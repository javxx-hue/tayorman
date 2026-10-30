// Renders the app icon (same design as public/icon.svg) to PNG without
// dependencies: shapes are rasterized with 4x4 supersampling, encoded with zlib.
// Usage: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex('#1c1917'), PAGE = hex('#faf7ee'), ACCENT = hex('#fbbf24');

// Shapes in a 512 unit square, painted in order (later wins)
const roundRect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const shapes = [
  [PAGE, roundRect(128, 136, 300, 376, 22)],
  [ACCENT, roundRect(312, 136, 384, 376, 22)],
  [BG, roundRect(170, 196, 258, 212, 8)],
  [BG, roundRect(170, 248, 258, 264, 8)],
  [BG, roundRect(170, 300, 230, 316, 8)],
];

function render(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const S = 4, scale = 512 / size;
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const x = (px + (sx + 0.5) / S) * scale, y = (py + (sy + 0.5) / S) * scale;
        let c = BG; // full-bleed background, safe for maskable icons
        for (const [color, inside] of shapes) if (inside(x, y)) c = color;
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = py * (size * 4 + 1) + 1 + px * 4, n = S * S;
      raw[o] = r / n; raw[o + 1] = g / n; raw[o + 2] = b / n; raw[o + 3] = 255;
    }
  }
  return png(size, raw);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, render(size));
console.log('icons written');
