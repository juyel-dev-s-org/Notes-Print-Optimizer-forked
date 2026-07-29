# Benchmark Baseline

This file records the baseline performance metrics for the optimizer pipeline before any re-architecture phases are applied.

## Environment
- Node.js: 20.x
- Browser: Chrome 120+ (or jsdom equivalent for CI)
- Test Image: 800x1000px synthetic light handwritten page

## Baseline Metrics (Phase 0)

| Stage | Duration (ms) | MPx/s | Memory (MB) |
|-------|---------------|-------|-------------|
| analyze | TBD | TBD | TBD |
| process | TBD | TBD | TBD |
| **TOTAL** | **TBD** | **TBD** | **TBD** |

## Notes
- Run `npm run test:bench` to update these metrics.
- Phase 3 targets: Phase-2 wall time ≥40% faster on multi-core, main-thread long tasks >50ms near zero during processing.
- Phase 5 targets: WASM v2 must beat v1 by ≥25% with parity outputs.
