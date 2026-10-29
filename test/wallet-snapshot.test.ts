import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assessmentCase, assertSnapshotUsable, buildWalletSnapshot, STRICT_REGIME,
  type SnapshotSource, type SnapshotPolicy, type BlockContext } from "../src/zone/wallet-snapshot.js";
import { GovRestSource } from "../src/zone/gov-rest-source.js";

const h = (s: string) => createHash("sha256").update(s).digest("base64");
// Syntactic fixture wallets. Actual checksum validity is enforced natively.
const alice = "axone1" + "q".repeat(38), bob = "axone1" + "p".repeat(38);
const sponsor = "axone1" + "z".repeat(38);
const codeChecksum = "ab".repeat(32), constitutionHash = h("strict-constitution");
const context: BlockContext = { chainId: "local", govAddress: "gov-fixture", codeChecksum,
  height: 10n, hash: "cd".repeat(32), time: 100n };
const policy: SnapshotPolicy = { chainId: "local", govAddress: "gov-fixture", codeChecksum,
  constitutionHash, constitutionRevision: 1n, maxSnapshotAgeSeconds: 30n,
  maxLeaseSeconds: 20n, pageLimit: 2, maxPages: 30 };
const window = { start: 100n, end: 120n };
type Row = Record<string, unknown>;
function row(id: number, subject = alice, eligible = true, author = sponsor, at = 90): Row {
  const c = assessmentCase(subject);
  const verdict = `wallet_entitlement_v1(${STRICT_REGIME},${subject},${eligible ? "eligible" : "read_only"},${at},${eligible ? at + 259200 : at})`;
  return { decision_id: id, author, case: c, case_hash: h(c), verdict, verdict_hash: h(verdict),
    motivation: null, motivation_hash: null, constitution_revision: 1, constitution_hash: constitutionHash,
    block_height: 8, block_time_seconds: at };
}
function patch(row: Row, changes: Row): Row {
  const r = { ...row, ...changes };
  r.case_hash = h(String(r.case)); r.verdict_hash = h(String(r.verdict));
  return r;
}
class Fixture implements SnapshotSource {
  requests: Array<{ request: object; height: bigint }> = [];
  contextReads = 0;
  receiptHeight = 10n;
  revision = 1;
  fork = false;
  failCursor?: number;
  truncate = false;
  constructor(readonly rows: Row[]) {}
  async context(height: bigint) {
    assert.equal(height, 10n); this.contextReads++;
    return { ...context, hash: this.fork && this.contextReads > 1 ? "ef".repeat(32) : context.hash };
  }
  async queryGov(request: object, height: bigint) {
    this.requests.push({ request, height });
    const q = request as { decisions?: { start_after: number | null; limit: number } };
    if (!q.decisions) return { height: this.receiptHeight,
      data: { constitution_revision: this.revision, constitution_hash: constitutionHash } };
    const cursor = q.decisions.start_after ?? 0;
    if (cursor === this.failCursor) throw Error("page unavailable");
    return { height: this.receiptHeight, data: { decisions: this.rows.filter(r => Number(r.decision_id) > cursor)
      .slice(0, this.truncate ? 1 : q.decisions.limit) } };
  }
}
const build = (f: Fixture, p = policy, now = 105n) => buildWalletSnapshot(f, p, 10n, window, now);

test("latest decisions select subject wallets, never fee payers", async () => {
  const f = new Fixture([row(1, alice), row(2, bob)]);
  const v = await build(f);
  assert.deepEqual(v.members, [bob, alice].sort());
  assert(!v.members.includes(sponsor));
  assert.equal(f.requests.length, 3); // Status, full page, mandatory empty tail.
  assert(f.requests.every(q => q.height === 10n));
  assert(f.requests.every(q => !JSON.stringify(q.request).includes("decisions_by_author")));
});
test("a refusal supersedes a still-valid earlier grant across pages", async () => {
  const f = new Fixture([row(1, alice), row(2, bob), row(3, alice, false)]);
  assert.deepEqual((await build(f)).members, [bob]);
});
test("a later independently funded assessment may grant again", async () => {
  const f = new Fixture([row(1), row(2, alice, false), row(3, alice, true, bob)]);
  assert.deepEqual((await build(f)).members, [alice]);
});
test("unrelated regime and governance records do not erase a refusal", async () => {
  const unrelated = patch(row(3), { case: "ctx{intent:note,regime:other,subject:someone,nested:obj{intent:qualify_wallet_v1}}", verdict: "not_an_entitlement" });
  const gov = patch(row(4), { case: `ctx{intent:'gov:revise_constitution',regime:${STRICT_REGIME},subject:${alice}}`, verdict: "'gov:permitted'" });
  assert.deepEqual((await build(new Fixture([row(1), row(2, alice, false), unrelated, gov]))).members, []);
});
test("complete multi-page history, deterministic manifest and sorted set", async () => {
  const rows = Array.from({ length: 11 }, (_, i) => row(i + 1, i % 2 ? bob : alice));
  const a = await build(new Fixture(rows));
  const b = await build(new Fixture(rows), { ...policy, pageLimit: 3 });
  assert.equal(a.recordsRead, 11); assert.equal(a.viewId, b.viewId);
});
test("the same block's hexadecimal case cannot split common view fingerprints", async () => {
  const upper = new Fixture([row(1)]);
  upper.context = async () => ({ ...context, hash: context.hash.toUpperCase() });
  assert.equal((await build(upper)).viewId, (await build(new Fixture([row(1)]))).viewId);
});
test("source changes while reading a snapshot make it unavailable", async () => {
  const f = new Fixture([row(1)]); f.fork = true;
  await assert.rejects(build(f), /Source changed/);
});
test("an unavailable page never yields a partial or cached favorable set", async () => {
  const f = new Fixture([row(1), row(2, bob), row(3, alice, false)]); f.failCursor = 2;
  await assert.rejects(build(f), /page unavailable/);
});
test("pagination budget exhaustion is not successful truncation", async () => {
  await assert.rejects(build(new Fixture([row(1), row(2)]), { ...policy, maxPages: 1 }), /budget exhausted/);
});
test("historical receipt height and current constitution must match", async () => {
  const f = new Fixture([row(1)]); f.receiptHeight = 11n;
  await assert.rejects(build(f), /height not verified/);
  const g = new Fixture([row(1)]); g.revision = 2;
  await assert.rejects(build(g), /Unsupported current constitution/);
});
test("source chain, gov instance and code checksum are pinned", async () => {
  for (const changes of [{ chainId: "other" }, { govAddress: "other" }, { codeChecksum: "ef".repeat(32) }]) {
    await assert.rejects(build(new Fixture([row(1)]), { ...policy, ...changes }), /context mismatch/);
  }
});
test("duplicate records and descending height cannot create a selected set", async () => {
  await assert.rejects(build(new Fixture([row(1), row(1)])), /duplicate/);
  await assert.rejects(build(new Fixture([row(1), patch(row(2), { block_height: 7 })])), /unordered/);
});
test("no eligibility fallback to older constitutional versions", async () => {
  const latest = patch(row(2), { constitution_revision: 0 });
  assert.deepEqual((await build(new Fixture([row(1), latest]))).members, []);
});
test("expired latest grant never resurrects an older grant", async () => {
  const p = { ...policy, maxSnapshotAgeSeconds: 30n };
  const f = new Fixture([row(1, alice, true, sponsor, 0)]);
  const c = { ...context, time: 259200n };
  f.context = async () => c;
  const v = await buildWalletSnapshot(f, p, 10n, { start: 259200n, end: 259220n }, 259205n);
  assert.deepEqual(v.members, []);
});
test("a grant expiring exactly at common-window end covers that half-open window", async () => {
  const f = new Fixture([row(1, alice, true, sponsor, 0)]);
  f.context = async () => ({ ...context, time: 259180n });
  const v = await buildWalletSnapshot(f, policy, 10n, { start: 259180n, end: 259200n }, 259185n);
  assert.deepEqual(v.members, [alice]);
});
test("snapshot and external rights share a bounded common window", async () => {
  const v = await build(new Fixture([row(1)]));
  assertSnapshotUsable(v, 119n);
  assert.throws(() => assertSnapshotUsable(v, 120n), /expired/);
  await assert.rejects(build(new Fixture([row(1)]), { ...policy, maxSnapshotAgeSeconds: 19n }), /freshness/);
  await assert.rejects(build(new Fixture([row(1)]), { ...policy, maxLeaseSeconds: 19n }), /freshness/);
});
test("empty complete history grants nobody", async () => {
  assert.deepEqual((await build(new Fixture([]))).members, []);
});
test("a caller cannot mutate the common window after membership selection", async () => {
  const input = { start: 100n, end: 120n };
  const v = await buildWalletSnapshot(new Fixture([row(1)]), policy, 10n, input, 105n);
  input.end = 999999n;
  assert.equal(v.window.end, 120n);
  assert.throws(() => { (v.window as { end: bigint }).end = 999999n; }, TypeError);
  assert.throws(() => assertSnapshotUsable(v, 121n), /expired/);
});
test("a fresh refusal cannot be displaced by the same sponsor's later unrelated record", async () => {
  const note = patch(row(3, bob), { case: "ctx{intent:note,regime:other}", verdict: "ok" });
  assert.deepEqual((await build(new Fixture([row(1), row(2, alice, false), note]))).members, []);
});

const attacks: Array<[string, (r: Row) => Row, RegExp]> = [
  ["unsafe JSON integer", r => patch(r, { decision_id: Number.MAX_SAFE_INTEGER + 1 }), /Invalid decision id/],
  ["missing decision", r => patch(r, { decision_id: 2 }), /Missing/],
  ["future height", r => patch(r, { block_height: 11 }), /future/],
  ["future time", r => patch(r, { block_time_seconds: 101 }), /future/],
  ["forged verdict hash", r => ({ ...r, verdict_hash: h("forged") }), /hash mismatch/],
  ["subject mismatch", r => patch(r, { case: assessmentCase(bob) }), /mismatched/],
  ["unsupported schema", r => patch(r, { verdict: String(r.verdict).replace("wallet_entitlement_v1", "wallet_entitlement_v2") }), /Unknown/],
  ["unsupported target act", r => patch(r, { case: String(r.case).replace("qualify_wallet_v1", "qualify_wallet_v2") }), /Unknown/],
  ["caller commitment", r => patch(r, { case: String(r.case).replace("ctx{", "ctx{commitment:secret,") }), /Unexpected/],
  ["session in public case", r => patch(r, { case: String(r.case).replace("ctx{", "ctx{challenge:bot_nonce,") }), /Unexpected/],
  ["duplicate subject", r => patch(r, { case: String(r.case).replace("ctx{", `ctx{subject:${bob},`) }), /Duplicate/],
  ["non-block decision time", r => patch(r, { verdict: String(r.verdict).replace(",90,259290)", ",89,259289)") }), /block time/],
  ["extended expiry", r => patch(r, { verdict: String(r.verdict).replace("259290)", "259291)") }), /window/],
  ["unversioned refusal", r => patch(r, { verdict: "'gov:forbidden'" }), /Unknown/],
  ["quoted structural injection", r => patch(r, { case: `ctx{intent:note,regime:other,text:'intent:qualify_wallet_v1,subject:${alice}'}` }), /regime mismatch/],
  ["unbalanced case", r => patch(r, { case: "ctx{intent:qualify_wallet_v1,subject:obj{bad:1}" }), /Unbalanced/]
];
for (const [name, attack, message] of attacks) test(`reject ${name} without older-grant fallback`, async () => {
  await assert.rejects(build(new Fixture([attack(row(1))])), message);
});

test("canonical assessment case carries no secret or Telegram data", () => {
  assert.equal(assessmentCase(alice), `ctx{intent:qualify_wallet_v1,regime:${STRICT_REGIME},subject:${alice}}`);
  assert.throws(() => assessmentCase("axone1evil').call(bad)"), /wallet syntax/);
});

test("REST adapter pins contract code and all smart queries at the requested height", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    let body: unknown = { data: { decisions: [] } };
    if (url.includes("/blocks/")) body = { block_id: { hash: context.hash },
      block: { header: { chain_id: "local", height: "10", time: "1970-01-01T00:01:40Z" } } };
    else if (url.endsWith("/code/1")) body = { code_info: { data_hash: Buffer.from(codeChecksum, "hex").toString("base64") } };
    else if (!url.includes("/smart/")) body = { contract_info: { code_id: "1" } };
    return new Response(JSON.stringify(body), { headers: { "x-cosmos-block-height": "10" } });
  }) as typeof fetch;
  const source = new GovRestSource("https://node.example", "gov-fixture", fetcher);
  assert.deepEqual(await source.context(10n), context);
  assert.equal((await source.queryGov({ decisions: { start_after: null, limit: 2 } }, 10n)).height, 10n);
  assert(calls.every(c => new Headers(c.init?.headers).get("x-cosmos-block-height") === "10"));
  const wire = JSON.parse(Buffer.from(decodeURIComponent(calls.at(-1)!.url.split("/smart/")[1]!), "base64").toString());
  assert.deepEqual(wire, { module: { decisions: { start_after: null, limit: 2 } } });
});
test("REST normalizes protobuf base64 block IDs and hex code digests to one identity", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    let body: unknown;
    if (url.includes("/blocks/")) body = { block_id: { hash: Buffer.from(context.hash, "hex").toString("base64") },
      sdk_block: { header: { chain_id: "local", height: "10", time: "1970-01-01T00:01:40.000000001Z" } } };
    else if (url.includes("/code/")) body = { code_info: { data_hash: codeChecksum.toUpperCase() } };
    else body = { contract_info: { code_id: "1" } };
    return new Response(JSON.stringify(body), { headers: { "x-cosmos-block-height": url.includes("/blocks/") ? "11" : "10" } });
  }) as typeof fetch;
  assert.deepEqual(await new GovRestSource("https://node.example", "gov-fixture", fetcher).context(10n), context);
});
for (const header of [null, "11"]) test(`REST adapter rejects missing/wrong response height ${header}`, async () => {
  const fetcher = (async () => new Response('{"data":{}}', { headers: header ? { "x-cosmos-block-height": header } : {} })) as typeof fetch;
  await assert.rejects(new GovRestSource("https://node.example", "gov", fetcher).queryGov({}, 10n), /response-height/);
});
test("REST accepts the gateway metadata header and rejects conflicting receipts", async () => {
  for (const conflict of [false, true]) {
    const headers: Record<string, string> = { "grpc-metadata-x-cosmos-block-height": "10" };
    if (conflict) headers["x-cosmos-block-height"] = "11";
    const fetcher = (async () => new Response('{"data":{}}', { headers })) as typeof fetch;
    const query = new GovRestSource("https://node.example", "gov", fetcher).queryGov({}, 10n);
    if (conflict) await assert.rejects(query, /response-height/);
    else assert.equal((await query).height, 10n);
  }
});
