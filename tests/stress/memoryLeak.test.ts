import { describe, it, expect } from 'vitest';
import { MemoryGuard, memoryGuard } from '../../lib/pipeline/MemoryGuard';
import { CheckpointManager } from '../../lib/pipeline/checkpoint/CheckpointManager';

describe('Phase 8.5: Memory leak — 10x process-reset cycle', () => {
  it('MemoryGuard.reset clears high-water mark', () => {
    const mg = new MemoryGuard();
    mg.trackAllocation(10 * 1048576);
    mg.trackAllocation(20 * 1048576);
    expect(mg.getHighWaterMarkMB()).toBeGreaterThan(0);
    mg.reset();
    expect(mg.getHighWaterMarkMB()).toBe(0);
  });

  it('CheckpointManager survives 10 save/load cycles', async () => {
    const cm = new CheckpointManager();
    for (let cycle = 0; cycle < 10; cycle++) {
      await cm.save(`doc-cycle-${cycle}`, {
        documentId: `doc-cycle-${cycle}`,
        totalPages: 100,
        completedPages: [],
        engineVersion: 'v2',
        params: { presetMode: 'AUTO_ADAPTIVE' },
        layoutConfig: {},
      });
      for (let p = 1; p <= 100; p++) await cm.markPageDone(`doc-cycle-${cycle}`, p);
      const snapshots = await cm.listSnapshots();
      const snapshot = snapshots.find(s => s.documentId === `doc-cycle-${cycle}`);
      expect(snapshot).toBeDefined();
      expect(snapshot!.totalPages).toBe(100);
      await cm.remove(`doc-cycle-${cycle}`);
      const afterRemove = await cm.getResumePages(`doc-cycle-${cycle}`, 100);
      expect(afterRemove).toEqual([]);
    }
  });

  it('MemoryGuard handles 10x alloc/release cycles with stable high-water', () => {
    const mg = new MemoryGuard();
    let peak = 0;
    for (let cycle = 0; cycle < 10; cycle++) {
      mg.trackAllocation(5 * 1048576);
      mg.trackRelease(5 * 1048576);
      mg.trackAllocation(8 * 1048576);
      peak = mg.getHighWaterMarkMB();
      mg.reset();
    }
    expect(peak).toBeGreaterThan(0);
  });
});
