import test from "node:test";
import assert from "node:assert/strict";
import { fetchActiveDelegations } from "../src/axone/staking.js";

const address = "axone1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

test("sums only delegations to BONDED validators across pagination pages", async () => {
  const urls: string[] = [];

  const fakeFetch = async (
    input: string | URL | Request
  ): Promise<Response> => {
    const url = new URL(input.toString());
    urls.push(url.toString());

    // 1. Validator set
    if (url.pathname === "/cosmos/staking/v1beta1/validators") {
      assert.equal(
        url.searchParams.get("status"),
        "BOND_STATUS_BONDED"
      );

      return new Response(
        JSON.stringify({
          validators: [
            { operator_address: "axonevaloper1bonded1" },
            { operator_address: "axonevaloper1bonded2" }
          ],
          pagination: {
            next_key: null
          }
        }),
        { status: 200 }
      );
    }

    // 2. Delegations
    if (
      url.pathname ===
      `/cosmos/staking/v1beta1/delegations/${address}`
    ) {
      const key = url.searchParams.get("pagination.key");

      if (!key) {
        return new Response(
          JSON.stringify({
            delegation_responses: [
              {
                delegation: {
                  validator_address: "axonevaloper1bonded1"
                },
                balance: {
                  denom: "uaxone",
                  amount: "100"
                }
              },
              {
                delegation: {
                  validator_address: "axonevaloper1unbonded"
                },
                balance: {
                  denom: "uaxone",
                  amount: "5000"
                }
              }
            ],
            pagination: {
              next_key: "page-2"
            }
          }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          delegation_responses: [
            {
              delegation: {
                validator_address: "axonevaloper1bonded2"
              },
              balance: {
                denom: "uaxone",
                amount: "900"
              }
            }
          ],
          pagination: {
            next_key: null
          }
        }),
        { status: 200 }
      );
    }

    return new Response("Not found", { status: 404 });
  };

  const result = await fetchActiveDelegations(
    "https://rest.example.test",
    address,
    2,
    fakeFetch as typeof fetch
  );

  assert.equal(result.totalUaxone, 1_000n);
  assert.equal(result.delegationCount, 2);

  assert.equal(urls.length, 3);
});
