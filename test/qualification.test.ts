import test from "node:test";
import assert from "node:assert/strict";
import { qualifyByStake } from "../src/zone/qualification.js";

test("eligible exactly at threshold", () => {
  const result = qualifyByStake(1_000n, 1_000n);
  assert.equal(result.status, "eligible");
  assert.equal(result.deficitUaxone, 0n);
});

test("eligible above threshold", () => {
  const result = qualifyByStake(1_500n, 1_000n);
  assert.equal(result.status, "eligible");
  assert.equal(result.deficitUaxone, 0n);
});

test("read only below threshold", () => {
  const result = qualifyByStake(999n, 1_000n);
  assert.equal(result.status, "read_only");
  assert.equal(result.deficitUaxone, 1n);
});
