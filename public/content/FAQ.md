# Frequently Asked Questions

## General

**Does this app upload my files?**
No. All 12 tools run **100% on your device** (browser + WASM). Your PDFs and images never leave your device — except optional feedback you choose to send.

**Do I need an account?**
No. Free, no sign-up. Open and use.

**Which file types are supported?**
PDFs for all PDF tools; JPG/PNG/WebP for `Image to PDF` and `PDF to Images`; text for word/case tools; camera/image for QR scan.

**Does it work offline?**
Yes. After first load it is a Progressive Web App. All 12 tools work offline (precached `sw.js v37`).

---

## Print & PDF — Dark Notes, Enhance, N-up, Merge, Split

**Which tool for dark lecture slides?**
Use **Dark Notes → Print** — it removes dark backgrounds (auto-whitening + banner removal), sharpens ink, and lets you choose N-up. Use **Enhance Light PDF** only for faint/ washed-out light scans.

**Why do slides look washed out after processing?**
Dark-removal saves ink by design. In **Dark Notes → Print → Optimize**, increase **Contrast / Sharpen**, or add Manual Whitebox, then Re-process.

**How much ink & paper can I save?**
Typically **70–85% ink** and **up to 75% paper with 4-Up**, up to ~90% with 9-Up — depends on slides. The app reports estimated savings per job.

**Can I reorder or remove pages?**
Yes. In **Upload**: drag to reorder files / remove a file. In **Optimize**: exclude pages. In **Merge**: drag files, use **Smart Arrange** for series. In **Split**: pick page range or burst every N.

**What is Smart Arrange?**
It detects related series like *Calculus 1..13 Class Notes* (numbers, ordinals `2nd`, Roman `I, II`, zero-padding) and orders them naturally — one tap.

**What N-up options exist?**
`1, 2, 4, 6, 9` pages per sheet (A4/Letter, portrait/landscape). `N-up PDF` tool auto-merges multiple PDFs first. For dense formula try 6/9-Up; for diagrams use 2-Up.

**How do I use Merge / Split / Image ↔ PDF?**

- **Merge PDF:** drop up to 10 PDFs → drag to order / Smart Arrange → set filename → Merge → download.
- **Split PDF:** upload one PDF → choose *Extract range* (e.g. 3–10) or *Burst every N* → download or ZIP.
- **PDF to Images:** upload PDF → pick format (JPG/PNG/WebP) + DPI (up to 300) → preview → export ZIP.
- **Image to PDF:** add JPG/PNG/WebP photos → drag to reorder → choose *Fit* or *A4* → Create PDF.

---

## Security — Protect PDF & Password Generator

**How do I password-protect a PDF?**
Open **Protect PDF** → upload → set **Open password** (AES-256) and optional **Print/Copy/Edit locks** → Protect → download. Fully on-device (pdf-lib).

**Is the generated password secure?**
Yes. **Password Generator** uses browser `crypto.getRandomValues` (crypto-grade), not `Math.random`. Pick length 8–64, letters/numbers/symbols, bulk generate, one-tap copy.

---

## QR Studio

**Can I both generate and scan?**
Yes — **QR Studio** does both offline. *Generate*: type link/text/Wi-Fi/contact → pick style (dots, gradient, logo) → download PNG/SVG. *Scan*: **Camera**, **Image**, or **Paste**.

**Does camera upload my QR?**
No. Scan runs locally via `html5-qrcode` — frames never leave your device.

---

## Text — Word Counter & Case Converter

**What does Word Counter show?**
Live **words, characters (with/without spaces), sentences, paragraphs, reading & speaking time**, plus top keywords — as you type, offline.

**What cases are supported?**
`UPPERCASE`, `lowercase`, `Title Case`, `Sentence case`, `camelCase`, `PascalCase`, `snake_case`, `kebab-case`, plus alternating/inverse — one-tap copy.

---

## Privacy, sharing & troubleshooting

**Is my data safe with 12 tools?**
Yes — same guarantee for every tool: no upload, no tracker, no ad. Only **Send Feedback** (optional, opt-in) sends what you type to a Google Apps Script → Telegram relay (rate-limited 15/60s, server-controlled destination). See **Privacy Policy**.

**How do I report a bug for one of 12 tools?**
Use **Menu → Send Feedback** and pick the tool (or open GitHub → Issues → Bug Report). Include: tool name, steps, browser/OS/device, page count, console errors, and a small sample PDF if possible.

**The app feels slow on a 100-page PDF?**
On large files: keep tab active, use V2 engine (default, memory-safe), close other tabs, and use AC power. See **User Guide → Tips** for N-up paper savings.

**How can I contact the developer?**
Email [myself.juyel.dev@gmail.com](mailto:myself.juyel.dev@gmail.com) or [t.me/PrintOptimizer_chat](https://t.me/PrintOptimizer_chat).
