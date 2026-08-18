/**
 * Golden-output coverage over real PDF fixtures (Node, JS pipeline).
 *
 * For every fixture page: render at scale 1.8 (desktop engine default) with
 * pdfjs + @napi-rs/canvas, run the exact production recipe
 * (applyEngineRecipe: classify -> preset -> processPage) and compare the
 * output bytes against committed sha256 goldens.
 *
 * Any change to rendering, classification or pixel math must produce a
 * deliberate golden update. Regenerate with: PDF_UPDATE_GOLDENS=1.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { openPdfDocument, renderPdfPageOpen } from '../fixtures/pdfRender';
import { applyEngineRecipe, countInk } from '../fixtures/pdfMetrics';

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
  doc: Awaited<ReturnType<typeof openPdfDocument>>,
  pageIndex: number
): Promise<PageGolden> {
  const imageData = await renderPdfPageOpen(doc, pageIndex, RENDER_SCALE);

  const { profile, result } = applyEngineRecipe(imageData, pageIndex);
  const out = new Uint8Array(result.buffer);
  const hash = createHash('sha256').update(out).digest('hex');

  return {
    width: imageData.width,
    height: imageData.height,
    sha256: hash,
    inkBeforePct: countInk(imageData.data),
    inkAfterPct: countInk(out),
    classification: profile.classification,
  };
}

describe(UPDATE_GOLDENS ? 'pdf golden suite (regeneration mode)' : 'pdf fixture golden suite', () => {
  if (UPDATE_GOLDENS) {
    it('regenerates pdfGoldens.json from committed fixtures', async () => {
      const goldens: GoldensFile = { version: 1, renderScale: RENDER_SCALE, fixtures: {} };
      for (const name of FIXTURE_NAMES) {
        const doc = await openPdfDocument(readFixture(name));
        goldens.fixtures[name] = {};
        for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
          goldens.fixtures[name][String(pageIndex)] = await processPageGolden(doc, pageIndex);
        }
        console.log(`golden ${name}.pdf: ${doc.numPages} pages`);
        await doc.destroy();
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

      const doc = await openPdfDocument(readFixture(name));
      try {
        for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
          const golden = await processPageGolden(doc, pageIndex);
          const expected = goldens.fixtures[name][String(pageIndex)];
          expect(expected, `missing golden for ${name}.pdf page ${pageIndex} — run with PDF_UPDATE_GOLDENS=1`).toBeDefined();
          expect(golden, `mismatch on ${name}.pdf page ${pageIndex}`).toEqual(expected);
          expect(golden.sha256).toHaveLength(64);
          expect(golden.inkAfterPct).toBeLessThanOrEqual(golden.inkBeforePct);
        }
      } finally {
        await doc.destroy();
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