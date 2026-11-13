/**
 * Sovereign Client-Side QR Matrix Generator (ISO/IEC 18004 Byte Mode, ECC Level L)
 * Generates scannable QR matrices (Versions 1..10, up to 271 UTF-8 bytes) strictly
 * in browser memory so zero-knowledge #key URLs never leave the client device.
 */

interface VersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks1: number;
  dataCwBlock1: number;
  numBlocks2: number;
  dataCwBlock2: number;
  alignmentCenters: number[];
}

// Versions 1–10 specs for ECC Level L (Byte mode capacity up to 271 bytes)
const VERSION_SPECS_L: VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewordsPerBlock: 7, numBlocks1: 1, dataCwBlock1: 19, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewordsPerBlock: 10, numBlocks1: 1, dataCwBlock1: 34, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewordsPerBlock: 15, numBlocks1: 1, dataCwBlock1: 55, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewordsPerBlock: 20, numBlocks1: 1, dataCwBlock1: 80, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewordsPerBlock: 26, numBlocks1: 1, dataCwBlock1: 108, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, ecCodewordsPerBlock: 18, numBlocks1: 2, dataCwBlock1: 68, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [6, 34] },
  { version: 7, size: 45, dataCodewords: 156, ecCodewordsPerBlock: 20, numBlocks1: 2, dataCwBlock1: 78, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [6, 22, 38] },
  { version: 8, size: 49, dataCodewords: 194, ecCodewordsPerBlock: 24, numBlocks1: 2, dataCwBlock1: 97, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [6, 24, 42] },
  { version: 9, size: 53, dataCodewords: 232, ecCodewordsPerBlock: 30, numBlocks1: 2, dataCwBlock1: 116, numBlocks2: 0, dataCwBlock2: 0, alignmentCenters: [6, 26, 46] },
  { version: 10, size: 57, dataCodewords: 274, ecCodewordsPerBlock: 18, numBlocks1: 2, dataCwBlock1: 68, numBlocks2: 2, dataCwBlock2: 69, alignmentCenters: [6, 28, 50] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    for (let j = 0; j < ecLen; j++) {
      rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text);
  // Choose smallest version that fits: 4 bits mode + (8 or 16) bits len + 8*N bits
  let spec = VERSION_SPECS_L[VERSION_SPECS_L.length - 1];
  let found = false;
  for (const candidate of VERSION_SPECS_L) {
    const lenBits = candidate.version <= 9 ? 8 : 16;
    const maxBytes = Math.floor((candidate.dataCodewords * 8 - 4 - lenBits) / 8);
    if (utf8.length <= maxBytes) {
      spec = candidate;
      found = true;
      break;
    }
  }
  // Truncate safely only if input exceeds 271 bytes (rare for compact share URLs)
  const payload = found ? utf8 : utf8.slice(0, 270);

  // Build bit buffer
  const bits: number[] = [];
  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator = 0100
  pushBits(0b0100, 4);
  pushBits(payload.length, spec.version <= 9 ? 8 : 16);
  for (let i = 0; i < payload.length; i++) {
    pushBits(payload[i], 8);
  }

  const totalDataBits = spec.dataCodewords * 8;
  const terminator = Math.min(4, totalDataBits - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCw = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataCw[i] = b;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < spec.dataCodewords; i++, p++) {
    dataCw[i] = padBytes[p % 2];
  }

  // Split into RS blocks & interleave
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < spec.numBlocks1; b++) {
    const slice = dataCw.slice(offset, offset + spec.dataCwBlock1);
    offset += spec.dataCwBlock1;
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeRemainder(slice, spec.ecCodewordsPerBlock));
  }
  for (let b = 0; b < spec.numBlocks2; b++) {
    const slice = dataCw.slice(offset, offset + spec.dataCwBlock2);
    offset += spec.dataCwBlock2;
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeRemainder(slice, spec.ecCodewordsPerBlock));
  }

  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(spec.dataCwBlock1, spec.dataCwBlock2);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) finalCodewords.push(blk[i]);
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const blk of ecBlocks) {
      finalCodewords.push(blk[i]);
    }
  }

  // Initialize matrix
  const size = spec.size;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark;
      isFunction[r][c] = true;
    }
  };

  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunc(r, c, inOuter && (onBorder || inCore));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = centers[i];
      const cc = centers[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunc(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Reserve format info & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }
  setFunc(size - 8, 8, true);

  // Version info for >= 7
  if (spec.version >= 7) {
    let rem = spec.version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    const vBits = (spec.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  // Place data bits in zigzag
  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const cw = finalCodewords[bitIdx >>> 3];
            dark = ((cw >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Apply Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) {
            dark = !dark;
          }
          modules[r][c] = dark;
        }
      }
    }
    upward = !upward;
  }

  // Format bits for ECC Level L (01) + Mask 0 (000) => BCH + XOR 0x5412 = 0x77c4
  const formatBits = 0x77c4;
  for (let i = 0; i <= 5; i++) setFunc(8, i, ((formatBits >>> i) & 1) === 1);
  setFunc(8, 7, ((formatBits >>> 6) & 1) === 1);
  setFunc(8, 8, ((formatBits >>> 7) & 1) === 1);
  setFunc(7, 8, ((formatBits >>> 8) & 1) === 1);
  for (let i = 9; i < 15; i++) setFunc(14 - i, 8, ((formatBits >>> i) & 1) === 1);

  for (let i = 0; i < 8; i++) setFunc(size - 1 - i, 8, ((formatBits >>> i) & 1) === 1);
  for (let i = 8; i < 15; i++) setFunc(8, size - 15 + i, ((formatBits >>> i) & 1) === 1);

  return modules;
}
