// lib/optimizer/perf/benchmark.ts

export interface BenchmarkResult {
  stage: string;
  durationMs: number;
  memoryBytes?: number;
  megapixelsPerSec?: number;
}

export class BenchmarkHarness {
  private results: BenchmarkResult[] = [];
  private startTime: number = 0;

  public startStage(stage: string): void {
    this.startTime = performance.now();
  }

  public endStage(stage: string, pixels: number = 0): void {
    const durationMs = performance.now() - this.startTime;
    const result: BenchmarkResult = {
      stage,
      durationMs,
    };

    if (pixels > 0) {
      result.megapixelsPerSec = (pixels / 1_000_000) / (durationMs / 1000);
    }

    // Try to capture memory if available (Chrome/Node.js with --expose-gc)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      result.memoryBytes = (performance as any).memory.usedJSHeapSize;
    }

    this.results.push(result);
  }

  public getResults(): BenchmarkResult[] {
    return this.results;
  }

  public reset(): void {
    this.results = [];
  }

  public printSummary(): void {
    console.log('\\n=== Benchmark Summary ===');
    let totalMs = 0;
    for (const r of this.results) {
      console.log(`  ${r.stage}: ${r.durationMs.toFixed(2)} ms${r.megapixelsPerSec ? ` (${r.megapixelsPerSec.toFixed(2)} MPx/s)` : ''}`);
      totalMs += r.durationMs;
    }
    console.log(`  TOTAL: ${totalMs.toFixed(2)} ms\\n`);
  }
}

export const benchmark = new BenchmarkHarness();
