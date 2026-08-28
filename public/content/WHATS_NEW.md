# What's New

A quick look at the latest — **August 2026** is the big **12-tool** release.

---

## New — 12-Tool Suite (2026-08-28)

**Print Optimizer is now a full suite** — 12 tools in one offline PWA. Search at the top, or filter by `PDF / Image / Security / Utility / Text` chips.

**New tools:**

- **PDF to Images** — every page → JPG/PNG/WebP (up to 300 DPI) → ZIP.
- **Image to PDF** — photos → one PDF (Fit or A4, reorderable).
- **Merge PDF** — up to 10 files → Smart Arrange series → one file.
- **Split PDF** — extract range or burst every N → ZIP.
- **Protect PDF** — AES-256 open password + print/copy/edit locks — on-device.
- **Password Generator** — crypto-random `crypto.getRandomValues`, 8–64 chars, bulk.
- **QR Studio** — generate styled QR (dots, gradient, logo) + **scan** via camera / image / paste — offline.
- **Word Counter** — words, characters, sentences, reading time + top keywords, live.
- **Case Converter** — 11 formats (UPPER, lower, Title, camel, snake, kebab…), one-tap.
- **N-up PDF** — 1/2/4/6/9 pages per sheet, A4/Letter, portrait/landscape — auto-merge + live top→bottom preview.

All tools are deep-linkable (`/tools/<slug>/`), offline-cached (`sw.js v37`), and searchable.

### Premium landing — Emerald

Brand moved **Indigo/Violet → Emerald/Mint/Teal/Cyan** (`#10B981→#14B8A6→#06B6D4`) + liquid glass. New hero `Your Notes, Print-Ready` + trusted-students stats, ToolsBox `12 Free • No sign-up` + category chips `All · PDF Tools · Image Tools · Security Tools · Utility Tools · Text Tools` (dedupe fixed).

### N-up Live Preview & Order

- Preview now renders **top→bottom** (was bottom→top bug — fixed).
- Format order `8-up (2×4)` before `9-up (3×3)`.
- Download shows `order-delivered` illustration for done state.

### Footer Premium v2

Floating glass footer with **bow top + inverted corners**, emerald/cyan glow, red heart pulse, **HI/EN** (EN on), **LEGAL** → hamburger menu, **Contact** `mailto:myself.juyel.dev@gmail.com`, Community links `GitHub / Issues / Discussion→Telegram / Contributing`, social icons, and no-layout-shift phone rendering (`text-wrap:balance/pretty`).

### Polish you can feel

- White-box editor: 8 handles (corners + edges + center), move/drag/edge/keyboard nudge, English ribbon `Drag on the page…`.
- PageGrid: compact `h-8` pills `+N`, original thumbnail `1/5` toggle.
- ProcessingSettings: slate/indigo rotary knob, `Up to date` dirty-check, `h-9` Reset/Re-process.

---

## Previous — Smart PDF Rearrangement & Reliability (2026-08-18)

### Smart PDF Rearrangement

- **Automatic series detection** — `Basic Maths and Calculus 1..13` recognised and ordered naturally.
- **Natural sorting** — numbers, zero-padded, ordinals (`2nd, 3rd, 21st`), Roman numerals (`I, II, XIV`) all correct.
- **One-click Smart Arrange** — badge shows how many series found; tap to arrange.
- **Drag & drop** — reorder any time — arrow buttons remain as fallback.

### More Reliable & Faster Processing

- **Worker pool hardening** — hung workers retired and respawned with timeout.
- **Canvas reuse** — managed pool, less memory on large files.
- **Sharper Before/After** — full-quality "before" from merged PDF, cached in memory for instant flip.

### Settings & Information Center

- Hamburger menu → **Settings & Information Center** — Tools, Privacy, Community, Resources, Legal, Developer sections, config-driven (`lib/menu`).
- In-app docs (About, User Guide, FAQ, What's New, Changelog, Privacy, Terms, JSL, Copyright) from Markdown.
- **Clear Cache**, feedback modal, Telegram community/channel, contact.

### Licensing

- **JSL v1.0** — free for personal, educational, research use.

---

See the full [Changelog — juyel-dev/Notes-Print-Optimizer](https://github.com/juyel-dev/Notes-Print-Optimizer/blob/main/CHANGELOG.md) for every change, or the in-app **Changelog** in the menu.
