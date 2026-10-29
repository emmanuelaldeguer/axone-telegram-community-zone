import { createHash } from "node:crypto";

export const ASSESSMENT_INTENT = "qualify_wallet_v1";
export const STRICT_REGIME = "telegram_publish_strict_v1";
const VALIDITY = 259200n;
const U64_MAX = (1n << 64n) - 1n;
const WALLET = /^axone1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38}$/;
const sha = (text: string) => createHash("sha256").update(text).digest("base64");

export interface BlockContext {
  chainId: string;
  height: bigint;
  hash: string;
  time: bigint;
  govAddress: string;
  codeChecksum: string;
}
export interface HeightReceipt { height: bigint; data: unknown }
/** The implementation is a trusted chain-state reader, not a state proof. */
export interface SnapshotSource {
  context(height: bigint): Promise<BlockContext>;
  queryGov(request: object, height: bigint): Promise<HeightReceipt>;
}
export interface SnapshotPolicy {
  chainId: string;
  govAddress: string;
  codeChecksum: string;
  constitutionRevision: bigint;
  constitutionHash: string; // Canonical base64 of the on-chain 32-byte hash.
  maxSnapshotAgeSeconds: bigint; // Required; no hidden deployment default.
  maxLeaseSeconds: bigint;
  pageLimit: number;
  maxPages: number; // Hitting the budget errors; it never returns a partial set.
}
export interface CommonWindow { readonly start: bigint; readonly end: bigint }
export interface WalletSnapshot {
  source: BlockContext;
  constitutionRevision: bigint;
  constitutionHash: string;
  regime: typeof STRICT_REGIME;
  window: CommonWindow;
  maxSnapshotAgeSeconds: bigint;
  members: readonly string[]; // Public common set, never a per-session member query.
  recordsRead: number;
  viewId: string; // Manifest fingerprint, NOT a Merkle root or ZK proof.
}
type Row = Record<string, unknown>;

function object(value: unknown, label: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(`Invalid ${label}`);
  return value as Row;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw Error(`Invalid ${label}`);
  return value;
}
export function uint(value: unknown, label: string): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) value = String(value);
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) throw Error(`Invalid ${label}`);
  const parsed = BigInt(value);
  if (parsed > U64_MAX) throw Error(`${label} exceeds uint64`);
  return parsed;
}
function hash32(value: unknown, label: string): string {
  const s = text(value, label);
  const bytes = Buffer.from(s, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== s) throw Error(`Invalid ${label}`);
  return s;
}
/** Syntax only. The native staking/bech32 libraries validate the checksum. */
export function walletSyntax(value: string): boolean { return WALLET.test(value); }
export function assessmentCase(subject: string): string {
  if (!walletSyntax(subject)) throw Error("Invalid canonical wallet syntax");
  return `ctx{intent:${ASSESSMENT_INTENT},regime:${STRICT_REGIME},subject:${subject}}`;
}

// Non-executing top-level Prolog dict reader. Nested values remain opaque data.
// Quotes and balanced delimiters are tracked, so nested/spoofed keys cannot win.
function fields(input: string): { tag: string; values: Map<string, string> } {
  const match = /^([a-z][A-Za-z0-9_]*)\s*\{([\s\S]*)\}\s*$/.exec(input.trim());
  if (!match) throw Error("Unsupported recorded case encoding");
  const body = match[2]!;
  const values = new Map<string, string>();
  let start = 0, colon = -1, quote = "";
  const stack: string[] = [];
  const closing: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const emit = (end: number) => {
    if (end === start && body.trim() === "") return;
    if (colon < start) throw Error("Invalid case field");
    const key = atom(body.slice(start, colon).trim());
    const value = body.slice(colon + 1, end).trim();
    if (!value || values.has(key)) throw Error("Duplicate or empty case field");
    values.set(key, value);
    start = end + 1; colon = -1;
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quote) {
      if (c === "\\") { i++; if (i === body.length) throw Error("Incomplete quoted case"); }
      else if (c === quote) {
        if (body[i + 1] === quote) i++; else quote = "";
      }
    } else if (c === "'" || c === '"') quote = c;
    else if ("([{".includes(c)) stack.push(c);
    else if (")]}".includes(c)) { if (stack.pop() !== closing[c]) throw Error("Unbalanced case"); }
    else if (!stack.length && c === ":" && colon === -1) colon = i;
    else if (!stack.length && c === ",") emit(i);
  }
  if (quote || stack.length) throw Error("Unbalanced recorded case");
  emit(body.length);
  return { tag: match[1]!, values };
}
function atom(value: string): string {
  if (/^[a-z][A-Za-z0-9_]*$/.test(value)) return value;
  const quoted = /^'([A-Za-z0-9_:.-]+)'$/.exec(value);
  if (!quoted) throw Error("Unsupported case atom");
  return quoted[1]!;
}

interface Assessment {
  subject: string; status: "eligible" | "read_only"; at: bigint; until: bigint;
  revision: bigint; constitutionHash: string;
}
function assessment(row: Row, verdict: string): Assessment | null {
  const c = fields(text(row.case, "case"));
  const regime = c.values.has("regime") ? atom(c.values.get("regime")!) : undefined;
  const intent = c.values.has("intent") ? atom(c.values.get("intent")!) : undefined;
  const hasOurVerdict = verdict.includes(`(${STRICT_REGIME},`);
  if (regime !== STRICT_REGIME) {
    if (hasOurVerdict || (regime === undefined && intent === ASSESSMENT_INTENT)) throw Error("Case/verdict regime mismatch");
    return null;
  }
  if (intent === "gov:establish" || intent === "gov:revise_constitution") {
    if (hasOurVerdict) throw Error("Governance record is not a wallet assessment");
    return null;
  }
  if (intent !== ASSESSMENT_INTENT || c.tag !== "ctx") throw Error("Unknown target regime act");
  const allowed = new Set(["intent", "regime", "subject", "gov:module", "cw:tx"]);
  if ([...c.values.keys()].some(k => !allowed.has(k))) throw Error("Unexpected assessment field");
  const subject = atom(c.values.get("subject") ?? "");
  if (!walletSyntax(subject)) throw Error("Invalid subject wallet syntax");
  const parsed = /^wallet_entitlement_v1\(telegram_publish_strict_v1,(axone1[a-z0-9]+),(eligible|read_only),([0-9]+),([0-9]+)\)$/.exec(verdict.replace(/\s/g, ""));
  if (!parsed || parsed[1] !== subject) throw Error("Unknown or mismatched entitlement verdict");
  const at = uint(parsed[3], "assessment time"), until = uint(parsed[4], "assessment expiry");
  if (at !== uint(row.block_time_seconds, "record time")) throw Error("Assessment time is not block time");
  if (until !== (parsed[2] === "eligible" ? at + VALIDITY : at)) throw Error("Invalid entitlement window");
  return { subject, status: parsed[2] as Assessment["status"], at, until,
    revision: uint(row.constitution_revision, "record revision"),
    constitutionHash: hash32(row.constitution_hash, "record constitution hash") };
}

function checkContext(c: BlockContext, p: SnapshotPolicy, height: bigint): void {
  if (c.height !== height || c.chainId !== p.chainId || c.govAddress !== p.govAddress ||
      c.codeChecksum !== p.codeChecksum || !/^[0-9a-fA-F]{64}$/.test(c.hash) || c.time < 0n)
    throw Error("Snapshot source context mismatch");
}
/** Use a trusted verifier clock and a locally built/approved view, never an incoming manifest. */
export function assertSnapshotUsable(view: WalletSnapshot, now: bigint): void {
  if (now < view.source.time || now < view.window.start || now >= view.window.end ||
      now - view.source.time > view.maxSnapshotAgeSeconds) throw Error("Snapshot unavailable or expired");
}

export async function buildWalletSnapshot(source: SnapshotSource, policy: SnapshotPolicy,
  height: bigint, window: CommonWindow, now: bigint): Promise<WalletSnapshot> {
  if (height <= 0n || policy.constitutionRevision < 0n || policy.maxSnapshotAgeSeconds <= 0n ||
      policy.maxLeaseSeconds <= 0n || !Number.isSafeInteger(policy.pageLimit) || policy.pageLimit < 1 ||
      policy.pageLimit > 50 || !Number.isSafeInteger(policy.maxPages) || policy.maxPages < 1 ||
      !policy.chainId || !policy.govAddress || !/^[0-9a-f]{64}$/.test(policy.codeChecksum))
    throw Error("Invalid snapshot policy");
  hash32(policy.constitutionHash, "pinned constitution hash");
  const context = { ...await source.context(height) };
  checkContext(context, policy, height);
  context.hash = context.hash.toLowerCase();
  if (window.start < context.time || window.end <= window.start ||
      window.end - window.start > policy.maxLeaseSeconds ||
      window.end > context.time + policy.maxSnapshotAgeSeconds)
    throw Error("Common rights window exceeds expiry/freshness policy");
  const query = async (request: object) => {
    const receipt = await source.queryGov(request, height);
    if (receipt.height !== height) throw Error("Historical query height not verified");
    return object(receipt.data, "gov response");
  };
  const status = await query({ constitution_status: {} });
  if (uint(status.constitution_revision, "revision") !== policy.constitutionRevision ||
      hash32(status.constitution_hash, "constitution hash") !== policy.constitutionHash)
    throw Error("Unsupported current constitution");
  const latest = new Map<string, Assessment>();
  let cursor = 0n, count = 0, lastHeight = 0n, lastTime = 0n, complete = false;
  for (let page = 0; page < policy.maxPages; page++) {
    // JSON numbers above MAX_SAFE_INTEGER are rejected, never rounded.
    if (cursor > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Cursor needs a lossless uint64 transport");
    const response = await query({ decisions: {
      start_after: cursor ? Number(cursor) : null, limit: policy.pageLimit } });
    if (!Array.isArray(response.decisions) || response.decisions.length > policy.pageLimit) throw Error("Invalid decision page");
    for (const item of response.decisions) {
      const row = object(item, "decision"), id = uint(row.decision_id, "decision id");
      const h = uint(row.block_height, "record height"), t = uint(row.block_time_seconds, "record time");
      if (id !== cursor + 1n || h > height || h < lastHeight || t < lastTime || t > context.time)
        throw Error("Missing, duplicate, unordered or future decision");
      const verdict = text(row.verdict, "verdict");
      if (!text(row.author, "submitter")) throw Error("Missing submitter");
      for (const field of ["case", "verdict"])
        if (sha(text(row[field], field)) !== hash32(row[field + "_hash"], field + " hash")) throw Error("Decision payload hash mismatch");
      if (row.motivation !== null && row.motivation !== undefined) {
        if (sha(text(row.motivation, "motivation")) !== hash32(row.motivation_hash, "motivation hash")) throw Error("Motivation hash mismatch");
      } else if (row.motivation_hash !== null && row.motivation_hash !== undefined) throw Error("Unexpected motivation hash");
      const a = assessment(row, verdict);
      if (a) latest.set(a.subject, a); // Includes refusals; author never selects a member.
      cursor = id; lastHeight = h; lastTime = t; count++;
    }
    if (response.decisions.length < policy.pageLimit) { complete = true; break; }
  }
  if (!complete) throw Error("History pagination budget exhausted; no partial set");
  const after = await source.context(height);
  checkContext(after, policy, height);
  if (after.hash.toLowerCase() !== context.hash || after.time !== context.time) throw Error("Source changed during snapshot");
  const members = [...latest.values()].filter(a => a.status === "eligible" && a.until >= window.end &&
    a.revision === policy.constitutionRevision && a.constitutionHash === policy.constitutionHash)
    .map(a => a.subject).sort();
  const manifest = { chain: policy.chainId, gov: policy.govAddress, code: policy.codeChecksum,
    height: height.toString(), blockHash: context.hash, regime: STRICT_REGIME,
    revision: policy.constitutionRevision.toString(), constitution: policy.constitutionHash,
    start: window.start.toString(), end: window.end.toString(), members };
  const view: WalletSnapshot = { source: Object.freeze(context), constitutionRevision: policy.constitutionRevision,
    constitutionHash: policy.constitutionHash, regime: STRICT_REGIME, window: Object.freeze({ ...window }),
    maxSnapshotAgeSeconds: policy.maxSnapshotAgeSeconds, members: Object.freeze(members), recordsRead: count,
    viewId: createHash("sha256").update(JSON.stringify(manifest)).digest("hex") };
  assertSnapshotUsable(view, now);
  return Object.freeze(view);
}
