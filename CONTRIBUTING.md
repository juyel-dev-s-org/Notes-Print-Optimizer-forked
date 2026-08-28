# Contributing — Agent Workflow

> **AGENT-ONLY DOCUMENT.** For AI coding agents. Follow verbatim. Do not show to end users. Human overview: `README.md §2`.

## 1. Repository roles (non-negotiable)

| Repo | Role | Branch |
|---|---|---|
| `juyel-dev/Notes-Print-Optimizer` | **Production** (live users) | `main` (protected — `ci` strict, admins enforced) |
| `juyel-dev-s-org/Notes-Print-Optimizer-forked` | **Development / preview** | `main` + feature branches |

Rules:

1. All work in **fork** — commits, experiments, fixes.
2. **Production `main` never direct-pushed.** Only via merged PR `fork:main → prod:main`.
3. Every push to fork `main` auto-deploys Vercel preview (see PR comment). Production URL: `https://print-optimizer.vercel.app/` (Vercel git integration).
4. `develop` branch exists historically — **do NOT use**.
5. Base path is opt-in (`NEXT_PUBLIC_BASE_PATH`) — never inferred.

## 2. Day-to-day flow (agent checklist)

1. Branch in fork for non-trivial work: `git checkout -b feat/<name>` or `fix/<name>`.
2. **Gate before commit** (see `README.md §4`):
   ```
   npx tsc --noEmit
   npm run lint
   npm run test        # ALL green — no hardcoded count (434 at 2026-08-28)
   npm run build       # must produce out/ 20/20 static 2/2 export
   ```
3. Commit conventional (`feat:` `fix:` `perf:` `docs:` `chore:` `test:` `refactor:`) — one logical change per commit. Push to fork.
4. Verify preview on desktop + mobile: 0 console errors, no horizontal overflow, font loaded (`tests/smoke` criteria).
5. PR: `gh pr create -R juyel-dev/Notes-Print-Optimizer --base main --head juyel-dev-s-org:main` (or feature branch). Fill template in `.github/PULL_REQUEST_TEMPLATE.md`.
6. Wait for `ci` + `lighthouse` + `budget` green (`mergeStateStatus CLEAN`) → merge:
   `gh pr merge -R juyel-dev/Notes-Print-Optimizer --merge --delete-branch=false` (docs-only may use `--rebase`).
7. Confirm production Vercel deploy green → verify live URLs (`/`, `/tools/<slug>/`, `/offline/`).

## 3. Local setup

```bash
git clone https://github.com/juyel-dev-s-org/Notes-Print-Optimizer-forked.git
cd Notes-Print-Optimizer-forked
npm ci
npm run dev      # http://localhost:3000
# serve export:
npm run build && npx serve out -l 4180 --no-clipboard
```

Node 20+ (`.nvmrc`), npm 10+. Rust only for `npm run build:wasm`.

## 4. Code guidelines

- **TS strict** — do not loosen. No `any` without justification (see `eslint.config.mjs` warn).
- Functional React + hooks; small focused components.
- **Tailwind v4** only — no inline styles, no CSS modules.
- Follow existing folder structure (`README.md §7`):

| What | Where | Notes |
|---|---|---|
| New tool definition | `lib/tools/registry.ts` | single source — see `README.md §5` |
| Search / category logic | `lib/tools/search.ts` + `lib/tools/registry.ts:getToolCategories` | |
| Tool card UI | `components/tools/ToolsBox.tsx`, `ToolCard.tsx` | `labelMap` must cover all 5 categories |
| Tool view (per tool) | `components/<tool>/` (e.g. `nup/`, `qrgen/`, `protect/`) | |
| Image kernels | `lib/kernels/` (JS) or `wasm/src/` (Rust) | keep parity tests green |
| Pipeline plugins | `lib/plugins/` / `lib/pipeline/` | |
| Business logic | `lib/services/` | |
| Workers | `lib/workers/` (`pixel.worker.ts`, `compose.worker.ts`, `pool.ts`, `protocol.ts`) | |
| Shared UI hooks | `lib/ui/` (`useDialogFocus`) | |
| PWA hooks | `lib/pwa/` | |
| Menu / content | `lib/menu/` + `public/content/*.md` | human-friendly markdown |
| SEO / site | `lib/site.ts`, `app/layout.tsx`, `app/sitemap.ts` | never hardcode domain |

**Adding a tool — mandatory checklist (atomic):**

- [ ] `TOOL_REGISTRY` entry with unique `seoTitle`/`seoDescription`, alias, keywords, gradient `emerald/teal` family
- [ ] `public/sw.js:TOOL_ROUTES` + `VERSION` bump (`v37` → `v38`…)
- [ ] `CATEGORY_ORDER` / `ToolsBox.tsx:labelMap` if new category
- [ ] OG card `print-optimizer/og/<slug>.png` 1200×630 in `juyel-dev/image`
- [ ] `tests/unit/siteContract.test.ts` passes (frozen names)
- [ ] Human docs: `public/content/ABOUT.md`, `FAQ.md`, `USER_GUIDE.md`, `WHATS_NEW.md`, root `CHANGELOG.md`

## 5. Testing layout

| Suite | Location | Command |
|---|---|---|
| Unit | `tests/unit/` (26 suites) | `npm run test` |
| Integration | `tests/integration/` | |
| Stress | `tests/stress/` | |
| Benchmarks | `tests/benchmarks/` (`BASELINE.md`, `ENGINEERING_ASSESSMENT.md`) | `npm run test:bench` |
| E2E smoke | `tests/smoke/` (Playwright) | `npm run test:smoke` |
| Fixtures + goldens | `tests/fixtures/pdf/` (`pdfGoldens.json` byte-exact) | `fixtures:gen`, `PDF_UPDATE_GOLDENS=1` |

All PRs must pass `npm run test` **all green** and `npm run build`.

## 6. Commit conventions

- `feat:` new feature (tool, capability)
- `fix:` bug fix
- `docs:` documentation (no behavior change)
- `chore:` maintenance, deps, CI
- `perf:` performance (attach paired A/B numbers)
- `test:` tests
- `refactor:` refactoring (no behavior change)

Keep one logical change per commit. Never mix.

## 7. Hard constraints (blocking)

- **Never push to production directly** — PR only.
- **Never regen goldens** without `PDF_UPDATE_GOLDENS=1` + justification; goldens are byte-exact acceptance.
- **Never commit secrets** (tokens, private URLs).
- **Never reuse PWA icon filenames** — `-v2` cache-busted, always generate via `scripts/apply-icon-art.mjs`.
- **Never change engine default** (`pw-pixel-v2` sequential) without paired A/B on real fixtures (`ENGINEERING_ASSESSMENT.md §8` — V1 2.4× slower / 11× mem).
- **Static-only invariant:** no server PDF processing (`SECURITY.md`).
- **Never edit `out/`** — build output.
- **Always bump `public/sw.js:VERSION`** when precache changes.
- **Never rename `TOOL_REGISTRY.slug`** without major-version + redirect plan.

## 8. Reporting issues

- File on production tracker (`juyel-dev/Notes-Print-Optimizer` — fork has issues disabled).
- Use `.github/ISSUE_TEMPLATE/bug_report.md` — fill `Tool` field among 12.
- Include browser, OS, device, PDF pages, expected vs actual, console verbatim, minimal repro PDF if small.

## 9. License

Contributions licensed under JSL v1.0. See `LICENSE` and `public/content/JSL_LICENSE.md`.
