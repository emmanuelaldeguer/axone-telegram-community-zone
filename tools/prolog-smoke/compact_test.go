package main

import (
	"fmt"
	"os"
	"strings"
	"testing"

	prolog "github.com/axone-protocol/prolog/v3"
)

func loadCompactCore(t *testing.T, file string) *prolog.Interpreter {
	t.Helper()
	data, err := os.ReadFile("../../experiments/compact-lifecycle/" + file)
	if err != nil {
		t.Fatal(err)
	}
	core := strings.Split(strings.ReplaceAll(string(data), ":- consult", ":-consult"), ":-consult")[0]
	p := prolog.New(nil, nil)
	if err := p.Exec(core); err != nil {
		t.Fatal(err)
	}
	return p
}

func compactResult(t *testing.T, p *prolog.Interpreter, q string) string {
	t.Helper()
	s := p.QuerySolution(q)
	if err := s.Err(); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	var r struct{ Result prolog.TermString }
	if err := s.Scan(&r); err != nil {
		t.Fatal(err)
	}
	return fmt.Sprint(r.Result)
}

func TestCompactDifferential(t *testing.T) {
	ref := prolog.New(nil, nil)
	policy, err := os.ReadFile("../../policies/telegram-community-zone.pl")
	if err != nil {
		t.Fatal(err)
	}
	if err = ref.Exec(string(policy)); err != nil {
		t.Fatal(err)
	}
	states := []struct{ binding, status, grace, expiry string }{
		{"none", "read_only", "none", "none"},
		{"c1", "read_only", "none", "none"},
		{"c1", "eligible", "none", "1100000"},
		{"c1", "grace_period", "900000", "1159200"},
		{"c1", "revoked", "none", "none"},
	}
	for _, file := range []string{"constitution.pl", "constitution.compact.pl"} {
		t.Run(file, func(t *testing.T) {
			p := loadCompactCore(t, file)
			count := 0
			for _, s := range states {
				for _, now := range []int{999999, 1000000, 1099999, 1100000, 1159200, 1200000} {
					for _, stake := range []int64{0, 999999999, 1000000000, 1000000001} {
						for _, c := range []string{"c1", "c2"} {
							for _, action := range []string{"qualify(" + c + ")", "revoke", "unrelated"} {
								before := fmt.Sprintf("s(%s,%s,%s,%s)", s.binding, s.status, s.grace, s.expiry)
								event, next := "unchanged", before
								switch {
								case action == "unrelated":
								case action == "revoke" && s.binding == "none":
									event = "refused"
								case action == "revoke" && s.status == "revoked":
								case action == "revoke":
									event = "revoked"
									next = fmt.Sprintf("s(%s,revoked,none,none)", s.binding)
								case s.status == "revoked" || (s.binding != "none" && s.binding != c):
									event = "refused"
								default:
									goal := fmt.Sprintf("evaluate(evidence(true,true,available(%d)),state(%s,%s,%s),regime(1000000000,259200,259200),%d,result(Q,_,G,E)),Result=s(%s,Q,G,E).", stake, s.status, s.grace, s.expiry, now, c)
									evaluated := compactResult(t, ref, goal)
									switch {
									case strings.Contains(evaluated, ",eligible,"):
										next = evaluated
										event = "renewed"
										if s.binding == "none" {
											event = "admitted"
										}
									case strings.Contains(evaluated, ",grace_period,"):
										next = evaluated
										event = "grace"
									case s.binding == "none":
										event = "refused"
									default:
										next = fmt.Sprintf("s(%s,read_only,none,none)", s.binding)
										event = "disqualified"
									}
								}
								goal := fmt.Sprintf("findall(r(F,N),p(%s,%s,%d,%d,F,N),[Result]).", before, action, stake, now)
								if got, want := compactResult(t, p, goal), "r("+event+","+next+")"; got != want {
									t.Fatalf("%s\nwant %s\ngot %s", goal, want, got)
								}
								count++
							}
						}
					}
				}
			}
			t.Logf("%d differential transition cases, exactly one solution each", count)
		})
	}
}
