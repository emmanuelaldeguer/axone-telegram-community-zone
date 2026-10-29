# Wallet-control anonymous proof: acceptance contract, not an implementation

Source: [maintainer clarification](https://github.com/axone-protocol/contracts/issues/873#issuecomment-6441578159).
No cryptographic mechanism or library is selected by this document.

The native assessment names a public subject wallet; it neither checks nor
claims that its fee payer controls that wallet. Assessment/renewal must occur
independently of the Telegram session. No Telegram identifier, session token,
bot nonce or secret-derived identity commitment belongs in the public case.

For a common source/view and activation window, the eventual proof must bind:

1. Control of a wallet under the intended Axone signing/address scheme.
2. Membership of **that same wallet** in the approved entitled set derived from
   native decisions at the agreed height and regime/version.
3. A fresh, short-lived, single-use bot challenge bound internally to the
   authenticated Telegram session and expected bot/application audience.
4. The common window and source, with entitlement and lease expiry still valid
   after proof verification and before external permissions are granted.

A normal wallet signature sent to the bot would expose its signing identity.
An unrelated anonymous-identity membership proof would not establish control
of a qualifying wallet. The bridge between signing/control, canonical address
derivation and private membership must be selected, implemented and validated.
The design must work with existing wallets; requesting seed/private-key export
is not the intended integration path. A mechanism using a wallet signature as
a private witness is a requirement to investigate, not a claimed supported
circuit, browser implementation or selected cryptosystem.

The proof client must obtain the same public membership data as everyone else,
not fetch a personalized wallet path from the bot. The verifier must approve
the view's actual membership derivation and cryptographic root; the current
`viewId` manifest hash alone supplies no proof. A signed operator list, two
agreeing RPCs or a matching record hash is not a cryptographic chain-state proof.

Accept no wallet, public key, commitment, individual decision ID, member index,
private witness or raw identifying signature as presentation fields. Define a
strict scheme-specific proof envelope only after validating the mechanism.
Single-use challenge consumption must be atomic; proofs for another session,
audience, view, regime or expired window must fail. Successful proof validation
does not guarantee Telegram API delivery: external rights need bounded leases
and crash-safe reconciliation while preserving administrator moderation.

Snapshot freshness limits possible use of a view preceding a new refusal;
refresh/withdrawal policy and leases must explicitly bound that delay. Funding
and frequency of economic renewals remain explicit choices. No one-person-one-
account, non-transferability, wallet uniqueness across Telegram users, metadata
anonymity, private-key extraction or production security guarantee is claimed.
