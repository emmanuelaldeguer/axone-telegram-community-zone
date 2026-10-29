# Architecture

## Current native direction

[ADR 0004](decisions/0004-subject-wallet-poc.md) is the current architecture:
anyone may submit and fund an assessment of a subject wallet; the constitution
queries that wallet's native stake. A fixed-height snapshot uses the latest
relevant assessment per subject, including refusals, through existing Decisions
pagination. No on-chain identity commitment or author index is required.
Anonymous control of a wallet in that set remains an unimplemented proof step.

The [new strict profile](../experiments/subject-wallet/README.md) is explicitly
separate from the unchanged historical grace policy. Snapshot age, leases,
funding and grace must be agreed before production integration. The following
ADR 0003 paragraph records the superseded recovery prototype.

[ADR 0003](decisions/0003-axone-gov-native-poc.md) previously superseded the older
wallet/Telegram verification-service sketch below. Constitution evaluation and
recorded gov decisions are the native authority. Anonymous presentation to the
bot must not reveal a wallet, commitment or individual record identifier.

The [reconstructed compact prototype](../experiments/compact-lifecycle/README.md)
reserves a separate controller and uses symbolic commitments. Prior native
reports were lost; fresh native revalidation is provided as CI, not claimed as
already completed by recovery. The remaining sections record earlier milestones.

## Purpose

This project progressively turns a staking-gated Telegram discussion group into an Axone-governed community Zone.

## Target components

1. **Telegram Mini App** authenticates the Telegram user, connects a wallet and requests a nonce signature.
2. **Verification service** validates Telegram identity, wallet control and active Axone delegations.
3. **Axone Zone** defines the public regime and qualifies the submitted evidence.
4. **Telegram bot** applies the decision by changing member permissions.

Telegram is an external enforcement system. A Zone decision and the resulting Telegram permission change cannot be fully atomic, so a reconciliation loop is required.

## Current milestone

Only the read-only staking qualification path exists:

```text
Axone address
    |
    v
Cosmos SDK REST / staking delegations
    |
    v
sum active uaxone
    |
    v
configurable threshold
    |
    +--> eligible
    +--> read_only
```

No Telegram API call, wallet signature or on-chain execution is part of Milestone 1.
