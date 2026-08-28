## Summary

- **What**: one-line description (include affected `lib/tools/registry.ts:id` if tool change)
- **Why**: problem / requirement this resolves
- **Evidence**: measured numbers (paired A/B) or verification performed — do not leave blank

## Type of Change

- [ ] Bug fix (non-breaking, user-visible)
- [ ] New feature (non-breaking, e.g. new `TOOL_REGISTRY` entry)
- [ ] Breaking change (slug rename, URL, SW precache — justify + migration)
- [ ] Documentation update (no behavior change)
- [ ] Performance improvement (attach before/after `npm run test:bench` or `?bench=1` numbers)

## Scope

Files touched (paths), and whether behavior/outputs changed for end users.

Tool impact (if any):

- [ ] `lib/tools/registry.ts` (new/changed tool — list `id`/`slug`/`category`)
- [ ] `public/sw.js` (`TOOL_ROUTES` / `VERSION` bump)
- [ ] `app/layout.tsx` / `lib/site.ts` (SEO / OG / CSP / SITE_URL)
- [ ] `public/content/*.md` (human docs)
- [ ] `wasm/src/` (kernel change — parity tests + golden check required)

## Verification (agent gate — run ALL, check each)

- [ ] `npx tsc --noEmit` — exit 0
- [ ] `npm run lint` — clean (warn-only rules allowed: `no-img-element`, `no-unused-vars ^_`)
- [ ] `npm run test` — **ALL green** (no hardcoded count — at 2026-08-28: 434 tests / 41 files via `vitest run`)
- [ ] `npm run build` — succeeds → `out/` with `20/20 static` `2/2 export` (trailingSlash)
- [ ] If kernels/engine/fixtures touched: goldens 0 byte-diff (`tests/fixtures/pdf/pdfGoldens.json`) — `PDF_UPDATE_GOLDENS=1` only with justification
- [ ] If tool registry touched: `getAllToolSlugs().length === public/sw.js TOOL_ROUTES.length` (`tests/unit/siteContract.test.ts` green), `seoTitle`/`seoDescription` unique, no alias collision, `labelMap` in `ToolsBox.tsx` covers category
- [ ] `npm run check:og` if OG cards changed (1200×630, content-type, size caps)
- [ ] Tested on mobile viewport (Playwright smoke: 0 console errors, no horizontal overflow, font loaded)
- [ ] SW/icon changes: `VERSION` bumped in `public/sw.js` if precache changed; icon renames are cache-busted (`-v2`)
- [ ] Changelog entry added (`CHANGELOG.md` + `public/content/CHANGELOG.md` if user-visible)
- [ ] Docs updated if behavior/config changed (`README.md §5` Tool Contract, `SECURITY.md` if network, `GOOGLE_APPS_SCRIPT.md` if relay)

## Lighthouse & Budget (CI will check)

- [ ] `lighthouserc.json`: `performance error 0.95`, `accessibility warn 0.90`, `best-practices error 0.95`, `seo error 0.95` — resource caps ok
- [ ] `budget` job: 12 URLs (`/` + 12× `/tools/<slug>/`) — `performance 70 / accessibility 90 / best-practices 95 / seo 95`

## Notes for Reviewer

Anything reviewer must know: env vars (`NEXT_PUBLIC_*`), base-path implications, deploy ordering (this PR goes `fork → production` via `gh pr merge --merge`).

Related issue: `Fixes #...` (if applicable)
