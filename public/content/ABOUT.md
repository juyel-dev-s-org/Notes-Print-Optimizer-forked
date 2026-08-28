# About Print Optimizer

**Print Optimizer** is your all-in-one, privacy-first toolkit for studies. Made for students — especially Physics Wallah, JEE, NEET, and class notes — but useful for anyone who works with PDFs, images, and documents.

No sign-up. No upload. Everything runs **100% on your device** — your files never leave your browser.

## 12 Tools, One App

Search at the top, or tap a category chip:

**PDF Tools** — `Dark Notes → Print`, `Enhance Light PDF`, `Merge PDF`, `Split PDF`, `N-up PDF`
**Image Tools** — `PDF to Images`, `Image to PDF`
**Security Tools** — `Protect PDF (AES-256)`, `Password Generator`
**Utility Tools** — `QR Studio (Generate + Scan)`
**Text Tools** — `Word Counter`, `Case Converter`

### The classics — print & study

- **Dark Notes → Print** — strips dark backgrounds from lecture slides so they print cleanly on white paper. Auto-whitening + banner removal + up to 10-up.
- **Enhance Light PDF** — fixes faint scans — darken light ink, boost contrast, sharpen handwriting so printouts stay readable.
- **N-up PDF** — put 2, 4, 6 or 9 pages on one sheet. Upload one or many PDFs (auto-merged) → pick `1/2/4/6/9-up`, A4/Letter, portrait/landscape.
- **Merge / Split** — combine many PDFs in your order (Smart Arrange detects `Calculus 1..13` series), or extract a page range / burst into parts.
- **PDF ↔ Images** — convert every PDF page to JPG/PNG/WebP (pick DPI, get a ZIP), or combine photos/screenshots into one PDF (Fit or A4, reorderable).

### Security & utility

- **Protect PDF** — add AES-256 open password, or lock printing/copying/editing — fully on-device.
- **Password Generator** — crypto-random (`crypto.getRandomValues`), 8–64 chars, symbols, bulk generate, one-tap copy.
- **QR Studio** — generate styled QR codes (dots, gradients, logo) and **scan** via camera, image, or paste — links, Wi-Fi, contacts — all offline.

### Text tools

- **Word Counter** — live words, characters, sentences, reading time + top keywords as you type.
- **Case Converter** — `UPPERCASE`, `lowercase`, `Title Case`, `camelCase`, `snake_case`, `kebab-case` and more — one tap.

### Why students love it

- **Save ink & paper** — typically 70–85% ink and up to 75% paper with 4-Up (up to 90% with 9-Up).
- **Smart Arrange** — related files like *Calculus 1..13 Class Notes* are detected and ordered naturally (numbers, ordinals, Roman numerals, zero-padding).
- **Before/After slider** — flip any page to see exactly what changed, then download the print-ready PDF.

## Privacy by design

- **Local-first.** Your PDFs are rendered, optimized, and saved in your browser (WASM + Web Workers). No server ever sees them.
- **No account.** No name, email, or tracking.
- **Offline.** Once loaded, the app works as a Progressive Web App — even without internet.
- **Clear Cache.** Remove local data anytime from the menu → *Privacy → Clear Cache*.

Only **optional feedback** (if you tap *Send Feedback*) is sent — and only what you type — via a Google Apps Script relay to Telegram. Nothing else leaves your device.

## Technology

- Next.js 15 + React 19 + TypeScript + Tailwind CSS
- PDF.js & pdf-lib for rendering and composition
- Rust → WebAssembly kernels for fast image processing
- Web Workers for smooth, non-blocking processing
- Installable PWA with offline caching (`sw.js v37`) — all 12 tools work offline

## Contact & community

- Email: [myself.juyel.dev@gmail.com](mailto:myself.juyel.dev@gmail.com)
- Telegram feedback: [t.me/PrintOptimizer_chat](https://t.me/PrintOptimizer_chat)
- Repository: [GitHub — juyel-dev/Notes-Print-Optimizer](https://github.com/juyel-dev/Notes-Print-Optimizer)
- Report a bug: **Menu → Send Feedback** (pick the tool among 12) or open a GitHub issue.

---

*Copyright (c) 2026 Juyel Hossain. Licensed under the Juyel Source License (JSL) v1.0 — free for personal, educational and research use. See **JSL License** in the Legal section.*
