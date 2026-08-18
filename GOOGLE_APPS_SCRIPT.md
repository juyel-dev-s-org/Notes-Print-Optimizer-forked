# Google Apps Script Telegram Relay — Setup Guide (Agent)

> **AGENT-ONLY DOCUMENT.** Instructions for setting up the feedback relay
> (Google Apps Script → Telegram). Follow the steps exactly; the
> authoritative code lives in the repo — never paste anything from memory.

## 1. What this is

A lightweight Google Apps Script (GAS) web app that receives feedback
submissions from the app and forwards them to a Telegram bot. It contains
ZERO application logic: formatting, diagnostics, and PDF attachments are
computed client-side in the web app; the relay only validates and forwards.

## 2. Setup steps

### Step 1 — Create the project

1. Open https://script.google.com/
2. **+ New project** → name it `PW Notes Feedback Relay`.

### Step 2 — Paste the authoritative code

The hardened template is the exported constant `GOOGLE_APPS_SCRIPT_CODE` in
**`lib/feedback/gasScriptTemplate.ts`**. Open that file, copy the template
string verbatim, and replace the entire content of `Code.gs`.

Hardening guarantees baked into the template:

| Guarantee | Detail |
|---|---|
| Server-controlled `chat_id` | Any client-supplied `chat_id` is stripped and replaced with `TELEGRAM_CHAT_ID` — a public web app URL can never message other chats |
| Endpoint whitelist | Only `sendMessage` and `sendDocument` are relayed |
| Size caps | Request bodies ≤ 25 MB; decoded attachments ≤ 15 MB |
| Rate limiting | Rolling-window limiter: 15 requests / 60 s, human pacing, backed by `CacheService` |

### Step 3 — Set bot token & chat ID

Either edit `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` directly in `Code.gs`,
or use Project Settings (⚙️) → **Script Properties**:

- `TELEGRAM_BOT_TOKEN`: `123456789:ABCdefGHIjklMNOpqrsTUVwxyZ`
- `TELEGRAM_CHAT_ID`: `987654321`

### Step 4 — Deploy as web app

1. **Deploy** → **New deployment**
2. **Select type (⚙️)** → **Web app**
3. **Execute as**: `Me`
4. **Who has access**: `Anyone`
5. **Deploy**, authorize when prompted, copy the **Web App URL**.

### Step 5 — Wire the app

Set the web app URL as `NEXT_PUBLIC_FEEDBACK_URL` in the app's environment
(see README §7 Configuration), or add it to `lib/config`.

## 3. Privacy & architecture principles

1. **Lightweight relay**: the script holds zero application-specific logic.
2. **Client-side formatting**: markdown, versioning, system diagnostics,
   and PDF attachment handling are computed in the web app.
3. **Privacy first**: diagnostic telemetry and PDF attachments are strictly
   optional (user checkboxes, disabled by default); original filenames are
   hashed before display.
4. **Server-enforced destination**: relay always sends to the configured
   owner chat; client-supplied `chat_id` values are ignored.
5. **Rate-limited**: bursts and automation are rejected by the rolling-window
   limiter.

## 4. Agent checks after editing the template

- The constant must remain a single exported string in
  `lib/feedback/gasScriptTemplate.ts`.
- The string must include the hardening blocks listed above — do not strip
  the whitelist, size caps, rate limiter, or `chat_id` override.
- Run the feedback unit tests (`npm run test` — feedback module) after any
  template change.