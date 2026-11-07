# ADR 0005: anonymous wallet control with ADR-036 and Noir

Date: 2026-11-07. Status: selected for isolated research, not production.
Extends ADR 0004; no public deployment or Telegram enforcement.

## Choice

Use an existing wallet's off-chain ADR-036 signature as a **private witness**
in Noir. Verify the signature, derive the same wallet's canonical Axone address,
and prove private membership in the approved entitlement tree. Generate a
randomized UltraHonk proof with BB's explicit `verifierTarget: 'evm'` ZK option.
The bot verifies off chain; this target requires no EVM deployment or contract.

| Alternative | Assessment |
| --- | --- |
| Raw wallet signature to bot | Identifies the qualifying wallet. |
| Semaphore identity membership alone | Does not prove control of a wallet in the decision-derived set; still requires a bridge. |
| Blind credential issuer | Adds an issuer and qualification/lifecycle trust. |
| Wallet-key ring signature | Cannot assume existing wallets expose ring signing; no seed export is acceptable. |
| ADR-036 signature private inside ZK | Selected for research: documented signing interface and one control/address/membership relation. Real wallet support remains to validate. |

## Relation and source binding

Only the 32-byte membership root and 32-byte challenge digest are public:
64 byte-valued public field elements. The circuit:

1. Compresses the private secp256k1 point using X and Y parity.
2. Derives `RIPEMD160(SHA256(compressed_public_key))`, the Cosmos account payload.
3. Encodes it as canonical `axone` bech32, checksum included.
4. Reconstructs exact sorted Amino ADR-036 JSON with empty chain ID/memo,
   account/sequence `"0"`, zero fee, one `sign/MsgSignData` message and data equal
   to base64 of ASCII `axone-private-publish-v1:<64 lowercase hex challenge>`.
5. Verifies ECDSA/secp256k1 over SHA-256 of those 324 JSON bytes.
6. Verifies an eight-level SHA-256 Merkle path for **that derived address**.

The tree sorts canonical wallet strings, rejects duplicates/invalid checksums,
uses `SHA256(0x00 || address20)` leaves, `SHA256(0x01 || left32 || right32)`
nodes and `SHA256(0x02)` padding. Empty sets or more than 256 members fail.
Increasing capacity requires a new circuit/verifier, never truncation.
Address, key, signature, index and path stay private. No identity commitment or
wallet-derived nullifier is written on chain.

The bot must use the full member set from a trusted `buildWalletSnapshot`
result under its pinned source policy. `viewId` alone is not a Merkle root.
Approval is a trusted server operation, not a client manifest endpoint. The
client receives the same complete public set as everyone and computes its path
locally; never introduce a personalized path query. ZK proves membership in
the approved root, not chain-state correctness: ADR 0004's trusted-node boundary
remains. Latest refusals, constitution and expiry are enforced by the collector.

The challenge digest binds a fresh random 256-bit identifier, scheme/circuit ID,
audience, approved view ID/root, chain ID, regime and expiry. The view ID commits
to the source/constitution/common window. A server-side record binds the nonce
to the authenticated session; no Telegram ID enters the chain or signing doc.
The envelope permits only `scheme`, `circuitId`, `challengeId` and base64 `proof`.
The verifier supplies expected root/challenge and its fixed verification key;
the client cannot submit alternate public inputs, keys or artifacts.

Challenges are consumed synchronously before any verification await, preventing
concurrent replay within one process. Invalid verification burns the challenge.
Expiry and view approval are checked again after verification; leases are
bounded by the common entitlement/freshness window. Withdrawal stops pending
proofs; withdrawing already-granted external rights needs reconciliation.

## Evidence and limits

The real-proof harness uses ephemeral test wallets and synthetic decisions
passed through the actual snapshot collector, including a latest refusal.
It generates two randomized real ZK proofs for the same witness and verifies
them with a pinned key. It tests altered root/challenge/proof, mutated private
key/signature/path data, session/audience misuse and concurrent replay. Different
proof bytes are a regression check, not a formal privacy proof. Independent
known-answer vectors cover SHA-256 padding, RIPEMD-160, bech32 and ADR-036.
See the [experiment](../../experiments/wallet-control/README.md) and its report.

The separate stock-node/native REST workflow succeeded at commit
`5e705343a2266c1431492326c9fabfdfd8abf343`. A live chain-to-real-wallet-to-Telegram
ZK integration has **not** been demonstrated. The economic no-grace candidate,
source age, lease duration and renewal funding remain explicit policy gates.

Noir beta.18 and its upstream-pinned BB `3.0.0-nightly.20260102` form a deliberate
reproducible research baseline, not a latest-release/production-support claim.
SHA-256 padding is fully constrained around Noir's compression primitive.
RIPEMD-160 is vendored unchanged with license and source hashes from Distributed
Lab commit `9bdaaa206316aee61c0fa24312d5413530ff7219`. This circuit has no
unconstrained helper. Compiler/backend primitives remain dependencies; the
circuit and software need independent cryptographic review. UltraHonk/KZG has
CRS/setup assumptions; eliminating a qualification issuer does not eliminate
cryptographic trust assumptions. Never use a `*-no-zk` proof target.

The Node harness uses a WASM engine; it is not a browser MiniApp. Node crypto and
Buffer plumbing still need browser adaptation. Real Keplr/Leap/hardware-wallet
signing, browser/mobile memory/time, audited source/view distribution, durable
shared challenge storage, rate/storage limits, Telegram authentication and
crash-safe moderation/permissions reconciliation remain unimplemented.
Private proving must remain on the user's device: a remote prover sees the
witness. No private-key argument exists outside the ephemeral test signer.

An explicit minimum anonymity set of at least two prevents trivial one-member
issuance but guarantees no practical anonymity. Public decision history, timing,
IP addresses, set size, targeted set partitions and endpoint/extension telemetry
may still correlate identity. Common view distribution needs review. Signatures
can be shared; non-transferability and one-person-one-account are not proved.

## Primary references

- [Keplr signArbitrary and ADR-036](https://docs.keplr.app/api/guide/sign-arbitrary)
- [Cosmos secp256k1 address derivation](https://github.com/cosmos/cosmos-sdk/blob/main/crypto/keys/secp256k1/secp256k1.go)
- [Pinned Noir ECDSA source](https://github.com/noir-lang/noir/blob/v1.0.0-beta.18/noir_stdlib/src/ecdsa_secp256k1.nr)
- [Noir release's BB pin](https://github.com/noir-lang/noir/blob/v1.0.0-beta.18/scripts/install_bb.sh)
- [Pinned BB ZK selection](https://github.com/AztecProtocol/aztec-packages/blob/v3.0.0-nightly.20260102/barretenberg/ts/src/barretenberg/backend.ts)
- [Vendored RIPEMD-160 source](https://github.com/distributed-lab/noir-ripemd160/tree/9bdaaa206316aee61c0fa24312d5413530ff7219)
