# Notes Print Optimizer — Agent Documentation

> **AGENT-ONLY DOCUMENT.** Read this file before touching any code. Facts here are normative unless marked `non-normative`. Do NOT render verbatim in human UI. For human overview see `public/content/ABOUT.md`.

---

## 0. How to read this doc (for AI agents)

| You want | Jump to |
|---|---|
| Add / rename / remove a tool | **§5 Tool Registry Contract** + `lib/tools/registry.ts:35` |
| Change offline / precache / icons | **§6 PWA & Service Worker** + `public/sw.js:1` |
| Touch kernels / WASM / perf | **§7 Engine & Pipeline** + `tests/benchmarks/BASELINE.md` |
| Change SEO / OG cards / sitemap | **§8 Configuration** + `lib/site.ts:1` |
| Gate before push | **§4 Verification Gate** |

**Single source of truth:** `lib/tools/registry.ts` → `TOOL_REGISTRY` (12 tools, stable `slug`). Every route, SW entry, sitemap, search index, and card derives from it. Never hardcode a tool elsewhere.

---

## 1. Identity

| Field | Value |
|---|---|
| Product | **Print Optimizer — PW Notes Print Suite** (brand `Print Optimizer`) |
| Purpose | 12-tool suite for students: dark-slide whitening, enhance, protect, PDF↔images, merge/split, image→PDF, plus utility/text/QR. Saves ink & paper. |
| Tagline | *Every PDF, print-perfect — merge, split, protect, whiten & enhance, plus JPG/PNG image conversion* (`app/layout.tsx:18`) |
| Stack | Next.js 15.5 (App Router, `output:'export'`), React 19, TS 5.9 strict, Tailwind v4, pdfjs-dist 4.10, pdf-lib 1.17, Rust→WASM (`wasm/src`), `motion`, `lucide-react` |
| Theme identity | Emerald → Mint → Teal → Cyan `#10B981→#6EE7B7→#14B8A6→#06B6D4` + liquid glass. Violet (`#243BFF/#4338ca`) removed Aug 2026 — do NOT reintroduce. |
| Runtime | **Fully client-side, zero server.** Static export `out/` → Vercel (portable to any static host). No upload except optional feedback. |
| License | Juyel Source License (JSL) v1.0 (`LICENSE`, `public/content/JSL_LICENSE.md`) |
| CI | `ci.yml` required check `ci` (strict, admins enforced) + `lighthouse` + `budget` |

## 2. Repository topology (two-repo model)

| Repo | Role | Branch | Protection |
|---|---|---|---|
| `juyel-dev/Notes-Print-Optimizer` | **PRODUCTION** (live users) | `main` | protected: required `ci` strict, enforced for admins |
| `juyel-dev-s-org/Notes-Print-Optimizer-forked` | **DEVELOPMENT / preview** | `main` + feature branches | none |

**Mandatory rules:**

1. All development in **fork**. Never push production `main` directly — only via PR `juyel-dev-s-org:main → juyel-dev:main`.
2. Merge only with `gh pr merge --merge` (or `--rebase` for doc-only); `ci` + `lighthouse` + `budget` must be green.
3. **Production URL:** `https://print-optimizer.vercel.app/` via `VERCEL_PROJECT_PRODUCTION_URL` (`lib/site.ts:8`). Adding a custom domain requires fresh Vercel deploy — do not hardcode domains.
4. **Fork preview URL:** Vercel preview comment on each PR.
5. **Base path:** Opt-in only via `NEXT_PUBLIC_BASE_PATH`. Root hosts (Vercel) need nothing — never infer from `GITHUB_ACTIONS`.
6. Stale `develop` branch exists — **do NOT use**.

## 3. Environment & exact commands

Prereq: Node 20+ (`.nvmrc` → `20`), npm 10+. Rust toolchain only for `build:wasm`.

| Task | Command | Notes |
|---|---|---|
| Install | `npm ci` | |
| Dev | `npm run dev` | http://localhost:3000 |
| Typecheck | `npx tsc --noEmit` | must exit 0 |
| Lint | `npm run lint` | `eslint.config.mjs` — `next/core-web-vitals` |
| Unit + integration + bench | `npm run test` | `vitest run` — **434 tests / 41 files at 2026-08-28 HEAD** — never hardcode count; gate is *all green* |
| Benchmarks (all) | `npm run test:bench` | `phase0Baseline`, `sharpenShootout`, `kernelProfile`, `realPdfBaseline` |
| E2E smoke | `npm run test:smoke` | `playwright` chromium (22 tests) — `npx serve out -l 4180` first |
| CI full | `npm run test:ci` | vitest + bench + smoke |
| Production build | `npm run build` | `next build && postbuild-strip-devtools.js` → `out/` (trailingSlash). Known warnings: `next/no-img-element` in `EnhanceWorkbenchView/ProcessingModal/ImagesResultView`, `no-unused-vars` `phaseName/isProcessing`, `exhaustive-deps` `PersistentShell` — do not chase |
| Serve export | `npx serve out -l 4180 --no-clipboard` | `next start` **FAILS** with `output:'export'` |
| WASM rebuild | `npm run build:wasm` | `wasm-pack build` → `public/wasm/` — binary is committed |
| Gen fixtures | `npm run fixtures:gen` | `scripts/gen-pdf-fixtures.mjs` — fixed-seed LCG, deterministic |
| Gen goldens | `PDF_UPDATE_GOLDENS=1 npm run test` | deliberate only — see §9 invariants |
| Check OG cards | `npm run check:og` | validates `cdn.jsdelivr.net/gh/juyel-dev/image@main/print-optimizer/og/*.png` 1200×630 |

## 4. Verification gate (run ALL before every push)

```
1. npx tsc --noEmit                          # 0
2. npm run lint                              # clean (warn-only rules allowed)
3. npm run test                              # ALL green (no hardcoded count)
4. npm run build                             # success → out/ + 20/20 static + 2/2 export
5. Optional: npx serve out -l 4180 && npm run test:smoke  # 0 console errors, no overflow, font loaded, desktop+mobile
6. If kernels/engine/fixtures touched: goldens 0 byte-diff, WASM parity green
7. If precache/icons/tools touched: bump VERSION in public/sw.js + verify public/content/ docs + toolHref contract
```

Do not skip a step. Do not claim "already verified" without evidence.

## 5. Tool Registry Contract (the most important section)

**File:** `lib/tools/registry.ts:35` — **`TOOL_REGISTRY: ToolDefinition[]` is the single source of truth.** 12 entries at 2026-08-28:

| # | id (`ToolMode`) | slug (stable URL) | title | category | icon | chips |
|---|---|---|---|---|---|---|
| 1 | `dark-print` | `dark-print` | Dark Notes → Print | pdf | FileText | Auto-whiten · Banner removal · Up to 10-up |
| 2 | `enhance` | `enhance-light-pdf` | Enhance Light PDF | pdf | Contrast | Darken ink · Contrast · Sharpen |
| 3 | `protect` | `protect-pdf` | Protect PDF | security | ShieldCheck | AES-256 · Open password · Print/Copy locks |
| 4 | `to-images` | `pdf-to-images` | PDF to Images | image | Images | JPG·PNG·WebP · Up to 300 DPI · ZIP |
| 5 | `merge` | `merge-pdf` | Merge PDF | pdf | Combine | Up to 10 files · Smart Arrange · Custom filename |
| 6 | `split` | `split-pdf` | Split PDF | pdf | Scissors | Extract range · Burst every N · ZIP |
| 7 | `to-pdf` | `image-to-pdf` | Image to PDF | image | ImagePlus | JPG·PNG·WebP · Fit or A4 · Reorderable |
| 8 | `password-gen` | `password-generator` | Password Generator | security | KeyRound | Crypto-random · 8–64 chars · Bulk |
| 9 | `qr-gen` | `qr-generator` | QR Studio | utility | QrCode | Generate+Scan · Styled QR · Camera & image |
| 10 | `word-count` | `word-counter` | Word Counter | text | Type | Live stats · Reading time · Top keywords |
| 11 | `case-convert` | `case-converter` | Case Converter | text | CaseSensitive | 11 formats · One-tap copy · Live |
| 12 | `nup` | `n-up` | N-up PDF | pdf | LayoutGrid | Auto-merge · 1/2/4/6/9-up · A4/Letter |

**Types:** `ToolCategory = 'pdf'|'image'|'security'|'text'|'utility'` ordered `['pdf','image','security','utility','text']` via `getToolCategories()` (`registry.ts:242`). Chips use `labelMap` in `components/tools/ToolsBox.tsx:108` — keep in sync.

**What adding a tool MUST do (atomic):**

1. Append one `ToolDefinition` to `TOOL_REGISTRY` (unique `id`, stable `slug`, unique `seoTitle`/`seoDescription`, `aliases`/`keywords`, `category`, `icon`, `gradient` emerald family, `chips`, `cta`).
2. Add slug to `public/sw.js:TOOL_ROUTES` (precache — 100% offline guarantee). Keep `getAllToolSlugs().length === TOOL_ROUTES.length` — enforced by `tests/unit/siteContract.test.ts`.
3. Route already works via `app/(app)/tools/[slug]/page.tsx` (`generateStaticParams` from registry). No extra page needed.
4. Add `CATEGORY_ORDER` placement if new category — and update `ToolsBox.tsx:labelMap`.
5. Add OG card `print-optimizer/og/<slug>.png` (1200×630) to `juyel-dev/image` repo.
6. Bump `VERSION` in `public/sw.js:1` (`v37` at HEAD) so precache invalidates.
7. Update human docs: `public/content/ABOUT.md`, `FAQ.md`, `USER_GUIDE.md`, `WHATS_NEW.md`, root `CHANGELOG.md`.

**Never:** rename a `slug` casually (URL contract, sitemap, SW, OG all break), duplicate `seoTitle`/`seoDescription`, reuse alias `password` without scoping (already collides `protect` vs `password-gen` — test aliases), or add a network tool without `SECURITY.md` review.

Helpers: `toolHref(mode)` → `/tools/<slug>/`, `getToolBySlug`, `slugForMode`, `modeForSlug`, `getAllToolSlugs`, `getToolById` (`registry.ts:258`).

## 6. PWA & Service Worker

- **Manifest:** `app/manifest.ts` — `id/start_url/scope = BASE_PATH + /`, `name Print Optimizer`, `theme_color #020617` (dark) / `#f4f6fb` (light via `THEME_INIT_SCRIPT` in `app/layout.tsx:165`), `background #020617`, `display standalone`, icons `icon-192-v2.png / icon-512-v2.png / icon-maskable-v2.svg` (cache-busted `-v2` — never reuse name).
- **SW:** `public/sw.js` — `VERSION='v37'` → `CACHE='pw-optimizer-v37'` + `STATIC`/`DYNAMIC` variants. `BASE` derived from `self.location.pathname` for subpath deploys. `PRECACHE_URLS = [/, /offline/, ...TOOL_ROUTES, icons, vendor/pdf*.mjs, wasm/npo_wasm.*]`.
  - `install`: `skipWaiting` + `Promise.allSettled(precache)` — deliberate for 100% offline (see comment `public/sw.js:1`).
  - `activate`: delete old `pw-optimizer-*` keeps 3.
  - `fetch`: navigate `network-first → DYNAMIC_CACHE → /offline/ 503 html`; wasm `network-first → STATIC_CACHE`; static assets (js/css/png/svg/mjs/woff) `cache-first`; else `stale-while-revalidate`; `message SKIP_WAITING`.
- **Bump rule:** Any precache change → `VERSION++`. Icons: generate via `scripts/apply-icon-art.mjs` from `public/icon-master.png` — never hand-edit `-v2`.

## 7. Architecture map

```
app/                         App Router (output:'export', trailingSlash:true)
  layout.tsx                 fonts (Plus Jakarta Sans/Outfit/Geist Mono), metadataBase=SITE_URL, OG cdn, CSP, theme script
  (app)/page.tsx             LandingHero (emerald) + ToolsBox (12 cards)
  (app)/tools/[slug]/page.tsx  prerendered per TOOL_REGISTRY (dynamicParams=false)
  manifest.ts / sitemap.ts / robots.ts / offline/
components/
  Header.tsx / LandingHero.tsx / ToolsBox.tsx / ToolCard.tsx
  tools/ / nup/ / qrgen/ / protect/ / tomerge/ / tosplit/ / toimages/ / toimgpdf/ / whitebox/ / enhance/
  views/ (WorkflowView) / preview/ / shared/ (EmptyPhaseState, LoadingSkeleton) / shell/ (PersistentShell)
  ui/ / menu/ / seo/
lib/
  tools/registry.ts          single source (see §5)
  tools/search.ts            alias+keyword fuzzy search
  site.ts                    SITE_URL + OG_CDN_BASE (Vercel auto-detect, never hardcode domain)
  optimizer/                 engine V1/V2, processor, exporter, wasm/, perf/
  kernels/                   JS kernels (whiteBox, enhanceKernels, pixelKernels)
  workers/                   pool + protocol + pixel/compose workers
  workflow/                  reducer + hooks (useOptimization, useManualRegions) + context
  pipeline/                  plugin pipeline + checkpoint (IndexedDB)
  pwa/                       useInstallPrompt
  menu/                      hamburger drawer config + contentLoader (public/content/*.md)
  feedback/                  gasScriptTemplate.ts + gasClient.ts
  nup/                       nupLayout.ts (pure geometry) + nupService.ts (single-parse vector)
  rearrange/                 parser/normalizer/sorter/rule-engine (Smart Arrange)
  content/                   FAQ parser + JSON-LD
  enhance/ / protect/ / tomerge/ / tosplit/ / toimages/ / img2pdf/
public/
  sw.js (v37), icon-*-v2.png, vendor/pdf*.mjs, wasm/npo_wasm.*, content/*.md (8 human docs), fixtures/
tests/
  unit/ (26 suites incl. whiteBox, manualWhiteBox, siteContract, toolSearch)  | integration/ | stress/ | smoke/ (Playwright) | benchmarks/ (BASELINE, ENGINEERING_ASSESSMENT) | fixtures/pdf/ (4 PDFs + pdfGoldens.json)
wasm/                        Rust source (wasm/src) → public/wasm/npo_wasm_bg.wasm (30,606 B)
scripts/                     postbuild-strip-devtools.js (60B stub), apply-icon-art.mjs, gen-pdf-fixtures.mjs, check-og-assets.mjs
```

**Processing pipeline (per-tool, dark-print example):**

```
Upload PDFs → Merge (pdf-lib, Smart Arrange) → Analyze Pages (kernels) → Optimize per-page (V2 sequential, pixel kernel) → Layout Grid (nupLayout) → Export PDF (pdfExporter, composeSheetWithWorker)
```

Text/utility tools (word-count, case-convert, password-gen, qr-gen) are pure client transforms — no pipeline.

**Engine versions:**

| Engine | ID | Default | Notes |
|---|---|---|---|
| V1 | `pw-pixel-v1` | No | Parallel pool — measured 2.4× slower + 11× mem on 100p real PDF — DO NOT default |
| V2 | `pw-pixel-v2` | **Yes** | Sequential, memory-safe — production |

State: `workflowReducer` (single source) + `CheckpointManager` (IndexedDB, feature-flag `pipeline.checkpoint_resume`) + `MetricsBus` (`page:phases`, `doc:phases`).

## 8. CI/CD

| Workflow | File | Jobs | Triggers |
|---|---|---|---|
| ci | `.github/workflows/ci.yml` (61L) | `npm ci → lint → tsc → vitest → audit high → build (BASE_PATH='') → playwright chromium smoke (grep-invert worker pool runtime)` | push/PR `main,master`, dispatch |
| lighthouse | `.github/workflows/lighthouse.yml` (115L) | `lighthouse` (`lighthouserc.json` asserts: perf `error 0.95`, **a11y `warn 0.90`**, best-practices `error 0.95`, seo `error 0.95`, resource caps `doc 15k / script 380k / css 80k / image 500k / 3rd-party 2`) + `budget` (12 URLs: `/`, all 12 `/tools/<slug>/` loops, thresholds `perf70 a11y90 best93 seo95`) | push/PR `main,master` |
| wasm-build | `.github/workflows/wasm-build.yml` (39L) | `wasm-pack build` → artifact | `workflow_dispatch` only |

Known: GH runners occasionally hang on Playwright browser install (~1h) — cancel & re-run.

## 9. Key invariants (DO NOT break)

- **Determinism:** All generated PDFs use `PDFDocument.create({ updateMetadata:false })`. 3 consecutive `fixtures:gen` runs must yield identical SHA-256.
- **Golden byte-exact:** `tests/fixtures/pdf/pdfGoldens.json` (per-page sha256 + inkBefore/After + classification). Regen only `PDF_UPDATE_GOLDENS=1`; alt-platform via `altSha256` (see `25807e8`).
- **Byte-identical perf:** Optimizations must keep goldens 0 byte-diff and suite green.
- **WASM committed:** `public/wasm/npo_wasm_bg.wasm` (30,606 B) + `npo_wasm.js` — rebuild only on `wasm/src` change; verify `wasmKernelParity` tests.
- **SW versioning:** Bump `VERSION` on any precache change. `-v2` filenames never reused.
- **Static-only:** No server PDF processing; no upload except optional feedback; SW caches static only — no user data.
- **No secrets** in code/docs/commits.
- **Slug stability:** `TOOL_REGISTRY.slug` is URL contract — rename = breaking change (needs redirect + major version).
- **SEO uniqueness:** Every tool needs distinct `seoTitle`/`seoDescription` — crawlers penalize duplicates.
- **Conventional commits:** `feat:` `fix:` `docs:` `chore:` `perf:` `test:` `refactor:` — one logical change per commit.

## 10. Configuration (.env)

Copy `.env.example` → `.env.local`:

| Variable | Req | Description |
|---|---|---|
| `NEXT_PUBLIC_FEEDBACK_URL` | No | GAS web app URL (see `GOOGLE_APPS_SCRIPT.md`) |
| `NEXT_PUBLIC_BASE_PATH` | No | Base path — opt-in only, never inferred |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical URL — auto `VERCEL_PROJECT_PRODUCTION_URL` on Vercel; set explicitly for custom domain |
| `NEXT_PUBLIC_GSC_VERIFICATION` | No | GSC token — renders `google-site-verification` meta only when set |
| `NEXT_PUBLIC_OG_CDN_BASE` | No | OG card base — default `https://cdn.jsdelivr.net/gh/juyel-dev/image@main`. Push PNG there → purge `purge.jsdelivr.net` → rescrape FB debugger |
| `NEXT_PUBLIC_OG_PROJECT_SLUG` | No | `print-optimizer` |

**OG cards:** Static PNGs `print-optimizer/og/<slug>.png` + `home.png` (1200×630) in `juyel-dev/image` repo. Contract frozen by `tests/unit/siteContract.test.ts`. Verify: `npm run check:og`.

## 11. Release flow (fork → production)

1. Feature branch in fork → commit (conventional) → push fork.
2. Run §4 gate (`tsc`, `lint`, `test`, `build`, optional smoke).
3. PR: `gh pr create -R juyel-dev/Notes-Print-Optimizer --base main --head juyel-dev-s-org:main` (or feature branch).
4. Wait `mergeStateStatus === CLEAN` (`ci`+`lighthouse`+`budget` green).
5. Merge: `gh pr merge -R juyel-dev/Notes-Print-Optimizer --merge --delete-branch=false`
6. Confirm Vercel production deploy green → verify live URLs (tools + offline).

---

## Acknowledgments

PDF.js (Mozilla), pdf-lib, Next.js, Tailwind CSS, Rust + wasm-pack. Icons: `icon-master.png` → `-v2` via `scripts/apply-icon-art.mjs`.
