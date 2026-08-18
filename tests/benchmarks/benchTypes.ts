/**
 * Shared types and helpers for browser bench specs that drive the real
 * engine via window.__npoProcessPdf (installed by runBenchmark.ts).
 */
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { PDFDocument } from 'pdf-lib';

export interface NpoBenchResult {
  engineId: string;
  engineVersion: string;
  wasmLoaded: boolean;
  totalPages: number;
  totalMs: number;
  pagesPerSecond: number;
  perPageAvg: {
    renderMs: number;
    analyzeMs: number;
    processMs: number;
    thumbnailMs: number;
    persistMs: number;
  };
  environment: { hardwareConcurrency: number; isMobile: boolean; devicePixelRatio: number };
}

declare global {
  interface Window {
    __npoProcessPdf?: (pdfBuffer: ArrayBuffer, opts?: { engineVersion?: string }) => Promise<NpoBenchResult>;
    gc?: () => void;
  }
}

export const FIXTURE_NAMES = ['text.pdf', 'image.pdf', 'scanned.pdf', 'mixed.pdf'] as const;

export const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'pdf');

/** Merge the four committed fixture PDFs into a single deck.
 *
 *  With `targetPages`, fixture pages are cycled (re-copied in fixture order)
 *  until the deck reaches the target — every page is still real committed
 *  content, which keeps large-deck runs honest (no synthetic pages). */
export async function buildFixtureDeck(deckPath: string, targetPages?: number): Promise<number> {
  /* updateMetadata:false — pdf-lib otherwise stamps CreationDate/ModDate from
     new Date(), making every save nondeterministic (breaks reproducibility). */
  const deck = await PDFDocument.create({ updateMetadata: false });
  let pages = 0;
  while (targetPages === undefined || pages < targetPages) {
    for (const name of FIXTURE_NAMES) {
      if (targetPages !== undefined && pages >= targetPages) break;
      const src = await PDFDocument.load(readFileSync(join(FIXTURES_DIR, name)));
      const copied = await deck.copyPages(src, src.getPageIndices());
      for (const p of copied) deck.addPage(p);
      pages += copied.length;
    }
    if (targetPages === undefined) break;
  }
  const bytes = await deck.save();
  mkdirSync(dirname(deckPath), { recursive: true });
  writeFileSync(deckPath, bytes);
  return pages;
}