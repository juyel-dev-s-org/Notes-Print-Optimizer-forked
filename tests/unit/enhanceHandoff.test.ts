/**
 * Unit tests for the Enhance -> Layout handoff bridge: pure mapping and
 * the IndexedDB record shape handed to pwOptimizerStorage.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnhanceHandoffService } from '@/lib/services/EnhanceHandoffService';
import { pwOptimizerStorage } from '@/lib/optimizer/storage';

vi.mock('@/lib/optimizer/storage', () => ({
  pwOptimizerStorage: { storePagesBatch: vi.fn().mockResolvedValue(undefined) },
}));

const page = (n: number) => ({
  dataUrl: `data:image/jpeg;base64,${btoa(`page-${n}`)}`,
  width: 800 + n,
  height: 1000 + n,
});

const sample = () => [page(0), page(1), page(2)];

describe('EnhanceHandoffService.dataUrlToJpegBlob', () => {
  it('decodes base64 payload and keeps the mime type', () => {
    const blob = EnhanceHandoffService.dataUrlToJpegBlob(page(0).dataUrl);
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(6); // "page-0".length
  });

  it('degrades gracefully to an empty JPEG blob for malformed input', () => {
    const blob = EnhanceHandoffService.dataUrlToJpegBlob('not-a-data-url');
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(0);
  });
});

describe('EnhanceHandoffService.buildProcessedPages', () => {
  it('maps pages in order with passthrough geometry and shared storageKey', () => {
    const pdfId = 'pw_enh_123';
    const pages = EnhanceHandoffService.buildProcessedPages(sample(), pdfId);

    expect(pages).toHaveLength(3);
    pages.forEach((p, i) => {
      expect(p.pageIndex).toBe(i);
      expect(p.thumbnailDataUrl).toBe(sample()[i].dataUrl);
      expect(p.width).toBe(800 + i);
      expect(p.height).toBe(1000 + i);
      expect(p.storageKey).toBe(pdfId);
    });
  });

  it('fills neutral light-note stats and a preset parameter set', () => {
    const [p] = EnhanceHandoffService.buildProcessedPages([page(0)], 'pw_enh_x');
    expect(p.profile.classification).toBe('HANDWRITTEN_NOTES');
    expect(p.profile.lightBackgroundRatio).toBe(1);
    expect(p.profile.darkBackgroundRatio).toBe(0);
    expect(p.profile.width).toBe(800);
    expect(p.parameters.preset).toBe('LIGHT_HANDWRITTEN');
    expect(p.inkCoverageBeforePct).toBe(p.inkCoverageAfterPct);
  });
});

describe('EnhanceHandoffService.persistPages', () => {
  beforeEach(() => {
    vi.mocked(pwOptimizerStorage.storePagesBatch).mockClear();
  });

  it('writes one optimized JPEG record per page under a single pdfId', async () => {
    await EnhanceHandoffService.persistPages(sample(), 'pw_enh_9');

    expect(pwOptimizerStorage.storePagesBatch).toHaveBeenCalledTimes(1);
    const [records] = vi.mocked(pwOptimizerStorage.storePagesBatch).mock.calls[0];
    expect(records).toHaveLength(3);
    records.forEach((r, i) => {
      expect(r.pdfId).toBe('pw_enh_9');
      expect(r.pageIndex).toBe(i);
      expect(r.originalBlob).toBeNull();
      expect(r.optimizedBlob.type).toBe('image/jpeg');
      expect(r.optimizedBlob.size).toBe(6);
    });
  });
});
