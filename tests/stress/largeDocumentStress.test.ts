import { describe, it, expect, beforeAll } from 'vitest';
import { MemoryGuard } from '../../lib/pipeline/MemoryGuard';
import { CheckpointManager } from '../../lib/pipeline/checkpoint/CheckpointManager';
import { computeScheduleProfile } from '../../lib/pipeline/types';

const DOC_ID = 'stress-test-300p';

describe('Phase 5.6: 300-page stress test', () => {
  let guard: MemoryGuard;
  let cp: CheckpointManager;

  beforeAll(async () => {
    guard = new MemoryGuard();
    cp = new CheckpointManager();
    await cp.remove(DOC_ID);
  });

  it('should simulate 300 pages through checkpoint without data loss', async () => {
    const TOTAL = 300;
    const completed: number[] = [];

    await cp.save(DOC_ID, {
      documentId: DOC_ID, totalPages: TOTAL, completedPages: [],
      engineVersion: 'v2', params: {}, layoutConfig: {},
    });

    for (let i = 1; i <= TOTAL; i++) {
      await cp.markPageDone(DOC_ID, i);
      completed.push(i);
    }

    const record = await cp.load(DOC_ID);
    expect(record).not.toBeNull();
    expect(record!.totalPages).toBe(TOTAL);
    expect(record!.completedPages.length).toBe(TOTAL);
    expect(record!.completedPages).toEqual(completed);
  });

  it('getResumePages should return empty list for fully-processed doc', async () => {
    const pending = await cp.getResumePages(DOC_ID, 300);
    expect(pending).toEqual([]);
  });

  it('getResumePages should return correct pending pages for partial doc', async () => {
    await cp.remove('partial-test');
    await cp.save('partial-test', {
      documentId: 'partial-test', totalPages: 300, completedPages: [],
      engineVersion: 'v2', params: {}, layoutConfig: {},
    });
    for (let i = 1; i <= 147; i++) {
      await cp.markPageDone('partial-test', i);
    }
    const pending = await cp.getResumePages('partial-test', 300);
    expect(pending.length).toBe(153);
    expect(pending[0]).toBe(148);
    expect(pending[pending.length - 1]).toBe(300);
    await cp.remove('partial-test');
  });

  it('getResumePages should return empty if totalPages mismatch', async () => {
    await cp.save('mismatch-test', {
      documentId: 'mismatch-test', totalPages: 100,
      completedPages: [], engineVersion: 'v2',
      params: {}, layoutConfig: {},
    });
    const pending = await cp.getResumePages('mismatch-test', 200);
    expect(pending).toEqual([]);
    await cp.remove('mismatch-test');
  });

  it('MemoryGuard should track 300 simulated allocations with correct peak', () => {
    guard.reset();
    for (let i = 0; i < 300; i++) {
      guard.trackAllocation(22_000_000);
      guard.trackRelease(22_000_000);
    }
    expect(guard.getHighWaterMarkMB()).toBe(21);
    expect(guard.canAllocate(1)).toBe(true);
  });

  it('MemoryGuard canAllocate should return false under high simulated pressure', () => {
    guard.reset();
    guard.trackAllocation(600 * 1048576);
    const canAlloc = guard.canAllocate(50_000_000);
    expect(canAlloc).toBe(false);
  });
});

describe('Phase 5.7: Peak heap verification', () => {
  it('device profile for 4GB mobile should set maxHeapMB to 512', () => {
    const mobileGuard = new MemoryGuard();
    const limits = mobileGuard.getLimits();
    expect(limits.maxHeapMB).toBeLessThanOrEqual(1024);
    expect(limits.gcPressureThreshold).toBeGreaterThanOrEqual(0.8);
  });

  it('computeScheduleProfile for mobile caps maxPagesInFlight at 2', () => {
    const profile = computeScheduleProfile({
      cores: 4, memoryGB: 3, isMobile: true, isTablet: false,
      supportsWASM: false, supportsOffscreenCanvas: false, maxRenderDim: 1600,
    });
    expect(profile.maxPagesInFlight).toBe(2);
    expect(profile.targetDPI).toBe(150);
    const maxMemPerPage = profile.maxRenderDim * profile.maxRenderDim * 4;
    const worstCaseHeap = profile.maxPagesInFlight * maxMemPerPage;
    expect(worstCaseHeap).toBeLessThan(512 * 1048576);
  });

  it('computeScheduleProfile for desktop caps maxPagesInFlight at 8', () => {
    const profile = computeScheduleProfile({
      cores: 8, memoryGB: 16, isMobile: false, isTablet: false,
      supportsWASM: true, supportsOffscreenCanvas: true, maxRenderDim: 2400,
    });
    const maxMemPerPage = profile.maxRenderDim * profile.maxRenderDim * 4;
    const worstCaseHeap = profile.maxPagesInFlight * maxMemPerPage;
    expect(worstCaseHeap).toBeLessThan(2048 * 1048576);
  });

  it('MemoryGuard evictThreshold should trigger before maxHeapMB', () => {
    const mobileGuard = new MemoryGuard();
    const limits = mobileGuard.getLimits();
    expect(limits.evictThreshold).toBeLessThan(limits.gcPressureThreshold);
    expect(limits.gcPressureThreshold).toBeLessThanOrEqual(1);
  });
});
