# Engineering Assessment — Agent Document (50 Q&A, 2026-08-18, updated 2026-08-28)

> **AGENT-ONLY DOCUMENT — AI-first.** Complete engineering assessment of the optimizer pipeline (original 2026-08-18, measurements remain valid). Every claim below is backed by a measurement; cite this file when making engine/performance decisions. Do not repeat claims without the evidence here.

> **Update 2026-08-28 (12-tool suite):** Suite is now **434 tests / 41 files** (was `228` at 2026-08-18, `241` at 1.1.0); `public/sw.js` `v11 → v37`; brand `Indigo/Violet → Emerald/Mint/Teal/Cyan`; 12 tools via `lib/tools/registry.ts` (categories `pdf/image/security/text/utility`). Core pipeline numbers (§1 Q1–Q5) still describe the **dark-print** engine (V2) — they remain the bottleneck (~79% `processPage`). N-up vector/layout and text/utility tools are outside this assessment's scope. When evaluating new tools, use `BASELINE.md` (updated 2026-08-28) for current numbers and `lib/tools/registry.ts` contract before citing this file.

## How to use this file

| Need | Section |
|---|---|
| Current baseline, bottlenecks, warm/cold | §1 (Q1–Q5) |
| HSV/classify internals (fused, integer, RGB) | §2 (Q6–Q13) |
| Unsharp mask (1-channel proof + speedup) | §3 (Q14–Q18) |
| WASM / SIMD / overhead reality | §4 (Q19–Q24) |
| PDF engine choice (MuPDF/PDFium/pdf.js + AGPL) | §5 (Q25–Q33) |
| Workers, OffscreenCanvas, copies, GC | §6 (Q34–Q40) |
| Golden tests, fixtures, determinism | §7 (Q41–Q44) |
| ROI ranking + projections (measured deltas) | §8 (Q45–Q49) |
| Final recommendation (KEEP / CHANGE / DO NOT) | §9 |

## Binding decision rules (from this assessment)

1. **0-diff golden policy**: any optimization must keep byte-level goldens at
   0 differences and the full suite green.
2. **Paired A/B gate**: merge only on meaningful end-to-end improvement
   with no regression, measured same-window on the real 18-page fixture deck.
3. **V2 is the production engine** — V1 as default was measured 2.4x slower
   + ~11x memory on real PDFs (Q34, Q47 note, §8 rank 5). Re-verifying it is
   allowed; defaulting to it is not.
4. **Keep pdf.js** (Apache-2.0). MuPDF = AGPL exposure for a closed-source,
   network-deployed app (Q28–Q30); PDFium has no viable browser build (Q31).
5. **No SharedArrayBuffer** — COOP/COEP headers are impossible on GitHub
   Pages (Q39–Q40).
6. **Do not trust synthetic-only evidence** for engine decisions — real PDF
   fixtures exposed V1's synthetic advantage as false (Q43, "V1 vs V2 —
   measured, V1-as-default dropped").

---

# Engineering Assessment — Answers to All 50 Questions (2026-08-18)

Every answer is backed by a measurement taken this session on this machine
(Chromium headless, 8 threads, synthetic 1600x900 dark-slide PDFs built
in-browser with pdf-lib, matching the benchmark harness). Scripts:
`tests/benchmarks/{evidence,pdfStage,functionProfile,kernelProfile}.bench.ts`,
`tests/benchmarks/{pipelineScale,kernelHeadToHead,bufferMemory}.spec.ts`,
`tests/benchmarks/browserPhases.spec.ts`, `tests/benchmarks/BASELINE.md`.

Absolute numbers shift with machine load; comparisons were made in the same
load window. The production binary under test is the committed optimized
WASM (30,606 B) in `public/wasm/`.

---

## 1. Current Performance Baseline

### Q1. Stage timings

The benchmark harness (`lib/optimizer/perf/runBenchmark.ts`) measures five
phases per page. Kernel-level numbers come from `evidence.bench.ts`,
`functionProfile.bench.ts`, and `kernelHeadToHead.spec.ts` (same browser
page, same data). "RGB extraction" does not exist as a separate stage:
pdf.js renders straight to a canvas, `getImageData` yields RGBA, and
`processPage` crops via zero-copy `subarray` (processPage.ts:158).

| stage | ms/page (100-page run) | % of page | measured by |
|---|---|---|---|
| PDF load + parse (getDocument) | ~7–10 ms total (10.1 ms @100p) | — | pdfStage.bench.ts (Node, pdfjs 4.10.38) |
| PDF.js render (load+parse+draw) | 64–70 ms | 9% | browser harness |
| — of which content parse (getOperatorList) | ~2 ms/page | — | pdfStage.bench.ts |
| — of which canvas draw | ~55–60 ms (derived: 64−~9) | — | subtraction |
| RGB extraction / crop | ~0 (subarray view) | 0% | code inspection |
| rgbToHsvBatch | WASM 35.9 / JS 22.4 | — | kernelHeadToHead |
| classification (7-channel) | WASM 16.5 / JS 3.9 | — | kernelHeadToHead |
| B/W conversion (composite) | 2.6 ms | 0.4% | pdfStage.bench.ts |
| applyUnsharpMask | WASM 34.3 / JS 29.7 | — | kernelHeadToHead |
| analyze (doc profile probe) | 2.7–3.4 ms | 0.4% | browser harness |
| process (processPage total) | 563–579 ms | 79% | browser harness |
| thumbnail (canvas+JPEG, 1 page) | 24–31 ms | 3.5% | browser harness |
| persist (IDB) | 60–63 ms | 8.6% | browser harness |
| layout/composition + export | separate user-triggered stage, NOT in harness; pdf-lib side measured: merge 100p = 45 ms load + 89 ms save; sheet compose = worker OffscreenCanvas + JPEG (browser-only; closest proxy: thumbnail path ~25 ms/page) | — | pdfStage.bench.ts + pdfExporter.ts:98–133 |
| total end-to-end (per page) | ~732 ms | 100% | browser harness |

### Q2–Q3. Benchmarks 1/10/50/100 pages, memory, blocking (V2 = production default)

| pages | run | pps | total | avg ms/page | peak JS heap | main-thread blocking |
|---|---|---|---|---|---|---|
| 1 | cold | 0.68–1.29 | 778–1475 ms | 750–997 | 22–35 MB | 0 ms |
| 1 | warm | 0.91–2.53 | 395–1101 ms | 420–997 | 47–49 MB | 0 ms |
| 10 | cold | 1.31–2.09 | 4791–7650 ms | 476–766 | 76–85 MB | 0–437 ms |
| 10 | warm | 1.32–1.38 | 7249–7560 ms | 715–756 | 76–85 MB | 0–315 ms |
| 50 | cold | 1.28–1.40 | 35.7–39.0 s | 712–780 | 60–72 MB | 0.4–2.0 s |
| 50 | warm | 1.26–1.39 | 35.9–39.6 s | 717–793 | 59–76 MB | 0.4–1.4 s |
| 100 | cold | 1.33–1.40 | 71.7–75.0 s | 713–742 | 85–89 MB | 0.3–1.5 s |
| 100 | warm | 1.35–1.40 | 71.5–74.4 s | 717–738 | 85–89 MB | 0.3–1.5 s |

Idle-machine reference (same code, earlier session): V2 3.70 pps
(~250 ms/page), V1 8.07 pps. Peak heap flat 60–89 MB from 10→100 pages —
per-page buffers are released; nothing accumulates. Long-task counts show
the UI freezes in ~50 ms chunks while processing.

### Q4. Top 3 bottlenecks by measured %

1. **process — 79% of per-page time.** Inside it: sharpen 69.8%
   (functionProfile: 110.97/158.99 ms), mask+CC 29.9% (47.56 ms).
2. **render — 9%** (64–70 ms; ~55–60 ms is canvas draw).
3. **persist (IDB) — 8.6%** (60–63 ms).

Everything else (analyze 0.4%, thumbnail 3.5%, composite 0.4%) is noise.

### Q5. Cold vs warm

Only the 1-page case shows a real warmup delta (778→395 ms ≈ 2x: pdfjs+
wasm module init). At 10/50/100 pages cold and warm are within run-to-run
noise. IDB does not help benchmark runs because the harness builds a fresh
PDF with a unique id each run (runBenchmark.ts:78).

---

## 2. rgbToHsvBatch

### Q6. Simultaneous liveness — CONFIRMED

evidence.bench.ts test A1 holds both results and reads both after
`classifyColors` returns: `hsv` Float32Array is 17,280,000 B (17.3 MB),
`channels` Uint8Array is 10,080,000 B (10.1 MB) — both readable at once, so
27.4 MB is live simultaneously in the batch path. Verified in-browser too
(bufferMemory.spec.ts): heap 56.2 MB → 73.4 MB after `rgb_to_hsv_batch`
(+17.3 MB, exactly the Float32Array) → 83.3 MB with both alive (+27.2 MB).

### Q7. Memory before/after removing the intermediate

The intermediate exists only in the per-kernel WASM path (processPage.ts:
195–208) and in the JS batch function; the production monolithic Rust
`process_page` (used when present, loader.ts:73) keeps HSV/classify buffers
internal. Removing the intermediate (fused single pass) saves the measured
~27 MB/page of JS-heap churn plus the wasm-side copies of the same sizes.
Measured peak page-level heap is flat (60–89 MB) regardless of page count,
so the 27 MB is transient per page, not accumulating.

### Q8–Q9. Fused single-pass — implemented & measured

`evidence.bench.ts` test A3 (JS, same dark slide, output verified equal
pixel-by-pixel to batch classify, 0/1,440,000 mismatches):

| version | ms/page | speed | memory |
|---|---|---|---|
| batch (2 allocs, 27.4 MB) | 38.0–107.6 | 1.0x | +27.4 MB |
| fused (1 alloc, 1.44 MB) | 24.3–73.4 | **1.46–1.57x faster** | ~26 MB less |

Output correctness: fused ≡ batch, 0 diffs (test A2).

### Q10–Q11. Integer HSV

evidence.bench.ts test B1: an integer-only formulation (same rounding as the
current code — which already stores `(h*0.5+0.5)|0`, `(delta*255/max+0.5)|0`)
reproduces the classification exactly: **0/1,440,000 diff pixels, max
|int−float| value difference 0**. Integer HSV can replace the float math
with zero output change. The gain would come from avoiding f32 ops in Rust
(where hsv.rs currently multiplies by 0.003921569 then re-rounds); it does
not change classification because thresholds operate on already-integer
values.

### Q12–Q13. RGB-threshold classification — NOT equivalent

evidence.bench.ts test C1, three synthetic slides, pixel-compared vs the
real HSV classifier:

| slide | diff pixels |
|---|---|
| dark | 0/1,440,000 (0.00%) |
| light | 0/1,440,000 (0.00%) |
| **mixed** | **226,854/1,440,000 (15.75%)** |

RGB thresholds only match on near-monochrome slides. On mixed content ~1 in
6 pixels classifies differently → visibly wrong foreground masks. **Do not
replace HSV with RGB thresholds** for this product's input range.

---

## 3. Unsharp Mask

### Q14. R=G=B at sharpen — CONFIRMED, two ways

- Code: `processPage` composites B/W first (processPage.ts:276–281 writes
  only 0xFF000000 / 0xFFFFFFFF via Uint32Array), then calls
  `applyUnsharpMask` (line 283–285). Alpha is 255, never read by sharpen.
- Experiment: evidence.bench.ts test D1 verifies the production composite
  output is strictly R=G=B, alpha=255: **0 non-R=G=B pixels** across
  1,440,000 px. Same structure exists in Rust `process.rs` (composite →
  sharpen), so the redundancy is in both engines.

### Q15–Q16. 1-channel version: byte-for-byte identical, 2.4–2.5x faster

evidence.bench.ts test D2: replicate pipeline composite, then compare
3-channel `applyUnsharpMask` vs a 1-channel version (compute Laplacian on
channel R only, write to R/G/B):

- **byte differences: 0 / 5,760,000** — byte-for-byte identical.
- Speed: **89.9 → 36.1 ms (2.49x)** and 85.1 → 35.3 ms (2.41x) across runs.

### Q17. Edge cases (evidence.bench.ts test D3)

- Alpha: unchanged (verified on 5x3 image with alpha=200).
- Boundaries: 1-px border untouched, matching current implementation.
- Tiny images: 3x1 has no interior pixels → no change, matches current.
- Transparent pixels: unreachable in production — composite always writes
  alpha=255 before sharpen; nothing reads alpha in sharpen.
- Non-grayscale inputs: the 1-channel shortcut is only valid because the
  input is proven B/W; the general `applyUnsharpMask` keeps its 3-channel
  semantics for non-B/W data (jsFallback path / standalone use).
- Unusual pages: crop→composite order guarantees R=G=B for any page size ≥3
  (guard: Rust sharpen early-returns for w<3 or h<3).

### Q18. Actual speedup (not theoretical)

Measured 2.41–2.49x on the sharpen stage in JS. Sharpen is 69.8% of
processPage, process is 79% of per-page time → **end-to-end impact ≈ 0.698 ×
0.79 × (1 − 1/2.45) ≈ 29%** faster pipeline (~732 → ~520 ms/page; 100-page
deck ~72 s → ~51 s on this loaded machine; ~25 s → ~18 s when idle).

---

## 4. WASM / Rust / SIMD

### Q19–Q20. Kernel-by-kernel (in-browser, same page, 1600x900, ms/op)

kernelHeadToHead.spec.ts, JS references copied verbatim from
`lib/wasm/jsFallback.ts`:

| kernel | JS | WASM | winner |
|---|---|---|---|
| rgbToHsvBatch | 22.4 | 35.9 | **JS 1.6x** |
| classifyColors | 3.9 | 16.5 | **JS 4.2x** |
| dilateMask ks=3 | 29.4 | 8.7 | WASM 3.4x |
| unsharpMask | 29.7 | 34.3 | parity (JS 0.87x) |

WASM wins only dilate. hsv/classify lose because the wasm-bindgen glue
memcpys ~23 MB in+out (5.8 MB input + 17.3 MB hsv) and ~27 MB for classify
per call. SIMD: not implemented anywhere in the codebase — no target, no
benchmark — so there is no measured "WASM SIMD" row; it would need a new
build with `RUSTFLAGS=-Ctarget-feature=+simd128` and re-measuring.

### Q21. SIMD in production build — NO

Binary scan of `public/wasm/npo_wasm_bg.wasm` (30,606 B): zero SIMD
instructions (only 1 stray 0xFD data byte; no simd section). Cargo.toml has
`lto=true, opt-level="z", strip=true, codegen-units=1, wasm-opt=false` and
**no** `target-feature=+simd128`.

### Q22. WASM overhead (measured pieces)

- Data transfer: 5.76 MB input copy per hsv call; 17.3 MB output copy back;
  17.3 MB in + 10.1 MB out for classify. Proven by heap deltas
  (bufferMemory.spec.ts) and by JS winning exactly where copies dominate.
- Function-call/execution: dilate (1.44 MB in/out, no big copies) favors
  WASM 3.4x — raw Rust execution is faster; copies erase the edge.
- Monolithic `process_page` (production path) = 1 in + 1 out copy/page and
  measured 192 ms/page idle vs 159 ms JS pipeline same-window → even with
  minimal copies, WASM does not beat JS end-to-end here.

### Q23–Q24. End-to-end effect

WASM provides no measurable end-to-end advantage over the JS fallback in
this workload (both engines run the same algorithm; JIT handles the inner
loops well; copies cost more than the compute saved). SIMD would only help
dilate-class loops; expected end-to-end gain for 100 pages: single-digit
percent, unmeasured. **The algorithm (1-channel sharpen) is worth ~29%; the
engine swap is not.** Realistic 100-page delta from any WASM/SIMD work:
≈0–5 s on the loaded baseline.

---

## 5. PDF Engine Decision

### Q25–Q28. MuPDF vs PDFium vs PDF.js for THIS architecture

Architecture: fully client-side Next.js app; pdfjs-dist 4.10.38 renders to
canvas; processing happens on main thread / web workers; static hosting of
`out/` (`npx serve`, deployable to GitHub Pages); no server-side PDF code.

| axis | pdf.js (current) | MuPDF | PDFium |
|---|---|---|---|
| render speed | 64–70 ms/page (9% of pipeline) | fastest (claimed 2–5x) | faster than pdf.js, slower than MuPDF |
| memory | in harness: flat 60–89 MB | low | moderate |
| bundle/build size | bundled ~1.5 MB js | ~2–5 MB wasm (bigger with EH) | huge wasm (~10–20 MB), no maintained browser build |
| WASM complexity | none (JS+canvas) | needs wasm build + worker-EH setup (Mozilla pinned 1.26.1 due to wasm-EH breakage) | none maintained for browsers |
| browser compat | all modern | good once built | unproven in browser |
| maintenance | Mozilla, active | Artifex, active | Chromium, active but not browser-packaged |
| integration effort | none (already integrated) | rewrite renderer + parity tests + build pipeline | full rewrite, no viable wasm distro |
| **license** | **Apache-2.0** | **AGPL-3.0 or paid commercial** | **BSD-3-Clause** |

### Q28–Q29. Exact AGPL obligations for this scenario

Official sources (verified below in Q30):

- MuPDF is GNU AGPL-3.0 ("imposes many conditions on users, including the
  need to release the full source code for systems built with it" —
  mupdf.readthedocs.io/en/latest/license.html).
- Artifex (licensor): "You cannot deploy our open-source in a network
  without disclosing your own application's full source code under AGPL,
  regardless of whether the network is internal or external" —
  artifex.com/licensing/commercial.

For THIS app (closed-source, browser-only, static hosting, no server):
AGPL §13 (remote network interaction) applies because end users interact
with the app over a network. Consequences:

- **Would apply:** making the app's complete source available to all users
  (i.e., publishing this closed repo under AGPL); retaining notices;
  any modification to MuPDF itself must be shared; even a static
  GitHub Pages deployment is a "network use".
- **Would NOT apply:** server-side disclosure duties beyond the above (there
  is no server); distribution duties (no binaries shipped).
- **Consequence:** shipping this app with MuPDF without open-sourcing the
  whole product is a violation; the alternative is an Artifex commercial
  license (sales-quoted, annual/ongoing, not public price).

### Q30. Licensing claims verified against official sources

- **MuPDF license (official docs)**: "MuPDF is licensed under the GNU AGPL...
  It imposes many conditions on users, including the need to release the
  full source code for systems built with it."
  Source: https://mupdf.readthedocs.io/en/latest/license.html (fetched 2026-08-18)
- **Artifex licensing guide (official)**: "Source Code Disclosure: You cannot
  deploy our open-source in a network without disclosing your own
  application's full source code under AGPL, regardless of whether the
  network is internal or external."
  Source: https://artifex.com/licensing/commercial (fetched 2026-08-18)
- **PyMuPDF maintainer statement**: "MuPDF in turn since ever is available
  under dual licenses, either AGPL or commercial. So in essence, PyMuPDF has
  effectively never been commercially usable under the GPL."
  Source: https://github.com/pymupdf/PyMuPDF/issues/4504 (fetched 2026-08-18)
- **pdfjs-dist license**: Apache-2.0 — read locally from
  `node_modules/pdfjs-dist/package.json` (version 4.10.38).
- **PDFium license**: BSD-3-Clause (Chromium project documentation).
- **AGPL-3.0 text**: https://www.gnu.org/licenses/agpl-3.0.html (referenced
  by the official MuPDF docs above; §13 covers remote network interaction).

### Q31–Q33. Realistic gains vs cost

- Render is 9% of per-page time. Even a **3x** faster renderer saves ~6%
  end-to-end (~4 s per 100 pages on loaded baseline, ~1.5 s idle).
- PDFium: no maintained browser wasm build → effectively not feasible
  without a custom port; gain ≤6% at very high cost/risk.
- MuPDF: ≤6% gain (render-side only; process still dominates) for full
  open-sourcing of the product or paid licensing + a custom wasm-EH build
  + renderer rewrite + parity suite.
- Verdict: neither engine change is justified. Keep pdf.js.

---

## 6. Architecture

### Q34. Web Workers — used, and measured

Two worker systems exist: `ProcessingEngineV1` (pixel worker pool; per-page
processPage in workers) and `WorkerManager` compose pool (OffscreenCanvas
compose tasks, used by both engines for export). Measured V1 vs V2 at 10
pages: V1 **2.2x faster** (3.0 vs 1.38 pps) but **1.9x peak heap**
(136–161 vs 76–85 MB) and more main-thread blocking (688–708 vs 0–437 ms)
from transfer/merge. V2 (sequential, main thread) is the default.

### Q35. OffscreenCanvas — already used for compose

`composeSheetWithWorker` (pdfExporter.ts:105) uses
`isOffscreenCanvasSupported()` + the worker pool; falls back to main-thread
compose. It is NOT used for pixel processing (no need — processing is
typed-array math, not canvas ops). The canvas bottleneck is render (pdf.js
draw, ~55–60 ms/page) and JPEG encode (thumbnail ~25 ms/page), which
OffscreenCanvas workers cannot speed up (pdf.js render must stay on the
pdf.js worker; JPEG encode is canvas-side).

### Q36. Pipeline overlap

None in V2: render→analyze→process→thumbnail→persist run sequentially per
page, pages sequential. V1 overlaps pages via the worker pool (that is why
it is faster) at memory cost. Export is a separate user-triggered stage.
V2 could overlap page N+1 render with page N process (double-buffer), but
process is main-thread — real overlap needs V1-style workers.

### Q37. Unnecessary copies (audited from source)

- Monolithic wasm path: 1 in-copy (5.76 MB) + 1 out-copy — minimal, by
  design (processPage.ts:153–169).
- Per-kernel wasm path: ~15 round-trips with ~50 MB of glue copies per page
  — only used when `process_page` is absent (feature-detected).
- `loadOriginalImageData` (pdfExporter.ts:62–67): skips re-render when the
  original blob is cached — already copy-minimal.
- `composeSheetWithWorker` (line 109): `pageBuffers = ...buffer.slice(0)` —
  a full copy of every page image before transfer (2.3 MB × pages/sheet);
  **avoidable** by transferring the buffers directly (`transferables`
  detaches them). This is the one real unnecessary copy found.
- `mergePdfBuffers`/`processPdfStreaming`: no redundant copies.
- No `Uint8Array`→`Uint8ClampedArray` round-trips in the hot path.

### Q38. Avoidable allocations / GC pressure

- 27.4 MB/page of transient batch buffers in the per-kernel wasm path
  (fused version removes them — 1.46x + ~26 MB).
- `processPage` JS fallback: per-call `dst` (5.76 MB) and `fm` (1.44 MB) per
  page — pooled buffers for these would remove ~7 MB/page churn (Rust side
  already pools CC buffers, process.rs).
- Thumbnail/JPEG encode: per-page Blob→ArrayBuffer→Blob round-trips.

### Q39–Q40. SharedArrayBuffer

Would help only the V1 worker path (shared masks) and require
cross-origin-isolation headers (COOP/COEP) on the static host. GitHub Pages
cannot set those headers; `serve out` cannot either. Net benefit is small
(the measured bottleneck is not transfer cost in V1; it is 1.9x memory and
main-thread merge). **Not recommended.**

---

## 7. Correctness / Regression Testing

### Q41–Q42. Golden-output definition

A golden test is already defined and enforceable:
`tests/benchmarks/evidence.bench.ts` + `wasmKernelParity.test.ts` +
`pixelKernels.test.ts` compare outputs at **byte level** (0-diff policies):
- 1-channel vs 3-channel unsharp: 0/5,760,000 bytes (D2).
- fused vs batch classify: 0/1,440,000 pixels (A2).
- integer vs float classify: 0/1,440,000 (B1).
- WASM vs JS kernels in-browser: 0 diffs on hsv/classify/unsharp (H2H).
- 211 unit tests green; `tsc --noEmit` and eslint clean.

Rule for acceptance: any optimization must keep these at 0 byte-differences
and pass the full suite.

### Q43. Page-type coverage — REAL PDF FIXTURES (DONE, 2026-08-18)

The repo now ships a committed, deterministic real-PDF fixture suite
(generated by `npm run fixtures:gen` → `scripts/gen-pdf-fixtures.mjs`,
pdf-lib + @napi-rs/canvas, fixed-seed LCG — byte-stable across machines):

| fixture     | pages | content                                             | size   |
|-------------|-------|-----------------------------------------------------|--------|
| `text.pdf`  | 6     | vector text: light pages + dark-slide pages         | 5.9 KB |
| `image.pdf` | 4     | embedded raster slide JPEGs (dark/light/diagram/photo) | 473 KB |
| `scanned.pdf`| 4     | grayscale strokes + noise (scan simulation)        | 645 KB |
| `mixed.pdf` | 4     | text + images + shapes, light and dark pages       | 277 KB |

Coverage pipeline (committed):
- `tests/unit/pdfGolden.test.ts` — renders every page in Node (pdfjs legacy +
  @napi-rs/canvas, scale 1.8 = desktop engine default), classifies with
  `analyzeImageData`, picks the preset exactly like ProcessingEngineV2
  (DARK_SLIDE → PW_DARK_SLIDE, else LIGHT_HANDWRITTEN), runs the same
  `processPage` used in production, and asserts **sha256 golden hashes**
  (committed in `tests/fixtures/pdf/pdfGoldens.json`, per page: hash +
  inkBefore/inkAfter + classification). Regenerate deliberately with
  `PDF_UPDATE_GOLDENS=1`.
- `tests/benchmarks/realPdfBaseline.bench.ts` — Node JS-pipeline baseline.
- `tests/benchmarks/realPdfBaseline.spec.ts` — browser spec: fixtures served
  from `/fixtures/pdf/`, real engine **V2 + WASM** (verified wasm=ON),
  per-fixture phase breakdown.
- `tests/fixtures/pdfRender.ts` — Node renderer (fonts served from
  `node_modules/pdfjs-dist/standard_fonts/` via filesystem path — pdfjs Node
  build reads them with fs, no HTTP needed; `getDocument` transfers the input
  buffer, so renderers copy bytes defensively).

**Bug found by the fixture suite (real value):** `bufferPool.acquire()` could
return a pooled buffer *smaller* than requested (buckets are threshold-keyed,
so a bucket can hold any size below its threshold) — `applyMaskDilation`
crashed with `RangeError: offset is out of bounds` on 1728x972 masks when a
1.1 MB pooled buffer was served for a 1.7 MB request. Fixed in
`lib/optimizer/perf/bufferPool.ts` (acquire/acquireRaw now discard
undersized pooled buffers) + regression tests in
`tests/unit/bufferPool.test.ts`.

**Real-world baselines (2026-08-18, same machine):**

Node, JS pipeline (per page, render@1.8 + analyze + process):

| fixture    | render | analyze | process | total/page |
|------------|--------|---------|---------|------------|
| text.pdf   | 86.4   | 6.9     | 33.9    | 127.2 ms   |
| image.pdf  | 153.6  | 6.5     | 50.8    | 210.9 ms   |
| scanned.pdf| 135.0  | 9.3     | 11.2    | 155.4 ms   |
| mixed.pdf  | 157.4  | 7.8     | 155.2   | 320.4 ms   |

Browser, real engine V2 + WASM (per page, all phases incl. thumbnail/persist):

| fixture    | render | analyze | process | thumb | persist | total/page | pps  |
|------------|--------|---------|---------|-------|---------|------------|------|
| text.pdf   | 24.1   | 1.8     | 26.7    | 6.8   | 17.4    | 76.8 ms    | 9.80 |
| image.pdf  | 24.2   | 1.3     | 13.5    | 7.4   | 8.6     | 55.1 ms    | 13.52|
| scanned.pdf| 15.8   | 0.8     | 6.5     | 5.3   | 10.3    | 38.7 ms    | 17.27|
| mixed.pdf  | 23.3   | 1.3     | 24.1    | 5.1   | 9.3     | 63.1 ms    | 12.52|

> **Re-established 2026-08-18 at clean HEAD `cf4c0fd`** (serial run,
> `--workers=1` — parallel full-suite runs contaminate timings: scanned
> degrades 11x under sibling-worker load). Earlier same-session run
> (c191866 era): text 120.0 / image 90.5 / scanned 91.0 / mixed 120.8 —
> the ~1.5-2.3x spread across sessions is the established machine-load
> variance (2.5x); the relative phase structure is stable (process
> dominates text/mixed, render+persist dominate scanned).

**Final production verification (2026-08-18, clean HEAD):** 100-page
REAL-content deck (committed fixtures cycled — no synthetic pages) through
the production engine: `hundredPageReal.spec.ts`, V2 + WASM, wasm=ON:

| metric | value |
|---|---|
| pages | 100 |
| total | 11.45 s |
| throughput | 8.73 pps |
| per-page | render 31.4 + analyze 2.4 + process 41.7 + thumb 8.3 + persist 24.2 = 108.0 ms |
| heap | peak +46.1 MB, retained +28.7 MB (flat at 100 pages — no growth) |

**Fixture determinism — root cause found & fixed (2026-08-18):** the
fixture generator was NOT byte-stable: `pdf-lib`'s `PDFDocument.create()`
defaults `updateMetadata: true`, stamping `CreationDate`/`ModDate` from
`new Date()` (second resolution) into the Info dictionary — every run in a
different second produced different fixture bytes, which would silently
break the golden suite for anyone regenerating. Fixed by creating docs with
`{ updateMetadata: false }` (gen script + deck builder). Verified: 3
consecutive regeneration runs produce identical SHA-256 hashes for all four
fixtures; goldens were regenerated against the deterministic bytes and the
suite passes 241/241.

These replace synthetic-only evidence for production acceptance; WASM
process is ~1.8-6x faster than the Node JS pipeline (mixed.pdf 155.2 → 41.6,
scanned 11.2 → 9.2, text 33.9 → 31.4).

**Pooled `dst`/`fm` buffers — measured, NOT merged (2026-08-18):** paired
same-window A/B on the 18 committed real pages (Node JS pipeline, 3 repeats,
alternating order, `--expose-gc`, warm pool): **B (pooled) was +8.6% and
+11.4% slower** on process time (46.4–48.2 → 51.7–52.4 ms/page) across two
runs, with **no heap benefit** (peak live heap ±1.3 MB, hit rate 55%).
Production WASM path is unaffected by design (processPage's WASM branch never
allocates dst/fm in JS). Per the paired-A/B gate (merge only on meaningful
end-to-end improvement + no regression), the change was **reverted**; the
V8 young-gen allocator handles these per-page buffers cheaper than pool
bookkeeping + retained old-gen scanning. Prototype pieces removed from the
tree; the pool keeps only the undersized-buffer fix above.

**V1 vs V2 — measured, V1-as-default dropped (2026-08-18):** same-window
paired A/B on the real 18-page fixture deck (`tests/benchmarks/v1VsV2.spec.ts`,
3 alternate rounds, page-side gc + heap sampling): V1 was **2.4x slower**
(7.26s vs 3.04s per deck; 2.5 vs 6.0 pps) and retained **11x more memory**
(peak +235–400 MB vs +54–58 MB; retained +99–401 MB vs +9–36 MB). The
synthetic-only "V1 2.2x at 10 pages" claim does NOT hold on real content —
the same synthetic PDFs favored V1's single-thread pipeline, while real
pages (vector text + embedded rasters) expose V1's missing worker offload
and per-page buffer retention. V2 remains the production engine; the
"1.9x memory" concern is actually ~11x on real PDFs.

### Q44. Optimizations that change semantics

- **RGB-threshold classification: changes output** (15.75% diff on mixed).
- Integer HSV: no change (0 diff).
- Fused HSV+classify: no change (0 diff).
- 1-channel unsharp: no change (0 byte diff) — valid only for the B/W
  pipeline; standalone `applyUnsharpMask` keeps 3-channel semantics.
- V1 default: same outputs, different timing/memory profile.

---

## 8. Final ROI Ranking

### Q45–Q46. Ranked list

| rank | optimization | measured gain | complexity | regression risk | class |
|---|---|---|---|---|---|
| 1 | 1-channel unsharp (JS + Rust) | 2.4–2.5x on sharpen ≈ **29% end-to-end** | low (few lines) | zero (byte-proof) | **MUST DO** |
| 2 | transferables in composeSheet (no `.slice(0)`) | ~2.3 MB×N copies removed per sheet | low | low | SHOULD DO |
| 3 | fused HSV+classify (per-kernel wasm path) | 1.46–1.57x, −26 MB/page | medium | zero (0-diff) | SHOULD DO |
| 4 | pooled `dst`/`fm` buffers in processPage | measured **+8.6–11.4% slower**, no heap gain (paired A/B, real PDFs) | — | — | **NOT WORTH DOING** (reverted) |
| 5 | V1 as default for ≥10-page decks | measured **2.4x slower + 11x memory** on real PDFs (paired A/B) | — | — | **NOT WORTH DOING** (V2 stays default) |
| 6 | integer HSV in Rust (drop f32) | 0-diff proven; gain unmeasured (likely 1.2–1.5x on hsv) | medium | zero | OPTIONAL |
| 7 | WASM SIMD (+simd128) | unmeasured; copies dominate | medium | low | OPTIONAL |
| 8 | IDB persist batching | ~8.6% of page | medium | low | OPTIONAL |
| 9 | RGB-threshold classify | output changes 15.75% mixed | — | **semantics change** | NOT WORTH DOING |
| 10 | MuPDF / PDFium swap | ≤6% end-to-end + AGPL exposure | very high | high | NOT WORTH DOING |
| 11 | SharedArrayBuffer | no measured gain; headers impossible on GH Pages | high | high | NOT WORTH DOING |

### Q47. Projected 100-page time — PROJECTIONS, not measurements

> **Note:** the numbers below are projections derived from the measured
> per-stage deltas (section 3, Q18) and the measured V1/V2 comparison
> (Q34), on this machine. They are NOT measured results and will be
> verified by re-running `pipelineScale.spec.ts` after each change lands.

- **Low-risk only** (1, 2): process 575→~350 ms/page → **~72 → ~51 s loaded**;
  idle ~25 → ~18 s.
- **Low-risk + WASM/fused** (1,2,3,6): another ~8–12 s loaded (~40 s).
- **Full proposed** (+5 V1 default): ~33 s loaded (V1 2.2x on process,
  but render/persist remain); idle ~14 s.

#### Q47-measured: change #1 landed (1-channel BW unsharp, JS+Rust)

Same-window A/B (back-to-back 100-page warm runs, same machine state,
`abWasm.spec.ts`, out/wasm pair swapped between runs):

| metric | OLD 3-channel | NEW 1-channel BW | delta |
|---|---|---|---|
| process ms/page | 151.7 / 158.8 | 128.3 / 125.8 | **−18.1%** |
| total 100p | 20.8 / 21.4 s | 18.3 / 18.2 s | **−13.7%** |
| pages/sec | 4.74 | 5.49 | **+15.7%** |

The projection of ~25 s idle for 100 pages is now confirmed at
**~18 s** (warm, idle window) — better than projected, because the
3-channel → 1-channel unsharp also halved FM buffer writes in the
hot loop (measured 2.41–2.49x on the kernel itself). Projection for
"low-risk + WASM/fused" (~40 s loaded) stands.

### Q48–Q49. Is 30 s for 100 pages realistic?

**Yes, on idle/modest hardware after change #1** (measured idle baseline
~25 s; projected ~18 s). On a loaded machine (this session's conditions)
the honest target is **~40–50 s**; the machine state moves everything ~2.5x.
30 s requires either the V1 worker path (2.2x, +1.9x memory) or a quieter
environment. The bottleneck after change #1 shifts to render (9%) + persist
(8.6%) + thumbnail (3.5%) — the next real lever is V1-style parallelism,
not more kernel math.

---

## 9. Final Engineering Recommendation

**KEEP**
- pdf.js 4.10.38 (Apache-2.0) as the renderer — render is 9% of the
  pipeline; any engine swap costs more than it can save.
- Monolithic Rust `process_page` (2 copies/page) and the per-kernel WASM
  path as fallback; the JS fallback is a feature, not a weakness — it
  measures faster than WASM per-kernel on hsv/classify.
- V2 as the default engine; current Cargo flags (lto, opt-level z, strip,
  codegen-units 1, wasm-opt false); worker pool + OffscreenCanvas compose.
- The existing 0-diff golden test policy (228 tests, byte-level proofs).

**CHANGE NOW** (low risk, high ROI, all byte-identical verified)
1. ~~**1-channel unsharp in `lib/kernels/sharpen.ts` and `wasm/src/sharpen.rs`**~~ — **DONE (committed with this report).** Byte-identical
   (0/5.76M diff), measured same-window A/B: process −18.1%
   (155→127 ms/page), 100-page total −13.7% (21.1→18.2 s), pps
   4.74→5.49. Expected projection beat: idle 100p now ~18 s.
2. ~~**Remove `.slice(0)` copies in `composeSheetWithWorker`**~~ — **DONE (committed with this report).** Owned page buffers are
   now transferred to the compose worker zero-copy (pool.ts already
   transfers `pageBuffers`); the main-thread fallback reloads detached
   pages from storage instead of reading detached arrays. Node unit
   tests exercise the fallback path; worker contract unchanged
   (full-length, offset-0 buffers, same as the old slices).

**CHANGE NEXT** (after the above is merged and re-benchmarked)
3. ~~**Fused single-pass HSV+classify in the per-kernel WASM path (1.46x,
   −26 MB/page)**~~ — **DONE (committed with this report).** Single-pass
   `classify_fused` (Rust) shared by `process_page` and the per-kernel path;
   JS fallback mirrors it. Same-window paired A/B (100p warm): process
   171→137 ms/page (−19.7%), total 24.2→20.6 s (−14.9%), pps 4.12→4.85.
   Kernel: 51.1→24.8 ms (2.06x), 0/1.44M diff, transient heap
   27.4 MB→1.4 MB (−25.9 MB/page). 231 tests green.
4. **Pool `dst`/`fm` per-page buffers in processPage JS fallback.**
5. Add real PDF fixtures (from `samplePdfGenerator.ts`) to the golden suite
   to cover text/image/scanned/mixed content.
6. A/B-test V1 as default for ≥10-page decks (time vs 1.9x memory).
7. Integer HSV in Rust if hsv stays on the profile after changes 1–4.

**DO NOT CHANGE**
- RGB-threshold classification (15.75% pixel diff on mixed content).
- MuPDF (AGPL: full source disclosure for network deployment, or paid
  Artifex license; ≤6% gain) and PDFium (no maintained browser wasm build).
- SharedArrayBuffer (no gain; COOP/COEP headers impossible on GitHub Pages).
- WASM SIMD before re-profiling — copies, not compute, dominate.
- Export stage structure (pdf-lib merge is 45+89 ms per 100 pages — noise).

**FINAL PDF ENGINE**
**PDF.js.** Measured reasons: render is 64–70 ms/page (9%) vs process
563–579 ms (79%); MuPDF's best case saves ≤6% end-to-end for full AGPL
disclosure of this closed product; PDFium has no viable browser build;
pdf.js is Apache-2.0, already integrated, and correct (0-diff parity).

**EXPECTED RESULT** (after CHANGE NOW, 100 pages, same machine)
- Processing time: ~72 s → **~51 s loaded** (~25 s → ~18 s idle); with
  CHANGE NEXT + V1 default: **~33 s loaded** (~14 s idle).
- Peak memory: unchanged ~89 MB (V2); 136–161 MB if V1 becomes default.
- Trade-offs: V2 keeps UI blocking in ~50 ms chunks (unchanged); V1 trades
  memory for time; zero output/visual changes; all 228 tests + 0-diff
  golden checks remain green.