/**
 * Real-world baseline: committed fixture PDFs rendered + processed in Node
 * with the exact engine recipe (render at scale 1.8 -> analyze -> preset ->
 * JS pixel pipeline). This is the JS-side reference baseline; the WASM-side
 * browser baseline lives in realPdfBaseline.spec.ts.
 *
 * Runs as part of `npm run bench` (vitest bench) — report numbers feed
 * ENGINEERING_ASSESSMENT.md.
 */
import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderPdfPage, loadPdfDocument } from '../fixtures/pdfRender';
import { analyzeImageData } from '../../lib/optimizer/analysis';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';
import { processPage } from '../../lib/kernels/processPage';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'pdf');
const RENDER_SCALE = 1.8;

const FIXTURE_NAMES = ['text', 'image', 'scanned', 'mixed'] as const;

describe('real-PDF baseline (Node, JS pipeline)', () => {
  it('per-fixture: render/analyze/process/ink/output-size', async () => {
    for (const name of FIXTURE_NAMES) {
      const bytes = new Uint8Array(readFileSync(join(FIXTURES_DIR, `${name}.pdf`)));
      const t0 = performance.now();
      const doc = await loadPdfDocument(bytes);
      const loadMs = performance.now() - t0;

      let renderMs = 0, analyzeMs = 0, processMs = 0;
      let inkBeforeSum = 0, inkAfterSum = 0, outBytes = 0;
      const classifications = new Set<string>();

      for (let pi = 0; pi < doc.numPages; pi++) {
        const t1 = performance.now();
        const imageData = await renderPdfPage(bytes, pi, RENDER_SCALE);
        renderMs += performance.now() - t1;

        const t2 = performance.now();
        const profile = analyzeImageData(imageData, pi);
        analyzeMs += performance.now() - t2;
        classifications.add(profile.classification);

        const preset: 'PW_DARK_SLIDE' | 'LIGHT_HANDWRITTEN' =
          profile.classification === 'DARK_SLIDE' ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN';
        const params = ParameterGenerator.getPresetParameters(preset);

        const t3 = performance.now();
        const result = processPage(
          imageData.data,
          imageData.width,
          imageData.height,
          params,
          { classification: profile.classification, darkBackgroundRatio: profile.darkBackgroundRatio }
        );
        processMs += performance.now() - t3;

        const out = new Uint8Array(result.buffer);
        outBytes += out.byteLength;
        inkBeforeSum += countInk(imageData.data);
        inkAfterSum += countInk(out);
      }
      await doc.destroy();

      const n = doc.numPages;
      console.log(`=== ${name}.pdf (${n} pages, ${classifications.size > 1 ? 'mixed' : [...classifications][0]}) ===`);
      console.log(`  load+parse: ${loadMs.toFixed(1)}ms | per-page render=${(renderMs / n).toFixed(1)}ms analyze=${(analyzeMs / n).toFixed(1)}ms process=${(processMs / n).toFixed(1)}ms`);
      console.log(`  total pipeline (render+analyze+process): ${(renderMs + analyzeMs + processMs).toFixed(0)}ms for ${n} pages = ${((renderMs + analyzeMs + processMs) / n).toFixed(1)}ms/page`);
      console.log(`  ink before=${(inkBeforeSum / n).toFixed(2)}% after=${(inkAfterSum / n).toFixed(2)}% | output ${(outBytes / 1048576).toFixed(1)}MB`);
    }
  }, 600000);
});

function countInk(rgba: Uint8Array | Uint8ClampedArray): number {
  let dark = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] < 128) dark++;
  }
  return Math.round((dark / (rgba.length / 4)) * 10000) / 100;
}