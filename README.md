# Notes Print Optimizer — Agent Documentation

> **AGENT-ONLY DOCUMENT.** This file is written for AI coding agents. Read it
> before modifying this codebase. Do NOT render it verbatim in any
> human-facing UI. Facts here are normative unless marked otherwise.

## 1. Identity

| Field | Value |
|---|---|
| Product | PW Notes Print Optimizer |
| Purpose | Convert dark-background lecture slides (Physics Wallah / class notes) to print-ready PDFs with optimal ink and paper usage |
| Stack | Next.js 15 (App Router, `output: 'export'`), React 19, TypeScript 5.9 strict, Tailwind CSS v4, pdfjs-dist 4.10.38, pdf-lib, Rust→WASM kernels |
| Runtime model | Fully client-side; zero server code; static export deployed to Vercel (portable to any static host) |
| License | Juyel Source License (JSL) v1.0 (see LICENSE) |
| CI badge | [CI](https://github.com/juyel-dev/Notes-Print-Optimizer/actions/workflows/ci.yml) |

## 2. Repository topology (two-repo model)

| Repo | Role | Branch | Protection |
|---|---|---|---|
| `juyel-dev/Notes-Print-Optimizer` | **PRODUCTION** (live users) | `main` | protected: required check `ci` (strict), enforced for admins |
| `juyel-dev-s-org/Notes-Print-Optimizer-forked` | **DEVELOPMENT** / preview | `main` + feature branches | none |

Mandatory rules for agents:

1. **All development happens in the fork.** Commit and push only to the fork.
2. **Never push to production `main` directly.** It is updated ONLY via a
   Pull Request from the fork; the PR must pass the `ci` check (plus
   lighthouse/budget) and be merged with `gh pr merge --merge`.
3. Production URL: `https://print-optimizer.vercel.app/` (Vercel git
   integration deploys production `main` automatically; absolute SEO URLs
   come from `VERCEL_PROJECT_PRODUCTION_URL`, so renaming the project or
   adding a domain requires a fresh deployment to take effect)
4. Fork preview URL: follow the Vercel preview comment on each PR
5. Base path is opt-in only (`NEXT_PUBLIC_BASE_PATH`) — never inferred from
   the environment. Root hosts (Vercel) need nothing.
6. A stale `develop` branch exists in production for historical reasons. Do
   not use it.

## 3. Environment & exact commands

Prerequisites: Node.js 20+ (see `.nvmrc`), npm 10+. Rust toolchain only for
WASM rebuilds.

| Task | Command | Notes |
|---|---|---|
| Install deps | `npm ci` | |
| Dev server | `npm run dev` | http://localhost:3000 |
| Typecheck | `npx tsc --noEmit` | must exit 0 |
| Lint | `npm run lint` | must be clean |
| Unit + integration | `npm run test` | Vitest, **241/241 green at HEAD** |
| Benchmarks | `npm run test:bench` | |
| E2E smoke | `npm run test:smoke` | Playwright |
| CI full suite | `npm run test:ci` | |
| Production build | `npm run build` | runs postbuild devtools-strip; static export to `out/` |
| Serve built export | `npx serve out -l 4180 --no-clipboard` | `next start` FAILS with `output: 'export'` |
| WASM rebuild | `npm run build:wasm` | binary is committed; see BASELINE.md for the manual cargo pipeline |
| Regenerate PDF fixtures | `npm run fixtures:gen` | `scripts/gen-pdf-fixtures.mjs`, fixed-seed LCG |
| Regenerate goldens | `PDF_UPDATE_GOLDENS=1 npm run test` | deliberate only, see invariants |

## 4. Verification gate (run ALL before pushing anything)

1. `npx tsc --noEmit` — exit 0
2. `npm run lint` — clean
3. `npm run test` — 241/241
4. `npm run build` — success. Known pre-existing warnings (do not chase):
   ProcessingModal `<img>` warning, LoadingSkeleton unused `phaseName`,
   UploadArea unused-expression, workflow-UI unused vars
   (rating/feedbackText/feedbackSubmitted/setRating/setFeedbackText/
   handleDownloadOptimized1Up/onSendFeedback).
5. Optional smoke: build → `npx serve out -l 4180 --no-clipboard` →
   Playwright check (0 console errors, no horizontal overflow, font loaded)
   on desktop AND mobile viewports.

## 5. Architecture map

```
app/                        Next.js App Router pages (layout, page, manifest, sw helper)
components/
  views/                    Platform-specific views (mobile/tablet/desktop)
  preview/                  PDF preview components
  shared/                   Shared UI (skeletons, metrics, error boundary)
lib/
  config/                   App configuration and validation
  rearrange/                Smart PDF rearrangement (parser, normalizer, sorter, rule engine)
  feedback/                 Feedback system; gasScriptTemplate.ts holds the GAS relay code
  i18n/                     Internationalization strings
  kernels/                  JS image processing kernels
  menu/                     Settings/Info-center menu registry + contentLoader
  metrics/                  Performance metrics event bus
  monitoring/               Runtime monitoring hooks
  optimizer/                Core optimization engine (engine/ V1+V2, processor/, wasm/, perf/)
  pipeline/                 Plugin pipeline architecture
  plugins/                  Pipeline plugins (Analyze, Process, Layout, Export)
  pwa/                      Install prompt hook (useInstallPrompt)
  services/                 Service layer (Upload, Optimization, Layout, Export)
  ui/                       Shared UI hooks (useDialogFocus, focus trap)
  workers/                  Web Worker pool and protocol
  workflow/                 State management (reducer, hooks, context)
public/                     Static assets: sw.js (VERSION v8), icons (-v2, cache-busted),
                            content/ (user-facing markdown docs), wasm/, fixtures/pdf/
tests/                      unit, integration, stress, smoke, benchmarks, fixtures/pdf
wasm/                       Rust WASM source
scripts/                    postbuild-strip-devtools.js, gen-pdf-fixtures.mjs, generate-icons.mjs
```

### Processing pipeline

```
Upload PDFs -> Merge -> Analyze Pages -> Optimize (per-page) -> Layout Grid -> Export PDF
```

### Engine versions

| Engine | ID | Default? | Description |
|---|---|---|---|
| V1 | `pw-pixel-v1` | No | Parallel worker pool; measured 2.4x slower + ~11x memory on real PDFs — DO NOT default |
| V2 | `pw-pixel-v2` | **Yes** | Sequential, memory-safe; production engine |

### State management

- Workflow reducer — single source of truth
- Checkpoint Manager — IndexedDB progress persistence
- Metrics Bus — event-driven telemetry (`page:phases`, `doc:phases`)

## 6. Key invariants (DO NOT break)

- **PDF determinism**: any generated PDF (fixtures, bench decks, sample
  generator) must be created with `PDFDocument.create({ updateMetadata: false })`.
  Metadata dates broke regeneration before; 3 consecutive regeneration runs
  must produce identical SHA-256.
- **Golden hashes are byte-exact**: `tests/fixtures/pdf/pdfGoldens.json`
  (per-page sha256 + inkBefore/inkAfter + classification). Regenerate ONLY
  deliberately with `PDF_UPDATE_GOLDENS=1`; accept alt-platform hashes only
  via the explicit altSha256 mechanism (see 25807e8).
- **Byte-identical policy**: performance optimizations must keep golden
  outputs at 0 byte-differences and the full suite green.
- **WASM binary is committed** (`public/wasm/`). Rebuild only when `wasm/src`
  changes; verify parity tests.
- **Service worker versioning**: bump `VERSION` in `public/sw.js` whenever
  precached files change. PWA icons are cache-busted via `-v2` filenames —
  never reuse an old filename for changed content.
- **No server-side processing** of user PDFs; no user data uploaded except
  optional feedback; SW caches only static assets.
- **No secrets** in code, docs, or commits.
- **Conventional commits**: `feat:` `fix:` `docs:` `chore:` `perf:` `test:`
  `refactor:`. One logical change per commit.

## 7. Configuration

Copy `.env.example` → `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FEEDBACK_URL` | No | Google Apps Script web app URL (feedback relay) |
| `NEXT_PUBLIC_BASE_PATH` | No | Deployment base path — opt-in only, never inferred from env |
| `NEXT_PUBLIC_SITE_URL` | No | Absolute production URL for canonicals/sitemap/JSON-LD (auto-detected on Vercel; set it explicitly when adding a custom domain) |

## 8. CI/CD (`.github/workflows/`)

| Workflow | Jobs | Triggers |
|---|---|---|
| `ci.yml` | npm ci → lint → tsc → unit tests → dependency audit → build (root basePath) → Playwright smoke | push to main + PRs; hosting handled by Vercel git integration |
| `lighthouse.yml` | Lighthouse CI: `lighthouse` + `budget` jobs | PRs + main |
| `wasm-build.yml` | Rust WASM build check | PRs + main |

Known behavior: GitHub-hosted runners occasionally hang on "Install
Playwright Browsers" (~1h+) — cancel and re-run the failed run.

## 9. Release flow (fork → production)

1. Commit + push fork `main` (preview auto-deploys).
2. Run the full verification gate (section 4).
3. Create PR: `gh pr create -R juyel-dev/Notes-Print-Optimizer --base main --head juyel-dev-s-org:main`
4. Wait until mergeStateStatus is `CLEAN` (ci + lighthouse + budget pass).
5. Merge: `gh pr merge -R juyel-dev/Notes-Print-Optimizer --merge --delete-branch=false`
6. Confirm the production deploy run completes; verify live URLs.

## Acknowledgments

PDF.js (Mozilla), pdf-lib, Next.js, Tailwind CSS, Rust + wasm-pack.