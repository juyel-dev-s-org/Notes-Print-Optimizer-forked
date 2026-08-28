# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning](https://semver.org/spec/v2.0.0.html/).

## [Unreleased]

### Added

- N-up PDF — live top→bottom preview (20 pre-render), auto-merge, 1/2/4/6/9-up, A4/Letter.
- Category chip dedupe — `Security Tools ×3` fixed → `PDF / Image / Security / Utility / Text` distinct.
- Docs overhaul — About/FAQ/User Guide expanded to 12 tools, Emerald theme docs, offline `v37` docs.

### Fixed

- Landing Emerald premium — hero stats `bg-white` for accessibility, footer floating glass polish.
- Lighthouse `accessibility 0.90 (warn)` — emerald palette now passes `budget` + `lighthouse` CI.

## [1.2.0] - 2026-08-28 — 12-Tool Suite

### Added

- **12 tools, one app** — `Dark Notes → Print`, `Enhance Light PDF`, `Protect PDF (AES-256)`, `PDF to Images`, `Merge PDF`, `Split PDF`, `Image to PDF`, `Password Generator`, `QR Studio (Generate+Scan)`, `Word Counter`, `Case Converter`, `N-up PDF` — all offline, all searchable via `lib/tools/registry.ts`.
- **ToolsBox** — search (title/alias/keyword), quick pills `Image→PDF / PDF→Images`, category chips `All · PDF Tools · Image Tools · Security Tools · Utility Tools · Text Tools`, 2→4 column cards with gradients & deep links `/tools/<slug>/`.
- **Categories** — `pdf (5), image (2), security (2), utility (1), text (2)` — drives filter & SEO.
- **Static routes** — `app/(app)/tools/[slug]/page.tsx` prerendered per tool, shareable URLs.
- **Offline all 12** — `public/sw.js v37` precaches `/ + /offline/ + 12 tool routes + icons + pdf worker + wasm` — 100% offline.

### Changed

- **Brand → Emerald** — Indigo/Violet (`#243BFF`) → Emerald/Mint/Teal/Cyan (`#10B981→#14B8A6→#06B6D4`) + liquid glass — hero, ToolsBox, card gradients.
- **Site URL** — `lib/site.ts` auto-detects `VERCEL_PROJECT_PRODUCTION_URL` → `https://print-optimizer.vercel.app/` (GitHub Pages fallback only).
- **Test suite** — `434 tests / 41 files` at 2026-08-28 (was `241` at 1.1.0).

### Fixed

- White-box CROPPED coords unified, 8-handle editor (`Drag on the page…`), PageGrid compact pills, ProcessingSettings rotary polish.

## [1.1.0] - 2026-08-18

### Added

- PWA **Install/Share card** in Settings drawer (A2HS + Web Share API, iOS guide).
- **Settings & Information Center** — `lib/menu` config-driven (Tools/Privacy/Community/Resources/Legal/Developer) + in-app Markdown docs (`public/content/`).
- **Smart PDF Rearrangement** — series detection + natural sort (numbers/ordinals/Roman/zero-pad) + drag & drop + one-click **Smart Arrange**.
- Brand icons `-v2` cache-busted, real-PDF fixtures (LCG `fixtures:gen` + sha256 goldens `pdfGoldens.json` + `altSha256`), menu unit tests.
- Home hero + feature strip.

### Fixed

- Golden determinism `updateMetadata:false`, buffer pool `RangeError`, Before/After blurry `slice()`, JS sharpen off-by-one → rolling 3-row, JSX break, Mojibake cleanup, worker pool hardening, a11y focus.
- See full technical list in [GitHub CHANGELOG](https://github.com/juyel-dev/Notes-Print-Optimizer/blob/main/CHANGELOG.md).

### Changed

- Re-licensed MIT → **JSL v1.0**; hardened GAS relay (15/60s, server `chat_id`); Install prompt in drawer only; `build` devtools-strip; shared sheet geometry; canvas pool.

### Performance

- 1-channel unsharp −18.1% process / fused HSV+classify −19.7%, zero-copy compose, lazy original re-render, cached PDF doc, **First Load JS 420 kB → 192 kB gzip**.
- V2 sequential is production (V1 parallel 2.4× slower / 11× mem).

### Removed

- `InstallBanner`/`InstallButton`, old navigator drawer content, outdated audit report.

## [1.0.0] - 2026-07-31

### Added

- Upload → Optimize → Layout → Export workflow; 1-up…10-up layout engine; WASM kernels (Rust) + worker pool + checkpoint (IndexedDB) + progressive thumbnails; platform-specific UI; PWA offline (SW) + metrics bus + GAS feedback + sample PDF generator; test suite + CI/CD.

### Fixed

- `headers()` static-export compat, `_headers`, vitest ` @/`, eslint flat, circular `views/types`, SW precache, autoprefixer, `useMonitor` leaks, unified `WorkflowPhase`.

### Changed

- CI `npm ci` + typecheck + `configure-pages`; README arch docs; removed `metadata.json`/`.aistudio`.

---

*Full technical Agent Changelog: [GitHub — CHANGELOG.md](https://github.com/juyel-dev/Notes-Print-Optimizer/blob/main/CHANGELOG.md)*
