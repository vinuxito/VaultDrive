/**
 * Shamir's Secret Sharing over GF(256)
 */

const exp = new Uint8Array(256);
const log = new Uint8Array(256);

// Initialize GF(256) exp and log tables using generator 3 or 2.
// Standard AES polynomial: x^8 + x^4 + x^3 + x^2 + 1 (0x11d)
let x = 1;
for (let i = 0; i < 255; i++) {
  exp[i] = x;
  log[x] = i;
  x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
}
exp[255] = 1;

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return exp[(log[a] + log[b]) % 255];
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero");
  if (a === 0) return 0;
  return exp[(log[a] - log[b] + 255) % 255];
}

export interface ShamirShare {
  x: number; // 1-indexed, e.g. 1 to N
  y: Uint8Array;
}

/**
 * Splits a secret byte array into N shares, requiring T shares to reconstruct.
 */
export function shamirSplit(secret: Uint8Array, N: number, T: number): ShamirShare[] {
  if (T < 1 || N < T || N >= 256) {
    throw new Error("Invalid parameters: T must be >= 1, N >= T, and N < 256");
  }

  const shares: ShamirShare[] = [];
  for (let i = 1; i <= N; i++) {
    shares.push({
      x: i,
      y: new Uint8Array(secret.length),
    });
  }

  const poly = new Uint8Array(T);
  for (let j = 0; j < secret.length; j++) {
    poly[0] = secret[j];
    
    // Generate random coefficients for x^1 ... x^(T-1)
    if (T > 1) {
      window.crypto.getRandomValues(poly.subarray(1));
    }

    // Evaluate polynomial at x = 1..N
    for (let i = 1; i <= N; i++) {
      let val = poly[0];
      let xPower = 1;
      for (let k = 1; k < T; k++) {
        xPower = gfMul(xPower, i);
        val ^= gfMul(poly[k], xPower);
      }
      shares[i - 1].y[j] = val;
    }
  }

  return shares;
}

/**
 * Reconstructs the secret byte array from a list of shares.
 */
export function shamirReconstruct(shares: ShamirShare[], T: number): Uint8Array {
  if (shares.length < T) {
    throw new Error("Not enough shares to reconstruct");
  }

  const subset = shares.slice(0, T);
  const len = subset[0].y.length;
  const secret = new Uint8Array(len);
  const xs = subset.map(s => s.x);

  // Precompute Lagrange basis polynomials at x = 0
  const l = new Uint8Array(T);
  for (let k = 0; k < T; k++) {
    let basis = 1;
    for (let m = 0; m < T; m++) {
      if (m !== k) {
        const num = xs[m];
        const den = xs[k] ^ xs[m];
        basis = gfMul(basis, gfDiv(num, den));
      }
    }
    l[k] = basis;
  }

  // Interpolate each byte
  for (let j = 0; j < len; j++) {
    let val = 0;
    for (let k = 0; k < T; k++) {
      val ^= gfMul(subset[k].y[j], l[k]);
    }
    secret[j] = val;
  }

  return secret;
}
