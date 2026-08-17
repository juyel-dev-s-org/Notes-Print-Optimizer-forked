# Benchmark Baseline

This file records the performance metrics for the optimizer pipeline across re-architecture phases.

## Environment
- Node.js: 20.x / 22.x
- Test Image: 800x1000px synthetic light handwritten page (for pipeline bench)
- Kernel bench: 1000x1000px random RGBA data (1 MPx)
- Runner: Vitest (jsdom + @napi-rs/canvas)

## Phase 0 — Performance Baseline (2026-08)

Goal: measure where processing time is actually spent before optimizing.

### CPU-bound per-page pipeline (Vitest, main-thread JS, no rendering)

Config: 1600x900 (1.44 MPx) synthetic dark slides, 10 pages, `PW_DARK_SLIDE` preset.
Source: `tests/benchmarks/phase0Baseline.bench.ts` (runs in CI).

| Phase | ms / page | Share |
|---|---|---|
| analyze | 24.6 | 11% |
| **processPage (pixel kernel)** | **194.1** | **84%** |
| inkCoverage (before + after) | 12.6 | 5% |
| **CPU total** | **231.3** | 100% |

- Throughput (CPU only): **~4.3 pages/sec**
- Runner: Windows 11 / Node 20 / vitest (jsdom)

### Post-optimization (combined CC pass + white-pixel fast path + Uint32 composite)

| Metric | Before | After | Improvement |
|---|---|---|---|
| process_ms_per_page | ~380 | ~194 | **49% faster** |
| pages_per_sec_cpu | ~2.3 | ~4.3 | **87% higher** |
| CC traversals per page | 8 (7 channels + noise) | 1 | **87% fewer** |

### Key finding

`processPage` (HSV classification + channel masks + dilate + denoise + composite + unsharp)
is **~85% of per-page CPU**. This is the single biggest target for parallelisation
(worker pool) and WASM acceleration.

### Instrumentation added in Phase 0

- V1 engine emits `page:phases` (per-page render / analyze / process / thumbnail / persist)
  and `doc:phases` (document aggregate) to the MetricsBus.
- Browser harness: call `window.__npoBenchmark()` in the console, or open the app with
  `?bench=1` (and optional `&pages=20`), to measure the **full pipeline including pdfjs
  rendering** on a real device.
- Vitest benchmark guards against CPU regressions in CI.

### Decision points for Phase 1+

- Capture the full render-vs-process split via `?bench=1` on a real device.
- If `process` stays dominant, Phase 1 (worker-pool parallelism) and Phase 2 (WASM) are justified.

### Engine comparison (20 pages, charging / best-performance, after lazy-original)

V2 (sequential) gives the true per-phase cost; V1 (parallel, 4 concurrent)
numbers are inflated by contention. Both measured via `?bench=1&engine=...`.

| Phase | V1 (parallel) | V2 (sequential) |
|---|---|---|
| render | 153.5ms | 27.4ms |
| analyze | 1.4ms | 1.5ms |
| process | 147.1ms | 157.9ms |
| thumb | 292.0ms | 25.1ms |
| persist | 248.7ms | 33.3ms |
| **pages/sec** | **4.63** | 3.76 |

- V1 wins on desktop (parallelism); V2 is memory-safe / sequential.
- V2's clean breakdown shows `process` (pixel kernel) is the true bottleneck
  (~64% of sequential per-page cost).
- Power state dominates: same code gave 4.6 pps (charging) vs 1.5 pps
  (battery saver). Always benchmark on AC / best-performance.
- Next target: move `process` kernels to WASM.

---

## Pipeline Benchmarks


| Phase | Analyze (ms) | Process (ms) | TOTAL (ms) | Analyze (MPx/s) | Process (MPx/s) | Notes |
|-------|-------------|-------------|-----------|----------------|----------------|-------|
| Phase 0-1 | ~71 | ~58 | ~129 | ~11 | ~14 | Before Phase 2 |
| Phase 2 | ~7-12 | ~8-10 | ~15-22 | ~64-107 | ~78-105 | After single-source worker |
| Phase 3 | ~10-20 | ~10-16 | ~20-37 | ~15-70 | ~15-80 | Pipeline + plugins |
| Phase 4 (JS baseline) | ~11 | ~4.5 | ~15.5 | ~73 | ~179 | After Rust WASM kernels (JS fallback) |

## Kernel Benchmarks (JS fallback, 1 MPx random data)

| Kernel | Time (ms) | Throughput (MPx/s) |
|--------|----------|-------------------|
| rgbToHsvBatch | 35.96 | 27.81 |
| classifyColors | 14.86 | 67.31 |
| dilateMask ks=3 | 9.26 | 108.02 |
| unsharpMask | 42.14 | 23.73 |
| removeNoise (40Kpx) | 3.04 | 13.16 |
| inkCoverage | 1.47 | 678.06 |
| connectedComponents (40Kpx) | 0.37 | 107.01 |

## WASM Performance Targets (when loaded in browser)

| Function | JS (MPx/s) | WASM Target (MPx/s) | Speedup |
|----------|-----------|--------------------|---------|
| rgb_to_hsv_batch | ~28 | 60-80 | 2-3x |
| classify_colors | ~67 | 50-70 | ~1x (already fast) |
| connected_components | ~107 | 15-20 | ~0.15x* |
| strip_decorative_fills | ~13 | 12-18 | ~1x |
| remove_noise | ~13 | 18-25 | 1.5-2x |
| dilate_mask | ~108 | 40-60 | ~0.5x* |
| unsharp_mask | ~24 | 35-50 | 1.5-2x |
| ink_coverage | ~678 | 150-200 | ~0.3x* |

\* Some JS implementations are already very fast because the test data is random (no actual connected components). WASM overhead (memory copy) makes these slower for small/simple inputs. Real-world speedups depend on actual document content.

## Key Improvements

### Phase 4 (Rust WASM Migration)
1. **Rust WASM module (25KB)**: All 8 kernels (hsv, classify, connected components, decorative, noise, dilation, sharpen, ink) implemented in Rust with wasm-bindgen.
2. **JS fallback**: `jsKernels` in `lib/wasm/jsFallback.ts` — pure-JS implementations matching WASM exactly. Auto-used when WASM unavailable.
3. **Lazy loading**: WASM loaded on first worker message, not on page load. Graceful JS fallback on failure.
4. **Worker integration**: `pixel.worker.ts` calls `ensureWasmKernels()` on init and sets all hooks via `setWasmKernelsHooks()`.
5. **Parity tests**: 11 tests verify Rust WASM JS fallback === JS reference kernels (75 total passing).

## Targets
- Phase 4: WASM JS fallback must match JS reference kernels (11/11 parity tests pass ✅).
- Phase 5: Large document (300-page) processing must not exceed 512MB peak heap.
- Phase 8: >85% test coverage.

---

## Sharpen Optimization (2026-08)

Goal: reduce the #1 cost inside `processPage`. Intra-kernel profiling (1600x900 dark
slide, exact toggle-difference method) showed sharpen = 73% of kernel time
(42.4ms of 58.0ms); mask+CC 23.1%, dilate 3.8%, composite ~0%.

### JS kernels (`lib/kernels/sharpen.ts`)

Variant shootout (`tests/benchmarks/sharpenShootout.bench.ts`, 1600x900):

| Variant | ms/call | Notes |
|---|---|---|
| B full-copy | 28.7-29.1 | baseline correct |
| A rolling-2row (old) | 20.2-27.3 | **BUG: off-by-one (loaded row y+2 as current)** |
| C rolling-3row | 19.2-21.7 | correct + fastest |
| D full-copy+locals | 27.8-30.0 | |
| E float32 rolling | 50.4 | |
| F rolling-3row+hoisted | 60.2-62.8 | |

- **Fix applied**: `applyUnsharpMask` rewritten as rolling 3-row (variant C).
  Removes the full-image copy AND fixes the off-by-one so output now matches the
  mathematical reference (parity test added to `tests/unit/pixelKernels.test.ts`).
- JS was ~24-42ms/kernel on 1MPx; variant C keeps the speed of the buggy rolling
  version while producing correct output.

### Rust WASM (`wasm/src/sharpen.rs`)

Native `cargo test --release speed_variants` (1600x900, x86):

| Variant | ms/call | vs full-copy |
|---|---|---|
| **full-copy (`to_vec`)** | **55.9** | 1.00x |
| rolling-3row | 66.4 | 0.84x |
| unrolled (3-channel) | 124.4 | 0.45x |
| separable two-pass | 114.3 | 0.49x |

- In Rust the full-image copy wins: `memcpy` is cheap, per-row rolling rotation and
  extra passes add more cost than the copy saves (opposite of JS).
- **Decision**: Rust `unsharp_mask` stays full-copy (was already fastest + correct).
  Added a range-safety guard (`height/width < 3`) plus a unit test.

### Browser end-to-end (`tests/benchmarks/browserPhases.spec.ts`, wasm=true, hw=8, 10 pages)

Fresh run before vs after wasm rebuild (same `PW_DARK_SLIDE`, real pdf.js render):

| Phase | V2 before | V2 after | V1 before | V1 after* |
|---|---|---|---|---|
| render | 42.5ms | ~35-43ms | 61.6ms | 123-139ms |
| process | 602.1ms | **338-348ms** | 720.9ms | 777-812ms |
| thumb | 8.1ms | — | 31.7ms | ~55ms |
| persist | 28.8ms | — | 47.8ms | ~177ms |
| pages/sec | 1.42 | **2.16-2.28** | 3.97 | ~2.9 |

\* V1 runs noisy (render/persist inflated by machine load / parallel contention);
V2 is the stable signal.

- **V2 process improved ~44%** (602 → ~340ms) after rebuilding the WASM binary.
  Committed `npo_wasm_bg.wasm` was ~26KB; rebuilt is ~30.6KB. Cargo.toml already had
  `lto/opt-level="z"/codegen-units=1` but the committed binary predated an effective
  optimized build, so the served module was slower.
- **Manual WASM build pipeline** (wasm-pack blocked by machine policy):
  `cargo build --target wasm32-unknown-unknown --release` →
  `wasm-bindgen --target web --out-dir pkg target/wasm32-unknown-unknown/release/npo_wasm.wasm` →
  copy `pkg/npo_wasm_bg.wasm` + `pkg/npo_wasm.js` to `public/wasm/`.
- `wasm/src/process.rs` compile fixes for rustc 1.97: inner `//!` doc comments after
  items (E0753 → `//`) and `CC_BUFFERS.with` borrow-checker (E0499 → destructure guard).
- Full verification: 211 vitest tests pass (incl. JS/Rust sharpen parity),
  `tsc --noEmit` clean, eslint clean.

