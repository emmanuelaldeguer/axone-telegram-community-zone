// Fixed-length SHA-256 padding, fully constrained. No unconstrained helpers.
// FIPS 180-4; compression is Noir's built-in SHA-256 black box.
pub fn digest<let N: u32>(message: [u8; N]) -> [u8; 32] {
    let mut padded: [u8; ((N + 9 + 63) / 64) * 64] = [0; ((N + 9 + 63) / 64) * 64];
    for i in 0..N { padded[i] = message[i]; }
    padded[N] = 0x80;
    let bits = (N as u64) * 8;
    for i in 0..8 { padded[padded.len() - 1 - i] = ((bits >> ((i * 8) as u64)) & 255) as u8; }
    let mut state: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    for block in 0..(padded.len() / 64) {
        let mut words: [u32; 16] = [0; 16];
        for i in 0..16 {
            for j in 0..4 { words[i] = (words[i] << 8) | (padded[block * 64 + i * 4 + j] as u32); }
        }
        state = std::hash::sha256_compression(words, state);
    }
    let mut out: [u8; 32] = [0; 32];
    for i in 0..8 {
        for j in 0..4 { out[i * 4 + j] = ((state[i] >> (24 - j * 8)) & 255) as u8; }
    }
    out
}
