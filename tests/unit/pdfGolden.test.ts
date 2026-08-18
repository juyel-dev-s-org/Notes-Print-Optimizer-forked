/**
 * Golden-output coverage over real PDF fixtures (Node, JS pipeline).
 *
 * For every fixture page: render at scale 1.8 (desktop engine default) with
 * pdfjs + @napi-rs/canvas, classify with analyzeImageData, pick the preset
 * exactly like ProcessingEngineV2 does (DARK_SLIDE -> PW_DARK_SLIDE, else
 * LIGHT_HANDWRITTEN), run the main-thread JS pixel pipeline (the same
 * processPage used by MainThreadImageProcessor) and compare the output
 * bytes against committed sha256 goldens.
 *
 * Any change to rendering, classification or pixel math must produce a
 * deliberate golden update. Regenerate with: PDF_UPDATE_GOLDENS=1.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { renderPdfPage } from '../fixtures/pdfRender';
import { analyzeImageData } from '../../lib/optimizer/analysis';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';
import { processPage } from '../../lib/kernels/processPage';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'pdf');
const GOLDENS_FILE = join(FIXTURES_DIR, 'pdfGoldens.json');
const RENDER_SCALE = 1.8;
const UPDATE_GOLDENS = process.env.PDF_UPDATE_GOLDENS === '1';

interface PageGolden {
  width: number;
  height: number;
  sha256: string;
  inkBeforePct: number;
  inkAfterPct: number;
  classification: string;
}

interface GoldensFile {
  version: 1;
  renderScale: number;
  fixtures: Record<string, Record<string, PageGolden>>;
}

const FIXTURE_NAMES = ['text', 'image', 'scanned', 'mixed'] as const;

function loadGoldens(): GoldensFile {
  return JSON.parse(readFileSync(GOLDENS_FILE, 'utf8')) as GoldensFile;
}

function readFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES_DIR, `${name}.pdf`)));
}

async function processPageGolden(
  name: string,
  pageIndex: number
): Promise<{ golden: PageGolden; imageData: ImageData }> {
  const bytes = readFixture(name);
  const imageData = await renderPdfPage(bytes, pageIndex, RENDER_SCALE);

  const profile = analyzeImageData(imageData, pageIndex);
  const preset: 'PW_DARK_SLIDE' | 'LIGHT_HANDWRITTEN' =
    profile.classification === 'DARK_SLIDE' ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN';
  const params = ParameterGenerator.getPresetParameters(preset);

  const result = processPage(
    imageData.data,
    imageData.width,
    imageData.height,
    params,
    { classification: profile.classification, darkBackgroundRatio: profile.darkBackgroundRatio }
  );

  const out = new Uint8Array(result.buffer);
  const hash = createHash('sha256').update(out).digest('hex');

  const inkBefore = countInk(imageData.data);
  const inkAfter = countInk(out);

  return {
    golden: {
      width: imageData.width,
      height: imageData.height,
      sha256: hash,
      inkBeforePct: inkBefore,
      inkAfterPct: inkAfter,
      classification: profile.classification,
    },
    imageData,
  };
}

function countInk(rgba: Uint8Array | Uint8ClampedArray): number {
  let dark = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] < 128) dark++;
  }
  return Math.round((dark / (rgba.length / 4)) * 10000) / 100;
}

describe(UPDATE_GOLDENS ? 'pdf golden suite (regeneration mode)' : 'pdf fixture golden suite', () => {
  if (UPDATE_GOLDENS) {
    it('regenerates pdfGoldens.json from committed fixtures', async () => {
      const goldens: GoldensFile = { version: 1, renderScale: RENDER_SCALE, fixtures: {} };
      for (const name of FIXTURE_NAMES) {
        const bytes = readFixture(name);
        const pages = await import('../fixtures/pdfRender').then((m) => m.loadPdfDocument(bytes));
        goldens.fixtures[name] = {};
        for (let pageIndex = 0; pageIndex < pages.numPages; pageIndex++) {
          const { golden } = await processPageGolden(name, pageIndex);
          goldens.fixtures[name][String(pageIndex)] = golden;
        }
        await pages.destroy();
        console.log(`golden ${name}.pdf: ${pages.numPages} pages`);
      }
      writeFileSync(GOLDENS_FILE, JSON.stringify(goldens, null, 2) + '\n');
      console.log('goldens written to', GOLDENS_FILE);
    }, 300_000);
    return;
  }

  const goldens = loadGoldens();

  for (const name of FIXTURE_NAMES) {
    it(`produces byte-stable output for ${name}.pdf (all pages)`, async () => {
      const numPages = goldens.fixtures[name] ? Object.keys(goldens.fixtures[name]).length : 0;
      expect(numPages).toBeGreaterThan(0);

      for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
        const { golden, imageData } = await processPageGolden(name, pageIndex);
        const expected = goldens.fixtures[name][String(pageIndex)];
        expect(expected, `missing golden for ${name}.pdf page ${pageIndex} — run with PDF_UPDATE_GOLDENS=1`).toBeDefined();
        expect(golden, `mismatch on ${name}.pdf page ${pageIndex}`).toEqual(expected);
        expect(golden.sha256).toHaveLength(64);

        expect(imageData.width).toBe(expected.width);
        expect(imageData.height).toBe(expected.height);
        expect(imageData.data[3]).toBe(255);
        expect(golden.inkAfterPct).toBeLessThanOrEqual(golden.inkBeforePct);
      }
    }, 300_000);
  }

  it('goldens file is up to date with committed fixtures', () => {
    expect(goldens.version).toBe(1);
    expect(goldens.renderScale).toBe(RENDER_SCALE);
    for (const name of FIXTURE_NAMES) {
      expect(existsSync(join(FIXTURES_DIR, `${name}.pdf`))).toBe(true);
      expect(Object.keys(goldens.fixtures[name] ?? {}).length).toBeGreaterThan(0);
    }
  });
});