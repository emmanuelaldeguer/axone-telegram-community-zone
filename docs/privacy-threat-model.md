# Axone Telegram Community Zone — Privacy Threat Model

## Purpose

This document defines the privacy properties required by the Axone Telegram
Community Zone.

The primary objective is not to make Telegram users anonymous to Telegram or
Axone wallets anonymous on-chain.

The objective is to prevent the Community Zone from creating a durable or
trivially reconstructable link between:

```
Telegram identity
```

and:

```
Axone wallet address
```

This property is referred to in this project as Telegram–Axone unlinkability.

---

## 1. Identities involved

The system contains two distinct identity domains.

### Telegram identity

Telegram may know:

- Telegram user ID;
- Telegram username;
- group membership;
- messages and interactions with the bot.

This identity is required on the Telegram side to apply contributor permissions.

### Axone identity

The Axone network exposes:

- wallet address;
- staking delegations;
- validators;
- public on-chain activity.

This identity is required on the Axone side to evaluate staking qualification.

The Community Zone must not require these identities to be directly linked.

---

## 2. Core privacy invariant

The following mapping must never become a required application data model:

```
Telegram user <-> Axone wallet address
```

In particular:

- an Axone address must never be sent through Telegram;
- the Telegram bot must never receive an Axone address;
- Telegram-side storage must never contain an Axone address;
- Axone-side qualification must never require a Telegram user ID;
- logs must never contain both identities in the same correlation context;
- no on-chain record may expose a Telegram identity;
- qualification credentials must not reveal the underlying wallet address.

---

## 3. Privacy boundary

The architecture must separate two components.

### Axone-side qualifier

May know:

```
wallet address
wallet-control proof
staking evidence
regime parameters
qualification
```

Must not know:

```
Telegram user ID
Telegram username
Telegram group membership
Telegram messages
```

### Telegram-side verifier

May know:

```
Telegram user ID
qualification proof
qualification validity
regime identifier
regime version
```

Must not know:

```
Axone wallet address
staking amount
validator list
wallet-control signature
raw staking evidence
```

---

## 4. Desired qualification flow

Conceptually:

```
Axone wallet
     |
     v
prove wallet control
     |
     v
evaluate staking
     |
     v
eligible under regime
     |
     v
privacy-preserving credential
     |
     |  no wallet address
     v
Telegram-side presentation
     |
     v
verify qualification
     |
     v
contributor access
```

The qualification credential is the privacy boundary between the two systems.

---

## 5. Required privacy properties

### P1 — Wallet confidentiality from Telegram

The Telegram component must never learn the Axone wallet address used to obtain
qualification.

### P2 — Telegram confidentiality from the qualifier

The Axone-side qualifier must never learn which Telegram account will use the
qualification.

### P3 — No persistent identity mapping

The application must not store:

```
telegram_user_id -> axone_address
```

or the reverse mapping.

### P4 — Issuance/presentation unlinkability

A credential presented to Telegram should not allow the credential issuer to
trivially determine which issuance event produced that presentation.

Avoiding the wallet address inside the credential is not sufficient.

A unique credential identifier known to both issuer and verifier could recreate
the prohibited link.

### P5 — Minimal disclosure

The Telegram verifier should learn only what is required to enforce the regime.

Conceptually:

```
regime = telegram-community-zone
regime_version = ...
qualification = eligible | grace_period
valid_until = ...
```

It should not learn the underlying evidence.

### P6 — Replay protection

A captured qualification proof must not be reusable by an observer to obtain
access.

Replay protection must not require disclosure of the Axone wallet address.

### P7 — Expiry

Qualification must remain time-bounded.

A privacy-preserving credential must not extend qualification beyond the validity
defined by the regime.

### P8 — Logging discipline

Logs must not undermine protocol-level privacy.

In particular, production logs must avoid recording correlatable combinations of:

```
wallet address
credential identifier
Telegram user ID
request timing
```

---

## 6. Threat actors

### Other Telegram users

They must not be able to discover the Axone wallet associated with another
Telegram contributor.

### Telegram-side application

It must not learn the wallet used for qualification.

### Axone-side qualification service

It must not learn the Telegram identity that will consume the qualification.

### Application operator

The architecture should minimise the ability of the operator to reconstruct the
Telegram-to-wallet relationship from application data.

Protocol design should not rely solely on an organisational promise not to
perform correlation.

### Passive observer

A passive observer should not be able to derive the wallet-to-Telegram mapping
from public credentials or on-chain records.

---

## 7. Correlation risks

Even when identities are not explicitly stored together, correlation may remain
possible through:

- unique credential identifiers;
- identical identifiers during issuance and presentation;
- precise timestamps;
- IP addresses;
- request logs;
- shared backend sessions;
- analytics systems;
- wallet signatures containing Telegram-related data.

The architecture must minimise these correlation channels.

---

## 8. Explicit non-goals

The Community Zone does not attempt to:

- hide a Telegram user's identity from Telegram itself;
- hide an Axone wallet address or public staking activity from the blockchain;
- provide network-level anonymity against a global traffic observer;
- make blockchain activity private;
- guarantee anonymity if the user voluntarily reveals their wallet address.

These are outside the scope of the current prototype.

---

## 9. Credential requirements

Any credential mechanism considered for Milestone 4 must be evaluated against
the following questions:

1. Does the Telegram verifier learn the wallet address?
2. Does the issuer learn the Telegram identity?
3. Can issuance and presentation be correlated through a stable identifier?
4. Can the credential be replayed?
5. Can the credential be copied or transferred to another user?
6. Can qualification expiry be enforced?
7. Can the regime identifier and version be proven?
8. Can the proof be verified without querying the wallet from Telegram?
9. Can the mechanism operate without publishing Telegram identity on-chain?
10. What metadata remains available for correlation?

---

## 10. Candidate mechanisms

Candidate approaches to evaluate include:

- blind signatures;
- anonymous credentials;
- selectively disclosed credentials with unlinkable presentation;
- zero-knowledge proofs;
- combinations of these mechanisms.

No mechanism is selected yet.

The simplest implementation is not automatically the preferred one: the chosen
design must satisfy the privacy properties above without introducing unnecessary
cryptographic complexity.

---

## 11. Milestone 4 decision gate

No wallet-control or credential implementation should begin until the candidate
mechanisms have been compared against this threat model.

The selected architecture must document:

- what each component learns;
- what each component stores;
- what is transmitted;
- what is signed;
- what is revealed during presentation;
- how replay is prevented;
- how expiry is enforced;
- what correlation remains possible;
- which privacy guarantees are cryptographic and which are operational.