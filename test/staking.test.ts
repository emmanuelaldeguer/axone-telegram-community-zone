import test from "node:test";
import assert from "node:assert/strict";
import { fetchActiveDelegations } from "../src/axone/staking.js";

const address = "axone1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

test("sums delegations across validators and pagination pages", async () => {
  const urls: string[] = [];
  const fakeFetch = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input.toString());
    urls.push(url.toString());
    const key = url.searchParams.get("pagination.key");

    if (!key) {
      return new Response(JSON.stringify({
        delegation_responses: [
          { balance: { denom: "uaxone", amount: "100" } },
          { balance: { denom: "uaxone", amount: "250" } }
        ],
        pagination: { next_key: "page-2" }
      }), { status: 200 });
    }

    return new Response(JSON.stringify({
      delegation_responses: [
        { balance: { denom: "uaxone", amount: "650" } }
      ],
      pagination: { next_key: null }
    }), { status: 200 });
  };

  const result = await fetchActiveDelegations(
    "https://rest.example.test",
    address,
    2,
    fakeFetch as typeof fetch
  );

  assert.equal(result.totalUaxone, 1_000n);
  assert.equal(result.delegationCount, 3);
  assert.equal(urls.length, 2);
});
