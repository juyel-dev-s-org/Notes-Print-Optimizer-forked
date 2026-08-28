# AGENT.md — Prime Directive for AI Agents

> **Read this file FIRST on every session.** It is the 60-second brain-load for any AI touching this repo. For deep spec see `README.md`.

## 1. What you are building

**Print Optimizer — 12-tool, 100% offline, static-export PWA.** No server. All PDFs/images/QR/passwords processed on-device (WASM + Workers + pdf-lib + pdfjs). Deploy: static `out/` → Vercel.

## 2. The one rule that matters

**`lib/tools/registry.ts:TOOL_REGISTRY` is the single source of truth.** 12 tools, each with stable `slug` → `/tools/<slug>/`. Never hardcode a tool elsewhere.

Adding a tool = 7 atomic steps (see `README.md §5`):

1. `TOOL_REGISTRY` entry
2. `public/sw.js:TOOL_ROUTES` entry
3. `generateStaticParams` auto-works — no page needed
4. `CATEGORY_ORDER` + `ToolsBox.tsx:labelMap` if new category
5. OG card `juyel-dev/image:print-optimizer/og/<slug>.png`
6. `public/sw.js:VERSION++` (`v37` at HEAD)
7. Human docs: `public/content/*` + `CHANGELOG.md`

Renaming a `slug` is a **breaking URL change**.

## 3. Categories (5)

`ToolCategory = 'pdf'|'image'|'security'|'text'|'utility'` ordered `pdf > image > security > utility > text`.

- `pdf` (5): dark-print, enhance, merge, split, n-up
- `image` (2): pdf-to-images, image-to-pdf
- `security` (2): protect, password-gen
- `utility` (1): qr-gen
- `text` (2): word-count, case-convert

Label map lives in `components/tools/ToolsBox.tsx:108` — keep synced. Duplicate label bug fixed in `d999346` (was `Security Tools ×3`).

## 4. Branch & gate

- **Prod:** `juyel-dev/Notes-Print-Optimizer:main` (protected, `ci` required, strict)
- **Dev:** `juyel-dev-s-org/Notes-Print-Optimizer-forked:main` — all work here.
- **Gate before ANY push:**

```
npx tsc --noEmit && npm run lint && npm run test && npm run build
# then optionally: npx serve out -l 4180 && npm run test:smoke
```

Suite: Vitest 434 tests / 41 files + Playwright 22. Never hardcode `241` — old number. Gate is *all green*.

## 5. Theme & PWA

- **Theme:** Emerald/Mint/Teal/Cyan `#10B981/#6EE7B7/#14B8A6/#06B6D4` + glass. Violet removed — do NOT reintroduce.
- **Icons:** `public/icon-master.png` → `scripts/apply-icon-art.mjs` → `icon-*-v2.png` — never reuse name.
- **SW:** `public/sw.js v37` — precaches `/, /offline/, 12×/tools/<slug>/, icons, vendor/pdf*.mjs, wasm/*`. Bump `VERSION` on precache change.

## 6. What NOT to do

- Do not push to `juyel-dev:main` directly.
- Do not regen goldens without `PDF_UPDATE_GOLDENS=1` + justification (`tests/fixtures/pdf/pdfGoldens.json` byte-exact).
- Do not change engine default (`pw-pixel-v2` sequential is prod; V1 parallel 2.4× slower / 11× mem).
- Do not add network calls — `app/layout.tsx` CSP allows only `script.google.com` (feedback) + self/blob/data/wasm-unsafe-eval.
- Do not edit `out/`; do not commit secrets.

## 7. Fast file map

| Need | File |
|---|---|
| Add tool | `lib/tools/registry.ts` |
| Search / chips | `lib/tools/search.ts`, `components/tools/ToolsBox.tsx` |
| Offline / precache | `public/sw.js`, `app/manifest.ts` |
| SEO / site URL | `lib/site.ts`, `app/layout.tsx`, `app/sitemap.ts` |
| Dark-print kernels | `lib/kernels/whiteBox.ts`, `lib/optimizer/engine/v2/*` |
| N-up geometry | `lib/nup/nupLayout.ts` |
| QR / Protect / Merge / Split | `components/qrgen/`, `components/protect/`, `lib/tomerge/`, `lib/tosplit/` |
| State | `lib/workflow/workflowReducer.ts` |
| Tests | `tests/unit/siteContract.test.ts` (frozen names), `tests/smoke/*` |

## 8. Evidence discipline

Per `tests/benchmarks/BASELINE.md` + `ENGINEERING_ASSESSMENT.md`: AC power, `--workers=1`, paired A/B alternating, 0 byte-diff goldens. See `CONTRIBUTING.md` for commit convention.

**When stuck:** Read `README.md` full, `tests/benchmarks/ENGINEERING_ASSESSMENT.md` for perf decisions, `lib/site.ts` for URL logic.
