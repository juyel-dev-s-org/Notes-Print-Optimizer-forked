# Google Apps Script Telegram Relay — Setup Guide (Agent + Admin)

> **AGENT-ONLY DOCUMENT.** Setup for the **optional** feedback relay (GAS → Telegram). Authoritative code lives in repo — never paste from memory.

## 1. What this is

A lightweight GAS web app that receives **optional** feedback submissions (rating, category, message, optional diagnostics + PDF attachment) and forwards to a Telegram bot. It holds **zero** app logic: formatting, diagnostics, PDF handling are computed client-side; relay only validates and forwards.

Applies to all 12 tools — same feedback form (`lib/feedback/`) is reused from the hamburger menu.

## 2. Environment wiring

| App env | Value | Where |
|---|---|---|
| `NEXT_PUBLIC_FEEDBACK_URL` | GAS Web App URL (from §3 Step 5) | `.env.local` or `lib/config` |
| `lib/site.ts` | `VERCEL_PROJECT_PRODUCTION_URL` auto-detect for `SITE_URL` — feedback URL is independent, still set explicitly | `lib/site.ts:8` |

If `NEXT_PUBLIC_FEEDBACK_URL` is unset, **Send Feedback** is hidden — app still works 100% offline.

## 3. Setup steps (5)

### Step 1 — Create project

1. Open https://script.google.com/
2. **+ New project** → name `PW Notes Feedback Relay`.

### Step 2 — Paste authoritative code

Source of truth: **`lib/feedback/gasScriptTemplate.ts`** → exported `GOOGLE_APPS_SCRIPT_CODE`.

Open that file, copy the string verbatim, replace entire `Code.gs`.

Hardening guarantees baked in (do NOT strip):

| Guarantee | Detail |
|---|---|
| Server-controlled `chat_id` | Any client-supplied `chat_id` stripped → replaced with `TELEGRAM_CHAT_ID` — public URL cannot message other chats |
| Endpoint whitelist | Only `sendMessage` and `sendDocument` relayed |
| Size caps | Request bodies ≤ 25 MB; decoded attachments ≤ 15 MB |
| Rate limiting | Rolling-window: 15 requests / 60 s, human pacing, `CacheService` backed |

### Step 3 — Set bot token & chat ID

Edit `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` in `Code.gs`, or Project Settings (⚙️) → **Script Properties**:

- `TELEGRAM_BOT_TOKEN`: `123456789:ABCdefGHIjklMNOpqrsTUVwxyZ`
- `TELEGRAM_CHAT_ID`: `987654321`

### Step 4 — Deploy as web app

1. **Deploy** → **New deployment**
2. **Select type (⚙️)** → **Web app**
3. **Execute as**: `Me`
4. **Who has access**: `Anyone`
5. **Deploy** → authorize → copy **Web App URL**.

### Step 5 — Wire the app

Set Web App URL as `NEXT_PUBLIC_FEEDBACK_URL` (see `README.md §10`). For Vercel: Project Settings → Environment Variables → add → redeploy. Locally: `.env.local` → `npm run dev`.

Test: Submit feedback in app (with diagnostics checkbox) → check Telegram chat receives markdown + attachment (if any).

## 4. Privacy & architecture principles

1. **Lightweight relay:** zero app-specific logic.
2. **Client-side formatting:** markdown, versioning, `systemDiagnostics.ts` (browser/OS/PWA/PDF pages) computed in web app.
3. **Privacy first:** diagnostics + PDF attachments strictly optional (user checkboxes, disabled by default); original filenames hashed before display (`GOOGLE_APPS_SCRIPT.md` privacy §3).
4. **Server-enforced destination:** relay always sends to configured owner chat; client `chat_id` ignored.
5. **Rate-limited:** bursts/automation rejected.

## 5. Agent checks after editing template

- Constant must remain single exported string in `lib/feedback/gasScriptTemplate.ts`.
- Must include hardening blocks above — do not strip whitelist, caps, limiter, or `chat_id` override.
- Run `npm run test` (feedback module: `tests/unit/siteContract`, feedback loader) after change — must stay green.
- Keep `SECURITY.md §3 #5` in sync with any change here.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Feedback button not shown | `NEXT_PUBLIC_FEEDBACK_URL` not set or empty |
| 401 / auth error | Redeploy GAS as `Anyone`, re-copy URL |
| No Telegram message | Check `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, bot is admin in chat |
| Rate-limited (429) | Wait 60s — limiter is intentional |
