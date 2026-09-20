# Security and privacy

## Mandatory constraints

- Never store wallet private keys or mnemonics.
- Never commit secrets; use `.env` locally and a secret manager in deployment.
- Never publish raw Telegram user identifiers on-chain.
- Never put Telegram message contents on-chain.
- Never expose an Axone wallet address through Telegram.
- Never persist a direct mapping between a Telegram user and an Axone wallet address.
- The Telegram-side application must not require access to the user's Axone address.
- The Axone-side qualification component must not require access to the user's Telegram identity.
- Treat a REST/API outage as an inability to refresh evidence, not as evidence that staking has fallen below the threshold.
- Do not connect the prototype to the official Axone Telegram group before sandbox validation.

---

## Privacy objective

The Community Zone must preserve unlinkability between:

```text
Telegram identity
```

and:

```text
Axone wallet address
```

The system must avoid creating or persisting the relationship:

```text
Telegram user <-> axone1...
```

Telegram may know the Telegram user.

Axone may know the wallet address and its public staking state.

The Community Zone architecture must avoid introducing a durable bridge between those two identities.

---

## Separation of responsibilities

The qualification flow must separate the Telegram side from the Axone side.

Conceptually:

```text
AXONE SIDE

Wallet
  |
  v
wallet-control proof
  |
  v
staking evidence
  |
  v
qualification
  |
  v
privacy-preserving credential / proof


TELEGRAM SIDE

Telegram user
  |
  v
presents qualification credential / proof
  |
  v
bot verifies qualification
  |
  v
contributor access decision
```

The Telegram component should receive only the minimum information required to
verify contributor qualification.

It should not receive the underlying Axone wallet address.

The Axone qualification component should not receive the Telegram user identifier.

---

## Telegram-side data minimisation

The Telegram bot may need to know:

- the Telegram user identifier;
- whether a valid Community Zone qualification is presented;
- the applicable regime identifier and version;
- the qualification validity period;
- information required to prevent replay.

The Telegram bot must not require:

- the user's Axone wallet address;
- active delegation details;
- validator identities;
- raw staking evidence;
- wallet signatures containing a Telegram identifier.

---

## Axone-side data minimisation

The Axone-side qualification component may need to know:

- the Axone wallet address;
- proof of wallet control;
- active staking evidence;
- the applicable regime identifier and version.

It must not require:

- the Telegram user identifier;
- Telegram username;
- Telegram group membership information;
- Telegram message contents.

---

## Qualification credential

A future qualification credential should disclose only the information required
to prove that the holder satisfies the Community Zone regime.

Conceptually, the disclosed information may include:

```text
regime = telegram-community-zone
regime_version = 1
qualification = eligible
valid_until = ...
```

It must not disclose:

```text
wallet = axone1...
telegram_user_id = ...
```

The credential design must also minimise correlation through stable identifiers.

A credential must not introduce a new persistent identifier that allows the
issuer, verifier or an observer to reconstruct the Telegram-to-wallet link.

---

## Unlinkability

Avoiding storage of the wallet address in the Telegram database is necessary but
not sufficient.

If the same backend observes:

1. which wallet receives a credential; and
2. which Telegram user later presents that same uniquely identifiable credential,

the backend could reconstruct the relationship.

The future credential mechanism should therefore aim to prevent presentation
from being trivially correlated with issuance.

Candidate approaches include:

- blind-signed credentials;
- anonymous credentials;
- zero-knowledge proofs;
- other privacy-preserving proof systems compatible with the Axone architecture.

The exact mechanism remains to be selected and validated.

---

## Wallet control

Wallet control must be proven on the Axone side without binding the proof to a
Telegram identity.

A future challenge mechanism may use:

- a one-time nonce;
- short expiry;
- replay protection;
- an Axone wallet signature.

The signed challenge must not contain the Telegram user identifier or create a
persistent Telegram-to-wallet binding.

---

## Replay protection

A qualification proof used on the Telegram side must include sufficient replay
protection.

Depending on the credential architecture, this may require:

- short-lived proofs;
- one-time presentation challenges;
- verifier-bound challenges;
- rotating or unlinkable presentation material.

Replay protection must not rely on exposing the underlying Axone wallet address
to Telegram.

---

## Logging

Application logs must not create the correlation that the protocol architecture
is designed to avoid.

In particular:

- never log a Telegram identifier together with an Axone wallet address;
- never log a qualification credential together with both identities;
- avoid logging raw wallet-control signatures unless strictly required for debugging;
- production logging must minimise stable correlatable identifiers.

---

## On-chain privacy

Telegram identities must never be published on-chain in plaintext.

The preferred architecture is stronger than merely hashing the Telegram
identifier: the Axone-side regime should not need the Telegram identity at all.

If an on-chain reference to a qualification is required, prefer a
privacy-preserving commitment, anonymous credential reference or proof rather
than a Telegram identifier.

---

## Enforcement reconciliation

Telegram permissions are external state.

The system must periodically reconcile expected Zone decisions with actual
Telegram member permissions and repair drift.

An `eligible` Axone qualification must never automatically override a restriction
explicitly applied by a Telegram administrator.

Privacy constraints continue to apply during reconciliation: enforcement must
not require disclosure of the user's Axone wallet address to Telegram.