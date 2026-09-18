# ADR 0001: Progressive Zone integration

- **Status:** Accepted
- **Date:** 2026-09-03

## Context

The project is both a functional community tool and a learning exercise. Building wallet authentication, Telegram enforcement and on-chain Axone qualification simultaneously would obscure the protocol boundaries and make failures difficult to diagnose.

## Decision

Implement the project in progressive milestones. Begin with a read-only staking qualification prototype. Add the Telegram adapter only after blockchain reads are validated. Add wallet-control proof before permission enforcement. Move the regime and qualification into Axone only after the off-chain flow is understood and tested.

## Consequences

- Early versions are deliberately incomplete.
- The first policy file is descriptive and not yet on-chain.
- Telegram remains an external effect adapter.
- The architecture is designed so off-chain qualification logic can later be replaced by an Axone-governed decision without rewriting every integration.
