# Security Policy — Agent + Human Document

> **AGENT-ONLY + HUMAN.** Threat model for this **static, 100% on-device** app. Read before adding any network code.

## 1. Supported versions

| Version | Supported |
|---|---|
| 1.x.x | Yes (JSL v1.0) |

## 2. Reporting a vulnerability (agent rules)

- **NEVER open a public issue** for a security vulnerability.
- Report via private advisory: `https://github.com/juyel-dev/Notes-Print-Optimizer/security/advisories/new`
- Include: description, repro steps, affected component (`lib/tools/registry.ts:id`), impact, browser/OS.
- SLA: acknowledge ≤ 48h; fix/mitigation plan ≤ 7 days; credit in `CHANGELOG.md` unless anonymity requested.

## 3. Threat model — static, client-side, 12-tool suite

The app runs **entirely in the browser**. Zero server PDF processing. Static export `out/` → CDN.

| # | Invariant | Detail | Enforced by |
|---|---|---|---|
| 1 | No server PDF processing — nothing leaves device | All 12 tools (dark-print, enhance, protect AES-256, pdf-to-images, merge, split, image-to-pdf, password-gen, qr-gen, word-count, case-convert, n-up) run on-device via WASM + Workers + pdf-lib/pdfjs | `lib/optimizer`, `lib/nup`, `lib/protect`, `lib/tools/registry.ts` |
| 2 | No upload except **optional** feedback | Feedback is opt-in (checkbox, disabled by default). No telemetry, no analytics, no ads | `lib/feedback/gasClient.ts` |
| 3 | All processing local | WASM (`public/wasm/npo_wasm_bg.wasm`) + Web Workers + IndexedDB checkpoint — no `fetch` to external for tool logic | `lib/workers/pool.ts`, `wasm/src/` |
| 4 | SW caches **static assets only** — never user data | `public/sw.js` precaches `TOOL_ROUTES` + icons + vendor + wasm; user PDFs stay in memory/IndexedDB ephemeral | `public/sw.js:PRECACHE_URLS` |
| 5 | Feedback relay is hardened | Endpoint whitelist `sendMessage`/`sendDocument` only, size caps 25 MB req / 15 MB attachment, rolling-window 15 req/60s via `CacheService`, server-controlled `chat_id` (client value stripped) | `lib/feedback/gasScriptTemplate.ts` + `GOOGLE_APPS_SCRIPT.md` |
| 6 | CSP is minimal | `app/layout.tsx:meta http-equiv CSP` — `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' https://script.google.com; worker-src 'self' blob:` — no other connect target allowed | `app/layout.tsx` |
| 7 | OG images are **static CDN**, not app data | `lib/site.ts:OG_CDN_BASE = https://cdn.jsdelivr.net/gh/juyel-dev/image@main` — social cards never receive PDFs | `lib/site.ts`, `app/layout.tsx:ogImageUrl` |
| 8 | Crypto is browser-native | `password-gen` uses `crypto.getRandomValues` (not `Math.random`); `protect` uses pdf-lib AES-256; QR camera (`qr-gen`) processes frames locally, never uploads | `components/passwordgen/`, `lib/protect/`, `components/qrgen/` |

## 4. Per-tool data flow (for auditors & agents)

| Tool | Input | Leaves device? | Notes |
|---|---|---|---|
| dark-print, enhance, n-up, merge, split, to-images, to-pdf, protect | PDF / images you select | **No** | Rendered via pdfjs in Worker, composed via pdf-lib; `protect` encryption is in-memory |
| password-gen | length + charset | **No** | `crypto.getRandomValues` — see `tests/unit/protect.test.ts` for entropy |
| qr-gen (generate) | text/url/wifi/contact | **No** | `qrcode` + `qr-code-styling` local; logo overlay local |
| qr-gen (scan) | camera frame / image / clipboard | **No** | `html5-qrcode` local decode |
| word-count, case-convert | pasted text | **No** | pure string transform |

**Rule for agents:** Adding a tool that needs network → **must** update this file, `app/layout.tsx:CSP`, `SECURITY.md` review, and PR must include threat-model entry. No silent `fetch`.

## 5. Agent constraints

- Do not add telemetry or upload paths without explicit review (violates #2).
- Do not expand `public/sw.js:PRECACHE_URLS` to dynamic/user content.
- Keep `lib/feedback/gasScriptTemplate.ts` in sync with `GOOGLE_APPS_SCRIPT.md` hardening guarantees.
- Do not expand `connect-src` without updating this file and `app/layout.tsx`.
- CI runs `npm audit --omit=dev,optional` — resolve **high/critical** before merge (see `ci.yml`).

## 6. Contact

Security questions: `myself.juyel.dev@gmail.com` (see `public/content/ABOUT.md`). For non-security bugs use `.github/ISSUE_TEMPLATE/bug_report.md`.
