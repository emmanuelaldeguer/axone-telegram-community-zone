import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { sha256, hex } from './protocol.mjs';

const version = execFileSync('nargo', ['--version'], { encoding: 'utf8' });
assert.match(version, /nargo version = 1\.0\.0-beta\.18\n/);
assert.match(version, /99bb8b5cf33d7669adbdef096b12d80f30b4c0c9/);
for (const [path, expected] of [
  ['@noir-lang/noir_js', '1.0.0-beta.18'],
  ['@aztec/bb.js', '3.0.0-nightly.20260102'],
]) {
  const manifest = JSON.parse(await readFile(new URL(`node_modules/${path}/package.json`, import.meta.url)));
  assert.equal(manifest.version, expected);
}
const vendor = new URL('circuit/vendor/ripemd160/', import.meta.url);
const upstream = JSON.parse(await readFile(new URL('UPSTREAM.json', vendor)));
for (const [file, expected] of Object.entries(upstream.files)) assert.equal(hex(sha256(await readFile(new URL(file, vendor)))), expected, `Modified vendor source: ${file}`);
console.log('Exact compiler, runtime, backend and unmodified RIPEMD-160 sources verified');
