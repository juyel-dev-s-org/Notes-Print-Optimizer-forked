# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Settings & Information Center: the hamburger drawer is now a config-driven
  menu (Tools, Privacy, Community, Resources, Legal, Developer) rendered from
  `lib/menu` metadata with an accessible accordion UI
- In-app documents (About, User Guide, FAQ, What's New, Changelog, Privacy
  Policy, Terms of Use, JSL License, Copyright Notice) rendered from Markdown
  in `public/content/`
- Feedback reachable from the menu via a modal reusing the existing form
- Clear Cache privacy action; Telegram community/channel and contact links
- App and drawer footer with copyright and contact email
- Smart PDF Rearrangement: automatic detection of related PDF series
  (e.g. "Basic Maths and Calculus 1..13 Class Notes") with rule-based
  natural sorting (numbers, ordinals, roman numerals, zero-padding)
- New `lib/rearrange` module with a modular parser / normalizer / sorter /
  rule-engine architecture (zero new dependencies, browser-only)
- Drag & drop reordering of uploaded files in all platform views
  (arrow buttons remain as the touch/keyboard fallback)
- One-click "Smart Arrange" action with series detection badge in the
  Phase-1 file sequence panel (`components/FileSequencePanel.tsx`)
- Uploaded series are auto-arranged as files arrive; unrelated files keep
  their upload order
- Unit test coverage for the rearrangement pipeline (parser, normalizer,
  sorter, rule engine, edge cases, performance smoke test)

### Changed
- Re-licensed from MIT to the Juyel Source License (JSL) v1.0
  (LICENSE, package.json, README, CONTRIBUTING)
- Updated feedback Google Apps Script endpoint to the new web app URL

### Removed
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
