# Google Apps Script Telegram Relay Setup Guide

This guide describes how to set up your lightweight, production-ready Google Apps Script (GAS) to receive feedback submissions and forward them directly to your Telegram Bot.

---

## 🚀 Setup Steps (5 Minutes)

### Step 1: Create Google Apps Script Project
1. Open [Google Apps Script](https://script.google.com/).
2. Click **+ New project**.
3. Name your project **PW Notes Feedback Relay**.

### Step 2: Paste the Code
Replace the entire code in `Code.gs` with the following script:

```javascript
/**
 * Generic, Stateless & Payload-Agnostic Telegram Bot Relay
 * Pipeline: Web App -> Google Apps Script -> Telegram Bot API
 */
var TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN_HERE";
var TELEGRAM_CHAT_ID = "YOUR_TELEGRAM_CHAT_ID_HERE";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "No post data received" });
    }

    var envelope = JSON.parse(e.postData.contents);

    var scriptProps = PropertiesService.getScriptProperties();
    var botToken = scriptProps.getProperty("TELEGRAM_BOT_TOKEN") || TELEGRAM_BOT_TOKEN;
    var defaultChatId = scriptProps.getProperty("TELEGRAM_CHAT_ID") || TELEGRAM_CHAT_ID;

    if (!botToken || botToken === "YOUR_TELEGRAM_BOT_TOKEN_HERE") {
      return jsonResponse({ status: "error", message: "TELEGRAM_BOT_TOKEN is not configured." });
    }

    var operations = envelope.operations;
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return jsonResponse({ status: "error", message: "Invalid payload envelope: 'operations' array missing or empty." });
    }

    var results = [];

    for (var i = 0; i < operations.length; i++) {
      var op = operations[i];
      var endpoint = op.endpoint; // e.g., "sendMessage", "sendDocument", "sendPhoto", "sendVideo"
      var payload = op.payload || {};

      // Inject default chat_id if not present in operation payload
      if (!payload.chat_id && defaultChatId && defaultChatId !== "YOUR_TELEGRAM_CHAT_ID_HERE") {
        payload.chat_id = defaultChatId;
      }

      var url = "https://api.telegram.org/bot" + botToken + "/" + endpoint;
      var options = {
        method: "post",
        muteHttpExceptions: true
      };

      // Check if operation contains a base64 encoded binary attachment
      if (payload.base64File && payload.base64File.base64Data) {
        var fileObj = payload.base64File;
        var bytes = Utilities.base64Decode(fileObj.base64Data);
        var blob = Utilities.newBlob(
          bytes,
          fileObj.mimeType || "application/octet-stream",
          fileObj.filename || "file"
        );

        var multipartPayload = {};
        var keys = Object.keys(payload);
        for (var k = 0; k < keys.length; k++) {
          if (keys[k] !== "base64File") {
            multipartPayload[keys[k]] = payload[keys[k]];
          }
        }
        var fieldName = fileObj.fieldName || "document";
        multipartPayload[fieldName] = blob;

        options.payload = multipartPayload;
      } else {
        options.contentType = "application/json";
        options.payload = JSON.stringify(payload);
      }

      var res = UrlFetchApp.fetch(url, options);
      var resJson = {};
      try {
        resJson = JSON.parse(res.getContentText());
      } catch (parseErr) {
        resJson = { raw: res.getContentText() };
      }

      // Fallback for sendMessage if Markdown parse error occurs
      if (!resJson.ok && endpoint === "sendMessage" && payload.parse_mode) {
        delete payload.parse_mode;
        options.payload = JSON.stringify(payload);
        var retryRes = UrlFetchApp.fetch(url, options);
        try {
          resJson = JSON.parse(retryRes.getContentText());
        } catch (retryErr) {}
      }

      results.push({
        endpoint: endpoint,
        ok: resJson.ok || false,
        response: resJson
      });
    }

    return jsonResponse({
      status: "success",
      version: envelope.version || "1.0",
      provider: envelope.provider || "telegram",
      results: results
    });

  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "Generic Payload-Agnostic Telegram Relay",
    version: "1.0"
  });
}
```

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
3. **Privacy First**: Diagnostic telemetry and PDF attachments are strictly optional, controlled by user checkboxes on submission.
