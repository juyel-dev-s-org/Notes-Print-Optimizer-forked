import { describe, it, expect } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';

/**
 * PDF-stage timings measurable in Node:
 * - pdf-lib: build/parse/save (export stage structure)
 * - pdfjs-dist: getDocument (load+parse) + getPage + getOperatorList
 * - composite B/W loop timing
 */

const W = 1600, H = 900;

async function buildDarkSlidePdf(pages: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = pdfDoc.addPage([1600, 900]);
    page.drawRectangle({ x: 0, y: 0, width: 1600, height: 900, color: rgb(0.117, 0.133, 0.2) });
    for (let y = 40; y < 900 - 40; y += 40) {
      page.drawLine({ start: { x: 40, y }, end: { x: 1600 - 40, y }, thickness: 2, color: rgb(0.88, 0.88, 0.88) });
    }
  }
  return await pdfDoc.save();
}

describe('PDF stage timing (Node)', () => {
  it('pdf-lib: 100-page build, parse (load), save', async () => {
    const t0 = performance.now();
    const bytes = await buildDarkSlidePdf(100);
    const buildMs = performance.now() - t0;
    console.log(`  pdf-lib build 100-page vector PDF: ${buildMs.toFixed(1)}ms (${(bytes.length / 1024).toFixed(0)} KB)`);

    /* parse: load into a new PDFDocument (what the app does on merge) */
    const t1 = performance.now();
    const parsed = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const parseMs = performance.now() - t1;
    expect(parsed.getPageCount()).toBe(100);
    console.log(`  pdf-lib load/parse 100-page PDF: ${parseMs.toFixed(1)}ms`);

    /* merge: copy all pages into a fresh doc + save (pdfExporter.mergePdfBuffers) */
    const t2 = performance.now();
    const merged = await PDFDocument.create();
    const copied = await merged.copyPages(parsed, parsed.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
    const mergedBytes = await merged.save();
    const mergeMs = performance.now() - t2;
    console.log(`  pdf-lib merge 100 pages + save: ${mergeMs.toFixed(1)}ms (${(mergedBytes.length / 1024).toFixed(0)} KB)`);
  });

  it('pdfjs-dist: getDocument (load+parse) + getOperatorList, per page count', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    for (const pages of [1, 10, 100]) {
      const bytes = await buildDarkSlidePdf(pages);
      const t0 = performance.now();
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const loadParseMs = performance.now() - t0;
      const page = await doc.getPage(1);
      const t1 = performance.now();
      const opList = await page.getOperatorList();
      const opsMs = performance.now() - t1;
      await doc.destroy();
      console.log(`  pdfjs ${pages}p: getDocument(load+parse)=${loadParseMs.toFixed(1)}ms  getOperatorList(page1)=${opsMs.toFixed(1)}ms  (${opList.fnArray.length} ops)`);
    }
  }, 120000);

  it('B/W composite loop (Uint32Array) at 1600x900', () => {
    const totalPixels = W * H;
    const fm = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i += 7) fm[i] = 1;
    const dst = new Uint8ClampedArray(totalPixels * 4);
    const dst32 = new Uint32Array(dst.buffer);
    const runs = 20;
    for (let i = 0; i < 2; i++) for (let j = 0; j < totalPixels; j++) dst32[j] = fm[j] === 1 ? 0xFF000000 : 0xFFFFFFFF;
    const t0 = performance.now();
    for (let r = 0; r < runs; r++) {
      for (let j = 0; j < totalPixels; j++) dst32[j] = fm[j] === 1 ? 0xFF000000 : 0xFFFFFFFF;
    }
    const ms = (performance.now() - t0) / runs;
    console.log(`  composite 1.44MPx B/W: ${ms.toFixed(2)}ms/op`);
  });

  it('export-stage proxy: pdf-lib embed+save with 25 sheets of JPEG-less structure', async () => {
    /* The app exports sheets as JPEG via canvas (browser-only, measured via
       thumbnailMs ~25ms/page as the closest proxy). The pdf-lib side
       (embedJpg + addPage + save) is measured here structurally. */
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < 25; i++) pdfDoc.addPage([2400, 1800]);
    const t0 = performance.now();
    const bytes = await pdfDoc.save();
    const saveMs = performance.now() - t0;
    console.log(`  pdf-lib save 25-sheet PDF (no images): ${saveMs.toFixed(1)}ms (${(bytes.length / 1024).toFixed(0)} KB)`);
  });
});