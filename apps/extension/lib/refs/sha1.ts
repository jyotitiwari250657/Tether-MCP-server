/**
 * Pure SHA-1 Digest (TRD §6.4.3).
 * Used for deterministic textSig generation across environments.
 */

function rotl(n: number, s: number): number {
  return (n << s) | (n >>> (32 - s));
}

export function sha1(input: string): string {
  const utf8: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c < 128) {
      utf8.push(c);
    } else if (c < 2048) {
      utf8.push(192 | (c >> 6), 128 | (c & 63));
    } else {
      utf8.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
  }

  const bitLen = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length + 8) % 64 !== 0) {
    utf8.push(0);
  }

  const words: number[] = [];
  for (let i = 0; i < utf8.length; i += 4) {
    words.push(
      ((utf8[i] ?? 0) << 24) |
        ((utf8[i + 1] ?? 0) << 16) |
        ((utf8[i + 2] ?? 0) << 8) |
        (utf8[i + 3] ?? 0),
    );
  }
  words.push(Math.floor(bitLen / 0x100000000));
  words.push(bitLen >>> 0);

  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) {
      w[t] = words[i + t] ?? 0;
    }
    for (let t = 16; t < 80; t++) {
      w[t] = rotl((w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0), 1);
    }

    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
    for (let t = 0; t < 80; t++) {
      const wt = w[t] ?? 0;
      let f = 0;
      let k = 0;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + wt) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((v) => v.toString(16).padStart(8, '0')).join('');
}

export function computeTextSig(
  role: string,
  name: string,
  rect: { x: number; y: number; w: number; h: number },
): string {
  const rx = Math.floor(rect.x / 24);
  const ry = Math.floor(rect.y / 24);
  const rw = Math.floor(rect.w / 24);
  const rh = Math.floor(rect.h / 24);
  const rectQuantized = `${rx},${ry},${rw},${rh}`;
  const raw = `${role}\u0000${name.slice(0, 40)}\u0000${rectQuantized}`;
  return sha1(raw).slice(0, 12);
}
