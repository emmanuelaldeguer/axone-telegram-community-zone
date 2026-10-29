# Subject-wallet PoC alignment

This candidate replaces the commitment/author-index direction following
[Chris's clarification on issue #873](https://github.com/axone-protocol/contracts/issues/873#issuecomment-6441578159).
Qualification and private presentation are separate operations. Anyone may
submit and normally fund an assessment of an existing subject wallet; that is
not proof that the submitter controls it. Control must be proved anonymously
later, for a fresh session-bound bot challenge. No such proof is implemented here.

## Native candidate, no upstream patch

[constitution.pl](constitution.pl) reads bonded staking for `subject`, not
`cw:tx.message.sender`. It validates a canonical 20-byte Axone wallet using the
native Bech32 library, reads native stake and block time, and records:

```prolog
wallet_entitlement_v1(telegram_publish_strict_v1,Subject,Status,At,Until)
```

The case contains only `intent`, `regime` and `subject` plus context injected by
gov. No commitment, claimed stake, previous state, Telegram ID or bot challenge
is accepted. The submitter cannot choose the verdict or invoke an arbitrary
revocation act. The admin may also submit an ordinary assessment; no exclusive
reserved-controller rule is imposed on participants. Governance authorization
remains a separate admin action; a special-looking RecordDecision does not
establish that an actual revision happened.

**Explicit policy boundary:** this is a strict, stateless assessment candidate:
at least 1,000,000,000 bonded `uaxone` yields 72-hour eligibility; below threshold
yields a recorded refusal immediately. It is **not** the historical 72-hour
grace regime. The old `evaluate/5` policy and its grace tests are retained
unchanged. Applying grace natively would require an authoritative previous-state
path under the existing interfaces. This choice is open before deployment;
the candidate must not be merged as a silent change to the intended economics.
Native evidence/query failure aborts the transaction, rather than manufacturing
a refusal or extending a grant. Decimal atom balances beyond int64 are compared
exactly; malformed or non-canonical amounts are rejected.

The predicate's qualification window, not a live stake reading at presentation,
governs the entitlement. A fresh snapshot can still contain a two-day-old grant
which remains within its 72-hour qualification validity. Snapshot freshness
does not imply a fresh economic assessment of every wallet.

## Complete snapshot through existing Decisions

[wallet-snapshot.ts](../../src/zone/wallet-snapshot.ts) traverses the existing
ascending `Decisions` endpoint at one agreed height, including refusals. It
checks canonical consecutive IDs, ordering, source height/time, payload hashes,
target namespace/schema, subject consistency and decision time/expiry. It then
selects the **latest relevant assessment per subject**, independently of author.
Read-only `Decide` output is never accepted as a recorded entitlement.
Other-regime and governance records do not replace that assessment; unknown
target acts/schemas make the view unavailable rather than enabling old-grant
fallback. Latest records from an unsupported constitutional version grant no
rights. No `DecisionsByAuthor` query, custom membership registry or new contract
is required.

An exact-full page is followed by another page, even when it ends in an empty
tail. A failed page, nonterminating/repeated cursor, missing middle record or
exhausted page budget causes an error; no partial membership set is returned.
Safe JSON integer limits are enforced, never rounded. A provider lying about
the final end of its history is not detected cryptographically: the source is
an explicitly trusted full node, not a state-proof verifier.

[gov-rest-source.ts](../../src/zone/gov-rest-source.ts) requests historical state
with the Cosmos height header, requires a matching response-height receipt
(including the gateway metadata variant), and checks the block and immutable
contract-code checksum. The block context is re-read after pagination to detect
drift. A proxy omitting historical-height metadata is rejected. Local transport
tests are synthetic; the native workflow exercises the actual node REST route.

Every caller must configure a common activation window, maximum snapshot age
and maximum rights lease. There are no hidden production defaults. Members
must remain eligible for the **entire common window**, ending no later than the
source freshness deadline. The returned source/window/member set is immutable.
`assertSnapshotUsable` checks an already trusted built view at verification
time; it is not validation of an arbitrary incoming proof or manifest.
The verifier must supply its own trusted current time, not a presentation's
claimed timestamp.

The public set is canonical and shared, not selected in response to a Telegram
user. `viewId` is a SHA-256 manifest fingerprint, **not a Merkle root, membership
proof, signature or chain-authentication proof**. A bot must reconstruct/approve
the actual view and bind a selected cryptographic statement to it. A later
refusal may be invisible to an older accepted snapshot within its allowed
staleness; source freshness and the external lease bound that delay. Telegram
permission expiry/reconciliation is still unimplemented.

## Funding, policy and cryptography gates

- Current native fixture renewal is manual. The transaction submitter pays
  ordinary fees; no daily scheduler, community funding pool, fee grant or
  guaranteed renewal budget is implemented.
- Approve qualification validity and whether the strict candidate or historical
  grace rule is intended. Snapshot-age and lease values are required inputs.
  Native tests use 60-second age/30-second lease **only as fixture settings**.
- Select and validate proof of **control of an entitled wallet**, not merely
  knowledge of an unrelated identity secret. See the
  [proof acceptance contract](../../docs/wallet-control-proof-contract.md).
- Validate the production Abstract governance/authorization route, code/revision
  transitions and chain authentication. This does not claim that v16 has been
  released or dendrite-2 upgraded.

## Validation and source pins

The Go interpreter tests cover threshold boundaries, large native decimal-atom
balances and invalid encodings. TypeScript tests cover subject/payer separation,
latest refusal, unrelated acts, pagination completeness, malformed relevant
records, expired grants, source/version changes, historical-height receipts,
immutable common windows and bounded freshness/lease checks.

Run `npm run ci`. Native validation is separately provided by
[native-wallet.yml](../../.github/workflows/native-wallet.yml). It builds the
functional mains observed on 2026-10-29:

- axoned `5570d4c6652eed7598bbe68e0189cca68a79a3c4`;
- contracts `3fa1f29e76b263bc40c30618ddbbc135ccd9bbae`, **unmodified**.

The native harness makes eight third-party assessments, including real stake
acquisition/loss, rejects seven malformed or unauthorized acts without writing
records, and rebuilds the fixed-height set through REST with multi-page
`Decisions`. It uses direct fixture gov instantiation and temporary generated
keys, not production Abstract installation or any existing wallet. A temporary
permissive bootstrap is local-only and must not be publicly deployed.

The [validation record](validation.json) distinguishes locally executed checks
from native workflow checks. Configuration of a workflow does not mean it has
passed. The old commitment/index experiment remains historical and manual-only;
its earlier results do not validate this new profile.
