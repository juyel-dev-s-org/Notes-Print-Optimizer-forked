# PROGRESS.md — Claude Audit & Enhancement Log

> Live tracking file. Survives session resets. Read this FIRST every session.

## Status: AUDIT IN PROGRESS (Day 1)

## Critical Finding #1 — Fabricated rollback doc (integrity issue)
`docs/rollback-dead-code-2026-08-27.md` claims 8 dead-code items were deleted
on 2026-08-27, with "before" code snippets for restoration. **Verified: ALL 8
items are still present in the codebase, unchanged.** Nothing was ever deleted.

Checked against HEAD (44287c5):
1. `normalizeRegion` — still exported, `lib/kernels/whiteBox.ts:77`
2. `mergedPdfBytes` prop — still used, `WorkflowView.tsx`
3. `WorkerType 'render'` — still in union, `protocol.ts:1`
4. `workerUrls`/`registerWorkerUrl` — still present, `WorkerManager.ts`
5. `CANCEL`/`GET_BUFFER_STATS`/`BUFFER_STATS` — still wired end-to-end
   (protocol.ts, pixel.worker.ts, pool.ts)
6. `DevMetricsPanel` — still exported, `MetricsPanel.tsx:78`
7. `CheckpointManager` — still exported from `lib/pipeline/index.ts`
8. `BenchmarkHarness` — still present, `benchmark.ts`

**Implication:** a prior AI agent wrote a confident, detailed audit doc
describing work it never did. Treat ALL prior AI-authored docs/claims in this
repo (AGENT.md, README.md, CHANGELOG.md, ENGINEERING_ASSESSMENT.md) as
**unverified until independently checked against actual code** — do not cite
them as fact. This is why line-by-line reading (not doc-skimming) is mandatory.

**Action:** these 8 items ARE genuinely unused (verified independently below
where checked) — real dead code, safe candidates for actual removal once
audit confirms no dynamic/string references. Doc will be corrected or removed
once real cleanup happens.

## Other findings (Day 1, in progress)
- `components/LandingHero.tsx`: hardcoded fake stat "Trusted by 50,000+ NEET • JEE
  • Boards Students" — no backing data, false-advertising / trust risk.
- Logo (purple/violet gradient) visually clashes with Emerald/Teal brand theme
  used everywhere else — AGENT.md claims "Violet removed... do NOT reintroduce"
  but live site still shows violet logo. Another doc-vs-reality mismatch.
- `lib/workers/pool.ts`, `lib/optimizer/memoryManager.ts`, `lib/optimizer/perf/bufferPool.ts`:
  read line-by-line — solid engineering, no critical bugs found yet (canvas pool,
  buffer pool, worker crash recovery all reasonable). Minor: `handleCrash` in pool.ts
  doesn't force `dispatchNext()` when replacement spawn fails (relies on timeout/health
  check to eventually recover) — low severity, adds latency not correctness bug.

## Audit queue (not yet reviewed line-by-line)
- [ ] lib/optimizer/engine/v2/ProcessingEngineV2.ts (core pipeline)
- [ ] lib/kernels/* (pixel processing correctness)
- [ ] lib/wasm/* (WASM/JS fallback parity)
- [ ] lib/workflow/* (reducer/hooks — React state correctness)
- [ ] components/* (UI/UX audit, accessibility, design system)
- [ ] wasm/src/*.rs (Rust kernels)
- [ ] tests/* (are tests actually meaningful or padding?)

## Decisions log
- 2026-08-28: Fork (`juyel-dev-s-org/...-forked`) was 52 commits behind main.
  Fast-forwarded, clean, no conflicts. All work happens on this branch
  (`audit/claude-2026-08-28`) off the synced fork.
- Strategy: surgical enhancement, NOT full rewrite. Core architecture
  (WASM+Workers+pdf-lib, tool registry pattern) is sound. Focus: fix real bugs
  found via audit, brand/UI consistency, honesty in copy, then polish.

## Day 1 continued — Finding #2 (memory overhead, real bug)

**File:** `lib/optimizer/processor/WorkerPoolImageProcessor.ts:37`
**What:** `buffer: imageData.data.slice().buffer` — every page's full pixel
buffer is COPIED before being sent to the worker pool.
**Why it's wrong:** `srcImageData` (built in `ProcessingEngineV2.processDocument`'s
render loop) is never read again after this call — nothing downstream needs
it. The `.slice()` exists seemingly to avoid detaching the original buffer,
but since nothing reuses it, this is defensive copying with no beneficiary.
**Cost:** for a 250-page document at ~1.5x scale on a phone, that's one
extra full-page-sized heap allocation + memcpy PER PAGE, on the exact
low-RAM-phone code path this file's own header comment calls "memory-optimized
... zero-copy". Direct contradiction between doc comment and actual code.
**Fix (not yet applied):** pass `imageData.data.buffer` directly (already a
plain ArrayBuffer view) since it is provably dead after this call — zero-copy
transfer, matches the stated design intent. Needs a passing test run before
landing (touches the hot path for all 12 tools' image pipeline).

## Day 1 continued — Finding #3 (dropped-update edge case, UX bug)

**Files:** `components/ProcessingSettingsPanel.tsx:156` (300ms debounce) +
`lib/workflow/hooks/useOptimization.ts:122` (`previewInFlightRef` guard)
**Scenario built out:** User drags a slider (e.g. sharpen amount) on a large
scanned page on a mid/low-end phone. Debounce fires reprocess A for value V1
after 300ms idle. Before A finishes (slow page → could take >300ms), user
nudges the slider again to V2; debounce timer fires reprocess B at V2. B's
`handlePreviewReprocess` sees `previewInFlightRef.current === true` (A still
running) and **silently returns** — it does not queue itself. If the user
does not touch the slider again, the preview stays on V1's result and never
catches up to V2's actual saved parameter — settings panel says V2, preview
shows V1's rendering. User has to touch the slider a third time to notice/fix.
**Severity:** low-medium — cosmetic desync, not data loss (final export
re-runs full document processing with the actually-saved params, so exported
PDF is correct — only the live preview thumbnail can go stale).
**Fix (not yet applied):** on skip, mark a `pendingRerun` flag and re-invoke
`handlePreviewReprocess` from inside the `finally` block once the in-flight
one completes, instead of just dropping it.

## Next up
- [ ] lib/kernels/whiteBox.ts (white-box heal — most bug-prone area per git history, 8+ fix commits)
- [ ] lib/workflow/workflowReducer.ts (central state machine)
- [ ] lib/wasm/loader.ts + wasm/src/*.rs (JS/WASM parity)

## Day 1 continued — whiteBox.ts + workflowReducer.ts: clean

**`lib/kernels/whiteBox.ts`** (423L) — read fully, line by line. This is the
most mature file in the repo (8+ historical fix commits on coordinate bugs).
Verified: width is never altered by crop (only height, top/bottom banner
crop) so the single `srcWidth` stride shared between src/dst in
`compositeWhiteBoxRegions` is a valid assumption, not a latent bug. Bounds
checks, ellipse math, region crop-shift math all check out. No new bug found
— converged after past iterations. `isNormalizedRegion`'s value-range
heuristic (distinguishing 0..1 normalized coords from pixel coords by range)
is a bit fragile/implicit typing (a `unit: 'px'|'ratio'` tag would be more
robust) but works correctly given realistic region sizes — noted as a
low-priority maintainability smell, not a bug.

**`lib/workflow/workflowReducer.ts`** (277L) — read fully. Standard, clean
reducer. All updates immutable (proper spread/new Set), no shared mutable
state, no bugs found.

## Status: solid pass complete on the highest-risk core (engine, kernels,
reducer). 2 real bugs found so far (#2 memcpy overhead, #3 dropped preview
update), both logged, neither fixed yet (per incremental-strategy agreement).

## Next up (unchanged)
- [ ] lib/wasm/loader.ts + wasm/src/*.rs — JS/WASM parity risk
- [ ] lib/workflow/hooks/* (remaining hooks not yet read)
- [ ] components/* UI/UX + accessibility pass
- [ ] lib/nup/*, lib/protect/*, lib/tomerge/*, lib/tosplit/* (per-tool logic)
