// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { buildNup } from '../../lib/nup/nupService';
import { renderPdfPage } from '../fixtures/pdfRender';

/**
 * Regression test for a real bug (see PROGRESS.md Finding #5): 90°/270°
 * rotated source pages produced a completely BLANK N-up output (malformed
 * rotation matrix + wrong scale reference), and 180° pages ignored rotation
 * entirely (rendered upside-down). None of this was caught by prior tests
 * because nothing exercised buildNup with a rotated source page — pure
 * geometry unit tests on nupLayout.ts can't catch a Matrix/embedding bug.
 *
 * Strategy: build a tiny source PDF with a RED marker square near one
 * corner and a BLUE marker square near the opposite corner (in the page's
 * own unrotated content space), set /Rotate, run it through the real
 * buildNup(), then actually RENDER the output PDF and check that both
 * markers are (a) present at all — catches the "blank page" failure mode —
 * and (b) in the position a physical clockwise rotation would put them —
 * catches "wrong but non-blank" failure modes like the 180° upside-down bug.
 */

async function buildRotatedSource(rotationDeg: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 300]); // portrait, W=200 H=300
  // RED marker near the page's own top-left (in unrotated content space)
  page.drawRectangle({ x: 10, y: 260, width: 30, height: 30, color: rgb(1, 0, 0) });
  // BLUE marker near the page's own bottom-right
  page.drawRectangle({ x: 160, y: 10, width: 30, height: 30, color: rgb(0, 0, 1) });
  page.setRotation(degrees(rotationDeg));
  return doc.save();
}

/** Fraction of pixels in the rendered image matching a target color, plus centroid. */
function findMarker(imageData: ImageData, match: (r: number, g: number, b: number) => boolean) {
  const { data, width, height } = imageData;
  let count = 0, sx = 0, sy = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (match(data[i], data[i + 1], data[i + 2])) {
        count++; sx += x; sy += y;
      }
    }
  }
  return count === 0
    ? { count, cx: -1, cy: -1 }
    : { count, cx: sx / count / width, cy: sy / count / height }; // normalized 0..1
}

const isRed = (r: number, g: number, b: number) => r > 200 && g < 80 && b < 80;
const isBlue = (r: number, g: number, b: number) => b > 200 && r < 80 && g < 80;

const baseOpts = {
  format: '1x1' as const,
  paper: 'A4' as const,
  orientation: 'PORTRAIT' as const,
  margins: { outer: 0, inner: 0 },
  borders: false,
  numbers: false,
};

describe('buildNup rotation handling', () => {
  it('0° (control): both markers present, red above blue', async () => {
    const src = await buildRotatedSource(0);
    const result = await buildNup(new Uint8Array(src), baseOpts);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const img = await renderPdfPage(bytes, 0, 1);
    const red = findMarker(img, isRed);
    const blue = findMarker(img, isBlue);
    expect(red.count).toBeGreaterThan(0);
    expect(blue.count).toBeGreaterThan(0);
    expect(red.cy).toBeLessThan(blue.cy); // red (top-left) above blue (bottom-right)
  });

  it.each([90, 180, 270])('%i° rotation: both markers survive (not blank)', async (rot) => {
    const src = await buildRotatedSource(rot);
    const result = await buildNup(new Uint8Array(src), baseOpts);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const img = await renderPdfPage(bytes, 0, 1);
    const red = findMarker(img, isRed);
    const blue = findMarker(img, isBlue);
    // The historical bug: 90°/270° rendered a fully blank page (count === 0
    // for both markers). Guard against regressing to that.
    expect(red.count, `red marker missing at rotation ${rot}°`).toBeGreaterThan(0);
    expect(blue.count, `blue marker missing at rotation ${rot}°`).toBeGreaterThan(0);
  });

  it('90° clockwise: top-left marker moves to top-right, bottom-right moves to bottom-left', async () => {
    const src = await buildRotatedSource(90);
    const result = await buildNup(new Uint8Array(src), baseOpts);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const img = await renderPdfPage(bytes, 0, 1);
    const red = findMarker(img, isRed);
    const blue = findMarker(img, isBlue);
    expect(red.cx).toBeGreaterThan(0.5); // red now on the right half
    expect(blue.cx).toBeLessThan(0.5); // blue now on the left half
  });

  it('270° clockwise: top-left marker moves to bottom-left, bottom-right moves to top-right', async () => {
    const src = await buildRotatedSource(270);
    const result = await buildNup(new Uint8Array(src), baseOpts);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const img = await renderPdfPage(bytes, 0, 1);
    const red = findMarker(img, isRed);
    const blue = findMarker(img, isBlue);
    expect(red.cx).toBeLessThan(0.5); // red now on the left half
    expect(blue.cx).toBeGreaterThan(0.5); // blue now on the right half
  });

  it('180°: red stays "above" blue is wrong — rotation must flip so blue ends up above red', async () => {
    const src = await buildRotatedSource(180);
    const result = await buildNup(new Uint8Array(src), baseOpts);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const img = await renderPdfPage(bytes, 0, 1);
    const red = findMarker(img, isRed);
    const blue = findMarker(img, isBlue);
    // The historical bug: rotation was ignored entirely for 180°, so red
    // stayed above blue (as if unrotated). A correct 180° flip must put
    // blue above red instead.
    expect(blue.cy).toBeLessThan(red.cy);
  });
});
