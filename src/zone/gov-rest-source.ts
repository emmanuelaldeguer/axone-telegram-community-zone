import { uint, type BlockContext, type HeightReceipt, type SnapshotSource } from "./wallet-snapshot.js";

type Obj = Record<string, unknown>;
function obj(x: unknown): Obj {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw Error("Invalid chain response");
  return x as Obj;
}
function str(x: unknown): string { if (typeof x !== "string") throw Error("Invalid chain string"); return x; }
function digest(x: unknown): string {
  const s = str(x);
  if (/^[0-9a-fA-F]{64}$/.test(s)) return s.toLowerCase();
  const bytes = Buffer.from(s, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== s) throw Error("Invalid chain digest");
  return bytes.toString("hex");
}

/** Trusted REST/full-node adapter. Header checks are NOT cryptographic state proofs.
 * Historical-state access and the SDK response-height header are mandatory.
 * A proxy omitting that header is rejected rather than labelled as height-pinned.
 */
export class GovRestSource implements SnapshotSource {
  constructor(private readonly restUrl: string, private readonly govAddress: string,
    private readonly fetchImpl: typeof fetch = fetch, private readonly timeoutMs = 15000) {
    new URL(restUrl);
  }

  private async read(path: string, height: bigint, requireReceipt = true): Promise<HeightReceipt> {
    const response = await this.fetchImpl(new URL(path, this.restUrl), {
      headers: { accept: "application/json", "x-cosmos-block-height": height.toString() },
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    if (!response.ok) throw Error(`Historical chain query failed: ${response.status}`);
    const headers = [response.headers.get("x-cosmos-block-height"),
      response.headers.get("grpc-metadata-x-cosmos-block-height")].filter((h): h is string => h !== null);
    if (requireReceipt && (headers.length === 0 || headers.some(h => uint(h, "response height") !== height)))
      throw Error("Missing or incorrect SDK response-height header");
    return { height, data: await response.json() };
  }

  async context(height: bigint): Promise<BlockContext> {
    const [blockResponse, contractResponse] = await Promise.all([
      this.read(`/cosmos/base/tendermint/v1beta1/blocks/${height}`, height, false),
      this.read(`/cosmwasm/wasm/v1/contract/${encodeURIComponent(this.govAddress)}`, height)
    ]);
    const blockData = obj(blockResponse.data), block = obj(blockData.sdk_block ?? blockData.block), header = obj(block.header);
    if (uint(header.height, "block height") !== height) throw Error("Incorrect block height");
    const codeId = uint(obj(obj(contractResponse.data).contract_info).code_id, "code id");
    const codeData = obj((await this.read(`/cosmwasm/wasm/v1/code/${codeId}`, height)).data);
    const checksum = digest(obj(codeData.code_info).data_hash);
    const timestamp = str(header.time);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(timestamp)) throw Error("Invalid block timestamp");
    const milliseconds = Date.parse(timestamp);
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw Error("Invalid block time");
    return { chainId: str(header.chain_id), height, hash: digest(obj(blockData.block_id).hash),
      time: BigInt(Math.floor(milliseconds / 1000)), govAddress: this.govAddress,
      codeChecksum: checksum };
  }

  async queryGov(request: object, height: bigint): Promise<HeightReceipt> {
    const body = Buffer.from(JSON.stringify({ module: request })).toString("base64");
    const response = await this.read(`/cosmwasm/wasm/v1/contract/${encodeURIComponent(this.govAddress)}/smart/${encodeURIComponent(body)}`, height);
    return { height: response.height, data: obj(response.data).data };
  }
}
