# Roadmap

## Milestone 1 — Active staking qualification

- [x] load REST endpoint and threshold from configuration;
- [x] query Cosmos SDK staking delegations;
- [x] follow pagination;
- [x] sum active `uaxone` delegation balances;
- [x] return `eligible` or `read_only`;
- [x] unit-test threshold and pagination behaviour;
- [x] validate against live Axone networks and independently cross-check REST results.

**Status: completed.**

Validation was performed against both Axone testnet (`axone-dendrite-2`) and
mainnet (`axone-1`). A mainnet account with 11 active delegations confirmed
that the implementation correctly aggregates staking across multiple validators.
The aggregate returned by the TypeScript implementation matched an independent
sum of the Cosmos SDK REST response.

## Milestone 2 — Regime formalisation

- [x] draft a simple Prolog policy;
- [ ] validate the exact Axone logical execution interface;
- [ ] model evidence and regime versioning;
- [ ] model `grace_period`, `suspended` and `exempt`.

## Milestone 3 — Telegram read-only integration

- [ ] sandbox Telegram group;
- [ ] bot commands `/start`, `/verify`, `/status`;
- [ ] no permission mutation yet.

## Milestone 4 — Wallet control

- [ ] Telegram Mini App authentication;
- [ ] nonce issuance and replay protection;
- [ ] Keplr/Axone signing flow;
- [ ] secure Telegram-wallet binding.

## Milestone 5 — Enforcement

- [ ] grant publishing rights;
- [ ] 24-hour re-check scheduler;
- [ ] 72-hour qualification validity;
- [ ] 72-hour grace period;
- [ ] automatic read-only transition and restoration;
- [ ] reconciliation loop.

## Milestone 6 — Axone Zone

- [ ] anchor regime/version in Axone;
- [ ] qualify evidence through the Zone;
- [ ] record privacy-preserving decision or issue credential;
- [ ] reduce backend to adapters.
