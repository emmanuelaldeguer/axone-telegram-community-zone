# Security and privacy

## Mandatory constraints

- Never store wallet private keys or mnemonics.
- Never commit secrets; use `.env` locally and a secret manager in deployment.
- Never publish raw Telegram user identifiers on-chain.
- Do not put Telegram message contents on-chain.
- Treat a REST/API outage as an inability to verify, not as evidence of ineligibility.
- Do not connect the prototype to the official Axone Telegram group before sandbox validation.

## Wallet linking

The future Telegram-to-wallet binding must use a one-time, short-lived nonce bound to the authenticated Telegram user and expected Axone address. Replay must be rejected.

## On-chain privacy

If a Telegram identity needs an on-chain reference, prefer a privacy-preserving commitment or a short-lived credential rather than a plaintext Telegram identifier.

A possible future credential is `AxoneTelegramContributor`.

## Enforcement reconciliation

Telegram permissions are external state. The system must periodically reconcile expected Zone decisions with actual Telegram member permissions and repair drift.
