/**
 * Canonical icon pipeline — single source: public/icon-master.png
 *
 * Regenerates every icon asset from the master artwork:
 *   icon-512-v2.png, icon-192-v2.png          (PWA + layout icons)
 *   favicon-32x32.png, favicon-48x48.png,
 *   favicon.ico (16/32/48), apple-icon.png    (browser favicons)
 *   icon-maskable-v2.png/.svg                 (Android adaptive, safe-zone)
 *   icon.svg                                  (generic SVG favicon wrapper)
 *
 * Usage:
 *   node scripts/apply-icon-art.mjs                     # regenerate from master
 *   node scripts/apply-icon-art.mjs --src <path.png>    # re-crop master from a
 *                                                       # source render (transparent
 *                                                       # background expected), then
 *                                                       # regenerate everything
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { join, resolve } from 'node:path';

const publicDir = join(process.cwd(), 'public');
const masterPath = join(publicDir, 'icon-master.png');
const MASKABLE_BG = '#d4beff'; // sampled from the artwork's lavender hexagon
const MASKABLE_ART_SCALE = 0.72; // Android safe zone: content within ~66-80% circle

const srcArgIdx = process.argv.indexOf('--src');
const srcPath = srcArgIdx > -1 ? resolve(process.argv[srcArgIdx + 1]) : null;

async function buildMasterFromSource() {
  const img = await loadImage(srcPath);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (d[(y * img.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.max(w, h);
  const master = createCanvas(side, side);
  const mctx = master.getContext('2d');
  mctx.drawImage(img, minX, minY, w, h, Math.floor((side - w) / 2), Math.floor((side - h) / 2), w, h);
  writeFileSync(masterPath, master.toBuffer('image/png'));
  console.log(`master ${side}x${side} (from ${img.width}x${img.height}, art ${w}x${h})`);
}

function resizePng(size) {
  return loadImage(masterPath).then((img) => {
    const c = createCanvas(size, size);
    c.getContext('2d').drawImage(img, 0, 0, size, size);
    return c.toBuffer('image/png');
  });
}

async function appleIcon() {
  const img = await loadImage(masterPath);
  const size = 180;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  return c.toBuffer('image/png');
}

async function maskablePng() {
  const img = await loadImage(masterPath);
  const size = 512;
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = MASKABLE_BG;
  ctx.fillRect(0, 0, size, size);
  const art = Math.round(size * MASKABLE_ART_SCALE);
  ctx.drawImage(img, Math.round((size - art) / 2), Math.round((size - art) / 2), art, art);
  return c.toBuffer('image/png');
}

function svgWrapper(pngBuf, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><image width="${size}" height="${size}" href="data:image/png;base64,${pngBuf.toString('base64')}"/></svg>`;
}

function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + 16 * count;
  const dirs = [];
  for (const { size, buf } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size === 256 ? 0 : size, 0);
    dir.writeUInt8(size === 256 ? 0 : size, 1);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(buf.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    offset += buf.length;
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.buf)]);
}

if (srcPath) await buildMasterFromSource();

const png512 = await resizePng(512);
writeFileSync(join(publicDir, 'icon-512-v2.png'), png512);
console.log('icon-512-v2.png');

writeFileSync(join(publicDir, 'icon-192-v2.png'), await resizePng(192));
console.log('icon-192-v2.png');

const icoEntries = [];
for (const s of [16, 32, 48]) {
  const buf = await resizePng(s);
  if (s > 16) writeFileSync(join(publicDir, `favicon-${s}x${s}.png`), buf);
  icoEntries.push({ size: s, buf });
}
writeFileSync(join(publicDir, 'favicon.ico'), buildIco(icoEntries));
console.log('favicon.ico + favicon-32x32.png + favicon-48x48.png');

writeFileSync(join(publicDir, 'apple-icon.png'), await appleIcon());
console.log('apple-icon.png');

const maskable = await maskablePng();
writeFileSync(join(publicDir, 'icon-maskable-v2.png'), maskable);
writeFileSync(join(publicDir, 'icon-maskable-v2.svg'), svgWrapper(maskable, 512));
console.log('icon-maskable-v2.png/.svg');

writeFileSync(join(publicDir, 'icon.svg'), svgWrapper(png512, 512));
console.log('icon.svg');
