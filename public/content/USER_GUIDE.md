# User Guide — Print Optimizer (12 Tools)

This guide covers **every tool**. Tip: use the **search box** at the top — type *merge*, *qr*, *password*, *n-up*, *dark slides* — and the app will surface the right tool.

---

## Quick start — pick a tool

1. On the landing page you see **12 cards** grouped by category: **PDF Tools · Image Tools · Security Tools · Utility Tools · Text Tools**.
2. Use **Search** (`PYQ, dark slides, handwritten, image to pdf…`) or tap a **category chip** (`All / PDF Tools / Image Tools / Security Tools / Utility Tools / Text Tools`) to filter.
3. Tap a card → you go to `/tools/<slug>/` (e.g. `/tools/n-up/`, `/tools/qr-generator/`). Each tool is deep-linkable and works offline.

---

## PDF Tools — for notes & printing

### 1) Dark Notes → Print (for dark-background slides)

1. **Upload & Merge** — Tap *Select PDF Files* or drag PDFs. Add many — they merge in shown order. Use **Smart Arrange** for series (`Calculus 1..13`) or drag to reorder.
2. **Optimize** — Choose preset or fine-tune **Sharpen / Contrast / Denoise / Background whitening**. Preview one page → *Re-process* single or all. Exclude pages you don't want. Optional: **Manual Whitebox** — draw/ drag boxes (`Drag on the page…` ribbon).
3. **Layout** — Pick grid `1/2/4/6/8/10-up` (and later N-up tool for `9-up`), paper size/orientation, margins, borders/page numbers. Apply.
4. **Export** — Download print-ready PDF. Tip: print double-sided for max saving.

### 2) Enhance Light PDF (for faint scans)

1. Upload light-background / faint handwritten or scanned PDFs.
2. Tune **Darken / Contrast / Sharpen** sliders + toggles *Clean Background / Grayscale*. Use the **Before/After slider** (hold to compare) to check each page.
3. Export. The original dark→print flow is untouched — this is a separate path.

### 3) Merge PDF

1. Drop **up to 10 PDFs**.
2. Drag to order or tap **Smart Arrange**.
3. Set custom filename → **Merge** → Download one combined PDF.

### 4) Split PDF

1. Upload one PDF.
2. Choose **Extract range** (e.g. pages `3–10` → one PDF) or **Burst every N** (e.g. every `5` pages → ZIP).
3. Download.

### 5) N-up PDF (put many pages on one sheet)

1. Upload **one or many PDFs** — many are auto-merged first.
2. Pick **pages per sheet**: `1 / 2 / 4 / 6 / 9` (Note: `8-up` lives in Dark Notes → Print; N-up tool uses `9-up` as max), **A4/Letter**, **Portrait/Landscape**.
3. Use the **live preview** (top→bottom) to see grid.
4. **Export** print-ready N-up PDF.

---

## Image Tools

### 6) PDF to Images

1. Upload PDF → pick format **JPG / PNG / WebP** + **DPI** (up to 300).
2. Preview each page.
3. **Export ZIP** — one tidy ZIP.

### 7) Image to PDF

1. Add photos/screenshots (**JPG/PNG/WebP**).
2. Drag to reorder.
3. Choose **Fit to image** or **A4 pages**.
4. **Create PDF** → download.

---

## Security Tools

### 8) Protect PDF (AES-256)

1. Upload PDF → set **Open password** (required to open).
2. Optional: lock **Printing / Copying / Editing**.
3. **Protect** → download encrypted PDF. Fully on-device (no upload).

### 9) Password Generator

1. Pick **length 8–64** + character sets: letters, numbers, symbols.
2. Tap **Generate** (crypto-random via `crypto.getRandomValues`) → **Copy** or **Bulk generate**.
3. Paste where needed — nothing is stored.

---

## Utility Tools

### 10) QR Studio (Generate + Scan, 100% offline)

**Generate:**
1. Choose type: Link / Text / Wi-Fi / Contact.
2. Type content → pick style: dot shape, gradient, optional logo.
3. Download **PNG / SVG**.

**Scan:**
- **Camera** — point camera at QR.
- **Image** — upload an image containing QR.
- **Paste** — paste from clipboard.
All scanning is local — no upload.

---

## Text Tools

### 11) Word Counter

Paste or type — see **words, characters (with/without spaces), sentences, paragraphs, reading & speaking time**, plus **top keywords** live.

### 12) Case Converter

Paste text → tap **UPPERCASE / lowercase / Title Case / Sentence case / camelCase / PascalCase / snake_case / kebab-case / alternating / inverse** → **Copy** one tap. Live convert.

---

## Tips for best results

- **Dark slides** give biggest ink saving — use **Dark Notes → Print** with `4-Up (2×2)` as daily default.
- **Dense formula sheets:** 6-Up or 9-Up.
- **Diagrams / circuits:** 2-Up to keep detail.
- **Faint scans:** use **Enhance Light PDF**, not Dark Notes.
- **Large PDFs (100+ pages):** keep tab active, close other tabs, use AC power, and let V2 engine (default, memory-safe) finish.
- **Share:** after export most tools show **Share** (Web Share API) with copy-link fallback.

---

## Offline, privacy & help

- **Offline:** after first load, all 12 tools work offline (PWA, `sw.js v37`). Look for *Install* in the menu for Add to Home Screen.
- **Privacy:** no upload — see **Privacy Policy**. Clear local data via **Menu → Privacy → Clear Cache**.
- **Help:** **FAQ** in the menu, or contact [myself.juyel.dev@gmail.com](mailto:myself.juyel.dev@gmail.com) / [Telegram](https://t.me/PrintOptimizer_chat).
