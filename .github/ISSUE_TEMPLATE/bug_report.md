---
name: Bug Report / Feature Request
about: Report a bug or request a feature (agent-filled or human-filled). Agents must fill every section with concrete facts.
title: ''
labels: ''
assignees: ''
---

> **For AI agents:** fill every section with concrete facts. Replace placeholders. Attach console errors verbatim and, for bugs, a minimal repro PDF if small. Do not leave "TBD" — unknown fields say "unknown". For tool-specific bugs, set **Tool** below.

## Type

- [ ] Bug
- [ ] Feature request
- [ ] Question / docs gap

## Tool (pick one of 12 — or "all / landing")

- [ ] Landing / ToolsBox / Search / Category chips
- [ ] dark-print (Dark Notes → Print)
- [ ] enhance (Enhance Light PDF)
- [ ] protect (Protect PDF — AES-256)
- [ ] to-images (PDF to Images — JPG/PNG/WebP)
- [ ] merge (Merge PDF)
- [ ] split (Split PDF)
- [ ] to-pdf (Image to PDF)
- [ ] password-gen (Password Generator)
- [ ] qr-gen (QR Studio — Generate + Scan)
- [ ] word-count (Word Counter)
- [ ] case-convert (Case Converter)
- [ ] nup (N-up PDF — 1/2/4/6/9 per sheet)
- [ ] PWA / offline / install
- [ ] Other: ___

## Description

Concrete description of the bug or feature.

- **For bugs:** what is broken, and which build/URL was used?
  - Production: `https://print-optimizer.vercel.app/` (or `https://print-optimizer.vercel.app/tools/<slug>/`)
  - Fork preview: check the Vercel preview comment on the PR (e.g. `https://notes-print-optimizer-*.vercel.app/`)
  - Local: `http://localhost:3000` or `npx serve out -l 4180`

## Steps to Reproduce (bugs — numbered)

1. Go to '...' (exact URL + viewport: desktop / tablet / mobile)
2. Upload '...' (file names, page count, file size, e.g. `mixed.pdf 4 pages 25 MB`)
3. Select tool / preset / layout '...' (e.g. `N-up 4-up A4 portrait`)
4. Click '...'
5. See error (screenshot + console verbatim)

## Expected Behavior

What **must** happen (functional requirement). Be specific: output file, page count, visual result.

## Actual Behavior

What actually happened. Include **verbatim** console errors and network status (DevTools → Console / Network).

```
paste console error here
```

## Environment

- Browser: [e.g. Chrome 126.0.6478.127, Safari 17.4, Firefox 128]
- OS: [e.g. Windows 11 23H2, macOS 14.5, Android 14, iOS 17.5]
- Device: [e.g. Desktop 1920×1080, Pixel 8, iPad Pro 12.9"]
- Installed as PWA: yes / no
- PDF pages (if applicable): [e.g. 45 pages, 3 files merged]
- App version: see footer `v37` or `__npoVersion` in console

## Regression Check

- Reproducible on fork preview build? yes / no / unknown
- Reproducible in fresh incognito (no SW cache)? yes / no
- First broken commit (if known): `git bisect` result or commit SHA (e.g. `d999346`)
- Last known good version: [e.g. 1.1.0, main@<sha>]

## Additional Context

Screenshots, sample PDFs (small files only — ≤ 15 MB), HAR/console logs, `window.__npoBenchmark()` output if perf issue.

> **Privacy:** Do not attach sensitive PDFs. Sample PDFs are processed locally — attaching here uploads to GitHub. Redact personal data.
