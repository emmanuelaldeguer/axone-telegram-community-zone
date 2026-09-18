# Architecture

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
