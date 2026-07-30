import { describe, it, expect, beforeAll } from 'vitest';
import { MemoryGuard, memoryGuard } from '../../lib/pipeline/MemoryGuard';
import { CheckpointManager } from '../../lib/pipeline/checkpoint/CheckpointManager';
import { computeScheduleProfile } from '../../lib/pipeline/types';

describe('MemoryGuard', () => {
  it('should detect memory limits based on device', () => {
    const guard = new MemoryGuard();
    const limits = guard.getLimits();
    expect(limits.maxHeapMB).toBeGreaterThan(0);
    expect(limits.evictThreshold).toBeGreaterThan(0);
    expect(limits.gcPressureThreshold).toBeGreaterThan(0);
  });

  it('canAllocate should return boolean', () => {
    expect(typeof memoryGuard.canAllocate(1024)).toBe('boolean');
  });

  it('trackAllocation and trackRelease should track bytes', () => {
    const guard = new MemoryGuard();
    guard.trackAllocation(1000);
    guard.trackAllocation(2000);
    expect(guard.getHighWaterMarkMB()).toBeGreaterThanOrEqual(0);
    guard.trackRelease(500);
  });

  it('isUnderPressure should return boolean', () => {
    expect(typeof memoryGuard.isUnderPressure()).toBe('boolean');
  });

  it('reset should clear state', () => {
    const guard = new MemoryGuard();
    guard.trackAllocation(99999);
    guard.reset();
    expect(guard.getHighWaterMarkMB()).toBe(0);
  });
});

describe('CheckpointManager', () => {
  const cp = new CheckpointManager();

  it('should save and load a checkpoint', async () => {
    await cp.save('test-doc', {
      documentId: 'test-doc',
      totalPages: 5,
      completedPages: [1, 2, 3],
      engineVersion: 'v2',
      params: { preset: 'DARK_SLIDE' },
      layoutConfig: { format: 'A4' },
    });
    const loaded = await cp.load('test-doc');
    expect(loaded).not.toBeNull();
    expect(loaded!.totalPages).toBe(5);
    expect(loaded!.completedPages).toEqual([1, 2, 3]);
  });

  it('getResumePages should return unprocessed pages', async () => {
    const pending = await cp.getResumePages('test-doc', 5);
    expect(pending).toEqual([4, 5]);
  });

  it('should return empty if document unknown', async () => {
    const pending = await cp.getResumePages('unknown-doc', 10);
    expect(pending).toEqual([]);
  });

  it('should remove a checkpoint', async () => {
    await cp.remove('test-doc');
    const loaded = await cp.load('test-doc');
    expect(loaded).toBeNull();
  });

  it('listSnapshots should return summaries', async () => {
    await cp.save('list-test', {
      documentId: 'list-test',
      totalPages: 10,
      completedPages: [1, 2, 3, 4, 5],
      engineVersion: 'v2',
      params: {},
      layoutConfig: {},
    });
    const snapshots = await cp.listSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    const found = snapshots.find(s => s.documentId === 'list-test');
    expect(found).toBeDefined();
    expect(found!.completedCount).toBe(5);
    await cp.remove('list-test');
  });

  it('markPageDone should add a page to completed list', async () => {
    await cp.save('done-test', {
      documentId: 'done-test', totalPages: 3, completedPages: [],
      engineVersion: 'v2', params: {}, layoutConfig: {},
    });
    await cp.markPageDone('done-test', 1);
    await cp.markPageDone('done-test', 3);
    const record = await cp.load('done-test');
    expect(record!.completedPages).toContain(1);
    expect(record!.completedPages).toContain(3);
    expect(record!.completedPages).not.toContain(2);
    await cp.remove('done-test');
  });
});

describe('computeScheduleProfile', () => {
  it('should return low-tier for mobile devices', () => {
    const profile = computeScheduleProfile({
      cores: 4, memoryGB: 3, isMobile: true, isTablet: false,
      supportsWASM: false, supportsOffscreenCanvas: false, maxRenderDim: 1600,
    });
    expect(profile.renderConcurrency).toBe(1);
    expect(profile.maxPagesInFlight).toBe(2);
    expect(profile.targetDPI).toBe(150);
  });

  it('should return mid-tier for tablets', () => {
    const profile = computeScheduleProfile({
      cores: 6, memoryGB: 6, isMobile: false, isTablet: true,
      supportsWASM: true, supportsOffscreenCanvas: true, maxRenderDim: 2000,
    });
    expect(profile.processConcurrency).toBe(2);
    expect(profile.maxPagesInFlight).toBe(4);
    expect(profile.targetDPI).toBe(200);
  });

  it('should return high-tier for desktops', () => {
    const profile = computeScheduleProfile({
      cores: 8, memoryGB: 16, isMobile: false, isTablet: false,
      supportsWASM: true, supportsOffscreenCanvas: true, maxRenderDim: 2400,
    });
    expect(profile.renderConcurrency).toBe(2);
    expect(profile.maxPagesInFlight).toBe(8);
    expect(profile.targetDPI).toBe(250);
  });

  it('should handle 4GB desktop as low-tier (memoryGB <= 4)', () => {
    const profile = computeScheduleProfile({
      cores: 4, memoryGB: 4, isMobile: false, isTablet: false,
      supportsWASM: true, supportsOffscreenCanvas: true, maxRenderDim: 2000,
    });
    expect(profile.maxPagesInFlight).toBe(2);
    expect(profile.targetDPI).toBe(150);
  });
});
