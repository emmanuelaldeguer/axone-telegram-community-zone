import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { buildWalletSnapshot } from '../dist/src/zone/wallet-snapshot.js';
import { GovRestSource } from '../dist/src/zone/gov-rest-source.js';

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const policy = { ...config.policy };
for (const key of ['constitutionRevision', 'maxSnapshotAgeSeconds', 'maxLeaseSeconds']) policy[key] = BigInt(policy[key]);
const source = new GovRestSource(config.restUrl, policy.govAddress);
const view = await buildWalletSnapshot(source, policy, BigInt(config.height),
  { start: BigInt(config.window.start), end: BigInt(config.window.end) }, BigInt(config.now));
assert.deepEqual(view.members, [...config.expectedMembers].sort());
assert.equal(view.source.hash, config.expectedBlockHash);
console.log(JSON.stringify(view, (_, value) => typeof value === 'bigint' ? value.toString() : value));
