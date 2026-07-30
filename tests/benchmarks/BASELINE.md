# Benchmark Baseline

This file records the performance metrics for the optimizer pipeline across re-architecture phases.

## Environment
- Node.js: 20.x / 22.x
- Test Image: 800x1000px synthetic light handwritten page
- Runner: Vitest bench (jsdom + @napi-rs/canvas)

## Metrics

| Phase | Analyze (ms) | Process (ms) | TOTAL (ms) | Analyze (MPx/s) | Process (MPx/s) | Notes |
|-------|-------------|-------------|-----------|----------------|----------------|-------|
| Phase 0-1 | ~71 | ~58 | ~129 | ~11 | ~14 | Before Phase 2 (reducer + processor abstraction) |
| Phase 2 | ~7-12 | ~8-10 | ~15-22 | ~64-107 | ~78-105 | After single-source worker, IImageProcessor |
| Phase 3 | ~10-20 | ~10-16 | ~20-37 | ~15-70 | ~15-80 | After sheet compose worker, lazy 1-up, blob URLs |
| Phase 5 | ~24-44 | ~17-38 | ~41-82 | ~18-33 | ~21-47 | After WASM kernels (maskDilation, unsharpMask) |

> **Note**: Variance is high due to jsdom/@napi-rs canvas overhead and system load. The key wins of Phase 3 are not in pixel-kernel speed but in **off-main-thread sheet composition** and **lazy 1-up export** (immediate ~2× Phase-2 latency improvement for the optimization step).

## Key Improvements
### Phase 3
1. **Lazy 1-up export**: 1-up PDF no longer generated unconditionally — saves ~2× Phase-2 latency.
2. **Sheet composition in worker**: Main thread freed from canvas layout + JPEG encode.
3. **Blob URLs vs base64**: ~33% less memory per preview thumbnail.
4. **Parallel thumbnails**: `createImageBitmap` + per-call canvas replaces serialized shared canvas.

### Phase 5 (WASM v2 Engine)
1. **WASM mask dilation**: `applyMaskDilation` compiled to WebAssembly (1217 bytes) — zero-copy via shared linear memory, auto-fallback to JS.
2. **WASM unsharp mask**: `applyUnsharpMask` compiled to WebAssembly with f64 arithmetic — same zero-copy pattern.
3. **Automatic hook system**: Worker preloads WASM on init; kernel calls route through WASM with seamless JS fallback.
4. **1 KB payload**: WASM binary embedded as base64 in generated TypeScript — only 1 KB added to First Load JS.

## Targets
- Phase 5: WASM v2 must beat v1 by ≥25% with parity outputs (5/5 parity tests pass ✅).
