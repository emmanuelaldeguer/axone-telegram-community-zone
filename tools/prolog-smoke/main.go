package main

import (
	"fmt"
	"os"

	prolog "github.com/axone-protocol/prolog/v3"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: go run . <policy-file>")
		os.Exit(2)
	}

	policy, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}

	p := prolog.New(nil, nil)

	if err := p.Exec(string(policy)); err != nil {
		panic(err)
	}

	solution := p.QuerySolution(`
		evaluate(
			evidence(true,true,available(2000)),
			state(none,none,none),
			regime(1000,259200,259200),
			1000000,
			Result
		).
	`)

	if err := solution.Err(); err != nil {
		panic(err)
	}

	var result struct {
		Result prolog.TermString
	}

	if err := solution.Scan(&result); err != nil {
		panic(err)
	}

	fmt.Printf("Result = %s\n", result.Result)
}
