# Benchmark Baseline

This file records the performance metrics for the optimizer pipeline across re-architecture phases.

## Environment
- Node.js: 20.x / 22.x
- Test Image: 800x1000px synthetic light handwritten page (for pipeline bench)
- Kernel bench: 1000x1000px random RGBA data (1 MPx)
- Runner: Vitest (jsdom + @napi-rs/canvas)

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
