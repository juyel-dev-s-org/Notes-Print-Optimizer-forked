/**
 * Deterministic real-PDF fixture generator (run: `npm run fixtures:gen`).
 *
 * Produces four committed fixture PDFs under tests/fixtures/pdf/ (and a copy
 * under public/fixtures/pdf/ so Playwright specs can fetch them):
 *   - text.pdf     6 pages of vector text (light + dark slides)
 *   - image.pdf    4 pages of embedded raster slide JPEGs
 *   - scanned.pdf  4 pages of grayscale "scanned" strokes + noise
 *   - mixed.pdf    4 pages mixing text, raster images and vector shapes
 *
 * All randomness comes from a fixed-seed LCG, and drawing uses only
 * pdf-lib (deterministic) + @napi-rs/canvas (CPU rasterizer), so the
 * byte output is stable across machines for a given dependency set.
 * IMPORTANT: every PDFDocument.create() must pass { updateMetadata: false }
 * — pdf-lib otherwise stamps CreationDate/ModDate from new Date(), making
 * every regeneration nondeterministic and breaking the golden suite.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas, ImageData } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'tests', 'fixtures', 'pdf');
const PUBLIC_DIR = join(ROOT, 'public', 'fixtures', 'pdf');

/* ---------- deterministic PRNG ---------- */

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ---------- raster slide painters (deterministic) ---------- */

function paintDarkSlide(rand) {
  const w = 960, h = 540;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const n = (rand() * 23) | 0;
    const idx = i * 4;
    d[idx] = 26 + n; d[idx + 1] = 30 + n; d[idx + 2] = 42 + n; d[idx + 3] = 255;
  }
  for (let y = 40; y < h - 40; y += 36) {
    for (let x = 40; x < w - 40; x += 3) {
      const idx = (y * w + x) * 4;
      const v = 200 + ((x + y) % 44);
      d[idx] = v; d[idx + 1] = v; d[idx + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(56, 72, 300, 26);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(56, 140, 230, 20);
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(56, 208, 180, 18);
  return canvas.toBuffer('image/jpeg', 88);
}

function paintLightSlide(rand) {
  const w = 960, h = 540;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const n = (rand() * 17) | 0;
    const idx = i * 4;
    d[idx] = 243 + n; d[idx + 1] = 241 + n; d[idx + 2] = 237 + n; d[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(56, 72, 340, 30);
  ctx.fillStyle = '#334155';
  ctx.fillRect(56, 150, 520, 16);
  ctx.fillRect(56, 190, 480, 16);
  ctx.fillRect(56, 230, 500, 16);
  ctx.fillStyle = '#e11d48';
  ctx.fillRect(56, 300, 90, 60);
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(180, 300, 90, 60);
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(304, 300, 90, 60);
  return canvas.toBuffer('image/jpeg', 88);
}

function paintDiagramSlide(rand) {
  const w = 960, h = 540;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  for (let k = 0; k < 12; k++) {
    const x1 = 60 + rand() * 840, y1 = 60 + rand() * 420;
    const x2 = 60 + rand() * 840, y2 = 60 + rand() * 420;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.fillStyle = '#3b82f6';
  for (let k = 0; k < 5; k++) {
    const x = 60 + rand() * 820, y = 60 + rand() * 400;
    ctx.beginPath(); ctx.arc(x, y, 14 + rand() * 18, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#f59e0b';
  for (let k = 0; k < 5; k++) {
    const x = 60 + rand() * 820, y = 60 + rand() * 400;
    ctx.fillRect(x, y, 30 + rand() * 30, 30 + rand() * 30);
  }
  return canvas.toBuffer('image/jpeg', 88);
}

function paintPhotoSlide() {
  const w = 960, h = 540;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const x = i % w, y = (i / w) | 0;
    d[idx] = 90 + ((x * 7 + y * 3) % 90);
    d[idx + 1] = 120 + ((x * 5 + y * 11) % 70);
    d[idx + 2] = 150 + ((x * 13 + y * 5) % 60);
    d[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toBuffer('image/jpeg', 85);
}

/* ---------- scanned-page painter (deterministic) ---------- */

function paintScannedPage(rand) {
  const w = 960, h = 540;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const n = (rand() * 22) | 0;
    const v = 226 + n;
    d[idx] = v; d[idx + 1] = v; d[idx + 2] = v; d[idx + 3] = 255;
  }
  /* handwriting strokes: short slanted segments */
  const strokes = 160;
  for (let s = 0; s < strokes; s++) {
    const sx = 50 + rand() * (w - 100);
    const sy = 50 + rand() * (h - 100);
    const len = 14 + rand() * 26;
    const slant = (rand() - 0.5) * 0.8;
    const width = 2 + ((rand() * 2) | 0);
    for (let t = 0; t < len; t++) {
      const x = (sx + t + slant * t) | 0;
      const y = (sy + t * 0.35) | 0;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      for (let dw2 = -width; dw2 <= width; dw2++) {
        const yy = y + dw2;
        if (yy < 0 || yy >= h) continue;
        const idx = (yy * w + x) * 4;
        d[idx] = 40; d[idx + 1] = 40; d[idx + 2] = 40;
      }
    }
  }
  /* speckle noise */
  for (let s = 0; s < 900; s++) {
    const x = (rand() * w) | 0, y = (rand() * h) | 0;
    const idx = (y * w + x) * 4;
    const v = rand() < 0.5 ? 190 : 130;
    d[idx] = v; d[idx + 1] = v; d[idx + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toBuffer('image/jpeg', 88);
}

/* ---------- PDF builders ---------- */

async function buildTextPdf() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [612, 792];
  const ink = rgb(0.12, 0.14, 0.18);
  const inkSoft = rgb(0.35, 0.37, 0.42);
  const inkFaint = rgb(0.45, 0.45, 0.45);

  let p = doc.addPage(pageSize);
  p.drawText('Quarterly Engineering Review', { x: 56, y: 700, font: bold, size: 30, color: ink });
  p.drawText('Notes Print Optimizer - Q3 snapshot', { x: 56, y: 668, font, size: 16, color: inkSoft });
  for (let i = 0; i < 8; i++) p.drawText(`Session note line ${i + 1} with wrap-around summary text for the meeting archive.`, { x: 56, y: 620 - i * 30, font, size: 12, color: inkFaint });

  p = doc.addPage(pageSize);
  p.drawText('Agenda', { x: 56, y: 700, font: bold, size: 22, color: ink });
  const agenda = [
    '1. Pipeline throughput measurements and machine-state caveats',
    '2. WASM kernel head-to-head: hsv, classify, dilate, unsharp',
    '3. Same-window A/B protocol for every kernel change',
    '4. Memory: transient heap deltas per page, peak during 100-page runs',
    '5. Licensing: AGPL surface analysis (MuPDF/PDFium vs pdf.js)',
  ];
  agenda.forEach((t, i) => p.drawText(t, { x: 56, y: 655 - i * 34, font, size: 13, color: ink }));

  p = doc.addPage(pageSize);
  p.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.12, 0.13, 0.2) });
  p.drawText('Key Findings', { x: 56, y: 700, font: bold, size: 28, color: rgb(0.96, 0.82, 0.4) });
  for (let i = 0; i < 7; i++) p.drawText(`Measured finding ${i + 1}: kernel-level evidence with byte-level proofs.`, { x: 56, y: 640 - i * 36, font, size: 14, color: rgb(0.92, 0.93, 0.95) });

  p = doc.addPage(pageSize);
  p.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.1, 0.12, 0.16) });
  p.drawText('Action Items', { x: 56, y: 700, font: bold, size: 24, color: rgb(0.49, 0.83, 0.99) });
  const colors = [rgb(0.95, 0.45, 0.45), rgb(0.45, 0.85, 0.5), rgb(0.55, 0.7, 0.98)];
  for (let i = 0; i < 6; i++) {
    p.drawText(`[${i % 3 === 0 ? 'RED' : i % 3 === 1 ? 'GREEN' : 'BLUE'}] item ${i + 1}`, { x: 56, y: 640 - i * 40, font: bold, size: 14, color: colors[i % 3] });
    p.drawText(`Detail for action item ${i + 1} with an owner and a due date.`, { x: 56, y: 622 - i * 40, font, size: 12, color: rgb(0.85, 0.87, 0.9) });
  }

  p = doc.addPage(pageSize);
  p.drawText('Dense notes page', { x: 56, y: 700, font: bold, size: 20, color: rgb(0.15, 0.15, 0.2) });
  for (let r = 0; r < 26; r++) {
    for (let c = 0; c < 3; c++) {
      p.drawText(`cell(r${r}c${c}): deterministic golden fixture text for regression testing of the pixel pipeline.`, { x: 56 + c * 190, y: 660 - r * 22, font, size: 10, color: rgb(0.25, 0.27, 0.3) });
    }
  }

  p = doc.addPage(pageSize);
  p.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.14, 0.15, 0.22) });
  for (let r = 0; r < 30; r++) {
    p.drawText(`Dense dark-slide note ${r + 1}: small text on dark background exercises the PW_DARK_SLIDE preset.`, { x: 56, y: 700 - r * 22, font, size: 11, color: rgb(0.9, 0.91, 0.94) });
  }

  return doc.save();
}

async function buildImagePdf() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const variants = [paintDarkSlide(lcg(101)), paintLightSlide(lcg(202)), paintDiagramSlide(lcg(303)), paintPhotoSlide()];
  const titles = ['Dark raster slide', 'Light raster slide', 'Diagram raster slide', 'Photo-style raster slide'];
  for (let i = 0; i < variants.length; i++) {
    const page = doc.addPage([960, 540]);
    const img = await doc.embedJpg(variants[i]);
    page.drawImage(img, { x: 0, y: 0, width: 960, height: 540 });
    page.drawText(titles[i], { x: 32, y: 24, font, size: 14, color: rgb(1, 1, 1) });
  }
  return doc.save();
}

async function buildScannedPdf() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  for (const seed of [505, 606, 707, 808]) {
    const page = doc.addPage([960, 540]);
    const img = await doc.embedJpg(paintScannedPage(lcg(seed)));
    page.drawImage(img, { x: 0, y: 0, width: 960, height: 540 });
  }
  return doc.save();
}

async function buildMixedPdf() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([960, 540]);
  page.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(0.11, 0.13, 0.19) });
  const img1 = await doc.embedJpg(paintDarkSlide(lcg(909)));
  page.drawImage(img1, { x: 520, y: 120, width: 400, height: 300 });
  page.drawText('Mixed: dark text + image', { x: 40, y: 460, font: bold, size: 24, color: rgb(0.96, 0.82, 0.4) });
  for (let i = 0; i < 5; i++) page.drawText(`Bullet ${i + 1}: mixed content keeps both extraction paths busy.`, { x: 40, y: 420 - i * 30, font, size: 12, color: rgb(0.9, 0.92, 0.95) });

  page = doc.addPage([960, 540]);
  const img2 = await doc.embedJpg(paintLightSlide(lcg(1111)));
  page.drawImage(img2, { x: 40, y: 90, width: 560, height: 320 });
  page.drawText('Light page with embedded slide', { x: 40, y: 470, font: bold, size: 20, color: rgb(0.15, 0.18, 0.25) });
  page.drawText('Caption text below the embedded raster region.', { x: 40, y: 50, font, size: 11, color: rgb(0.3, 0.32, 0.36) });

  page = doc.addPage([960, 540]);
  page.drawText('Shapes + text (light)', { x: 40, y: 470, font: bold, size: 22, color: rgb(0.2, 0.22, 0.3) });
  page.drawRectangle({ x: 60, y: 260, width: 120, height: 80, color: rgb(0.9, 0.3, 0.35) });
  page.drawRectangle({ x: 220, y: 260, width: 120, height: 80, color: rgb(0.3, 0.5, 0.9) });
  page.drawRectangle({ x: 380, y: 260, width: 120, height: 80, color: rgb(0.3, 0.75, 0.45) });
  page.drawLine({ start: { x: 60, y: 180 }, end: { x: 900, y: 180 }, thickness: 3, color: rgb(0.25, 0.27, 0.32) });
  for (let i = 0; i < 4; i++) page.drawText(`Shape annotation ${i + 1} on a light mixed-content page.`, { x: 40, y: 140 - i * 24, font, size: 12, color: rgb(0.35, 0.37, 0.42) });

  page = doc.addPage([960, 540]);
  page.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(0.16, 0.18, 0.26) });
  const img3 = await doc.embedJpg(paintDiagramSlide(lcg(1111)));
  page.drawImage(img3, { x: 120, y: 220, width: 720, height: 280 });
  page.drawText('Dark page: diagram + caption', { x: 40, y: 40, font: bold, size: 20, color: rgb(0.85, 0.88, 0.95) });

  return doc.save();
}

/* ---------- main ---------- */

const fixtures = {
  'text.pdf': buildTextPdf,
  'image.pdf': buildImagePdf,
  'scanned.pdf': buildScannedPdf,
  'mixed.pdf': buildMixedPdf,
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });
  for (const [name, builder] of Object.entries(fixtures)) {
    const bytes = await builder();
    const buf = Buffer.from(bytes);
    writeFileSync(join(OUT_DIR, name), buf);
    writeFileSync(join(PUBLIC_DIR, name), buf);
    console.log(`${name}: ${buf.length} bytes`);
  }
  console.log('fixtures written to', OUT_DIR, 'and', PUBLIC_DIR);
}

main().catch((err) => { console.error(err); process.exit(1); });