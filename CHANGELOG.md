# Changelog — Agent Document

> **AGENT-ONLY DOCUMENT.** Structured for AI agents: keep entries factual,
> dated, and grouped by category (Added / Fixed / Changed / Performance /
> Removed). When you land user-visible or behavior-affecting work, add an
> entry here in the same commit. Format: Keep a Changelog 1.1.0; SemVer 2.0.0.

## [Unreleased]

### Added

- **Enhance Light PDF tool** (mobile): self-contained flow
  (upload → enhance → export) for faint, light-background PDFs —
  handwritten/scan/photographed notes. Tunable Darken / Contrast / Sharpen
  sliders, Clean Background and Grayscale toggles, per-page before/after
  preview, and print-ready PDF export. Engine lives in `lib/enhance/`
  (pure deterministic kernels `enhanceKernels.ts`, reducer, processor,
  exporter) with unit tests (21 new); the dark→print flow is untouched.
- **Premium mobile landing "Aurora Dark"**: brand-gradient tools box
  (`#243BFF→#5B35FF→#A12CFF`) with two tool cards (Dark Notes → Print,
  Enhance Light PDF); upgraded hero (gradient headline, ambient glows,
  glass stat chips). Tools box is mobile-only (`md:hidden`); tablet and
  desktop layouts unchanged.

### Fixed

- **Enhance workflow race + validation**: abort now guards against stale
  `RESET` overwriting a new run (`PROCESS_CANCEL` keeps files), unmount
  cleanup added, processor checks `signal` after every async step,
  `validatePdfFiles` helper centralizes PDF checks and `MAX_FILES` is
  enforced consistently; a11y fixes — dropzone no nested button,
  sliders 24px hit area, Hero glows 3→2.
- **Enhance polish**: ToolCard gradients differentiated
  (Dark Notes indigo→cyan, Enhance violet→pink), Hero glows reduced for
  performance, tuning constants extracted (`ENHANCE_TUNING`), slider
  dirty-check (`Up to date`), hold-to-compare preview, export share +
  safe-area sticky CTA, `scale-in` animation.
- **Settings/Info modals rendered inside the drawer** instead of the
  viewport: the drawer's slide-in animation (`animate-slide-in-left`,
  fill-mode `both`) leaves a retained `transform` that turns the drawer into
  a containing block, trapping `position: fixed` children. `Modal` now
  renders through a React portal to `document.body` (verified: desktop
  viewport-centered dialog, mobile full-width bottom sheet).

## [1.1.0] - 2026-08-18

### Added

- Adaptive PWA **Install/Share card** at the top of the Settings drawer:
  native add-to-home-screen card when not installed; Web Share API card
  (copy-link fallback) once installed; benefit chips (Fast / Offline /
  Private) and an iOS "Add to Home Screen" guide
- **Settings & Information Center**: config-driven menu (Tools, Privacy,
  Community, Resources, Legal, Developer) rendered from `lib/menu` metadata
  with an accessible accordion UI; in-app documents rendered from Markdown
  in `public/content/`
- Feedback reachable from the menu via a modal reusing the existing form;
  Clear Cache privacy action; Telegram community/channel and contact links
- **Smart PDF Rearrangement**: automatic series detection with rule-based
  natural sorting, drag & drop reordering, one-click "Smart Arrange"
- **Brand icon set**: new gradient icon (`#243BFF→#5B35FF→#A12CFF`, glass
  shine, white paper) for PWA, favicon, and OG metadata; icons are
  **cache-busted via `-v2` filenames** (any earlier cache can never serve
  the old icon); service worker cache bumped to v8
- Home page redesign: hero section + feature strip
- Real-PDF fixture suite: deterministic `text/image/scanned/mixed` fixtures
  (fixed-seed LCG, `npm run fixtures:gen`) + sha256 golden hashes
  (`tests/fixtures/pdf/pdfGoldens.json`) + alt-platform (Linux) altSha256
  support for the golden suite
- Unit tests for the menu module (Markdown renderer escaping/XSS/lists/
  links, MenuRegistry, contentLoader fetch-mocking + caching)

### Fixed

- **Golden fixture determinism**: pdf-lib metadata dates broke regeneration —
  all generated PDFs now use `PDFDocument.create({ updateMetadata: false })`
- **`bufferPool.acquire()` returned undersized buffers** (threshold-keyed
  buckets) → `RangeError: offset is out of bounds` on large masks; undersized
  pooled buffers are now discarded
- **Before/After slider blurry "before" side**: `getDocument` transferred
  `data.buffer` to the pdf.js worker, detaching shared merged-PDF bytes;
  bytes are now `slice()`d before handoff
- **JS sharpen off-by-one** (rolling 2-row loaded `y+2` as current row);
  rewritten as rolling 3-row, output matches mathematical reference
- **JSX break in FeedbackSection** (stray closing div)
- **Mojibake encoding cleanup** in DesktopWorkflowUI, MobileWorkflowUI,
  TabletWorkflowUI, PageGrid, ProcessingSettingsPanel (em dash, quotes,
  ellipsis, bullet, en dash, single quotes, black circle)
- Worker pool hardening: hung-worker respawn with timeouts, clearTaskTimeout
  on every completion/cancel path; preview render restore after buffer
  detachment; PDF caching in PdfExporter
- Accessibility review fixes: dialog focus management (new
  `lib/ui/useDialogFocus` shared hook), header focus-steal fix + drawer
  aria, radio-roving GridFormatPicker, touch targets, semantic token
  migrations

### Changed

- Re-licensed from MIT to the Juyel Source License (JSL) v1.0
- Feedback Google Apps Script endpoint updated; relay is
  endpoint-whitelisted, rate-limited (15 req / 60 s), server-controlled
  `chat_id`
- Install prompt UI lives only inside the drawer (shared `useInstallPrompt`
  hook, `lib/pwa`); `InstallBanner` and `InstallButton` removed
- `build` runs a postbuild step stripping the next-devtools chunk
- Layout engine shares sheet-composition geometry between worker and
  exporter; memoryManager canvas pool reused for compose tasks
- Memory manager pools canvases (acquire/release) with revokeAllBlobUrls
  cleanup on unload

### Performance

- **1-channel unsharp (JS + Rust)**: byte-identical (0/5.76M diff), same-
  window A/B: process −18.1% (155→127 ms/page), 100-page total −13.7%
  (21.1→18.2 s), pps 4.74→5.49
- **Fused single-pass HSV+classify (Rust + JS fallback)**: process −19.7%
  (171→137 ms/page), total −14.9% (24.2→20.6 s @100p), kernel 51.1→24.8 ms
  (2.06x), transient heap 27.4 MB→1.4 MB (−25.9 MB/page)
- **Zero-copy compose transfer**: `.slice(0)` copies removed in
  `composeSheetWithWorker` (owned buffers transferred; main-thread fallback
  reloads detached pages from storage)
- **Lazy original re-render**: original-slide JPEG encode skipped during
  processing; Before/After slider re-renders on demand from the merged PDF
- **Cached original PDF document** in PdfExporter (keyed by source bytes
  reference) — subsequent original-page renders skip re-parsing
- **First Load JS ~420 kB → ~192 kB gzip**: postbuild devtools-strip +
  framer-motion removed from First Load; `@next/bundle-analyzer` opt-in
  (`ANALYZE=true`)
- Worker pool parallel processing; V2 stays the default engine (V1 measured
  2.4x slower + ~11x memory on real PDFs — see ENGINEERING_ASSESSMENT.md §8)
- Phase-0 measurement infrastructure: per-phase timing (page:phases /
  doc:phases) on both engines; CI CPU baseline; browser harness
  (`?bench=1`, `&pages=N`, `&engine=v1|v2`)

### Removed

- `InstallBanner` (replaced by InstallShareCard), unused `InstallButton`
- Old workflow-navigator drawer content (install banner, phase shortcuts,
  quick actions, legacy footer)
- Outdated engineering audit report (superseded by
  tests/benchmarks/ENGINEERING_ASSESSMENT.md)

## [1.0.0] - 2026-07-31

### Added

- Multi-phase workflow: Upload, Optimize, Layout, Export
- Adaptive layout engine with 1-up through 10-up grid formats
- WASM-powered image processing kernels (Rust)
- Worker pool for parallel page processing
- Checkpoint/resume system via IndexedDB
- Progressive thumbnail rendering during processing
- Platform-specific UI (mobile, tablet, desktop)
- PWA support with offline caching via Service Worker
- Real-time metrics bus for performance telemetry
- Feedback system with Google Apps Script integration
- Sample PDF generator for zero-config testing
- Comprehensive test suite (unit, integration, stress, benchmarks)
- CI/CD pipeline with GitHub Pages deployment

### Fixed

- Removed `headers()` from next.config.ts (incompatible with static export)
- Added `_headers` file for GitHub Pages security headers
- Fixed vitest path alias resolution for `@/` imports
- Fixed eslint flat config compatibility
- Fixed circular dependency in views/types.ts imports
- Removed invalid manifest.webmanifest from SW precache
- Moved autoprefixer/postcss to devDependencies
- Removed redundant autoprefixer from postcss config (included in Tailwind v4)
- Cleaned up useMonitor event listener leaks
- Unified WorkflowPhase type to single canonical source

### Changed

- Improved CI workflow with npm ci, type checking, and configure-pages
- Updated README with comprehensive architecture documentation
- Removed AI Studio leftover files (metadata.json, .aistudio/)