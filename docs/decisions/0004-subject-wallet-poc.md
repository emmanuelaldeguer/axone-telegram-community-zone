# ADR 0004: subject-wallet assessments and separate anonymous control proof

Date: 2026-10-29. Status: architecture alignment implemented; strict economic
profile is a candidate pending explicit grace/freshness/funding decisions.
Follows [Chris's issue #873 comment](https://github.com/axone-protocol/contracts/issues/873#issuecomment-6441578159).

This supersedes the prototype-specific commitment binding, terminal
self-revocation, reserved-participant role and author-index dependency described
in ADR 0003. Their code/results remain historical experiments, not requirements.

Anyone may submit an assessment case identifying a subject wallet. The
constitution reads that wallet's bonded stake and native block time; gov
records author and constitutional provenance. Author is the submitter, not
the owner who will later prove entitlement. The Zone's Abstract account carries
governance capability; full installation/authorization still needs target tests.

The public entitled set uses the latest relevant decision **per subject**,
including refusal, under the target regime at an agreed height. It uses the
existing paginated Decisions query; no protocol index change is a prerequisite.
Current code reads complete bounded-budget history and fails on incomplete or
unsupported relevant data. The source is a trusted full node with strict
height/context checks, not a cryptographic state-proof implementation.

Later, a user answers a session-bound bot challenge with an anonymous proof of
control of a wallet in that set. No identity commitment is recorded on chain.
The proof mechanism is unselected; previous identity-membership experiments do
not establish wallet control. Assessment and presentation remain temporally
independent.

The first stateless native candidate is explicitly named
`telegram_publish_strict_v1`: 72-hour positive qualification, immediate refusal
on fresh insufficient stake, no grace. The historical 72-hour grace policy is
retained unchanged and must not be silently treated as implemented by this
candidate. Selecting/porting grace, maximum accepted snapshot age, common lease
duration and renewal funding are policy gates before integration/deployment.

Develop against pinned current main interfaces; v16 is needed for the full
dendrite-2 demonstration, not a prerequisite to local implementation. No public
deployment or Telegram permission change is authorized by this work.
