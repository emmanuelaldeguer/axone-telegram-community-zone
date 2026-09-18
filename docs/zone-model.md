# Zone model

## Concepts

| Axone concept | Telegram community application |
| --- | --- |
| Actor | Telegram user linked to an Axone wallet |
| Act | Request or maintain the right to publish |
| Evidence | Telegram identity, wallet control and active delegation amount |
| Regime | Public and versioned eligibility rules |
| Qualification | `eligible`, `grace_period`, `read_only`, later `suspended` or `exempt` |
| Decision | Grant, maintain, suspend or remove publishing access |
| Effect | Telegram permissions are updated |

## Eligibility rule

A participant is eligible when all of the following hold:

1. the participant controls an Axone address;
2. that address is securely linked to the Telegram identity;
3. the sum of active staking delegations is greater than or equal to the configured threshold.

Delegations to all validators are added together. Unbonding tokens are not counted.

## Lifecycle parameters

- qualification validity: 72 hours;
- automatic verification: every 24 hours;
- grace period: 72 hours;
- manual verification: possible at any time.

After a failed economic re-check, the user enters `grace_period`. If eligibility is not restored before grace expiry, the final effect is `read_only`, not expulsion.

## Moderation

Economic eligibility and moderation are distinct. `suspended` is a moderation state and must not be derived from staking. Native staking must never be slashed for Telegram behaviour.
