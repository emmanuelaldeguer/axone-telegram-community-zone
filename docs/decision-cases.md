# Axone Telegram Community Zone — Decision Cases

## Purpose

This document defines the expected behaviour of the Community Zone regime before
its implementation in Prolog.

Each case describes:

- the available evidence;
- the previous qualification where relevant;
- the expected qualification;
- the resulting decision;
- the external Telegram effect.

These cases are the functional reference for policy implementation and testing.

---

## 1. Qualification inputs

The regime evaluates the following inputs:

| Input | Meaning |
| --- | --- |
| `telegram_verified` | Telegram identity has been authenticated |
| `wallet_control_verified` | Control of the linked Axone account has been proven |
| `active_stake` | Total active delegation amount |
| `minimum_stake` | Minimum amount required by the regime |
| `previous_qualification` | Most recent valid qualification |
| `grace_started_at` | Time at which the grace period began |
| `current_time` | Time of evaluation |
| `grace_period` | Maximum grace-period duration |

Unbonding stake is not included in `active_stake`.

---

## 2. Case A — Telegram identity is not verified

### Inputs

```text
telegram_verified = false
```

Other evidence is irrelevant because the actor cannot yet be linked reliably to a
Telegram identity.

### Expected result

```text
qualification = unverified
```

### Decision

```text
revoke_contributor_access
```

For a new actor, this means contributor access is simply not granted.

### Telegram effect

```text
can_send_messages = false
```

---

## 3. Case B — Wallet control is not verified

### Inputs

```text
telegram_verified = true
wallet_control_verified = false
```

### Expected result

```text
qualification = unverified
```

### Decision

```text
revoke_contributor_access
```

For a new actor, contributor access is not granted.

### Telegram effect

```text
can_send_messages = false
```

---

## 4. Case C — New actor with sufficient active staking

### Inputs

```text
telegram_verified = true
wallet_control_verified = true
active_stake >= minimum_stake
previous_qualification != eligible
```

### Expected result

```text
qualification = eligible
```

### Decision

```text
grant_contributor_access
```

### Telegram effect

```text
can_send_messages = true
```

---

## 5. Case D — Existing eligible actor remains above the threshold

### Inputs

```text
telegram_verified = true
wallet_control_verified = true
active_stake >= minimum_stake
previous_qualification = eligible
```

### Expected result

```text
qualification = eligible
```

The qualification validity period is renewed.

### Decision

```text
maintain_contributor_access
```

### Telegram effect

```text
can_send_messages = true
```

---

## 6. Case E — Actor is below the threshold and has no prior eligibility

### Inputs

```text
telegram_verified = true
wallet_control_verified = true
active_stake < minimum_stake
previous_qualification != eligible
previous_qualification != grace_period
```

### Expected result

```text
qualification = read_only
```

### Decision

```text
revoke_contributor_access
```

For a new actor, this means contributor access is not granted.

### Telegram effect

```text
can_send_messages = false
```

---

## 7. Case F — Eligible actor falls below the threshold

### Inputs

```text
telegram_verified = true
wallet_control_verified = true
active_stake < minimum_stake
previous_qualification = eligible
```

### Expected result

A grace period begins.

```text
qualification = grace_period
grace_started_at = current_time
```

### Decision

```text
maintain_during_grace
```

### Telegram effect

```text
can_send_messages = true
```

---

## 8. Case G — Actor remains below the threshold during grace period

### Inputs

```text
telegram_verified = true
wallet_control_verified = true
active_stake < minimum_stake
previous_qualification = grace_period
current_time < grace_started_at + grace_period
```

### Expected result

```text
qualification = grace_period
```

The original `grace_started_at` value must not be reset by each verification.

### Decision

```text
maintain_during_grace
```

### Telegram effect

```text
can_send_messages = true
```

---

## 9. Case H — Actor restores sufficient staking during grace period

### Inputs

```text
telegram_verified = true
wallet_control_verified = true
active_stake >= minimum_stake
previous_qualification = grace_period
```

### Expected result

```text
qualification = eligible
```

The grace period ends.

### Decision

```text
maintain_contributor_access
```

### Telegram effect

```text
can_send_messages = true
```

---

## 10. Case I — Grace period expires while staking remains insufficient

### Inputs

```text
telegram_verified = true
wallet_control_verified = true
active_stake < minimum_stake
previous_qualification = grace_period
current_time >= grace_started_at + grace_period
```

### Expected result

```text
qualification = read_only
```

### Decision

```text
revoke_contributor_access
```

### Telegram effect

```text
can_send_messages = false
```

---

## 11. Case J — Technical failure while a valid qualification still exists

A failure to retrieve staking evidence is not evidence that the actor has become
ineligible.

Examples include:

- REST endpoint unavailable;
- timeout;
- temporary node failure;
- malformed or incomplete upstream response.

### Inputs

```text
staking_evidence = unavailable
previous_qualification = valid
qualification_expiry > current_time
```

### Expected result

No new economic qualification is produced.

The previous valid qualification remains effective until its expiry.

### Decision

```text
no_new_decision
```

### Effect

The current Telegram permission is left unchanged and verification is retried.

---

## 12. Case K — Technical failure lasting beyond qualification expiry

Axone remains the source of truth for staking qualification.

A technical failure does not immediately invalidate an existing qualification.
However, a positive qualification has a finite validity period of 72 hours and
cannot be renewed without fresh evidence from Axone.

### Inputs

```text
staking_evidence = unavailable
previous_qualification = valid
qualification_expiry <= current_time
```

### Expected result

```text
qualification = read_only
```

The previous qualification expires normally.

The technical failure is not interpreted as evidence that staking has fallen below
the threshold.

Instead, the system considers that it no longer has sufficiently fresh evidence
to maintain contributor access.

### Decision

```text
revoke_contributor_access
```

### Telegram effect

```text
can_send_messages = false
```

### Recovery

When Axone becomes available again, the actor is re-evaluated.

If:

```text
active_stake >= minimum_stake
```

then:

```text
qualification = eligible
decision = grant_contributor_access
can_send_messages = true
```

No additional grace period is required for recovery.

The actor becomes eligible again as soon as fresh evidence from Axone confirms
that the staking threshold is satisfied.

---

## 13. Moderation is not a decision case

Telegram moderation is outside the Community Zone regime.

The policy does not evaluate:

- message content;
- user behaviour;
- administrator sanctions;
- bans;
- mutes.

An administrator restriction must not be reversed merely because the Zone considers
the actor economically eligible.

---

## 14. Decision matrix

| Case | Identity | Wallet | Stake | Previous state | Result | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| A | No | Any | Any | Any | `unverified` | `revoke_contributor_access` |
| B | Yes | No | Any | Any | `unverified` | `revoke_contributor_access` |
| C | Yes | Yes | >= threshold | Not eligible | `eligible` | `grant_contributor_access` |
| D | Yes | Yes | >= threshold | `eligible` | `eligible` | `maintain_contributor_access` |
| E | Yes | Yes | < threshold | No prior eligibility | `read_only` | `revoke_contributor_access` |
| F | Yes | Yes | < threshold | `eligible` | `grace_period` | `maintain_during_grace` |
| G | Yes | Yes | < threshold | `grace_period`, not expired | `grace_period` | `maintain_during_grace` |
| H | Yes | Yes | >= threshold | `grace_period` | `eligible` | `maintain_contributor_access` |
| I | Yes | Yes | < threshold | `grace_period`, expired | `read_only` | `revoke_contributor_access` |
| J | Yes | Yes | unavailable | Valid qualification | unchanged | `no_new_decision` |

---

## 15. Policy invariants

The future policy must preserve the following invariants:

1. No actor becomes `eligible` without verified Telegram identity.
2. No actor becomes `eligible` without verified wallet control.
3. No actor becomes `eligible` with active staking below the regime threshold.
4. Unbonding stake never contributes to eligibility.
5. A grace period can only originate from a previously eligible state.
6. Rechecking during grace must not reset `grace_started_at`.
7. Restoring sufficient staking immediately ends the grace condition.
8. Technical infrastructure failure is never equivalent to negative staking evidence.
9. Axone eligibility does not override Telegram administrator moderation.
10. A qualification cannot remain valid beyond its expiry without fresh evidence from Axone.