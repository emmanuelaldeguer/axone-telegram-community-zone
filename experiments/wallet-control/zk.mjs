import { Barretenberg, BackendType, UltraHonkBackend, UltraHonkVerifierBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import { sha256, hex, publicInputs } from './protocol.mjs';

// Compiler/runtime/back-end versions are exact in package-lock.json.
// Explicit ZK mode; never select evm-no-zk or keccak:true for privacy.
export const PROOF_OPTIONS = Object.freeze({ verifierTarget: 'evm' });
export function circuitIdentity(artifact, verificationKey) {
  return hex(sha256(Buffer.from(JSON.stringify({
    scheme: 'axone-adr036-hash160-merkle8-ultrahonk-zk-v1',
    noir: '1.0.0-beta.18', bb: '3.0.0-nightly.20260102', target: 'evm',
    bytecode: artifact.bytecode, abi: artifact.abi, vk: Buffer.from(verificationKey).toString('base64'),
  }))));
}
export async function createZk(artifact) {
  // Explicit WASM also in Node: this tests the browser-capable proving engine.
  const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1 });
  const backend = new UltraHonkBackend(artifact.bytecode, api);
  const verificationKey = await backend.getVerificationKey(PROOF_OPTIONS);
  const verifier = new UltraHonkVerifierBackend(api);
  const noir = new Noir(artifact);
  return {
    circuitId: circuitIdentity(artifact, verificationKey),
    verificationKey,
    execute: (input) => noir.execute(input),
    async prove(input) {
      const { witness } = await noir.execute(input);
      const result = await backend.generateProof(witness, PROOF_OPTIONS);
      const expected = publicInputs(hex(input.root), hex(input.challenge));
      if (JSON.stringify(result.publicInputs) !== JSON.stringify(expected)) throw Error('Unexpected public input ABI');
      return result;
    },
    async verify(data) {
      try { return await verifier.verifyProof({ ...data, verificationKey }, PROOF_OPTIONS); }
      catch { return false; }
    },
    destroy: () => api.destroy(),
  };
}
