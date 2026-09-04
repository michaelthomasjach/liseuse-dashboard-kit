// Draws the PWA icons as real PNGs, by hand — no image dependency for two files that change about
// never. A candlestick glyph on the e-ink palette's own paper background, so the installed icon
// looks like the thing it opens. Re-run with `node scripts/make-pwa-icons.mjs` after editing.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", ".storybook", "public");
const PAPER = [242, 240, 234];
const INK = [26, 26, 26];
const UP = [92, 122, 92];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const px = Buffer.alloc(size * size * 3);
  const put = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  };
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };

  for (let i = 0; i < px.length; i += 3) [px[i], px[i + 1], px[i + 2]] = PAPER;

  // Three candles, sized off the icon so both resolutions render identically.
  const u = size / 32;
  const body = Math.round(4 * u);
  const wick = Math.max(1, Math.round(1.5 * u));
  const candles = [
    { x: 8, top: 12, bottom: 24, openY: 15, closeY: 22, colour: INK },
    { x: 15, top: 7, bottom: 21, openY: 18, closeY: 10, colour: UP },
    { x: 22, top: 11, bottom: 26, openY: 14, closeY: 23, colour: INK },
  ];
  for (const c of candles) {
    const cx = Math.round(c.x * u);
    rect(cx + Math.round(body / 2) - Math.round(wick / 2), Math.round(c.top * u), wick, Math.round((c.bottom - c.top) * u), c.colour);
    const y0 = Math.round(Math.min(c.openY, c.closeY) * u);
    rect(cx, y0, body, Math.round(Math.abs(c.closeY - c.openY) * u), c.colour);
  }

  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), png(size));
  console.log(`icon-${size}.png`);
}
