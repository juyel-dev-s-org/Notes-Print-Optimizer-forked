# Security Policy — Agent Document

> **AGENT-ONLY DOCUMENT.** Written for AI coding agents and maintainers.
> Follow the reporting flow below when a vulnerability is discovered.

## 1. Supported versions

| Version | Supported |
|---|---|
| 1.x.x | Yes |

## 2. Reporting a vulnerability (agent rules)

- **NEVER open a public issue** for a security vulnerability.
- Report via the private advisory flow:
  `https://github.com/juyel-dev/Notes-Print-Optimizer/security/advisories/new`
- Include: detailed description, repro steps, affected component, impact.
- Expected SLA: acknowledgment ≤ 48 h; fix/mitigation plan ≤ 7 days;
  credit in release notes unless anonymity requested.

## 3. Threat model (static, client-side app)

The application runs entirely in the browser. Security invariants:

| # | Invariant |
|---|---|
| 1 | No server-side processing of user PDFs — nothing leaves the device |
| 2 | No user data uploaded to any server except optional feedback (opt-in checkbox, disabled by default) |
| 3 | All PDF processing is local: WebAssembly + Web Workers + IndexedDB |
| 4 | Service worker caches static assets only — never user data |
| 5 | Feedback relay (Google Apps Script) is endpoint-whitelisted, rate-limited, and forces server-controlled `chat_id` — client-supplied values are stripped |

## 4. Agent constraints

- Do not add telemetry or upload code paths without review (violates #2).
- Do not expand the service worker precache to dynamic/user content.
- Keep the GAS relay template (`lib/feedback/gasScriptTemplate.ts`) in sync
  with the hardening guarantees in `GOOGLE_APPS_SCRIPT.md`.
- CI runs `npm audit` — resolve high/critical findings before merging.