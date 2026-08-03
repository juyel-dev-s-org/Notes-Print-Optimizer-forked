# Notes Print Optimizer

Mobile-first adaptive print optimizer and PDF engine for Physics Wallah (PW) and lecture class notes. Convert dark-background lecture slides to print-ready PDFs with optimal ink and paper usage.

[![CI + Deploy](https://github.com/juyel-dev/Notes-Print-Optimizer/actions/workflows/deploy.yml/badge.svg)](https://github.com/juyel-dev/Notes-Print-Optimizer/actions/workflows/deploy.yml)
[![License: JSL v1.0](https://img.shields.io/badge/License-JSL%20v1.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://typescriptlang.org)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)

## Features

- **Smart PDF Rearrangement** - Auto-detects related series (e.g. *Calculus 1..13 Class Notes*) and natural-sorts them, with drag & drop fine-tuning
- **Print Optimization** - Converts dark-background slides to ink-efficient print layouts
- **Adaptive Layout Engine** - Supports 1-up, 2-up, 4-up, 6-up, 8-up, and 10-up arrangements
- **WASM-Powered Kernels** - Rust-compiled image processing for near-native speed
- **Mobile-First PWA** - Installable, works offline with service worker caching
- **Smart Analysis** - Ink coverage detection, banner removal, noise reduction
- **Real-time Metrics** - Live ink savings, page count, and processing stats
- **Multi-Phase Workflow** - Upload, Process, Layout, Export with checkpoint/resume
- **Responsive UI** - Optimized views for mobile, tablet, and desktop
- **Checkpoint & Resume** - Automatically saves progress; resume after crash or refresh
- **Worker Pool** - Parallel page processing via Web Workers with crash recovery

## Quick Start

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 10+

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

Open [http://localhost:3000](http://localhost:3000) in your browser.

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
npm run test          # Unit + Integration tests (Vitest)
npm run test:watch    # Watch mode
npm run test:bench    # Performance benchmarks
npm run test:smoke    # E2E Smoke tests (Playwright)
npm run test:ci       # Full CI suite
```

## Project Structure

```
app/                        Next.js App Router pages
components/                 React UI components
  views/                    Platform-specific views (mobile/tablet/desktop)
  preview/                  PDF preview components
  shared/                   Shared UI (skeletons, metrics, error boundary)
lib/
  config/                   App configuration and validation
  rearrange/                Smart PDF rearrangement (parser, normalizer, sorter, rule engine)
  feedback/                 Feedback system (Google Apps Script)
  i18n/                     Internationalization strings
  kernels/                  JS image processing kernels
  metrics/                  Performance metrics event bus
  monitoring/               Runtime monitoring hooks
  optimizer/                Core optimization engine
    engine/                 Processing engines (V1/V2)
    processor/              Image processors (MainThread / WorkerPool)
    wasm/                   WASM runtime and bindings
  pipeline/                 Plugin pipeline architecture
  plugins/                  Pipeline plugins (Analyze, Process, Layout, Export)
  services/                 Service layer (Upload, Optimization, Layout, Export)
  workers/                  Web Worker pool and protocol
  workflow/                 State management (reducer, hooks, context)
public/                     Static assets (SW, icons, WASM binaries)
tests/                      Test suites (unit, integration, stress, benchmarks)
wasm/                       Rust WASM source
```

## Architecture

### Processing Pipeline

```
Upload PDFs -> Merge -> Analyze Pages -> Optimize (per-page) -> Layout Grid -> Export PDF
```

### Engine Versions

| Engine | ID | Description |
|--------|-----|-------------|
| V1 | `pw-pixel-v1` | Single-pass render, unified HSV, worker pool |
| V2 | `pw-pixel-v2` | Enhanced color remap, adaptive DPI |

### State Management

- **Workflow Reducer** - Single source of truth for all app state
- **Checkpoint Manager** - IndexedDB-based progress persistence
- **Metrics Bus** - Event-driven performance telemetry

## Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_FEEDBACK_URL` | No | Google Apps Script URL for feedback |
| `NEXT_PUBLIC_BASE_PATH` | No | Base path for deployment (auto-set in CI) |

## Deployment

Automatically deployed to GitHub Pages on push to `main`:

**Live URL:** [https://juyel-dev.github.io/Notes-Print-Optimizer](https://juyel-dev.github.io/Notes-Print-Optimizer)

The CI pipeline:
1. Installs dependencies (`npm ci`)
2. Runs linting and type checking
3. Runs unit tests
4. Builds static export (`next build` with `output: 'export'`)
5. Deploys to GitHub Pages

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for our security policy.

## License

[Juyel Source License (JSL) v1.0](LICENSE) - © 2026 Juyel Hossain. Free for personal, educational, and research use; commercial use requires written permission.

## Acknowledgments

- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF rendering
- [pdf-lib](https://pdf-lib.js.org/) - PDF manipulation
- [Next.js](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Rust + wasm-pack](https://rustwasm.github.io/) - WASM kernels
