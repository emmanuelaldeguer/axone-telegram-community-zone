# Axone Telegram Community Zone

Experimental implementation of an Axone-governed Telegram community. The
project explores how an explicit regime can qualify wallet evidence and grant
or remove the right to publish in a Telegram group.

> **Status:** learning project and pre-production prototype. It does not yet
> represent an official production service and must not be connected to the
> official Axone Telegram group.

## Why this project?

The project turns a simple community rule into a governed act:

| Axone concept | Telegram application |
| --- | --- |
| Actor | Telegram user linked to an Axone wallet |
| Act | Request the right to publish |
| Evidence | Wallet control and active delegation amount |
| Regime | Public, versioned eligibility rules |
| Qualification | `eligible`, later `grace_period`, or `read_only` |
| Decision | Grant, maintain, or remove publishing access |
| Effect | Telegram member permissions are updated |

## Current milestone

Milestone 1 — active staking qualification — is complete.

The prototype can now:

- query all active staking delegations for an Axone address;
- follow Cosmos SDK pagination;
- aggregate delegations across multiple validators;
- apply a configurable threshold;
- return `eligible` or `read_only`.

The implementation has been validated against live Axone networks:

Canonical network endpoints used by the project are documented in
[`docs/development-guide.md`](docs/development-guide.md) and follow the network
definitions published in `axone-protocol/contracts`.

A mainnet validation with 11 active validator delegations was independently
cross-checked against the Cosmos SDK REST response and produced the same
aggregate staking amount.

The project remains read-only. It does not yet prove wallet ownership, interact
with Telegram, submit transactions, or execute the draft regime on-chain.

The next milestone is **Milestone 2 — regime formalisation**: define the actors,
acts, evidence, qualification rules, decisions and effects precisely, then
validate how that regime should be expressed and executed through Axone.

## Quick start

Requirements:

- Node.js 24 or newer;
- an Axone LCD/REST endpoint.

Install the development tools and create the local configuration:

```bash
npm install
cp .env.example .env
```

Set `AXONE_REST_URL` in `.env`, then query an address:

```bash
npm run stake -- axone1...
```

The command returns the total active delegation in `uaxone`, the number of
validator delegations, the configured threshold, and the resulting status.

Run the checks:

```bash
npm run ci
```

## Agreed lifecycle parameters

| Parameter | Initial value |
| --- | ---: |
| Qualification validity | 72 hours |
| Automatic verification | Every 24 hours |
| Grace period | 72 hours |
| Unbonding delegation | Not counted |

The economic threshold is intentionally undecided and remains configurable.

## Documentation

- [Architecture](docs/architecture.md)
- [Zone model](docs/zone-model.md)
- [Development guide](docs/development-guide.md)
- [Security and privacy](docs/security-and-privacy.md)
- [Roadmap](docs/roadmap.md)
- [Architecture decisions](docs/decisions/0001-progressive-zone-integration.md)

## Important limitations

- The address check is only a preliminary format check, not complete Bech32
  checksum validation.
- Entering an address does not prove ownership; signature verification is a
  later milestone.
- The policy file is a draft model and is not yet executed on-chain.
- Telegram remains an external enforcement system. Axone can govern a decision,
  but a bot must apply it through Telegram's API.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

