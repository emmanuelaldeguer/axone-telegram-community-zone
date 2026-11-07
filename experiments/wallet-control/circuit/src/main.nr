mod tests;
// Experimental relation: ADR-036 signature -> canonical Cosmos address -> membership.
// Only root and challenge are public. Never use a non-ZK proof target.
mod sha256;
use sha256::digest;
use ripemd160::ripemd160;

fn main(
    root: pub [u8; 32],
    challenge: pub [u8; 32],
    pub_x: [u8; 32],
    pub_y: [u8; 32],
    signature: [u8; 64],
    siblings: [[u8; 32]; 8],
    positions: [bool; 8],
) {
    let mut compressed: [u8; 33] = [0; 33];
    compressed[0] = 2 + (pub_y[31] & 1);
    for i in 0..32 { compressed[i + 1] = pub_x[i]; }
    let address = ripemd160(digest(compressed));
    let message_hash = sign_digest(address, challenge);
    assert(std::ecdsa_secp256k1::verify_signature(pub_x, pub_y, signature, message_hash));
    let mut leaf: [u8; 21] = [0; 21];
    for i in 0..20 { leaf[i + 1] = address[i]; }
    let mut node = digest(leaf);
    for level in 0..8 {
        let mut pair: [u8; 65] = [0; 65];
        pair[0] = 1;
        for i in 0..32 {
            pair[i + 1] = if positions[level] { siblings[level][i] } else { node[i] };
            pair[i + 33] = if positions[level] { node[i] } else { siblings[level][i] };
        }
        node = digest(pair);
    }
    assert(node == root);
}

// BIP-173 bech32, fixed HRP "axone", 20-byte secp256k1 account payload.
fn bech32(address: [u8; 20]) -> [u8; 44] {
    let alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l".as_bytes();
    let mut words: [u8; 32] = [0; 32];
    for i in 0..32 {
        let mut word: u8 = 0;
        for j in 0..5 {
            let bit = i * 5 + j;
            word = (word << 1) | ((address[bit / 8] >> ((7 - bit % 8) as u8)) & 1);
        }
        words[i] = word;
    }
    let hrp = [3, 3, 3, 3, 3, 0, 1, 24, 15, 14, 5];
    let mut chk: u32 = 1;
    for v in hrp { chk = polymod(chk, v); }
    for v in words { chk = polymod(chk, v); }
    for _ in 0..6 { chk = polymod(chk, 0); }
    chk = chk ^ 1;
    let mut out: [u8; 44] = [0; 44];
    let head = "axone1".as_bytes();
    for i in 0..6 { out[i] = head[i]; }
    for i in 0..32 { out[i + 6] = alphabet[words[i] as u32]; }
    for i in 0..6 { out[i + 38] = alphabet[((chk >> (5 * (5 - i))) & 31) as u32]; }
    out
}
fn polymod(chk: u32, v: u8) -> u32 {
    let top = chk >> 25;
    let generators: [u32; 5] = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let mut next = ((chk & 0x1ffffff) << 5) ^ (v as u32);
    for i in 0..5 { if ((top >> i) & 1) == 1 { next = next ^ generators[i]; } }
    next
}

// Exact sorted Amino JSON bytes used by ADR-036 signArbitrary.
fn sign_digest(address: [u8; 20], challenge: [u8; 32]) -> [u8; 32] {
    let mut message: [u8; 89] = [0; 89];
    let prefix = "axone-private-publish-v1:".as_bytes();
    for i in 0..25 { message[i] = prefix[i]; }
    let hex = "0123456789abcdef".as_bytes();
    for i in 0..32 {
        message[25 + i * 2] = hex[(challenge[i] >> 4) as u32];
        message[26 + i * 2] = hex[(challenge[i] & 15) as u32];
    }
    let mut b64: [u8; 120] = [61; 120];
    let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".as_bytes();
    for i in 0..30 {
        let a = message[i * 3] as u32;
        let b = if i * 3 + 1 < 89 { message[i * 3 + 1] as u32 } else { 0 };
        let c = if i * 3 + 2 < 89 { message[i * 3 + 2] as u32 } else { 0 };
        let n = (a << 16) | (b << 8) | c;
        b64[i * 4] = alphabet[(n >> 18) & 63];
        b64[i * 4 + 1] = alphabet[(n >> 12) & 63];
        if i * 3 + 1 < 89 { b64[i * 4 + 2] = alphabet[(n >> 6) & 63]; }
        if i * 3 + 2 < 89 { b64[i * 4 + 3] = alphabet[n & 63]; }
    }
    let signer = bech32(address);
    let mut doc: [u8; 324] = [0; 324];
    let part0 = "{\"account_number\":\"0\",\"chain_id\":\"\",\"fee\":{\"amount\":[],\"gas\":\"0\"},\"memo\":\"\",\"msgs\":[{\"type\":\"sign/MsgSignData\",\"value\":{\"data\":\"".as_bytes();
    for i in 0..128 { doc[0 + i] = part0[i]; }
    for i in 0..120 { doc[128 + i] = b64[i]; }
    let part2 = "\",\"signer\":\"".as_bytes();
    for i in 0..12 { doc[248 + i] = part2[i]; }
    for i in 0..44 { doc[260 + i] = signer[i]; }
    let part4 = "\"}}],\"sequence\":\"0\"}".as_bytes();
    for i in 0..20 { doc[304 + i] = part4[i]; }
    digest(doc)
}
