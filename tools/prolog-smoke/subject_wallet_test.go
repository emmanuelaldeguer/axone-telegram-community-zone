package main

import (
	"fmt"
	prolog "github.com/axone-protocol/prolog/v3"
	"os"
	"strings"
	"testing"
)

func TestSubjectWalletAssessment(t *testing.T) {
	data, err := os.ReadFile("../../experiments/subject-wallet/constitution.pl")
	if err != nil {
		t.Fatal(err)
	}
	marker := "\nassess_wallet(Amount,Now,Status,Until):-"
	index := strings.Index(string(data), marker)
	if index < 0 {
		t.Fatal("missing pure assessment core")
	}
	p := prolog.New(nil, nil)
	if err := p.Exec(string(data)[index:]); err != nil {
		t.Fatal(err)
	}
	cases := []struct{ amount, want string }{
		{"0", "r(read_only,1000)"},
		{"999999999", "r(read_only,1000)"},
		{"1000000000", "r(eligible,260200)"},
		{"1000000001", "r(eligible,260200)"},
		{"9223372036854775807", "r(eligible,260200)"},
		{"'9223372036854775808'", "r(eligible,260200)"},
		{"'18446744073709551615'", "r(eligible,260200)"},
		{"'999999999999999999999999999999999999999999999999'", "r(eligible,260200)"},
		{"'0'", "r(read_only,1000)"},
		{"'999999999'", "r(read_only,1000)"},
		{"'1000000000'", "r(eligible,260200)"},
	}
	for _, c := range cases {
		t.Run(c.amount, func(t *testing.T) {
			q := fmt.Sprintf("findall(r(S,E),assess_wallet(%s,1000,S,E),[Result]).", c.amount)
			if got := compactResult(t, p, q); got != c.want {
				t.Fatalf("want %s, got %s", c.want, got)
			}
		})
	}
	for _, a := range []string{"-1", "1.5", "'0001'", "'01'", "''", "'1e9'", "'-10'", "'12x'", "[]", "foo(1)"} {
		t.Run("reject_"+a, func(t *testing.T) {
			q := fmt.Sprintf("findall(r(S,E),assess_wallet(%s,1000,S,E),Result).", a)
			if got := compactResult(t, p, q); got != "[]" {
				t.Fatal(got)
			}
		})
	}
	if got := compactResult(t, p, "findall(r(S,E),assess_wallet(1000000000,-1,S,E),Result)."); got != "[]" {
		t.Fatal(got)
	}
}
