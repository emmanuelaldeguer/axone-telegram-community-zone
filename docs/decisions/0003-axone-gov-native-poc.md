# ADR 0003: native axone-gov entitlement and private presentation

Target agreed in this project conversation; reconstructed after workspace
maintenance on 2026-10-28. This is not evidence of a deployed public PoC.

The constitution evaluates native staking and lifecycle rules; axone-gov records
the decision. A generic author index retrieves original records. Economic rules
must not be moved into a Rust qualification contract or an opaque backend.

The target combines an external wallet/proof client, a MiniApp, axone-gov and the
Telegram bot. Anonymous membership proof must eventually let the bot check an
entitlement without receiving a wallet address, commitment, member index or
individual decision ID. No Telegram-to-wallet mapping is intended. ZK alone
does not authenticate chain state or prevent metadata correlation.

The local prototype reserves a separate governance controller, has fixed binding
per participant, non-resetting grace, terminal self-revocation and a fail-closed
constitutional revision gate. Its commitments remain symbolic. Real commitment
admission, secret possession, source authentication, common roots, private
presentation, migration/recovery, approved v16/Abstract deployment and Telegram
effect reconciliation remain open.

See the [recovery checkpoint](../../experiments/compact-lifecycle/README.md).
