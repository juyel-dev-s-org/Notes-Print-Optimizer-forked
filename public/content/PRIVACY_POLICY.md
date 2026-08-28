# Privacy Policy

*Last updated: 2026-08-28*

Your privacy is the foundation of Print Optimizer. This policy explains what data is handled and how — for **all 12 tools**.

## 1. Local-first processing

Print Optimizer processes your files **entirely on your device** using your browser.

- **PDF tools** (Dark Notes → Print, Enhance, Protect, Merge, Split, N-up, PDF ↔ Images): PDFs and images are rendered via PDF.js + pdf-lib in Web Workers — never uploaded.
- **Security tools** (Protect PDF, Password Generator): AES-256 encryption and `crypto.getRandomValues` run locally.
- **Utility** (QR Studio): QR generation (`qrcode` + styling) and scanning (camera/image/paste via `html5-qrcode`) run locally — camera frames never leave your device.
- **Text tools** (Word Counter, Case Converter): string transforms run locally.

Your files are **not uploaded** to any server, and no copy is stored remotely. The app works **offline** as a PWA (`sw.js v37` caches 12 tool routes + assets).

## 2. Data we do not collect

- We do **not** collect your files, documents, images, or their contents.
- We do **not** require an account, name, or email to use the app.
- We do **not** use third-party analytics or advertising trackers.
- We do **not** receive QR camera frames, generated passwords, or text you paste for counting — all stay in memory.

## 3. Data stored on your device

To make the app work, small amounts of data may be stored locally in your browser:

- **IndexedDB / Cache Storage** — temporary page data and cached assets so processing can resume and the app can load offline.
- **Service Worker** — caches the app shell and 12 tool routes for offline use.
- **LocalStorage** — theme preference `po:theme` (dark `#020617` vs light `#f4f6fb`) and recent tool state (ephemeral).

This data stays on your device. Remove it anytime via **Menu → Privacy → Clear Cache**, or via browser *Clear site data*.

## 4. Feedback (optional, opt-in only)

If you choose **Send Feedback** (menu), the rating, category, message, and optional diagnostics you enter are sent to a Google Apps Script endpoint so the developer can read it (forwarded to a Telegram bot). Feedback is **optional and only sent when you tap Submit**. Do not include sensitive personal information. See `GOOGLE_APPS_SCRIPT.md` for relay hardening (endpoint whitelist, 15 req/60s, server-controlled destination).

Rate limit, size caps (25 MB request / 15 MB attachment), and `chat_id` override are enforced server-side.

## 5. External links & CDN

- The menu may link to external services (GitHub `juyel-dev/Notes-Print-Optimizer`, Telegram `t.me/PrintOptimizer_chat`) — those have their own privacy policies.
- Social share cards (`og:image`) are static PNGs served by `cdn.jsdelivr.net/gh/juyel-dev/image@main/print-optimizer/og/*` — they are **not** your files, just pre-made card images (1200×630). No PDF is ever sent there.

## 6. Children's privacy

The app does not knowingly collect personal data from anyone, including children.

## 7. Changes

This policy may be updated. The latest version is always available here in the app (**Menu → Privacy → Privacy Policy**). Major changes are noted in **What's New** and the **Changelog**.

## 8. Contact

Questions about privacy? Email [myself.juyel.dev@gmail.com](mailto:myself.juyel.dev@gmail.com) — see also **About** for repository link.
