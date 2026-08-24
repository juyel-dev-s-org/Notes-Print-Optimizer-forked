import { readFileSync, writeFileSync } from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { join } from 'node:path';

const srcPath = join(process.cwd(), 'public', 'icon-512-v2.png');
const publicDir = join(process.cwd(), 'public');

async function pngFromResize(size) {
  const img = await loadImage(srcPath);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  // Keep transparency, just draw resized
  ctx.drawImage(img, 0, 0, size, size);
  const buf = canvas.toBuffer('image/png');
  return buf;
}

async function pngApple180() {
  const img = await loadImage(srcPath);
  const size = 180;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  // Apple touch icon: solid background, no transparency edge. Icon already has gradient bg, so just draw.
  // Add white underlay for any transparent corners (rounded rect)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toBuffer('image/png');
}

function buildIco(pngBuffers) {
  // pngBuffers: [{size, buf}] where size is 16,32,48 etc
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirSize = 16 * count;
  let offset = headerSize + dirSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(count, 4);
  const dirs = [];
  const datas = [];
  for (const { size, buf } of pngBuffers) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size === 256 ? 0 : size, 0);
    dir.writeUInt8(size === 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2); // color count
    dir.writeUInt8(0, 3); // reserved
    dir.writeUInt16LE(1, 4); // planes
    dir.writeUInt16LE(32, 6); // bit count
    dir.writeUInt32LE(buf.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    datas.push(buf);
    offset += buf.length;
  }
  return Buffer.concat([header, ...dirs, ...datas]);
}

const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) {
  const buf = await pngFromResize(s);
  const outName = s === 16 ? null : `favicon-${s}x${s}.png`;
  if (outName) {
    writeFileSync(join(publicDir, outName), buf);
    console.log(`wrote ${outName} ${buf.length} bytes`);
  }
  pngs.push({ size: s, buf });
}
// Apple 180
const appleBuf = await pngApple180();
writeFileSync(join(publicDir, 'apple-icon.png'), appleBuf);
console.log(`wrote apple-icon.png ${appleBuf.length} bytes`);

// ICO with 16,32,48
const ico = buildIco(pngs);
writeFileSync(join(publicDir, 'favicon.ico'), ico);
console.log(`wrote favicon.ico ${ico.length} bytes with ${pngs.length} images`);

// Also ensure 32 favicon copy for layout fallback?
// Already have favicon-32x32.png etc
