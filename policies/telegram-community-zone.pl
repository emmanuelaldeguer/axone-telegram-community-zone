% Axone Telegram Community Zone
% Regime policy — Milestone 2
%
% This policy is a pure representation of the Community Zone regime.
% It does not query Telegram, wallets or the Axone staking module directly.
% External systems provide evidence; the policy qualifies that evidence
% according to explicit regime rules.
%
% This policy is not yet deployed or executed on-chain.

% ---------------------------------------------------------------------------
% Public entry point
% ---------------------------------------------------------------------------
%
% evaluate(
%     Evidence,
%     PreviousState,
%     Regime,
%     CurrentTime,
%     Result
% ).
%
% Evidence:
%
%   evidence(
%       TelegramVerified,
%       WalletControlVerified,
%       StakingEvidence
%   )
%
% StakingEvidence:
%
%   available(ActiveStake)
%   unavailable
%
%
% PreviousState:
%
%   state(
%       PreviousQualification,
%       GraceStartedAt,
%       QualificationExpiresAt
%   )
%
%
% Regime:
%
%   regime(
%       MinimumActiveStake,
%       GracePeriodSeconds,
%       QualificationValiditySeconds
%   )
%
%
% Result:
%
%   result(
%       Qualification,
%       Decision,
%       GraceStartedAt,
%       QualificationExpiresAt
%   )


% ---------------------------------------------------------------------------
% Case A — Telegram identity is not verified
% ---------------------------------------------------------------------------

evaluate(
    evidence(false, _, _),
    _,
    _,
    _,
    result(
        unverified,
        revoke_contributor_access,
        none,
        none
    )
).


% ---------------------------------------------------------------------------
% Case B — Wallet control is not verified
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, false, _),
    _,
    _,
    _,
    result(
        unverified,
        revoke_contributor_access,
        none,
        none
    )
).


% ---------------------------------------------------------------------------
% Cases C, D and H — sufficient staking
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, true, available(ActiveStake)),
    state(PreviousQualification, _, _),
    regime(MinimumStake, _, QualificationValidity),
    CurrentTime,
    result(
        eligible,
        Decision,
        none,
        QualificationExpiresAt
    )
) :-
    ActiveStake >= MinimumStake,
    eligible_decision(PreviousQualification, Decision),
    QualificationExpiresAt is CurrentTime + QualificationValidity.


% ---------------------------------------------------------------------------
% Case F — eligible actor falls below threshold
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, true, available(ActiveStake)),
    state(eligible, _, _),
    regime(MinimumStake, GracePeriod, _),
    CurrentTime,
    result(
        grace_period,
        maintain_during_grace,
        CurrentTime,
        GraceExpiresAt
    )
) :-
    ActiveStake < MinimumStake,
    GraceExpiresAt is CurrentTime + GracePeriod.


% ---------------------------------------------------------------------------
% Case G — actor remains below threshold during grace
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, true, available(ActiveStake)),
    state(grace_period, GraceStartedAt, _),
    regime(MinimumStake, GracePeriod, _),
    CurrentTime,
    result(
        grace_period,
        maintain_during_grace,
        GraceStartedAt,
        GraceExpiresAt
    )
) :-
    ActiveStake < MinimumStake,
    GraceExpiresAt is GraceStartedAt + GracePeriod,
    CurrentTime < GraceExpiresAt.


% ---------------------------------------------------------------------------
% Case I — grace period expired
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, true, available(ActiveStake)),
    state(grace_period, GraceStartedAt, _),
    regime(MinimumStake, GracePeriod, _),
    CurrentTime,
    result(
        read_only,
        revoke_contributor_access,
        none,
        none
    )
) :-
    ActiveStake < MinimumStake,
    GraceExpiresAt is GraceStartedAt + GracePeriod,
    CurrentTime >= GraceExpiresAt.


% ---------------------------------------------------------------------------
% Case E — below threshold without prior eligibility
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, true, available(ActiveStake)),
    state(PreviousQualification, _, _),
    regime(MinimumStake, _, _),
    _,
    result(
        read_only,
        revoke_contributor_access,
        none,
        none
    )
) :-
    ActiveStake < MinimumStake,
    no_prior_eligibility(PreviousQualification).


% ---------------------------------------------------------------------------
% Case J — technical failure while qualification is still valid
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, true, unavailable),
    state(
        PreviousQualification,
        GraceStartedAt,
        QualificationExpiresAt
    ),
    _,
    CurrentTime,
    result(
        PreviousQualification,
        no_new_decision,
        GraceStartedAt,
        QualificationExpiresAt
    )
) :-
    contributor_qualification(PreviousQualification),
    CurrentTime < QualificationExpiresAt.


% ---------------------------------------------------------------------------
% Case K — technical failure after qualification expiry
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, true, unavailable),
    state(
        PreviousQualification,
        _,
        QualificationExpiresAt
    ),
    _,
    CurrentTime,
    result(
        read_only,
        revoke_contributor_access,
        none,
        none
    )
) :-
    contributor_qualification(PreviousQualification),
    CurrentTime >= QualificationExpiresAt.


% ---------------------------------------------------------------------------
% Technical failure for an actor without contributor access
% ---------------------------------------------------------------------------

evaluate(
    evidence(true, true, unavailable),
    state(
        PreviousQualification,
        GraceStartedAt,
        QualificationExpiresAt
    ),
    _,
    _,
    result(
        PreviousQualification,
        no_new_decision,
        GraceStartedAt,
        QualificationExpiresAt
    )
) :-
    non_contributor_qualification(PreviousQualification).


% ---------------------------------------------------------------------------
% Helper predicates
% ---------------------------------------------------------------------------

eligible_decision(
    eligible,
    maintain_contributor_access
).

eligible_decision(
    grace_period,
    maintain_contributor_access
).

eligible_decision(
    unverified,
    grant_contributor_access
).

eligible_decision(
    read_only,
    grant_contributor_access
).

eligible_decision(
    none,
    grant_contributor_access
).


no_prior_eligibility(unverified).
no_prior_eligibility(read_only).
no_prior_eligibility(none).


contributor_qualification(eligible).
contributor_qualification(grace_period).


non_contributor_qualification(unverified).
non_contributor_qualification(read_only).
non_contributor_qualification(none).


% ---------------------------------------------------------------------------
% Publishing right
% ---------------------------------------------------------------------------

may_publish(eligible).
may_publish(grace_period).