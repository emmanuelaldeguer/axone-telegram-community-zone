// Ephemeral local test wallets only. Never connect this signer to a real account.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { buildWalletSnapshot, assessmentCase, STRICT_REGIME } from '../../dist/src/zone/wallet-snapshot.js';
import { sha256, publicKeyAddress, signDocBytes } from './protocol.mjs';

export function testWallet() {
  const secret = secp256k1.utils.randomSecretKey();
  const key = secp256k1.getPublicKey(secret);
  const wallet = publicKeyAddress(key);
  return {
    wallet,
    signer: { async signArbitrary(chainId, address, message) {
      if (chainId !== 'local-zk-fixture' || address !== wallet) throw Error('Fixture signer mismatch');
      const challenge = Buffer.from(message).toString().split(':')[1];
      return { pub_key: { type: 'tendermint/PubKeySecp256k1', value: Buffer.from(key).toString('base64') },
        signature: Buffer.from(secp256k1.sign(sha256(signDocBytes(wallet, challenge)), secret, { prehash: false })).toString('base64') };
    } },
  };
}

export async function fixtureSnapshot({ now = 1000, wallets = [testWallet(), testWallet(), testWallet()], refuseLast = false } = {}) {
  const hash = (s) => sha256(Buffer.from(s)).toString('base64');
  const context = { chainId: 'local-zk-fixture', height: 10n, hash: 'cd'.repeat(32), time: BigInt(now), govAddress: 'gov-fixture', codeChecksum: 'ab'.repeat(32) };
  const constitutionHash = hash('strict-fixture');
  const policy = { ...context, constitutionRevision: 1n, constitutionHash, maxSnapshotAgeSeconds: 600n, maxLeaseSeconds: 600n, pageLimit: 2, maxPages: 20 };
  function row(id, subject, eligible = true) {
    const at = now - 1, c = assessmentCase(subject);
    const verdict = `wallet_entitlement_v1(${STRICT_REGIME},${subject},${eligible ? 'eligible' : 'read_only'},${at},${eligible ? at + 259200 : at})`;
    return { decision_id: id, author: 'independent-fee-payer', case: c, case_hash: hash(c), verdict, verdict_hash: hash(verdict),
      motivation: null, motivation_hash: null, constitution_revision: 1, constitution_hash: constitutionHash, block_height: 8, block_time_seconds: at };
  }
  const rows = wallets.map((w, i) => row(i + 1, w.wallet));
  if (refuseLast) rows.push(row(rows.length + 1, wallets.at(-1).wallet, false));
  const source = {
    async context() { return { ...context }; },
    async queryGov(request, height) {
      return { height, data: request.decisions
        ? { decisions: rows.filter(r => r.decision_id > (request.decisions.start_after ?? 0)).slice(0, request.decisions.limit) }
        : { constitution_revision: 1, constitution_hash: constitutionHash } };
    },
  };
  const snapshot = await buildWalletSnapshot(source, policy, 10n, { start: BigInt(now), end: BigInt(now + 600) }, BigInt(now));
  return { wallets, snapshot };
}
