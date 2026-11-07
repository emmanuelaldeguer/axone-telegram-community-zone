import { createHash, randomBytes } from 'node:crypto';
import { bech32 } from '@scure/base';
import { secp256k1 } from '@noble/curves/secp256k1.js';

export const SCHEME = 'axone-adr036-hash160-merkle8-ultrahonk-zk-v1';
export const DEPTH = 8;
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest();
export const hex = (bytes) => Buffer.from(bytes).toString('hex');
export function fromHex(value, length) {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${length * 2}}$`).test(value)) throw Error('Invalid canonical hex');
  return Buffer.from(value, 'hex');
}
export function addressBytes(wallet) {
  const decoded = bech32.decode(wallet);
  const bytes = Buffer.from(bech32.fromWords(decoded.words));
  if (decoded.prefix !== 'axone' || bytes.length !== 20 || bech32.encode('axone', bech32.toWords(bytes)) !== wallet) throw Error('Unsupported wallet');
  return bytes;
}
export const encodeAddress = (bytes) => bech32.encode('axone', bech32.toWords(bytes));
export function publicKeyAddress(publicKey) {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 33 || ![2, 3].includes(publicKey[0])) throw Error('Expected compressed secp256k1 key');
  secp256k1.Point.fromBytes(publicKey).assertValidity();
  return encodeAddress(createHash('ripemd160').update(sha256(publicKey)).digest());
}

// Everyone builds the same complete tree locally; no personalized path request.
// Empty leaves are domain-separated from real addresses and internal nodes.
export function membershipTree(members) {
  if (!Array.isArray(members) || members.length === 0 || members.length > 2 ** DEPTH) throw Error('Expected 1..256 entitled wallets');
  const canonical = [...members].sort();
  if (new Set(canonical).size !== canonical.length) throw Error('Duplicate wallet');
  const leaves = canonical.map((wallet) => sha256(Buffer.concat([Buffer.from([0]), addressBytes(wallet)])));
  while (leaves.length < 2 ** DEPTH) leaves.push(sha256(Buffer.from([2])));
  const layers = [leaves];
  for (let level = 0; level < DEPTH; level++) {
    const prev = layers.at(-1), next = [];
    for (let i = 0; i < prev.length; i += 2) next.push(sha256(Buffer.concat([Buffer.from([1]), prev[i], prev[i + 1]])));
    layers.push(next);
  }
  return {
    root: hex(layers.at(-1)[0]),
    path(wallet) {
      let index = canonical.indexOf(wallet);
      if (index < 0) throw Error('Wallet is not entitled');
      const siblings = [], positions = [];
      for (let level = 0; level < DEPTH; level++) {
        siblings.push([...layers[level][index ^ 1]]);
        positions.push((index & 1) === 1);
        index >>= 1;
      }
      return { siblings, positions };
    },
  };
}

export function signingMessage(challenge) {
  fromHex(challenge, 32);
  return Buffer.from(`axone-private-publish-v1:${challenge}`, 'ascii');
}
export function signDocBytes(wallet, challenge) {
  addressBytes(wallet);
  // Cosmos Amino sorted JSON, recursively sorted keys, no whitespace.
  return Buffer.from(JSON.stringify({
    account_number: '0', chain_id: '', fee: { amount: [], gas: '0' }, memo: '',
    msgs: [{ type: 'sign/MsgSignData', value: { data: signingMessage(challenge).toString('base64'), signer: wallet } }],
    sequence: '0',
  }));
}
function base64(value, length) {
  if (typeof value !== 'string') throw Error('Invalid base64');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== length || bytes.toString('base64') !== value) throw Error('Invalid base64');
  return bytes;
}

// A local signer port matching Keplr signArbitrary. The raw signature/key never
// appear in the presentation. There is no private-key input on this API.
export async function walletWitness({ signer, chainId, wallet, challenge, members, root }) {
  fromHex(root, 32);
  const tree = membershipTree(members);
  if (tree.root !== root) throw Error('Membership root mismatch');
  const path = tree.path(wallet);
  const result = await signer.signArbitrary(chainId, wallet, signingMessage(challenge).toString('ascii'));
  exactKeys(result, ['pub_key', 'signature']);
  exactKeys(result.pub_key, ['type', 'value']);
  if (result.pub_key.type !== 'tendermint/PubKeySecp256k1') throw Error('Unsupported signing key');
  const publicKey = base64(result.pub_key.value, 33), signature = base64(result.signature, 64);
  if (publicKeyAddress(publicKey) !== wallet) throw Error('Signing wallet mismatch');
  if (!secp256k1.verify(signature, sha256(signDocBytes(wallet, challenge)), publicKey, { prehash: false, lowS: false })) throw Error('Invalid ADR-036 signature');
  const full = secp256k1.Point.fromBytes(publicKey).toBytes(false);
  return { root: [...fromHex(root, 32)], challenge: [...fromHex(challenge, 32)], pub_x: [...full.subarray(1, 33)], pub_y: [...full.subarray(33)], signature: [...signature], ...path };
}
export function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw Error('Unexpected fields');
}
export const publicInputs = (root, challenge) => [...fromHex(root, 32), ...fromHex(challenge, 32)].map((byte) => `0x${byte.toString(16).padStart(64, '0')}`);

// In-memory research adapter. Each process has its own atomic challenge store.
// Production requires a shared transactional store and Telegram reconciliation.
export class ChallengeVerifier {
  #pending = new Map();
  #views = new Map();
  constructor({ circuitId, verifyProof, now = () => Math.floor(Date.now() / 1000), challengeTtlSeconds, minimumAnonymitySet }) {
    fromHex(circuitId, 32);
    if (!Number.isSafeInteger(challengeTtlSeconds) || challengeTtlSeconds < 1 || challengeTtlSeconds > 300) throw Error('Invalid challenge TTL');
    if (!Number.isSafeInteger(minimumAnonymitySet) || minimumAnonymitySet < 2 || minimumAnonymitySet > 256) throw Error('Invalid anonymity minimum');
    this.circuitId = circuitId; this.verifyProof = verifyProof; this.now = now;
    this.ttl = challengeTtlSeconds; this.minimum = minimumAnonymitySet;
  }
  // Caller must obtain this view from trusted buildWalletSnapshot + policy.
  // No client-submitted manifest approval endpoint is provided.
  approveSnapshot(snapshot) {
    const now = BigInt(this.now());
    if (snapshot.members.length < this.minimum) throw Error('Anonymity set too small');
    if (now < snapshot.window.start || now >= snapshot.window.end || now < snapshot.source.time || now >= snapshot.source.time + snapshot.maxSnapshotAgeSeconds) throw Error('Snapshot unusable');
    fromHex(snapshot.viewId, 32);
    const root = membershipTree([...snapshot.members]).root;
    const end = Number(snapshot.window.end < snapshot.source.time + snapshot.maxSnapshotAgeSeconds ? snapshot.window.end : snapshot.source.time + snapshot.maxSnapshotAgeSeconds);
    if (!Number.isSafeInteger(end)) throw Error('Unsafe expiry');
    const view = Object.freeze({ root, viewId: snapshot.viewId, end, chainId: snapshot.source.chainId, regime: snapshot.regime });
    this.#views.set(view.viewId, view);
    return view;
  }
  withdrawView(viewId) { this.#views.delete(viewId); }
  issue({ session, audience, viewId }) {
    if (typeof session !== 'string' || !session || typeof audience !== 'string' || !audience) throw Error('Authenticated session and audience required');
    const view = this.#views.get(viewId), now = this.now();
    if (!view || now >= view.end) throw Error('View unavailable');
    const expiresAt = Math.min(now + this.ttl, view.end);
    const challengeId = hex(randomBytes(32));
    const challenge = hex(sha256(Buffer.from(JSON.stringify([SCHEME, this.circuitId, challengeId, audience, view.viewId, view.root, view.chainId, view.regime, expiresAt]))));
    this.#pending.set(challengeId, { session, audience, view, challenge, issuedAt: now, expiresAt });
    return Object.freeze({ scheme: SCHEME, circuitId: this.circuitId, challengeId, challenge, root: view.root, viewId, audience, expiresAt });
  }
  async consume(envelope, { session, audience }) {
    exactKeys(envelope, ['scheme', 'circuitId', 'challengeId', 'proof']);
    if (envelope.scheme !== SCHEME || envelope.circuitId !== this.circuitId) throw Error('Unexpected scheme/circuit');
    fromHex(envelope.challengeId, 32);
    const pending = this.#pending.get(envelope.challengeId);
    if (!pending || pending.session !== session || pending.audience !== audience) throw Error('Challenge/session mismatch');
    const valid = () => this.now() >= pending.issuedAt && this.now() < pending.expiresAt && this.now() < pending.view.end && this.#views.get(pending.view.viewId) === pending.view;
    if (!valid()) { this.#pending.delete(envelope.challengeId); throw Error('Challenge/view expired or withdrawn'); }
    if (typeof envelope.proof !== 'string' || envelope.proof.length > 262144) throw Error('Invalid proof size');
    const proof = Buffer.from(envelope.proof, 'base64');
    if (proof.length === 0 || proof.length % 32 || proof.toString('base64') !== envelope.proof) throw Error('Invalid proof encoding');
    // Synchronous deletion before any await prevents simultaneous consumption.
    // A failed verification burns the challenge; a fresh request is necessary.
    this.#pending.delete(envelope.challengeId);
    const ok = await this.verifyProof({ proof: new Uint8Array(proof), publicInputs: publicInputs(pending.view.root, pending.challenge) });
    if (!ok || !valid()) throw Error('Invalid or expired proof');
    return Object.freeze({ audience, session, viewId: pending.view.viewId, leaseEndsAt: pending.view.end });
  }
}
