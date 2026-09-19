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
mainnet (`axone-1`).

A mainnet account with 11 active delegations confirmed that the implementation
correctly aggregates staking across multiple validators.

The aggregate returned by the TypeScript implementation matched an independent
sum of the Cosmos SDK REST response.

---

## Milestone 2 — Regime formalisation

- [x] define the Community Zone purpose and governance boundary;
- [x] define actors, governed act, evidence, qualifications, decisions and effects;
- [x] formalise `unverified`, `eligible`, `grace_period` and `read_only`;
- [x] define 72-hour qualification validity;
- [x] define 72-hour grace-period semantics;
- [x] define 24-hour periodic re-evaluation principle;
- [x] define behaviour during temporary Axone infrastructure failure;
- [x] define qualification expiry during prolonged Axone unavailability;
- [x] keep Telegram moderation outside the Zone regime;
- [x] define decision cases A–K;
- [x] define policy invariants;
- [x] implement the regime as a Prolog policy;
- [x] execute the policy with the Axone Prolog VM;
- [x] implement automated tests for decision cases A–K;
- [x] test recovery after qualification expiry and Axone restoration;
- [x] integrate Prolog policy tests into the project CI;
- [x] validate the complete CI locally and through GitHub Actions.

**Status: completed.**

The Milestone 2 policy is implemented in:

```text
policies/telegram-community-zone.pl
```

The functional specification is documented in:

```text
docs/zone-model.md
docs/decision-cases.md
```

The policy is tested directly with the Axone Prolog VM through the Go test
harness located in:

```text
tools/prolog-smoke/
```

The project CI currently validates:

- 4 TypeScript tests;
- 12 Prolog/Axone VM tests.

A successful GitHub Actions run validates the complete test suite on every push
and pull request.

Regime version anchoring is intentionally deferred to the later Axone Zone
integration milestone.

---

## Milestone 3 — Telegram read-only integration

The objective of this milestone is to connect the prototype to Telegram without
yet changing user permissions.

The bot must be able to observe and explain qualification, but not enforce it.

- [ ] create a dedicated Telegram sandbox group;
- [ ] create and configure a Telegram bot;
- [ ] load Telegram credentials securely from environment configuration;
- [ ] implement `/start`;
- [ ] implement `/verify`;
- [ ] implement `/status`;
- [ ] associate a Telegram user with an Axone address provisionally;
- [ ] query active Axone staking through the existing staking adapter;
- [ ] evaluate qualification through the regime policy;
- [ ] return the qualification and decision to the user;
- [ ] persist minimal qualification state required for lifecycle testing;
- [ ] keep all Telegram permission mutation disabled;
- [ ] add automated tests for the Telegram adapter boundary;
- [ ] document the end-to-end read-only verification flow.

**Status: not started.**

At this stage, wallet ownership is not yet cryptographically proven.

The Telegram-to-Axone-address association is therefore provisional and suitable
only for sandbox testing.

No user must receive or lose Telegram publishing rights during Milestone 3.

---

## Milestone 4 — Wallet control

- [ ] Telegram Mini App authentication;
- [ ] nonce issuance;
- [ ] nonce expiry;
- [ ] replay protection;
- [ ] Keplr/Axone signing flow;
- [ ] signature verification;
- [ ] secure Telegram-to-wallet binding;
- [ ] integrate `wallet_control_verified` evidence into qualification;
- [ ] document privacy and security assumptions.

---

## Milestone 5 — Enforcement

- [ ] grant publishing rights to eligible actors;
- [ ] remove publishing rights from non-eligible actors;
- [ ] implement 24-hour automatic re-check scheduling;
- [ ] enforce 72-hour qualification validity;
- [ ] enforce 72-hour grace periods;
- [ ] automatically restore access after successful requalification;
- [ ] distinguish Zone-derived restrictions from administrator restrictions;
- [ ] ensure Axone eligibility never overrides Telegram administrator sanctions;
- [ ] implement reconciliation between desired Zone state and actual Telegram permissions;
- [ ] record enforcement events for auditability.

---

## Milestone 6 — Axone Zone integration

- [ ] define an explicit regime identifier and version;
- [ ] anchor the regime and its version in Axone;
- [ ] identify which evidence can be represented or referenced through Axone;
- [ ] execute or reproduce qualification through the Axone Zone architecture;
- [ ] anchor qualification decisions or issue suitable credentials;
- [ ] define privacy-preserving evidence references;
- [ ] define decision provenance and opposability;
- [ ] reduce the application backend to evidence collection and external-system adapters where possible;
- [ ] document the final Actor → Evidence → Regime → Qualification → Decision → Effect lifecycle.