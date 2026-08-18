# Google Apps Script Telegram Relay Setup Guide

This guide describes how to set up your lightweight, production-ready Google Apps Script (GAS) to receive feedback submissions and forward them directly to your Telegram Bot.

---

## 🚀 Setup Steps (5 Minutes)

### Step 1: Create Google Apps Script Project
1. Open [Google Apps Script](https://script.google.com/).
2. Click **+ New project**.
3. Name your project **PW Notes Feedback Relay**.

### Step 2: Paste the Code
Replace the entire code in `Code.gs` with the **hardened** relay template.

The authoritative copy lives in `lib/feedback/gasScriptTemplate.ts` (exported as
`GOOGLE_APPS_SCRIPT_CODE`). Open that file, copy the template string, and paste it
into `Code.gs`. The template is hardened as follows:

- **`chat_id` is always server-controlled** — any client-supplied `chat_id` is
  stripped and replaced with the configured `TELEGRAM_CHAT_ID`. A public web app
  URL can never be abused to send messages to other chats.
- **Endpoint whitelist** — only `sendMessage` and `sendDocument` are relayed.
- **Size caps** — request bodies are capped at 25 MB and decoded attachments at
  15 MB.
- **Rate limiting** — rolling-window limiter (15 requests / 60 s) with human
  pacing, backed by `CacheService`.

### Step 3: Set Bot Token & Chat ID
- You can either edit `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` directly in the code, or go to **Project Settings (⚙️)** -> **Script Properties** and add:
  - `TELEGRAM_BOT_TOKEN`: `123456789:ABCdefGHIjklMNOpqrsTUVwxyZ`
  - `TELEGRAM_CHAT_ID`: `987654321`

### Step 4: Deploy as Web App
1. Click **Deploy** -> **New deployment**.
2. Click **Select type (⚙️)** -> **Web app**.
3. Set **Execute as**: `Me`
4. Set **Who has access**: `Anyone`
5. Click **Deploy**, authorize permissions if prompted, and copy the **Web App URL**.

---

## 🔒 Privacy & Architecture Principles
1. **Lightweight Relay**: The Apps Script contains ZERO application-specific logic.
2. **Client-side Formatting**: All markdown formatting, versioning, system diagnostics, and PDF attachment handling are computed securely in the web application.
3. **Privacy First**: Diagnostic telemetry and PDF attachments are strictly optional, controlled by user checkboxes on submission (disabled by default). Original file names are hashed before display.
4. **Server-enforced destination**: The relay always sends to the configured owner chat; client-supplied `chat_id` values are ignored (see Step 2 hardening).
5. **Rate-limited**: Bursts and automation are rejected by the rolling-window limiter.
