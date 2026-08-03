# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Adaptive PWA **Install/Share card** at the top of the Settings drawer:
  shows a beautiful install card (native add-to-home-screen) when the app is
  not installed, and switches to a **Share this app** card (Web Share API with
  copy-link fallback) once installed
- Install card shows benefit chips (Fast / Offline / Private) and an iOS
  "Add to Home Screen" guide
- Unit tests for the menu module: Markdown renderer (escaping/XSS/lists/links),
  MenuRegistry (register/resolve/validate/hidden filtering) and contentLoader
  (fetch mocking + caching), plus a config-integration sanity suite
- Settings & Information Center: config-driven menu (Tools, Privacy, Community,
  Resources, Legal, Developer) rendered from `lib/menu` metadata with an
  accessible accordion UI
- In-app documents rendered from Markdown in `public/content/`
- Feedback reachable from the menu via a modal reusing the existing form
- Clear Cache privacy action; Telegram community/channel and contact links
- Smart PDF Rearrangement: automatic series detection with rule-based natural
  sorting, drag & drop reordering and one-click "Smart Arrange"

### Changed
- Install prompt UI now lives **only inside the drawer** (nothing renders
  outside the hamburger menu); shared `useInstallPrompt` hook (lib/pwa)
- Re-licensed from MIT to the Juyel Source License (JSL) v1.0
- Updated feedback Google Apps Script endpoint to the new web app URL

### Removed
- `InstallBanner` (replaced by the adaptive `InstallShareCard`)
- Unused `InstallButton` component
- Old workflow-navigator drawer content (install banner, phase shortcuts,
  quick actions, legacy footer)

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
