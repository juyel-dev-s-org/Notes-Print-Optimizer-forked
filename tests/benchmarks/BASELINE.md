# Benchmark Baseline — Agent Document

> **AGENT-ONLY DOCUMENT.** Raw performance data for AI agents. All numbers are measurements, not claims. When optimizing, read this file FIRST, then re-measure **paired A/B on same machine state** — never trust intuition. For decision history see `ENGINEERING_ASSESSMENT.md`.

## How to use

| You need | Go to |
|---|---|
| Per-phase CPU cost (no render) | **Phase 0 — Performance Baseline** |
| Engine V1 vs V2 (real pdf.js render) | **Engine comparison** |
| JS kernel 1 MPx numbers | **Kernel Benchmarks (JS fallback)** |
| WASM targets vs JS | **WASM Performance Targets** |
| Sharpen evidence (rolling 3-row vs full-copy) | **Sharpen Optimization (2026-08)** |
| How to re-measure | **Re-measure commands** |

## Re-measure commands

| Benchmark | Command | Notes |
|---|---|---|
| CPU per-page pipeline (CI guard) | `npm run test:bench` → `phase0Baseline.bench.ts` | Vitest jsdom, 1600×900 synthetic dark slides |
| Full kernel suite | `npm run test:bench` (all `*.bench.ts`) | includes `pipeline`, `kernelProfile`, `functionProfile` |
| Browser full-pipeline (real pdf.js) | `?bench=1` on `http://localhost:3000` (+ `&pages=N`, `&engine=v1\|v2`) or `window.__npoBenchmark()` | measures **with render** |
| Sharpen shootout | `tests/benchmarks/sharpenShootout.bench.ts` | 1600×900 variants A–F |
| Real-PDF baselines | `tests/benchmarks/realPdfBaseline.bench.ts` + `.spec.ts` | fixtures `text/image/scanned/mixed` |
| Paired A/B gates | `tests/benchmarks/v1VsV2.spec.ts`, `abWasm.spec.ts`, `browserPhases.spec.ts` | AC power, `--workers=1` |

## Measurement discipline (binding — violations are blocking)

1. **AC power / best-performance mode only** — power moves results ~3× (4.6 pps charging vs 1.5 pps battery saver, same code).
2. **Serial: `--workers=1`** — parallel suite contaminates timings (scanned fixture degraded 11× under sibling-worker load).
3. **Same load window, paired A/B, alternating order** — machine variance ~2.5× across sessions; cross-session numbers are not comparable.
4. **Merge only on meaningful end-to-end win with no regression in paired A/B** (see `ENGINEERING_ASSESSMENT.md §8`).
5. All numbers below were produced by **committed binaries** (`public/wasm/npo_wasm_bg.wasm`, **30,606 B** at 2026-08-28) + JS fallback `lib/kernels/*`. Rebuild only on `wasm/src` change.

---

## Environment (reference)

- Node 20.x / 22.x, Vitest 1.6 + jsdom + `@napi-rs/canvas`
- Pipeline bench: 1600×900 (1.44 MPx) synthetic **PW_DARK_SLIDE** preset, 10 pages
- Kernel bench: 1000×1000 random RGBA (1 MPx)
- Real-PDF fixtures: `tests/fixtures/pdf/` — `text.pdf (6p mixed)`, `image.pdf (4p)`, `scanned.pdf (4p LIGHT_SLIDE)`, `mixed.pdf (4p)` — deterministic LCG (`fixtures:gen`)

## Phase 0 — Performance Baseline (2026-08, updated 2026-08-28 post-12-tools)

Goal: where does per-page CPU go **before** render?

### CPU-bound per-page pipeline (Vitest, main-thread JS, no render)

Source: `tests/benchmarks/phase0Baseline.bench.ts` (CI). Config: 1600×900 synthetic dark slides, 10 pages, `PW_DARK_SLIDE`.

| Phase | ms / page | Share | At HEAD 2026-08-28 (emerald, 12-tool) |
|---|---|---|---|
| analyze | 95.6 | ~15% | 95.57 ms |
| **processPage (pixel kernel)** | **520.3** | **~79%** | 520.25 ms |
| inkCoverage (before+after) | 40.0 | ~6% | 39.95 ms |
| **CPU total** | **655.8** | 100% | **measured 655.76 ms/page** |

- Throughput (CPU only, no render): **~1.52 pages/sec** (main-thread JS)
- Runner: Windows 11 / Node 20 / Vitest jsdom — see raw log in that bench.

> **History:** Phase 0 early Aug 2026 reported `231.3 ms/page` (process 194 ms, 84%). Post-merge growth to `655 ms` reflects larger default work (full WASM kernel path, denser fixture, worker hardening) — compare **within same commit only**.

### Post-optimization timeline (combined CC + white fast-path + Uint32 composite)

| Metric | Before (Phase 0 early) | After (JS baseline Phase 4) | Improvement |
|---|---|---|---|
| process_ms_per_page | ~380 | ~194 → ~137 (fused) | **49–64% faster** |
| pages_per_sec_cpu | ~2.3 | ~4.3 → ~2.1 (current denser) | context-dependent |
| CC traversals/page | 8 (7 channels + noise) | 1 | **87% fewer** |

**Key finding (still true):** `processPage` (HSV + classify + CC + dilate + denoise + composite + unsharp) is **~79–85% of per-page CPU**. Parallelism (Worker pool) + WASM are the levers.

### Instrumentation added in Phase 0

- Both engines emit `page:phases` (render/analyze/process/thumbnail/persist) + `doc:phases` (aggregate) to `MetricsBus`.
- Browser harness: `window.__npoBenchmark()` or `?bench=1&pages=20&engine=v2`.

### Engine comparison (20 pages, AC / best-perf, after lazy-original)

V2 (sequential) gives true cost; V1 (parallel, 4 concurrent) inflated by contention. Via `?bench=1&engine=...`:

| Phase | V1 (parallel) | V2 (sequential) | Notes |
|---|---|---|---|
| render | 153.5ms | 27.4ms | V1 contention |
| analyze | 1.4ms | 1.5ms | |
| process | 147.1ms | 157.9ms | true bottleneck ~64% of seq cost |
| thumb | 292.0ms | 25.1ms | V2 lazy-original |
| persist | 248.7ms | 33.3ms | |
| **pages/sec** | **4.63** | 3.76 | V1 wins desktop, V2 wins memory-safety |

- Same code on battery saver: **1.5 pps vs 4.6 pps charging** — always AC.
- Next target: `process` → WASM (done in Phase 4 — see below).

---

## Pipeline Benchmarks (all phases)

| Phase | Analyze (ms) | Process (ms) | TOTAL (ms) | Analyze (MPx/s) | Process (MPx/s) | Notes |
|---|---|---|---|---|---|---|
| Phase 0–1 | ~71 | ~58 | ~129 | ~11 | ~14 | Before Phase 2 |
| Phase 2 | ~7–12 | ~8–10 | ~15–22 | ~64–107 | ~78–105 | Single-source worker |
| Phase 3 | ~10–20 | ~10–16 | ~20–37 | ~15–70 | ~15–80 | Pipeline + plugins |
| Phase 4 (JS fallback) | ~11 | ~4.5 | ~15.5 | ~73 | ~179 | Rust WASM kernels (JS fallback) |
| Current (2026-08-28, full JS) | ~95 | ~520 | ~655 | ~15 | ~2.8 | 1600×900 dark slide — see above |

## Kernel Benchmarks (JS fallback, 1 MPx random)

| Kernel | Time (ms) | Throughput (MPx/s) |
|---|---|---|
| rgbToHsvBatch | 35.96 | 27.81 |
| classifyColors | 14.86 | 67.31 |
| dilateMask ks=3 | 9.26 | 108.02 |
| unsharpMask | 42.14 | 23.73 |
| removeNoise (40 Kpx) | 3.04 | 13.16 |
| inkCoverage | 1.47 | 678.06 |
| connectedComponents (40 Kpx) | 0.37 | 107.01 |

Per-function at 1600×900 dark slide: `rgbToHsvBatch 556ms`, `unsharpMask 422ms`, `removeNoise 107ms`, `connectedComponents 95ms`, `dilate 73ms`, `classify 62ms` — `processPage` ~600ms total (see `functionProfile.bench.ts`).

## WASM Performance Targets (browser, when loaded)

| Function | JS (MPx/s) | WASM Target (MPx/s) | Speedup | Notes |
|---|---|---|---|---|
| rgb_to_hsv_batch | ~28 | 60–80 | 2–3× | |
| classify_colors | ~67 | 50–70 | ~1× | already fast |
| connected_components | ~107 | 15–20 | 0.15×* | JS random data favours JS |
| strip_decorative_fills | ~13 | 12–18 | ~1× | |
| remove_noise | ~13 | 18–25 | 1.5–2× | |
| dilate_mask | ~108 | 40–60 | 0.5×* | overhead on small inputs |
| unsharp_mask | ~24 | 35–50 | 1.5–2× | |
| ink_coverage | ~678 | 150–200 | 0.3×* | |

\* Random data has no connected components — WASM copy overhead dominates. Real slides differ.

## Key Improvements — Phase 4 (Rust WASM Migration)

1. **Rust WASM 30.6 KB** (`public/wasm/npo_wasm_bg.wasm`): 8 kernels (hsv, classify, CC, decorative, noise, dilation, sharpen, ink) via `wasm-bindgen`.
2. **JS fallback** `lib/wasm/jsFallback.ts` — pure JS parity, auto-used when WASM fails.
3. **Lazy load:** `ensureWasmKernels()` on first worker message, not page load.
4. **Worker integration:** `pixel.worker.ts:ensureWasmKernels()` + `setWasmKernelsHooks()`.
5. **Parity:** 11/11 parity tests green → `41/434` total green at HEAD.

Targets:

- Phase 4: WASM ≈ JS (parity) ✅
- Phase 5: 300-page ≤ 512 MB peak heap
- Phase 8: >85% coverage

---

## Sharpen Optimization (2026-08) — evidence, not claim

Goal: cut #1 cost inside `processPage`. Intra-kernel profiling (1600×900, toggle-difference) showed **sharpen = 73% of kernel** (42.4 ms of 58 ms); mask+CC 23.1%, dilate 3.8%, composite ~0%.

### JS `lib/kernels/sharpen.ts` — variant shootout (1600×900, `sharpenShootout.bench.ts`)

| Variant | ms/call | Notes |
|---|---|---|
| B full-copy | 28.7–29.1 | baseline correct |
| A rolling-2row (old) | 20.2–27.3 | **BUG: off-by-one (y+2 as current)** |
| **C rolling-3row** | **19.2–21.7** | **correct + fastest — shipped** |
| D full-copy+locals | 27.8–30.0 | |
| E float32 rolling | 50.4 | |
| F rolling-3row+hoisted | 60.2–62.8 | |

**Fix:** `applyUnsharpMask` rewritten as **rolling 3-row (C)** — removes full-image copy + fixes off-by-one, matches mathematical reference (parity `tests/unit/pixelKernels.test.ts`).

### Rust `wasm/src/sharpen.rs` — `cargo test --release speed_variants` (x86 1600×900)

| Variant | ms/call | vs full-copy |
|---|---|---|
| **full-copy (`to_vec`)** | **55.9** | **1.00× — shipped** |
| rolling-3row | 66.4 | 0.84× |
| unrolled (3-ch) | 124.4 | 0.45× |
| separable two-pass | 114.3 | 0.49× |

In Rust `memcpy` is cheap — rolling rotation costs more (opposite of JS). Rust `unsharp_mask` **stays full-copy** + guard `height/width < 3`.

### Browser end-to-end (`browserPhases.spec.ts`, wasm=true, hw=8, 10 pages)

Fresh before vs after WASM rebuild (same `PW_DARK_SLIDE`, real pdf.js):

| Phase | V2 before | V2 after | V1 before | V1 after* |
|---|---|---|---|---|
| render | 42.5ms | ~35–43ms | 61.6ms | 123–139ms |
| **process** | **602.1ms** | **338–348ms** | 720.9ms | 777–812ms |
| thumb | 8.1ms | — | 31.7ms | ~55ms |
| persist | 28.8ms | — | 47.8ms | ~177ms |
| pages/sec | 1.42 | **2.16–2.28** | 3.97 | ~2.9 |

\* V1 noisy (parallel contention); V2 is stable signal.

- **V2 process −44%** (602 → ~340 ms) after rebuilding WASM (26 KB → 30.6 KB). `Cargo.toml` already had `lto/opt-level="z"/codegen-units=1` but committed binary predated optimized build.
- **Manual WASM build** (wasm-pack may be blocked): `cargo build --target wasm32-unknown-unknown --release` → `wasm-bindgen --target web --out-dir pkg target/wasm32-unknown-unknown/release/npo_wasm.wasm` → copy `pkg/npo_wasm{,_bg.wasm,.js}` → `public/wasm/`.
- `wasm/src/process.rs` fixes for rustc 1.97: inner `//!` after items → `//`, `CC_BUFFERS.with` borrow-checker `dest ructure guard`.
- Verified: **434 vitest tests pass** (incl. JS/Rust sharpen parity), `tsc --noEmit` clean, eslint clean.

---

## Current suite health (for agents)

- **At 2026-08-28 HEAD:** `npx vitest run` → **41 files, 434 tests, 0 fail** (was 241 at 1.1.0, 211 in early baseline). Never gate on a number — gate on **all green**.
- **Smoke:** `npx playwright test --project=chromium` → 22 tests (basic + routing).
- **Build:** `npm run build` → `Next 15.5.23, 20/20 static, 2/2 export, First Load JS ~340 kB (shared) / ~355 kB (/)`.

## How to add a new benchmark

1. Create `tests/benchmarks/<name>.bench.ts` (Vitest bench `describe` + `bench`).
2. Keep data deterministic (LCG fixtures, not `Math.random`).
3. Document discipline (AC power, `--workers=1`) in this file.
4. Run `npm run test:bench` locally, paste paired A/B table into PR `Evidence`.
