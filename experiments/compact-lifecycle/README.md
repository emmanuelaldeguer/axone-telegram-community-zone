# Compact native lifecycle: reconstructed checkpoint

**Historical experiment, not the current PoC target.**
[ADR 0004](../../docs/decisions/0004-subject-wallet-poc.md) removes the commitment
and author-index requirements. The [subject-wallet candidate](../subject-wallet/README.md)
uses unmodified gov and existing paginated Decisions instead. This experiment's
native workflow is manual-only; its results do not validate the new candidate.
Recovery hashes refer to commit `b308523`, not later changes to the shared
harness. The current subject profile has its own validation record and workflow.

Date: 2026-10-28. Base Git commit:
`f71574913dbc9e7cef3d3bde3d7b186139ef12b0`.

This checkpoint reconstructs unpublished source from the conversation after
workspace maintenance deleted the local project, build caches and raw reports.
**It does not recreate or claim recovery of the lost native evidence.**
The checkpoint is saved on branch `codex/restore-native-poc-2026-10-28`;
`main` remains unchanged. The [recovery validation](recovery-validation.json) distinguishes checks rerun
here from native/Rust checks requiring a new build.

## Recovered source and current validation

The readable [constitution](constitution.pl) is 3,089 template bytes; its
[compact form](constitution.compact.pl) is 2,577 template bytes. The compact
SHA-256 matches the value recorded in the earlier conversation:
`de346d7dd2b97574b292690e352901ae3aae97ec53444e402a5bd5cb945ceb0c`.
After replacing local address placeholders, the earlier runs reported 3,176 and
2,664 deployed bytes respectively. Those deployed source files and reports are
not present; use the native harness to regenerate them, not fabricated JSON.

The pure [differential suite](../../tools/prolog-smoke/compact_test.go) is rerun:
720 state/action/stake/time combinations per source form, 1,440 total, compared
with `evaluate/5`, with exactly one solution each. The existing TypeScript and
policy suites also pass. The previously agreed expired-eligibility guard is
restored: negative evidence at/after expiry cannot start new grace.

The earlier conversation reported 18 native participant decisions, six failed
committed transactions and six complete author page walks per source form, plus
80 Rust tests. **Those numbers are historical reported results, not fresh
validation of this recovery.** The [new CI workflow](../../.github/workflows/native-compact.yml)
rebuilds pinned sources and regenerates native evidence after publication. Its
addition does not mean it has already run.

## Architecture and profile

See [ADR 0003](../../docs/decisions/0003-axone-gov-native-poc.md). Economic rules
remain in Prolog. The [generic author-index patch](author-index.patch) against
contracts `017fed78601ac6e4a3a1fa119a5829c18e063ba8` retrieves original decisions,
including denied ones, with ordered exclusive cursors. It marks complete
coverage only for fresh instances and refuses unsupported/missing legacy
coverage. It does not decide economic eligibility. No backfill is implemented.

The constitution accepts one namespace/deployment and reserves an administration
wallet which cannot qualify as a participant. Participant verdicts carry the
complete state, including refusals and unrelated requests. State is
`s(Binding,Status,GraceStart,Expiry)`; the versioned verdict is
`entitlement_v1(Author,Parent,Event,State)`.

Only symbolic commitments `c1` and `c2` are supported. Active stake threshold is
1,000,000,000 `uaxone`, qualification validity and grace are 259,200 seconds.
Accepted binding cannot change; economic disqualification permits later
qualification with the same binding, while self-revocation is terminal.
Native evidence failure aborts without extending old rights. Large decimal-atom
balances, role overlap, real commitment ownership, migration and recovery are
not implemented. Revision other than 1 disables the participant profile.

The native harness uses a temporary local node and generated keys only. It
asserts default Logic limits of 5,000 bytes and 100,000 variables without editing
them. It tests native delegation/unbonding, forged case claims, commitment
substitution, revocation persistence, non-resetting grace, failed-transaction
isolation and independent pagination/reference/hash checks. It uses direct
fixture instantiation, not the production Abstract installation route. Temporary
bootstrap is permissive and must never be deployed publicly. No ZK, real secret
enrollment, Telegram effect or public deployment is established by this profile.

## Reproduce fresh evidence

The [build script](../../tools/build-compact-constitution.py) removes layout and
comments only, without term/variable renaming. It is optional: the readable
constitution also fits the previous runs' default size limit.

```sh
python tools/build-compact-constitution.py --source experiments/compact-lifecycle/constitution.pl --output /tmp/compact.pl
cmp /tmp/compact.pl experiments/compact-lifecycle/constitution.compact.pl
npm ci
npm run ci
```

With Go 1.27.0, Rust 1.85.0, wasm32 target and Binaryen 133, use the workflow or
build axoned at `5570d4c6652eed7598bbe68e0189cca68a79a3c4` and apply the author
index patch to contracts at its pin. Then:

```sh
go build -p 2 -tags netgo -o /tmp/axoned-native ./cmd/axoned
```

From the clean pinned contracts checkout:

```sh
git apply /absolute/path/to/author-index.patch
cargo test --locked -p axone-gov --lib --test integration
cargo clippy --locked -p axone-gov --lib -- -D warnings
RUSTFLAGS='-C link-arg=--import-undefined' cargo build --locked --release --lib --target wasm32-unknown-unknown -p axone-gov
wasm-opt -Oz -aimfs 0 -fimfs 0 -ocimfs 0 -pii 0 target/wasm32-unknown-unknown/release/axone_gov.wasm -o /tmp/indexed-gov.wasm
```

From this project root, run both profiles sequentially:

```sh
python tools/native-compact-smoke.py --axoned /tmp/axoned-native --gov-wasm /tmp/indexed-gov.wasm --report /tmp/compact-native.json
python tools/native-compact-smoke.py --axoned /tmp/axoned-native --gov-wasm /tmp/indexed-gov.wasm --readable --report /tmp/readable-native.json
```

Reports and resolved sources contain public test addresses, never secret
phrases. The native node and temporary keyring are removed even after failure.
The inspected main source pin is not an approved v16 release, nor evidence that
dendrite-2 has been upgraded. Public target validation and anonymous enrollment
remain separate work.
