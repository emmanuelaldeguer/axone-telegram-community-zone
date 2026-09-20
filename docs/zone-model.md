# Axone Telegram Community Zone — Regime Model

## Purpose

The Axone Telegram Community Zone governs one specific question:

> Is this actor currently entitled to contribute to the Axone Telegram community?

The Zone governs contributor eligibility only.

Content moderation, behavioural sanctions, message deletion, muting and banning remain
outside the Axone regime and under the authority of Telegram administrators.

---

## 1. Actor

The governed actor is a Telegram user requesting the right to contribute to the
Axone Telegram community.

The Community Zone must not identify this actor through an Axone wallet address
and must not persist a direct Telegram-to-wallet mapping.

The architecture distinguishes two privacy-separated roles:

### Telegram actor

The Telegram user requesting or maintaining contributor access.

The Telegram side may know the Telegram identity required to apply Telegram
permissions.

### Axone qualification subject

An Axone wallet or account whose wallet control and staking state are evaluated
under the Community Zone regime.

The Axone-side qualification process may know the wallet address, but it must not
require the Telegram identity.

The relationship between the Telegram actor and the Axone qualification subject
must not be directly exposed or persistently recorded.

A privacy-preserving qualification proof or credential must bridge the two sides
without revealing the underlying Axone wallet address to Telegram.

---

## 2. Governed act

The primary governed act is:

`request_contributor_access`

It represents:

> A request by an actor to obtain or maintain the right to contribute to the Axone Telegram community under the current Community Zone regime.

The regime does not govern individual Telegram messages.

It governs the right to contribute.

Periodic eligibility checks are treated as requalification of this same right rather than as separate user actions.

---

## 3. Evidence

The Community Zone uses evidence while preserving a strict privacy boundary
between Telegram identity and Axone wallet identity.

### 3.1 Telegram identity evidence

`telegram_identity_verified`

Demonstrates that the current request originates from the relevant Telegram user.

This evidence exists only on the Telegram side.

It must not contain or reference an Axone wallet address.

### 3.2 Qualification presentation evidence

`qualification_proof_valid`

Demonstrates that the Telegram actor presents a valid qualification under the
Community Zone regime.

The exact cryptographic mechanism is not yet selected.

A future proof or credential must allow the Telegram side to verify information
such as:

```text
regime = telegram-community-zone
regime_version = ...
qualification = eligible | grace_period
valid_until = ...
```

without revealing:

```text
wallet = axone1...
```

The presentation mechanism must also provide suitable replay protection and
should minimise correlation between credential issuance and presentation.

### 3.3 Upstream wallet-control evidence

`wallet_control_verified`

Demonstrates control of the Axone account used for qualification.

This evidence belongs to the Axone-side qualification process.

It must not contain a Telegram identifier and must not be transmitted to the
Telegram bot.

The planned mechanism is a signed, time-limited challenge.

Not implemented yet.

### 3.4 Upstream active staking evidence

`active_delegation_amount`

Represents the total active delegation amount of the Axone qualification subject.

Delegations across all validators are aggregated.

Delegations currently unbonding are not counted.

This evidence is already implemented and validated in Milestone 1.

Raw staking evidence must remain on the Axone side and must not be exposed to
Telegram.

### 3.5 Evidence boundary

The Telegram side consumes qualification evidence, not wallet evidence.

Conceptually:

```text
AXONE SIDE

wallet control
AND
active staking
        |
        v
qualification
        |
        v
privacy-preserving proof / credential


TELEGRAM SIDE

Telegram identity
AND
valid qualification presentation
        |
        v
contributor access decision
```

No component should require a plaintext mapping:

```text
Telegram user <-> Axone wallet
```

---

## 4. Regime parameters

The regime defines explicit and versioned parameters.

Initial parameters:

| Parameter | Initial value |
| --- | ---: |
| Qualification validity | 72 hours |
| Automatic verification interval | 24 hours |
| Grace period | 72 hours |
| Minimum active stake | Configurable |
| Unbonding stake | Not counted |

The definitive staking threshold has not yet been selected.

---

## 5. Qualification

The economic qualification of an actor can have the following states:

### `unverified`

Required identity and/or wallet-control evidence is missing.

Effect: no contributor access.

### `eligible`

All required evidence is valid and:

`active_stake >= minimum_active_stake`

Effect: contributor access may be granted or maintained.

### `grace_period`

The actor was previously eligible but no longer satisfies the active staking threshold.

The actor retains contributor access temporarily for the configured grace period.

If the actor restores sufficient active staking during this period, qualification returns to
`eligible`.

### `read_only`

The actor does not qualify for contributor access.

This includes:

- an actor below the staking threshold without prior eligibility;
- an actor whose grace period has expired;
- an actor whose qualification has expired and cannot be successfully renewed.

Effect: Telegram publishing rights are not granted or are removed.

---

## 6. Eligibility rule

Qualification occurs across two privacy-separated stages.

### 6.1 Axone-side qualification

The Axone-side qualification process determines whether the underlying wallet
satisfies the economic regime.

Conceptually:

```text
wallet_control_verified
AND
active_stake >= minimum_active_stake
→ eligible
```

Unbonding stake is excluded from the calculation.

The resulting qualification must be transformed into a privacy-preserving proof
or credential before it is presented to Telegram.

### 6.2 Telegram-side access decision

The Telegram side must not independently query the actor's wallet or staking
position.

Contributor access may be granted when:

1. the Telegram identity for the current interaction is established;
2. a valid Community Zone qualification proof is presented;
3. the proof applies to the expected regime and regime version;
4. the qualification has not expired;
5. replay-protection requirements are satisfied;
6. the proof establishes `eligible` or a currently valid `grace_period`.

Conceptually:

```text
telegram_identity_verified
AND
qualification_proof_valid
AND
qualification_not_expired
→ contributor access
```

The Telegram-side decision must not require disclosure of the underlying Axone
wallet address.

---

## 7. Grace-period lifecycle

Eligibility is continuously re-evaluated.

Grace-period computation belongs to the Axone-side qualification process.

The Telegram side should receive only a valid proof of the resulting
qualification state and must not re-evaluate staking directly.

Presentation of a proof must never reset `grace_started_at`.

Example:

```text
T0
active_stake >= threshold
→ eligible

T1
active_stake < threshold
previous qualification = eligible
→ grace_period

T1 + 48h
active_stake >= threshold
→ eligible

OR

T1 + 72h
active_stake < threshold
→ read_only
```

Because automatic verification occurs every 24 hours, the effective time between an actual
stake reduction and enforcement may exceed the nominal 72-hour grace period.

---

## 8. Decisions

Qualification and decision are separate concepts.

Possible regime decisions are:

### `grant_contributor_access`

Issued when a previously non-eligible actor becomes eligible.

### `maintain_contributor_access`

Issued when an already eligible actor remains eligible.

### `maintain_during_grace`

Issued when an eligible actor falls below the threshold but remains inside the grace period.

### `revoke_contributor_access`

Issued when the actor is no longer eligible and no valid grace period remains.

---

## 9. Effects

The regime decision is translated into an external Telegram effect.

### Contributor access

```text
Telegram can_send_messages = true
```

### Read-only access

```text
Telegram can_send_messages = false
```

Axone governs the decision.

A Telegram bot or adapter applies the decision through the Telegram API.

Because Telegram is an external system, decision and enforcement are not atomic.

A later implementation must therefore include reconciliation between:

- the current Axone decision;
- the actual Telegram permissions.

---

## 10. Moderation boundary

Moderation is explicitly outside the scope of this regime.

Telegram administrators remain responsible for:

- deleting messages;
- muting users;
- banning users;
- applying behavioural sanctions;
- handling abusive or inappropriate content.

An Axone qualification of `eligible` must not automatically override a restriction explicitly
applied by a Telegram administrator.

Future Telegram integration must therefore distinguish:

- permissions resulting from the Axone Zone;
- permissions or restrictions resulting from Telegram administration.

This separation is intentional.

---

## 11. Technical failure rule

Failure to query Axone infrastructure is not evidence that staking has fallen
below the threshold.

This rule is evaluated on the Axone side.

If staking evidence cannot temporarily be refreshed:

- the most recent valid qualification remains effective until its expiry;
- the qualification validity period is not extended merely because Axone is unavailable;
- verification should be retried.

If fresh Axone evidence cannot be obtained before qualification expiry:

```text
qualification → read_only
```

When Axone becomes available again, fresh evidence may immediately produce a new
qualification.

If the staking requirement is satisfied again:

```text
read_only → eligible
```

The Telegram side does not need to know whether an expired qualification resulted
from insufficient staking or infrastructure unavailability.

It only needs to know whether a valid qualification proof currently exists.

Technical failure and negative staking evidence remain distinct on the Axone side.

---

## 12. Privacy invariant

The Community Zone must preserve unlinkability between Telegram identity and
Axone wallet identity.

The following relationship must never become a required application data model:

```text
Telegram user <-> Axone wallet address
```

In particular:

- Axone wallet addresses must never be sent through Telegram;
- the Telegram bot must not query staking by wallet address;
- Telegram-side state must not persist wallet addresses;
- Axone-side qualification must not require Telegram identifiers;
- application logs must not reconstruct the prohibited mapping;
- qualification credentials must minimise correlation between issuance and presentation.

Avoiding database storage alone is not sufficient.

The architecture must also avoid creating a trivially reconstructable link through
credentials, logs, request metadata or shared backend state.

The exact privacy-preserving credential mechanism remains to be selected during
Milestone 4.

---

## 13. Scope of Milestone 2

Milestone 2 must:

1. formalise the regime described in this document;
2. express the core qualification rules in Prolog;
3. define testable decision cases;
4. validate the policy independently from Telegram;
5. identify which parts of the regime can later be executed or anchored through Axone.

Milestone 2 does not yet include:

- Telegram bot integration;
- wallet signature verification;
- Telegram Mini App development;
- on-chain deployment;
- production moderation mechanisms;
- privacy-preserving qualification credential design;
- unlinkable credential issuance and presentation.