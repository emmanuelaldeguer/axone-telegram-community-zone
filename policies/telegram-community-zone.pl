% Axone Telegram Community Zone — draft regime model.
% This file is documentation/prototyping material only.
% It is NOT deployed and is NOT executed on-chain yet.

% qualify(+ActiveStake, +Threshold, -Status)
qualify(ActiveStake, Threshold, eligible) :-
    ActiveStake >= Threshold.

qualify(ActiveStake, Threshold, read_only) :-
    ActiveStake < Threshold.

% may_publish(+Status)
may_publish(eligible).

% Future versions will model grace_period, suspended, exempt,
% wallet-control evidence, credential-based exceptions and regime versioning.
