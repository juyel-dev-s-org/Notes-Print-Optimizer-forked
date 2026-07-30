# Notes Print Optimizer - Production-Grade Architecture Specification

**Version:** 2.0.0
**Date:** 2026-07-30
**Status:** APPROVED - Single Source of Truth

---

## 1. Executive Summary

The Notes Print Optimizer (NPO) is a privacy-first, serverless, browser-based application
that converts dark-mode educational slide PDFs into print-optimized, ink-efficient PDF
documents. It performs per-page analysis, intelligent color inversion/remapping, noise
removal, stroke enhancement, and multi-up grid layout composition - entirely client-side.

This specification defines the target production architecture with:

- **Plugin-based processing pipeline** for extensibility
- **Rust/WASM acceleration** for compute-heavy kernels
- **Large document optimization** (200-300+ pages) with bounded memory
- **Cross-device stability** (mobile phones through desktop workstations)

---

## 2. Current State Analysis

### 2.1 Technology Stack (Baseline)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (SSG export) | 15.5.x |
| UI | React + Tailwind CSS 4 | 19.2.x |
| PDF Render | pdfjs-dist | 4.10.38 |
| PDF Export | pdf-lib | 1.17.1 |
| Workers | Blob-URL (esbuild IIFE) | - |
| WASM | Hand-written WAT (wabt) | ~1.2KB |
| Cache | IndexedDB (raw API) | - |
| State | useReducer + Context | - |
| Testing | Vitest + jsdom | 1.6.x |

### 2.2 Identified Deficiencies

| ID | Category | Issue | Severity |
|----|----------|-------|----------|
| D-01 | Performance | PDF render on main thread blocks UI | HIGH |
| D-02 | Performance | No pipeline overlap (sequential stages) | HIGH |
| D-03 | Architecture | 3x duplicated banner detection logic | MEDIUM |
| D-04 | Architecture | pixelKernels.ts wrapper adds no value | LOW |
| D-05 | Performance | WASM covers only 2 of ~8 hot functions | MEDIUM |
| D-06 | Memory | No ImageData/buffer pooling | MEDIUM |
| D-07 | Reliability | Worker crash = task loss, no retry | HIGH |
| D-08 | Architecture | Layout logic duplicated (main + worker) | MEDIUM |
| D-09 | UX | No progressive/incremental preview | MEDIUM |
| D-10 | Architecture | page.tsx contains 500+ lines orchestration | MEDIUM |
| D-11 | Build | Worker bundled as string, no source maps | LOW |
| D-12 | Performance | composeSheet cellH bug: /cols should be /rows | HIGH |
| D-13 | Testing | Tests target wrapper, not execution path | MEDIUM |
| D-14 | Architecture | No plugin/stage system for extensibility | MEDIUM |
| D-15 | Performance | Thumbnail gen creates/destroys canvases per page | LOW |
| D-16 | Memory | No backpressure for 100+ page documents | HIGH |
| D-17 | Architecture | No configuration schema/validation | LOW |
| D-18 | Performance | IDB writes compete with render thread | LOW |
| D-19 | Memory | 200+ page docs cause OOM on mobile | CRITICAL |
| D-20 | Performance | No SIMD/WASM for HSV, CC, classification | HIGH |

---

## 3. Target Architecture

### 3.1 Design Principles

1. **Plugin-first pipeline**: Every processing capability is a self-contained plugin.
2. **Off-main-thread by default**: All pixel operations, PDF rendering, layout in workers.
3. **Zero-copy where possible**: Transferable ArrayBuffers, SharedArrayBuffer for WASM.
4. **Backpressure-aware**: Bounded concurrency with adaptive scheduling per device class.
5. **Progressive output**: Incremental results visible immediately.
6. **Fail-safe**: Every stage has retry, fallback, graceful degradation.
7. **Measurable**: Every plugin emits timing/throughput metrics.
8. **Memory-bounded**: Hard ceiling on in-flight pages regardless of document size.

### 3.2 Architecture Overview

    APPLICATION SHELL
      WorkflowShell / PlatformAdaptive UI / DevTools Metrics Panel

    ORCHESTRATION LAYER
      PipelineController / PluginRegistry / EventBus / Services

    PLUGIN PIPELINE
      PipelineScheduler (backpressure, concurrency, priority, cancellation)
      [Plugin:Render] -> [Plugin:Analyze] -> [Plugin:Process] ->
      [Plugin:Layout] -> [Plugin:Export]

    WORKER MESH + WASM
      [Render Workers] [Pixel Workers] [Compose Workers] [WASM Module (Rust)]

    INFRASTRUCTURE LAYER
      [BufferPool] [IDB Cache LRU] [MetricsBus] [ConfigRegistry]

---

## 4. Plugin System Design

### 4.1 Philosophy

The processing pipeline is a **directed acyclic graph (DAG) of plugins**. The core
PipelineController knows nothing about what plugins do - it only knows how to:

- Register plugins
- Resolve execution order (topological sort of declared dependencies)
- Route data between plugins via typed channels
- Handle lifecycle (init -> execute -> dispose)
- Enforce timeouts and retries

New features (e.g., OCR, watermark removal, custom color profiles) are added by
registering a new plugin. **Zero changes to PipelineController required.**

### 4.2 Plugin API

    // lib/pipeline/plugin/types.ts

    export type PluginId = string; // e.g., 'npo.render.pdfjs@1.0.0'

    export interface PluginManifest {
      readonly id: PluginId;
      readonly name: string;
      readonly version: string;
      readonly description: string;
      readonly dependsOn?: PluginId[];
      readonly inputChannel: ChannelId;
      readonly outputChannel: ChannelId;
      readonly executionTarget: 'main' | 'worker' | 'wasm' | 'auto';
      readonly priority?: number;
      readonly optional: boolean;
      readonly resourceHint?: {
        estimatedMemoryMB?: number;
        isGPUBound?: boolean;
        isCPUBound?: boolean;
      };
    }

    export interface PluginContext {
      readonly documentId: string;
      readonly pageIndex: number;
      readonly totalPages: number;
      readonly config: ResolvedConfig;
      readonly metrics: MetricsBus;
      readonly signal: AbortSignal;
      readonly deviceProfile: DeviceProfile;
      readonly bufferPool: IBufferPool;
      progress(fraction: number, message?: string): void;
      log(level: 'debug' | 'info' | 'warn' | 'error', msg: string): void;
    }

    export interface PluginResult<T = unknown> {
      readonly data: T;
      readonly metrics: PluginMetrics;
      readonly warnings?: string[];
      readonly cacheable?: boolean;
      readonly cacheKey?: string;
    }

    export interface PluginMetrics {
      readonly durationMs: number;
      readonly inputBytes: number;
      readonly outputBytes: number;
      readonly pixelsProcessed?: number;
      readonly wasmUsed?: boolean;
    }

    export interface IPlugin<I = unknown, O = unknown> {
      readonly manifest: PluginManifest;
      init?(ctx: PluginContext): Promise<void>;
      execute(input: I, ctx: PluginContext): Promise<PluginResult<O>>;
      executeBatch?(inputs: I[], ctx: PluginContext): Promise<PluginResult<O>[]>;
      isHealthy?(): boolean;
      dispose?(): Promise<void>;
    }

    export interface PluginRegistration {
      plugin: IPlugin;
      enabled: boolean;
      config?: Record<string, unknown>;
    }

### 4.3 Plugin Registry

    // lib/pipeline/plugin/PluginRegistry.ts

    export class PluginRegistry {
      private plugins = new Map<PluginId, PluginRegistration>();
      private executionOrder: PluginId[] = [];
      private dirty = true;

      register(plugin: IPlugin, config?: Record<string, unknown>): void;
      unregister(id: PluginId): void;
      setEnabled(id: PluginId, enabled: boolean): void;
      resolveOrder(): PluginId[];
      getActivePipeline(): IPlugin[];
      validate(): ValidationResult;
      upgrade(id: PluginId, newPlugin: IPlugin): void;
    }

### 4.4 Channel System (Data Routing)

    // lib/pipeline/plugin/channels.ts

    export type ChannelId = string;

    export const Channels = {
      RAW_PDF: 'channel:raw-pdf',
      PAGE_IMAGE: 'channel:page-image',
      PAGE_PROFILE: 'channel:page-profile',
      OPTIMIZED_IMAGE: 'channel:optimized',
      SHEET_COMPOSITION: 'channel:sheets',
      PDF_DOCUMENT: 'channel:pdf-output',
      THUMBNAIL: 'channel:thumbnail',
    } as const;

    export interface ChannelDataMap {
      [Channels.RAW_PDF]: ArrayBuffer;
      [Channels.PAGE_IMAGE]: { imageData: ImageData; pageNumber: number };
      [Channels.PAGE_PROFILE]: PageProfile;
      [Channels.OPTIMIZED_IMAGE]: { imageData: ImageData; inkMetrics: InkMetrics };
      [Channels.SHEET_COMPOSITION]: { sheets: ArrayBuffer[]; format: 'jpeg' };
      [Channels.PDF_DOCUMENT]: Blob;
      [Channels.THUMBNAIL]: { dataUrl: string; pageNumber: number };
    }

### 4.5 Built-in Plugins

| Plugin ID | Channel In | Channel Out | Target | Optional |
|-----------|-----------|-------------|--------|----------|
| npo.render.pdfjs@1.0.0 | RAW_PDF | PAGE_IMAGE | worker | No |
| npo.analyze.profile@1.0.0 | PAGE_IMAGE | PAGE_PROFILE | worker+wasm | No |
| npo.process.optimize@1.0.0 | PAGE_IMAGE+PROFILE | OPTIMIZED_IMAGE | worker+wasm | No |
| npo.layout.compose@1.0.0 | OPTIMIZED_IMAGE | SHEET_COMPOSITION | worker | No |
| npo.export.pdf@1.0.0 | SHEET_COMPOSITION | PDF_DOCUMENT | main | No |
| npo.thumbnail.generate@1.0.0 | PAGE_IMAGE | THUMBNAIL | worker | Yes |
| npo.cache.idb@1.0.0 | OPTIMIZED_IMAGE | (side-effect) | main | Yes |

### 4.6 Third-Party Plugin Example

    const watermarkPlugin: IPlugin<ImageData, ImageData> = {
      manifest: {
        id: 'community.watermark-remover@1.0.0',
        name: 'Watermark Remover',
        version: '1.0.0',
        description: 'Detects and removes diagonal watermarks',
        dependsOn: ['npo.render.pdfjs@1.0.0'],
        inputChannel: Channels.PAGE_IMAGE,
        outputChannel: Channels.PAGE_IMAGE,
        executionTarget: 'worker',
        priority: 50,
        optional: true,
        resourceHint: { estimatedMemoryMB: 20, isCPUBound: true },
      },
      async execute(input, ctx) {
        return { data: cleaned, metrics: { durationMs: 0, inputBytes: 0, outputBytes: 0 } };
      },
      async dispose() { }
    };
    registry.register(watermarkPlugin);

### 4.7 Backward Compatibility

- Engine v1 remains frozen and accessible via registry.getEngine('v1').
- Plugin system wraps v1 logic as monolithic plugin (npo.legacy.v1@1.0.0) for migration.
- All existing IProcessingEngine implementations continue to work unchanged.
- Plugin API versioning: manifest includes apiVersion: 1. Future breaking changes bump
  to apiVersion: 2 with adapter layer.

---

## 5. Large Document Optimization (200-300+ Pages)

### 5.1 Problem Statement

A 300-page PDF at 250 DPI produces ~300 x (2000x2800x4) bytes = ~6.7 GB of raw ImageData
if held simultaneously. Mobile devices have 2-4 GB total RAM. The browser tab will be
killed at ~1-1.5 GB JS heap.

### 5.2 Strategy: Streaming Sliding Window

    Document: 300 pages

    [R][R][R][ ][ ]   <- Render Window (3 pages ahead)
    [A][A][A]         <- Analyze Window (concurrent)
    [P][P][P]         <- Process Window (concurrent)
        |
        v
    [IDB / Disk]      <- Persisted (no RAM cost)

    Memory at any time: 3 pages x ~22MB = ~66MB (bounded!)

### 5.3 Adaptive Concurrency by Device Class

    interface DeviceProfile {
      cores: number;
      memoryGB: number;
      isMobile: boolean;
      isTablet: boolean;
      supportsWASM: boolean;
      supportsOffscreenCanvas: boolean;
      maxRenderDim: number;
    }

    function computeScheduleProfile(device: DeviceProfile): ScheduleProfile {
      if (device.isMobile || device.memoryGB <= 4) {
        return {
          renderConcurrency: 1, processConcurrency: 1, composeConcurrency: 1,
          maxPagesInFlight: 2, renderAhead: 1, idbWriteBatchSize: 2,
          yieldIntervalMs: 32, targetDPI: 150, maxRenderDim: 1600,
        };
      }
      if (device.isTablet || device.memoryGB <= 8) {
        return {
          renderConcurrency: 1, processConcurrency: 2, composeConcurrency: 1,
          maxPagesInFlight: 4, renderAhead: 2, idbWriteBatchSize: 4,
          yieldIntervalMs: 16, targetDPI: 200, maxRenderDim: 2000,
        };
      }
      return {
        renderConcurrency: 2,
        processConcurrency: Math.min(device.cores - 2, 6),
        composeConcurrency: 2, maxPagesInFlight: 8, renderAhead: 3,
        idbWriteBatchSize: 8, yieldIntervalMs: 16, targetDPI: 250, maxRenderDim: 2400,
      };
    }

### 5.4 Memory Budget Enforcement

    class MemoryGuard {
      private readonly MAX_HEAP_MB: number;
      private readonly EVICT_THRESHOLD = 0.8;

      constructor(device: DeviceProfile) {
        this.MAX_HEAP_MB = device.isMobile ? 512 : device.isTablet ? 1024 : 2048;
      }

      canAllocate(bytes: number): boolean {
        const currentMB = (performance as any).memory?.usedJSHeapSize / 1048576 ?? 0;
        return (currentMB + bytes / 1048576) < this.MAX_HEAP_MB * this.EVICT_THRESHOLD;
      }

      async enforceBudget(cache: CacheManager): Promise<void> {
        const currentMB = (performance as any).memory?.usedJSHeapSize / 1048576 ?? 0;
        if (currentMB > this.MAX_HEAP_MB * this.EVICT_THRESHOLD) {
          await cache.evictOldest(Math.ceil(currentMB - this.MAX_HEAP_MB * 0.6));
        }
      }
    }

### 5.5 Pipeline Overlap (Concurrent Stages)

    Time ----------------------------------------------------------------->
    Page 1: [RENDER][ANALYZE][PROCESS][FLUSH]
    Page 2:    [RENDER][ANALYZE][PROCESS][FLUSH]
    Page 3:       [RENDER][ANALYZE][PROCESS][FLUSH]
    Page 4:          [RENDER][ANALYZE][PROCESS][FLUSH]
    ...
    Page N:                                     [COMPOSE ALL][EXPORT]

- Render is GPU-bound: limited to 1-2 concurrent
- Analyze+Process are CPU-bound: parallelized across cores
- Compose runs after ALL pages processed (needs full set for grid layout)
- Export is I/O-bound: single-threaded pdf-lib assembly

### 5.6 Checkpoint and Resume

For 300-page documents, processing may take 2-5 minutes. If the tab is backgrounded or killed:

1. Each completed page is immediately persisted to IDB with { docId, pageIndex, status, data }.
2. On resume, PipelineController queries IDB for completed pages and skips them.
3. Progress state is serialized: { lastCompletedPage, totalProcessed, timestamp }.
4. User sees "Resuming from page 147/300" on return.

---

## 6. WASM Architecture (Rust)

### 6.1 Rationale

Current WAT covers 2 functions (~1.2KB). The connected-components algorithm, HSV conversion,
and color classification consume 70%+ of processing time in pure JS. Rust provides:

- Memory safety without GC
- SIMD intrinsics (std::simd / packed_simd)
- wasm-bindgen for zero-copy ArrayBuffer sharing
- wasm-opt size optimization
- Maintainable codebase vs hand-written WAT

### 6.2 Module Structure

    wasm/
      Cargo.toml
      src/
        lib.rs              # wasm-bindgen exports
        hsv.rs              # Batch RGB->HSV (SIMD u8x16)
        classify.rs         # Single-pass 7-channel color classification
        connected.rs        # Union-find CC labeling
        decorative.rs       # Strip decorative fills (CC + filter)
        noise.rs            # Noise removal (CC + size filter)
        mask_ops.rs         # Dilation/erosion (SIMD)
        sharpen.rs          # Unsharp mask (SIMD)
        ink.rs              # Full-pass ink coverage
        utils.rs            # Shared helpers
      pkg/                  # wasm-pack output (committed)
      build.sh              # wasm-pack build --target web --release

### 6.3 Performance Targets

| Function | JS (MPx/s) | WASM Target (MPx/s) | Speedup |
|----------|-----------|---------------------|---------|
| rgb_to_hsv_batch | ~15 | 60-80 | 4-5x |
| classify_colors (7-pass to 1-pass) | ~8 | 50-70 | 6-8x |
| connected_components | ~5 | 15-20 | 3-4x |
| strip_decorative_fills | ~4 | 12-18 | 3-4x |
| remove_noise | ~6 | 18-25 | 3-4x |
| apply_mask_dilation | ~20 | 40-60 | 2-3x |
| apply_unsharp_mask | ~12 | 35-50 | 3-4x |
| calculate_ink_coverage | ~25 | 150-200 | 6-8x |

**Aggregate target:** 2000x2800px page processing from ~180ms to ~45ms (4x improvement).

### 6.4 WASM Integration Pattern

    // lib/wasm/loader.ts
    export interface IWasmKernels {
      rgbToHsvBatch(rgba: Uint8ClampedArray, pixelCount: number): Float32Array;
      classifyColors(rgba: Uint8ClampedArray, hsv: Float32Array, n: number): ColorChannels;
      connectedComponents(mask: Uint8Array, w: number, h: number): Int32Array;
      stripDecorativeFills(rgba: Uint8ClampedArray, w: number, h: number): void;
      removeNoise(rgba: Uint8ClampedArray, w: number, h: number, maxArea: number): void;
      dilateMask(mask: Uint8Array, w: number, h: number, radius: number): void;
      unsharpMask(rgba: Uint8ClampedArray, w: number, h: number, amt: number, r: number): void;
      inkCoverage(rgba: Uint8ClampedArray, n: number, threshold: number): number;
    }

    export async function initWasm(): Promise<IWasmKernels> {
      try {
        const wasm = await import('../../wasm/pkg/npo_wasm.js');
        await wasm.default();
        return { /* map wasm exports */ };
      } catch (e) {
        console.warn('[WASM] Init failed, JS fallback:', e);
        return createJSFallbackKernels();
      }
    }

### 6.5 Zero-Copy Strategy (Rust)

    #[wasm_bindgen]
    pub fn strip_decorative_fills(rgba: &mut [u8], width: u32, height: u32) {
        // Operates directly on the JS-owned buffer - no copy
    }

    #[wasm_bindgen]
    pub fn rgb_to_hsv_batch(rgba: &[u8], pixel_count: u32) -> Vec<f32> {
        let mut hsv = Vec::with_capacity((pixel_count * 3) as usize);
        // SIMD processing...
        hsv
    }

### 6.6 Build and Distribution

- WASM binary committed to repo (wasm/pkg/npo_wasm_bg.wasm) for SSG compatibility.
- Build script: wasm-pack build --target web --release --out-dir pkg
- CI rebuilds only when wasm/src/** changes (path-based trigger).
- Binary size target: < 80KB gzipped.
- Loaded lazily: only when first processing task starts (not on page load).

---

## 7. Module Boundaries (Target File Structure)

    lib/
      pipeline/
        plugin/
          types.ts
          PluginRegistry.ts
          channels.ts
          index.ts
        PipelineScheduler.ts
        PipelineController.ts
        MemoryGuard.ts
        CheckpointManager.ts
        types.ts
        index.ts
      plugins/
        render/PdfJsRenderPlugin.ts
        analyze/ProfileAnalyzePlugin.ts
        process/OptimizeProcessPlugin.ts
        layout/ComposeLayoutPlugin.ts
        export/PdfExportPlugin.ts
        thumbnail/ThumbnailPlugin.ts
        cache/IDBCachePlugin.ts
      kernels/
        luminance.ts
        hsv.ts
        connectedComponents.ts
        colorClassification.ts
        maskOps.ts
        sharpen.ts
        noise.ts
        bannerDetection.ts
        inkCoverage.ts
        processPage.ts
        index.ts
      wasm/
        loader.ts
        types.ts
        jsFallback.ts
      workers/
        render.worker.ts
        pixel.worker.ts
        compose.worker.ts
        pool.ts
        protocol.ts
        WorkerManager.ts
      engine/
        IProcessingEngine.ts
        types.ts
        registry.ts
        v1/
        v2/ProcessingEngineV2.ts
      cache/
        CacheManager.ts
        eviction.ts
        types.ts
      config/
        schema.ts
        defaults.ts
        validator.ts
      metrics/
        MetricsBus.ts
        types.ts
        reporters/
      workflow/
        types.ts
        workflowReducer.ts
        WorkflowContext.tsx
        useWorkflow.ts
      services/
        UploadService.ts
        OptimizationService.ts
        LayoutService.ts
        ExportService.ts
      utils/
        device.ts
        memory.ts
        concurrency.ts

    wasm/
      Cargo.toml
      src/ (lib.rs, hsv.rs, classify.rs, connected.rs, decorative.rs, noise.rs, mask_ops.rs, sharpen.rs, ink.rs)
      pkg/
      build.sh

---

## 8. Implementation Roadmap

### Phase Overview

| Phase | Name | Est. Duration | Priority |
|-------|------|---------------|----------|
| 0 | Critical Bug Fixes and Quick Wins | 1 day | P0 |
| 1 | Kernel Consolidation | 2 days | P0 |
| 2 | Worker Architecture Modernization | 3 days | P0 |
| 3 | Plugin System + Pipeline Framework | 4 days | P0 |
| 4 | Rust/WASM Kernel Migration | 5 days | P1 |
| 5 | Large Document Optimization and Memory | 3 days | P1 |
| 6 | Progressive UX and Services Layer | 3 days | P1 |
| 7 | Configuration, Metrics and Observability | 2 days | P2 |
| 8 | Testing, Benchmarks and Hardening | 3 days | P2 |

### Phase 0: Critical Bug Fixes

| Task | Description |
|------|-------------|
| 0.1 | Fix composeSheet cellH: / cols -> / rows |
| 0.2 | Remove dead pixelKernels.ts wrapper |
| 0.3 | Deduplicate detectBanners to single implementation |
| 0.4 | Fix luminances array potential overflow |
| 0.5 | Add willReadFrequently: true to all 2d contexts using getImageData |

### Phase 1: Kernel Consolidation

| Task | Description |
|------|-------------|
| 1.1 | Create lib/kernels/ with individual pure-function modules |
| 1.2 | Extract from worker/kernels.ts into separate modules |
| 1.3 | Create lib/kernels/processPage.ts orchestrator |
| 1.4 | Update all imports (worker, MainThreadImageProcessor, tests) |
| 1.5 | Delete pixelKernels.ts. Verify all tests pass. |

### Phase 2: Worker Modernization

| Task | Description |
|------|-------------|
| 2.1 | Implement lib/workers/pool.ts - typed WorkerPool with retry, timeout, health |
| 2.2 | Implement lib/workers/protocol.ts - discriminated union messages |
| 2.3 | Create pixel.worker.ts (ES module, imports from lib/kernels/) |
| 2.4 | Create compose.worker.ts (OffscreenCanvas layout) |
| 2.5 | Create render.worker.ts (pdf.js in worker) |
| 2.6 | Implement WorkerManager.ts - singleton, capability detection, fallback |
| 2.7 | Update next.config.ts for new Worker(new URL(...)) |
| 2.8 | Remove old blob-URL infrastructure |

### Phase 3: Plugin System + Pipeline

| Task | Description |
|------|-------------|
| 3.1 | Implement lib/pipeline/plugin/types.ts - full plugin API |
| 3.2 | Implement PluginRegistry - register, unregister, topo-sort, validate |
| 3.3 | Implement channels.ts - typed channel definitions |
| 3.4 | Implement PipelineScheduler - bounded concurrency, backpressure, abort |
| 3.5 | Implement PipelineController - routes data between plugins via channels |
| 3.6 | Implement built-in plugins: Render, Analyze, Process, Layout, Export |
| 3.7 | Implement ProcessingEngineV2 wrapping PipelineController |
| 3.8 | Wire into UI via OptimizationService |
| 3.9 | Parity test: v1 output === v2 output |

### Phase 4: Rust/WASM

| Task | Description |
|------|-------------|
| 4.1 | Scaffold Rust project with wasm-bindgen, wasm-pack |
| 4.2 | Implement hsv.rs (SIMD batch conversion) |
| 4.3 | Implement classify.rs (single-pass 7-channel) |
| 4.4 | Implement connected.rs (union-find) |
| 4.5 | Implement decorative.rs + noise.rs |
| 4.6 | Implement mask_ops.rs + sharpen.rs |
| 4.7 | Implement ink.rs |
| 4.8 | Create lib/wasm/loader.ts with JS fallback |
| 4.9 | Integrate into pixel.worker.ts |
| 4.10 | Benchmark all kernels. Record in BASELINE.md |

### Phase 5: Large Document Optimization

| Task | Description |
|------|-------------|
| 5.1 | Implement MemoryGuard with device-adaptive limits |
| 5.2 | Implement sliding-window scheduler (maxPagesInFlight) |
| 5.3 | Implement ImageData ring buffer in pixel worker |
| 5.4 | Implement IDB LRU eviction (200MB budget) |
| 5.5 | Implement CheckpointManager for resume support |
| 5.6 | Stress test: 300-page PDF on simulated 4GB device |
| 5.7 | Verify peak heap < 512MB on mobile profile |

### Phase 6: Progressive UX

| Task | Description |
|------|-------------|
| 6.1 | Extract services: Upload, Optimization, Layout, Export |
| 6.2 | Refactor page.tsx to < 100 lines |
| 6.3 | Progressive thumbnail grid (per-page completion) |
| 6.4 | Cancellation UI with AbortController |
| 6.5 | Resume UI for interrupted large documents |

### Phase 7: Config and Metrics

| Task | Description |
|------|-------------|
| 7.1 | Config schema + defaults + validator |
| 7.2 | MetricsBus with per-plugin instrumentation |
| 7.3 | Dev-only metrics panel (tree-shaken in prod) |

### Phase 8: Testing and Hardening

| Task | Description |
|------|-------------|
| 8.1 | Unit tests for all kernels (>=90% branch coverage) |
| 8.2 | Integration test: full pipeline on synthetic PDFs |
| 8.3 | WASM parity tests |
| 8.4 | Benchmark suite with regression gates |
| 8.5 | Memory leak test (10x process-reset cycle) |
| 8.6 | Worker crash recovery test |
| 8.7 | Cross-browser smoke tests |
| 8.8 | CI pipeline: lint + test + build + benchmark |

---

## 9. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Rust/WASM build complexity | MEDIUM | HIGH | Pre-build + commit binary. CI rebuilds only on .rs changes |
| ES module workers in Safari < 16 | LOW | MEDIUM | Feature-detect; blob-URL fallback retained |
| Pipeline refactor output drift | MEDIUM | HIGH | Pixel-diff parity tests. v1/v2 parallel during dev |
| WASM binary size bloat | LOW | MEDIUM | wasm-opt -Oz. Lazy load. Size budget in CI |
| 300-page OOM on 2GB phones | MEDIUM | CRITICAL | MemoryGuard + sliding window + DPI reduction |
| IDB unavailable (private mode) | LOW | LOW | All calls try/catch. Processing works without cache |
| Next.js SSG + worker URLs | MEDIUM | HIGH | Test early Phase 2. Fallback: data URI inline |

---

## 10. Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| 20-page processing time | ~12-15s | < 5s |
| 300-page processing (desktop) | OOM crash | < 90s, < 512MB peak |
| 300-page processing (mobile) | OOM crash | < 180s, < 384MB peak |
| Main-thread jank | Frequent | < 2 dropped frames |
| First thumbnail visible | After full batch | < 500ms |
| WASM kernel throughput | N/A | > 50 MPx/s aggregate |
| Test coverage (core) | ~30% | > 85% |
| Worker crash recovery | Task lost | Auto-retry succeeds |
| Code duplication | 3x kernels | 1x |
| page.tsx lines | ~500 | < 100 |
| Plugin addition effort | Modify core | Register + done |

---

## 11. Approval

This specification is the **single source of truth**. Implementation begins at Phase 0,
Task 0.1 upon approval. Each task produces one focused commit. No phase is skipped.

---

*End of Specification v2.0.0*
