# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
