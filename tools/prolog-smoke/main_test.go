package main

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	prolog "github.com/axone-protocol/prolog/v3"
)

func runPolicyQuery(t *testing.T, query string) string {
	t.Helper()

	policyPath := filepath.Join("..", "..", "policies", "telegram-community-zone.pl")

	policy, err := os.ReadFile(policyPath)
	if err != nil {
		t.Fatalf("cannot read policy: %v", err)
	}

	p := prolog.New(nil, nil)

	if err := p.Exec(string(policy)); err != nil {
		t.Fatalf("cannot load policy: %v", err)
	}

	solution := p.QuerySolution(query)

	if err := solution.Err(); err != nil {
		t.Fatalf("query failed: %v", err)
	}

	var result struct {
		Result prolog.TermString
	}

	if err := solution.Scan(&result); err != nil {
		t.Fatalf("cannot read query result: %v", err)
	}

	return fmt.Sprint(result.Result)
}

func TestCaseA_TelegramIdentityNotVerified(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(false,true,available(2000)),
			state(none,none,none),
			regime(1000,259200,259200),
			1000000,
			Result
		).
	`)

	want := "result(unverified,revoke_contributor_access,none,none)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}

func TestCaseB_WalletControlNotVerified(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,false,available(2000)),
			state(none,none,none),
			regime(1000,259200,259200),
			1000000,
			Result
		).
	`)

	want := "result(unverified,revoke_contributor_access,none,none)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}

func TestCaseC_NewActorWithSufficientStake(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,available(2000)),
			state(none,none,none),
			regime(1000,259200,259200),
			1000000,
			Result
		).
	`)

	want := "result(eligible,grant_contributor_access,none,1259200)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}
func TestCaseD_EligibleActorRemainsAboveThreshold(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,available(2000)),
			state(eligible,none,1100000),
			regime(1000,259200,259200),
			1000000,
			Result
		).
	`)

	want := "result(eligible,maintain_contributor_access,none,1259200)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}

func TestCaseE_BelowThresholdWithoutPriorEligibility(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,available(500)),
			state(none,none,none),
			regime(1000,259200,259200),
			1000000,
			Result
		).
	`)

	want := "result(read_only,revoke_contributor_access,none,none)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}

func TestCaseF_EligibleActorFallsBelowThreshold(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,available(500)),
			state(eligible,none,1100000),
			regime(1000,259200,259200),
			1000000,
			Result
		).
	`)

	want := "result(grace_period,maintain_during_grace,1000000,1259200)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}
func TestCaseG_RemainsBelowThresholdDuringGrace(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,available(500)),
			state(grace_period,1000000,1259200),
			regime(1000,259200,259200),
			1100000,
			Result
		).
	`)

	want := "result(grace_period,maintain_during_grace,1000000,1259200)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}

func TestCaseH_RestoresSufficientStakeDuringGrace(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,available(2000)),
			state(grace_period,1000000,1259200),
			regime(1000,259200,259200),
			1100000,
			Result
		).
	`)

	want := "result(eligible,maintain_contributor_access,none,1359200)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}

func TestCaseI_GracePeriodExpires(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,available(500)),
			state(grace_period,1000000,1259200),
			regime(1000,259200,259200),
			1259200,
			Result
		).
	`)

	want := "result(read_only,revoke_contributor_access,none,none)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}
func TestCaseJ_TechnicalFailureWhileQualificationStillValid(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,unavailable),
			state(eligible,none,1259200),
			regime(1000,259200,259200),
			1100000,
			Result
		).
	`)

	want := "result(eligible,no_new_decision,none,1259200)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}

func TestCaseK_TechnicalFailureAfterQualificationExpiry(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,unavailable),
			state(eligible,none,1259200),
			regime(1000,259200,259200),
			1259200,
			Result
		).
	`)

	want := "result(read_only,revoke_contributor_access,none,none)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}
func TestRecoveryAfterTechnicalFailureExpiry(t *testing.T) {
	got := runPolicyQuery(t, `
		evaluate(
			evidence(true,true,available(2000)),
			state(read_only,none,none),
			regime(1000,259200,259200),
			1300000,
			Result
		).
	`)

	want := "result(eligible,grant_contributor_access,none,1559200)"

	if got != want {
		t.Fatalf("unexpected result\nwant: %s\ngot:  %s", want, got)
	}
}
