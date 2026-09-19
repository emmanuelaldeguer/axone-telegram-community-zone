# Axone Telegram Community Zone — Regime Model

## Purpose

The Axone Telegram Community Zone governs one specific question:

> Is this actor currently entitled to contribute to the Axone Telegram community?

The Zone governs contributor eligibility only.

Content moderation, behavioural sanctions, message deletion, muting and banning remain
outside the Axone regime and under the authority of Telegram administrators.

---

## 1. Actor

An actor is a Telegram user linked to an Axone account.

The final system must establish two independent facts:

1. the Telegram identity of the requester;
2. control of the linked Axone account.

The Telegram-to-wallet association remains off-chain.

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

Qualification relies on explicit evidence.

### 3.1 Telegram identity evidence

`telegram_identity_verified`

Demonstrates that the request is associated with the relevant Telegram user.

Not implemented yet.

### 3.2 Wallet control evidence

`wallet_control_verified`

Demonstrates that the Telegram user controls the linked Axone account.

The planned mechanism is a signed, time-limited nonce.

Not implemented yet.

### 3.3 Active staking evidence

`active_delegation_amount`

Represents the total active delegation amount of the linked Axone account.

Delegations across all validators are aggregated.

Delegations currently unbonding are not counted.

This evidence is already implemented and validated in Milestone 1.

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

An actor is eligible when all of the following are true:

1. Telegram identity is verified;
2. control of the linked Axone account is verified;
3. active staking is greater than or equal to the regime threshold.

Conceptually:

```text
telegram_identity_verified
AND wallet_control_verified
AND active_stake >= minimum_active_stake
→ eligible
```

Unbonding stake is excluded from the calculation.

---

## 7. Grace-period lifecycle

Eligibility is continuously re-evaluated.

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

Failure to query Axone infrastructure is not evidence of ineligibility.

If staking evidence cannot temporarily be refreshed:

- the most recent valid qualification remains effective until its expiry;
- the actor is not immediately downgraded;
- verification should be retried.

Technical failure and negative qualification must remain distinct.

---

## 12. Scope of Milestone 2

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
- production moderation mechanisms.