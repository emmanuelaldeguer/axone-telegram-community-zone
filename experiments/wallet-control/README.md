# Anonymous wallet-control research prototype

Executable research implementation of [ADR 0005](../../docs/decisions/0005-anonymous-wallet-control-research.md):
a private ADR-036 signature establishes control of an Axone secp256k1 wallet;
the same address must belong to an approved decision-derived Merkle set.
Real ZK proofs are generated locally. No MiniApp or Telegram deployment exists.

## Reproduce (Linux x86_64, Node 24)

From the repository root:

```bash
npm ci
npm run build
npm ci --ignore-scripts --prefix experiments/wallet-control
python experiments/wallet-control/install-nargo.py
export PATH="$PWD/.work-cache/noir:$PATH"
cd experiments/wallet-control
node check-toolchain.mjs
cd circuit
nargo compile --deny-warnings
nargo test --deny-warnings
cd ..
npm test
npm run prove
```

The bootstrap checks the official pinned compiler archive's SHA-256. On other
platforms install exact Noir beta.18 using official tooling. Check versions
before compiling; compiler/runtime/backend must move together. The BB engine
fetches a proving CRS on first use; internet and substantial RAM are needed.
Generated circuit files are ignored and recreated from reviewed sources.

`npm test` tests lifecycle/presentation rules with a stubbed cryptographic
verifier. `npm run prove` separately generates and verifies two real ZK proofs
using WASM, a synthetic decision source and ephemeral test wallets. The real
snapshot collector processes those decisions, including a latest refusal.
Only summary evidence is saved to `reports/local-zk.json`, not witnesses,
signatures or keys. This does not claim a live chain or extension signing test.

## Integration boundary

`walletWitness` accepts `signer.signArbitrary(chainId, wallet, text)`, matching
the documented Keplr interface. No private-key argument is required. The key
and ordinary signature stay local as private witness data. Do not send them to
a bot/API or hosted prover. `fixture.mjs` is an ephemeral test signer only.

Only trusted server code may call `ChallengeVerifier.approveSnapshot` with a
`buildWalletSnapshot` result and pinned policy. It is not a public manifest
endpoint. Clients fetch the complete common set, verify its root, and derive
paths locally. Future clients must validate the published source/view policy
and display signing context.

The presentation permits only:

```json
{
  "scheme": "axone-adr036-hash160-merkle8-ultrahonk-zk-v1",
  "circuitId": "<approved circuit/key fingerprint>",
  "challengeId": "<fresh server-issued identifier>",
  "proof": "<canonical base64 ZK proof>"
}
```

The verifier provides expected public inputs and its own fixed key. The 64
public fields encode just the common root and fresh digest. No wallet, raw key,
signature, index or individual decision ID is transmitted in this envelope.
Eight-level trees support at most 256 members. Empty/over-capacity sets fail;
the configured anonymity minimum is explicitly at least two. Fixture TTL and
windows are test values, not deployment policy.

`zk.mjs` explicitly selects BB's ZK `evm` target. Verification is off chain;
no EVM contract is involved. Circuit identity fingerprints bytecode, ABI,
versions, target and verification key. Non-ZK proof modes are prohibited.

Pending: independent review, real wallet signing, browser/mobile performance,
trusted common-view distribution, shared durable challenge storage, Telegram
authentication, permission reconciliation and live-chain integration. Node
crypto/Buffer plumbing still needs a browser adapter around the WASM engine.
See ADR 0005 for CRS/setup, chain-source trust and metadata-correlation limits.
