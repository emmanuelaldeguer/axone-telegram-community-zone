import test from 'node:test';
import assert from 'node:assert/strict';
import { ChallengeVerifier, membershipTree, walletWitness, publicInputs, encodeAddress, addressBytes, SCHEME } from '../protocol.mjs';
import { fixtureSnapshot } from '../fixture.mjs';

const fixture = await fixtureSnapshot();
const circuitId = 'ab'.repeat(32);
const auth = { session: 'authenticated-session', audience: 'bot/app' };
const proof = Buffer.alloc(32).toString('base64');
// Lifecycle tests stub the cryptographic verifier; prove.mjs uses real proofs.
function setup(verifyProof = async () => true, ttl = 60) {
  let time = 1000;
  const verifier = new ChallengeVerifier({ circuitId, verifyProof, now: () => time, challengeTtlSeconds: ttl, minimumAnonymitySet: 2 });
  const view = verifier.approveSnapshot(fixture.snapshot);
  const challenge = verifier.issue({ ...auth, viewId: view.viewId });
  const envelope = { scheme: SCHEME, circuitId, challengeId: challenge.challengeId, proof };
  return { verifier, view, challenge, envelope, setTime: n => { time = n; } };
}

test('tree is common and independent of member order; each real member has an eight-level path', () => {
  const members = [...fixture.snapshot.members];
  const a = membershipTree(members), b = membershipTree(members.reverse());
  assert.equal(a.root, b.root);
  assert.equal(a.path(members[0]).siblings.length, 8);
  assert.equal(a.path(members[0]).positions.length, 8);
});
test('duplicate, empty and over-capacity membership sets are rejected', () => {
  const w = fixture.snapshot.members[0];
  assert.throws(() => membershipTree([w, w]), /Duplicate/);
  assert.throws(() => membershipTree([]));
  assert.throws(() => membershipTree(Array(257).fill(w)));
});
test('all leaves validate canonical Axone bech32 checksums', () => {
  const w = fixture.snapshot.members[0];
  assert.throws(() => membershipTree([w.slice(0, -1) + (w.endsWith('q') ? 'p' : 'q')]));
  assert.throws(() => membershipTree([w.toUpperCase()]));
  assert.throws(() => membershipTree(['cosmos' + w.slice(5)]));
  assert.equal(encodeAddress(addressBytes(w)), w);
});
test('single-member snapshot cannot issue an anonymous challenge', () => {
  const { verifier } = setup();
  assert.throws(() => verifier.approveSnapshot({ ...fixture.snapshot, members: fixture.snapshot.members.slice(0, 1) }), /Anonymity/);
});
test('expired and not-yet-active snapshots cannot be approved', () => {
  const { verifier } = setup();
  assert.throws(() => verifier.approveSnapshot({ ...fixture.snapshot, window: { start: 1001n, end: 1600n } }), /unusable/);
  assert.throws(() => verifier.approveSnapshot({ ...fixture.snapshot, maxSnapshotAgeSeconds: 0n }), /unusable/);
});
test('signer adapter supplies ADR-036 text and checks returned key, signature and wallet', async () => {
  const { view, challenge } = setup(), { wallets, snapshot } = fixture;
  let sawText = false;
  const signer = { async signArbitrary(...args) {
    sawText = typeof args[2] === 'string' && args[2].startsWith('axone-private-publish-v1:');
    return wallets[0].signer.signArbitrary(...args);
  } };
  const input = await walletWitness({ ...wallets[0], signer, chainId: snapshot.source.chainId, members: [...snapshot.members], root: view.root, challenge: challenge.challenge });
  assert(sawText); assert.equal(input.pub_x.length, 32); assert.equal(input.signature.length, 64);
  const wrongSigner = { async signArbitrary() { return wallets[1].signer.signArbitrary(snapshot.source.chainId, wallets[1].wallet, `axone-private-publish-v1:${challenge.challenge}`); } };
  await assert.rejects(walletWitness({ ...wallets[0], signer: wrongSigner, chainId: snapshot.source.chainId, members: [...snapshot.members], root: view.root, challenge: challenge.challenge }), /wallet mismatch/);
});
test('client rejects a personalized or altered root before requesting a signature', async () => {
  let signed = false;
  await assert.rejects(walletWitness({ signer: { signArbitrary() { signed = true; } }, wallet: fixture.wallets[0].wallet,
    chainId: fixture.snapshot.source.chainId, members: [...fixture.snapshot.members], root: '00'.repeat(32), challenge: '11'.repeat(32) }), /root mismatch/);
  assert.equal(signed, false);
});
test('verifier supplies exact approved root and stored challenge as public inputs', async () => {
  let received;
  const f = setup(async data => { received = data; return true; });
  const result = await f.verifier.consume(f.envelope, auth);
  assert.deepEqual(received.publicInputs, publicInputs(f.view.root, f.challenge.challenge));
  assert.deepEqual(Object.keys(result).sort(), ['audience', 'leaseEndsAt', 'session', 'viewId']);
  assert.equal(result.leaseEndsAt, 1600);
});
test('wallet, public key, raw signature, index and client public inputs are rejected as fields', async () => {
  for (const key of ['wallet', 'publicKey', 'signature', 'memberIndex', 'publicInputs', 'verificationKey']) {
    const f = setup();
    await assert.rejects(f.verifier.consume({ ...f.envelope, [key]: 'anything' }, auth), /Unexpected fields/);
  }
});
test('expired challenge is rejected at the exact half-open boundary', async () => {
  const f = setup(); f.setTime(1060);
  await assert.rejects(f.verifier.consume(f.envelope, auth), /expired/);
});
test('verifier rechecks expiry after slow proof verification', async () => {
  let f; f = setup(async () => { f.setTime(1060); return true; });
  await assert.rejects(f.verifier.consume(f.envelope, auth), /expired/);
});
test('withdrawn view prevents use of previously issued challenges', async () => {
  const f = setup(); f.verifier.withdrawView(f.view.viewId);
  await assert.rejects(f.verifier.consume(f.envelope, auth), /withdrawn/);
});
test('withdrawal during verification prevents granting a lease', async () => {
  let f; f = setup(async () => { f.verifier.withdrawView(f.view.viewId); return true; });
  await assert.rejects(f.verifier.consume(f.envelope, auth), /expired/);
});
test('expired view cannot issue new challenges', () => {
  const f = setup(); f.setTime(1600);
  assert.throws(() => f.verifier.issue({ ...auth, viewId: f.view.viewId }), /unavailable/);
});
test('session and audience mismatch leave the legitimate challenge usable', async () => {
  const f = setup();
  await assert.rejects(f.verifier.consume(f.envelope, { ...auth, session: 'other' }), /session mismatch/);
  await assert.rejects(f.verifier.consume(f.envelope, { ...auth, audience: 'other' }), /session mismatch/);
  await f.verifier.consume(f.envelope, auth);
});
test('simultaneous consumption is atomic within the research process', async () => {
  const f = setup();
  const r = await Promise.allSettled([f.verifier.consume(f.envelope, auth), f.verifier.consume(f.envelope, auth)]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
});
test('invalid proof burns its challenge and cannot be retried', async () => {
  const f = setup(async () => false);
  await assert.rejects(f.verifier.consume(f.envelope, auth), /Invalid/);
  await assert.rejects(f.verifier.consume(f.envelope, auth), /session mismatch/);
});
test('unknown circuit or scheme cannot reach cryptographic verification', async () => {
  let reached = false; const f = setup(async () => { reached = true; return true; });
  await assert.rejects(f.verifier.consume({ ...f.envelope, circuitId: '00'.repeat(32) }, auth), /scheme/);
  await assert.rejects(f.verifier.consume({ ...f.envelope, scheme: 'non-zk' }, auth), /scheme/);
  assert(!reached);
});
test('proof encoding and bounded size are checked', async () => {
  const f = setup();
  for (const bad of ['', '***', proof + '\n', Buffer.alloc(31).toString('base64'), 'a'.repeat(262145)]) {
    await assert.rejects(f.verifier.consume({ ...f.envelope, proof: bad }, auth), /proof/);
  }
});
test('independent sessions get distinct nonces and challenges', () => {
  const f = setup(); const other = f.verifier.issue({ ...auth, session: 'second', viewId: f.view.viewId });
  assert.notEqual(f.challenge.challengeId, other.challengeId); assert.notEqual(f.challenge.challenge, other.challenge);
});
test('challenge TTL must be explicit and bounded', () => {
  for (const ttl of [undefined, 0, -1, 301, NaN, 1.5]) assert.throws(() => new ChallengeVerifier({
    circuitId, verifyProof: async () => true, challengeTtlSeconds: ttl, minimumAnonymitySet: 2,
  }));
});
