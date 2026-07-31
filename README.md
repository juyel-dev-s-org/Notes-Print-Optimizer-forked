# Notes Print Optimizer

Mobile-first adaptive print optimizer and PDF engine for Physics Wallah (PW) and lecture class notes. Convert dark-background lecture slides to print-ready PDFs with optimal ink and paper usage.

[![CI + Deploy](https://github.com/juyel-dev/Notes-Print-Optimizer/actions/workflows/deploy.yml/badge.svg)](https://github.com/juyel-dev/Notes-Print-Optimizer/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://typescriptlang.org)

## Features

- **Print Optimization** - Converts dark-background slides to ink-efficient print layouts
- **Adaptive Layout Engine** - Supports 1-up, 2-up, 4-up, 6-up, and 9-up arrangements
- **WASM-Powered Kernels** - Rust-compiled image processing for near-native speed
- **Mobile-First PWA** - Installable, works offline with service worker caching
- **Smart Analysis** - Ink coverage detection, banner removal, noise reduction
- **Real-time Metrics** - Live ink savings, page count, and processing stats
- **Multi-Phase Workflow** - Upload, Process, Layout, Export with checkpoint/resume
- **Responsive UI** - Optimized views for mobile, tablet, and desktop

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher

### Installation

```bash
git clone https://github.com/juyel-dev/Notes-Print-Optimizer.git
cd Notes-Print-Optimizer
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Production Build

```bash
npm run build
npm start
```

### WASM Build (Optional)

Requires [Rust](https://rustup.rs) and [wasm-pack](https://rustwasm.github.io/wasm-pack/):

```bash
npm run build:wasm
```

## Testing

```bash
npm run test        # Unit + Integration tests
npm run test:bench  # Benchmarks
npm run test:smoke  # E2E Smoke tests (Playwright)
npm run test:ci     # Full CI suite
```

## Project Structure

```
app/                    Next.js App Router pages
components/             React UI components
  views/                Platform-specific views (mobile/tablet/desktop)
  preview/              PDF preview components
  shared/               Shared UI components
lib/
  config/               App configuration and validation
  feedback/             Feedback system (Google Apps Script)
  i18n/                 Internationalization strings
  kernels/              JS image processing kernels
  metrics/              Performance metrics bus
  monitoring/           Runtime monitoring hooks
  optimizer/            Core optimization engine
    engine/             Processing engines (V1/V2)
    perf/               Performance utilities
    processor/          Image processors (Main/Worker)
    wasm/               WASM runtime and bindings
  pipeline/             Plugin pipeline architecture
  plugins/              Pipeline plugins
  services/             Business logic services
  wasm/                 WASM loader and fallback
  workers/              Web Worker management
  workflow/             Workflow state management
public/                 Static assets (icons, WASM, SW)
tests/                  Test suites
  benchmarks/           Performance benchmarks
  integration/          Integration tests
  smoke/                Playwright E2E tests
  stress/               Stress and memory leak tests
  unit/                 Unit tests
wasm/                   Rust WASM source
  src/                  Rust kernel implementations
scripts/                Build scripts
```

## Configuration

Copy `.env.example` to `.env.local` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| NEXT_PUBLIC_FEEDBACK_URL | Google Apps Script URL for feedback | No |

## Deployment

Automatically deployed to **GitHub Pages** on push to `main` via GitHub Actions.

**Live URL:** https://juyel-dev.github.io/Notes-Print-Optimizer

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Static Export) |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS 4 |
| Animation | Motion (Framer Motion) |
| PDF Render | pdf.js |
| PDF Export | pdf-lib |
| Compute | Rust to WebAssembly |
| Workers | Web Worker Pool |
| Testing | Vitest + Playwright |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages |

## License

[MIT](LICENSE) 2026 juyel-dev

---

Built with care for students who print their notes.
