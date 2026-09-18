# Development guide

## Principles

This repository is intentionally developed in small, testable milestones. Each milestone should remain understandable independently before adding another protocol or Telegram integration.

## Milestones

### 1. Read and qualify staking

Read all active delegations for an Axone address, aggregate them and apply a configurable threshold.

### 2. Formalise the regime

Define actors, acts, evidence, qualification, decisions and effects; then express the rule in Prolog and validate the appropriate Axone execution path.

### 3. Read-only Telegram bot

Implement `/start`, `/verify` and `/status`, without modifying Telegram permissions.

### 4. Wallet-control proof

Authenticate Telegram Mini App data, generate a one-use nonce, sign it with a supported Axone wallet and verify the signature.

### 5. Permission enforcement

Grant/revoke posting rights, implement renewal, grace-period handling and reconciliation.

### 6. Axone-governed Zone

Move regime ownership and qualification toward Axone. Keep the backend and Telegram bot as evidence and enforcement adapters.

## Local workflow

```bash
npm install
cp .env.example .env
npm run ci
npm run stake -- axone1...
```
