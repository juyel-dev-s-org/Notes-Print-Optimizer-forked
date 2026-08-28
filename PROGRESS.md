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
