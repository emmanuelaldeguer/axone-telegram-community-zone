import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fixtureSnapshot, testWallet } from './fixture.mjs';
import { ChallengeVerifier, walletWitness, SCHEME, publicInputs, sha256, hex } from './protocol.mjs';
import { createZk } from './zk.mjs';

const started = performance.now();
const artifactBytes = await readFile(new URL('circuit/target/axone_wallet_control.json', import.meta.url));
const artifact = JSON.parse(artifactBytes);
let clock = 1000;
const { snapshot, wallets } = await fixtureSnapshot({ now: clock, refuseLast: true });
const checks = [], timings = {};
async function check(name, action) { await action(); checks.push(name); console.log(`PASS ${name}`); }
console.log('Initializing explicit WASM ZK backend');
const beforeSetup = performance.now();
const zk = await createZk(artifact);
timings.setupMs = Math.round(performance.now() - beforeSetup);
try {
  const bot = new ChallengeVerifier({ circuitId: zk.circuitId, verifyProof: zk.verify, now: () => clock, challengeTtlSeconds: 120, minimumAnonymitySet: 2 });
  const approved = bot.approveSnapshot(snapshot);
  const auth = { session: 'authenticated-local-session', audience: 'local-test-bot' };
  const challenge = bot.issue({ ...auth, viewId: snapshot.viewId });
  const input = await walletWitness({ ...wallets[0], chainId: snapshot.source.chainId, challenge: challenge.challenge, members: [...snapshot.members], root: approved.root });
  await check('refused subject is absent despite an earlier positive decision', async () => {
    await assert.rejects(walletWitness({ ...wallets[2], chainId: snapshot.source.chainId, challenge: challenge.challenge, members: [...snapshot.members], root: approved.root }), /not entitled/);
  });
  await check('unentitled wallet is rejected', async () => {
    await assert.rejects(walletWitness({ ...testWallet(), chainId: snapshot.source.chainId, challenge: challenge.challenge, members: [...snapshot.members], root: approved.root }), /not entitled/);
  });
  console.log('Generating real ZK proof');
  const beforeProve = performance.now();
  const data = await zk.prove(input);
  timings.proveMs = Math.round(performance.now() - beforeProve);
  await check('valid proof verifies against pinned verification key', async () => assert(await zk.verify(data)));
  await check('modified challenge fails cryptographic verification', async () => {
    assert.equal(await zk.verify({ ...data, publicInputs: publicInputs(approved.root, '00'.repeat(32)) }), false);
  });
  await check('modified membership root fails cryptographic verification', async () => {
    assert.equal(await zk.verify({ ...data, publicInputs: publicInputs('00'.repeat(32), challenge.challenge) }), false);
  });
  await check('modified proof fails cryptographic verification', async () => {
    const proof = new Uint8Array(data.proof); proof[100] ^= 1;
    assert.equal(await zk.verify({ ...data, proof }), false);
  });
  const envelope = { scheme: SCHEME, circuitId: zk.circuitId, challengeId: challenge.challengeId, proof: Buffer.from(data.proof).toString('base64') };
  await check('extra identifying presentation field is rejected', async () => {
    await assert.rejects(bot.consume({ ...envelope, wallet: wallets[0].wallet }, auth), /Unexpected fields/);
  });
  await check('another authenticated session cannot consume the proof', async () => {
    await assert.rejects(bot.consume(envelope, { ...auth, session: 'other' }), /session mismatch/);
  });
  await check('another audience cannot consume the proof', async () => {
    await assert.rejects(bot.consume(envelope, { ...auth, audience: 'other' }), /session mismatch/);
  });
  await check('concurrent proof consumption succeeds exactly once', async () => {
    const results = await Promise.allSettled([bot.consume(envelope, auth), bot.consume(envelope, auth)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  });
  await check('replay fails', async () => { await assert.rejects(bot.consume(envelope, auth), /session mismatch/); });
  // ACVM rejection tests exercise circuit constraints, not just host checks.
  for (const [name, mutate] of [
    ['signature', v => { v.signature[0] ^= 1; }],
    ['private public key', v => { v.pub_x[0] ^= 1; }],
    ['address/public-key parity', v => { v.pub_y[31] ^= 1; }],
    ['Merkle sibling', v => { v.siblings[0][0] ^= 1; }],
    ['Merkle position', v => { v.positions[0] = !v.positions[0]; }],
    ['signed challenge', v => { v.challenge[0] ^= 1; }],
  ]) {
    await check(`invalid ${name} fails circuit execution`, async () => {
      const bad = structuredClone(input); mutate(bad);
      await assert.rejects(zk.execute(bad));
    });
  }
  // Two proofs for the same witness should differ in the selected ZK mode.
  console.log('Generating second proof for the identical private witness');
  const second = await zk.prove(input);
  await check('same-witness proofs are randomized and both verify', async () => {
    assert.notDeepEqual(data.proof, second.proof); assert(await zk.verify(second));
  });
  const report = { status: 'LOCAL_REAL_ZK_PROOF_PASS', date: new Date().toISOString(), scheme: SCHEME, circuitId: zk.circuitId,
    artifactSha256: hex(sha256(artifactBytes)), verificationKeySha256: hex(sha256(zk.verificationKey)),
    backend: 'Barretenberg WASM, one thread, verifierTarget=evm (ZK enabled)', noir: '1.0.0-beta.18', bb: '3.0.0-nightly.20260102',
    data: 'ephemeral test wallets and synthetic decision source passed through the actual snapshot collector; no live wallet/chain/Telegram session',
    publicInputFields: data.publicInputs.length, proofBytes: data.proof.length, members: snapshot.members.length, treeCapacity: 256,
    checks, timings: { ...timings, totalMs: Math.round(performance.now() - started) },
    pending: ['independent cryptographic review', 'real Keplr/Leap ADR-036 signing', 'browser/mobile proving performance', 'durable challenge store', 'live chain and Telegram integration'] };
  await mkdir(new URL('reports/', import.meta.url), { recursive: true });
  await writeFile(new URL('reports/local-zk.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: checks.length, proofBytes: report.proofBytes, timings: report.timings }));
} finally { await zk.destroy(); }
