export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Hardened Telegram Bot Relay
 * Pipeline: Web App -> Google Apps Script -> Telegram Bot API
 * 
 * Security model (read carefully):
 * - The Telegram destination chat_id is ALWAYS taken from server-side config.
 *   Client-supplied chat_id values are stripped and ignored. An attacker who
 *   POSTs to this public URL can never redirect messages to another chat.
 * - Only a whitelist of Telegram endpoints is accepted.
 * - Request bodies are size-capped and rate-limited (CacheService rolling window).
 * 
 * Instructions:
 * 1. Go to https://script.google.com/
 * 2. Create a new project.
 * 3. Paste this code into Code.gs.
 * 4. Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID below or in
 *    Project Settings -> Script Properties (preferred).
 * 5. Click "Deploy" -> "New deployment" -> Select "Web app".
 * 6. Execute as: "Me", Who has access: "Anyone".
 * 7. Deploy and copy the Web App URL into your app configuration.
 */

var TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN_HERE";
var TELEGRAM_CHAT_ID = "YOUR_TELEGRAM_CHAT_ID_HERE";

var ALLOWED_ENDPOINTS = ["sendMessage", "sendDocument"];
var MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB (GAS web app limit ~50 MB; 15 MB PDF => ~20 MB base64)
var MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // decoded attachment cap
var RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
var RATE_LIMIT_MAX_REQUESTS = 15; // max requests per window (global bucket)
var MIN_DELAY_MS = 500; // human-like pacing; slows automated spam

function doPost(e) {
  try {
    // --- body size cap ---
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "No post data received" });
    }
    if (e.postData.contents.length > MAX_BODY_BYTES) {
      return jsonResponse({ status: "error", message: "Payload too large" });
    }

    // --- rate limit (global rolling window via CacheService) ---
    if (!isRateLimited()) {
      return jsonResponse({ status: "error", message: "Rate limit exceeded, try again later" });
    }

    var envelope = JSON.parse(e.postData.contents);

    var scriptProps = PropertiesService.getScriptProperties();
    var botToken = scriptProps.getProperty("TELEGRAM_BOT_TOKEN") || TELEGRAM_BOT_TOKEN;
    var defaultChatId = scriptProps.getProperty("TELEGRAM_CHAT_ID") || TELEGRAM_CHAT_ID;

    if (!botToken || botToken === "YOUR_TELEGRAM_BOT_TOKEN_HERE") {
      return jsonResponse({ status: "error", message: "TELEGRAM_BOT_TOKEN is not configured." });
    }
    if (!defaultChatId || defaultChatId === "YOUR_TELEGRAM_CHAT_ID_HERE") {
      return jsonResponse({ status: "error", message: "TELEGRAM_CHAT_ID is not configured." });
    }

    var operations = envelope.operations;
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return jsonResponse({ status: "error", message: "Invalid payload envelope: 'operations' array missing or empty." });
    }

    var results = [];

    for (var i = 0; i < operations.length; i++) {
      var op = operations[i];
      var endpoint = op.endpoint;

      // --- endpoint whitelist ---
      if (ALLOWED_ENDPOINTS.indexOf(endpoint) === -1) {
        results.push({ endpoint: endpoint, ok: false, response: { error: "Endpoint not allowed" } });
        continue;
      }

      var payload = {};
      if (op.payload && typeof op.payload === "object" && !Array.isArray(op.payload)) {
        payload = op.payload;
      }

      // --- strip any client-supplied chat_id, always use server-configured one ---
      if (payload.chat_id !== undefined) {
        delete payload.chat_id;
      }
      payload.chat_id = defaultChatId;

      var url = "https://api.telegram.org/bot" + botToken + "/" + endpoint;
      var options = {
        method: "post",
        muteHttpExceptions: true
      };

      // Check if operation contains a base64 encoded binary attachment
      if (payload.base64File && payload.base64File.base64Data) {
        var fileObj = payload.base64File;
        var decodedBytes = Utilities.base64Decode(fileObj.base64Data);
        if (decodedBytes.length > MAX_ATTACHMENT_BYTES) {
          results.push({ endpoint: endpoint, ok: false, response: { error: "Attachment exceeds size limit" } });
          continue;
        }
        var blob = Utilities.newBlob(
          decodedBytes,
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

/**
 * Rolling-window rate limiter backed by CacheService.
 * Returns true when the request is allowed to proceed.
 */
function isRateLimited() {
  var cache = CacheService.getScriptCache();
  var now = Date.now();
  var key = "rl_events";
  var raw = cache.get(key);
  var events = [];
  if (raw) {
    try {
      events = JSON.parse(raw);
    } catch (e) {
      events = [];
    }
  }
  // drop events outside the window
  var cutoff = now - RATE_LIMIT_WINDOW_MS;
  events = events.filter(function (t) { return t > cutoff; });

  // pacing: reject bursts that are faster than MIN_DELAY_MS apart
  if (events.length > 0 && (now - events[events.length - 1]) < MIN_DELAY_MS) {
    return false;
  }
  if (events.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  events.push(now);
  cache.put(key, JSON.stringify(events), 300); // 5 min TTL, sliding window
  return true;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "Hardened Telegram Relay",
    version: "1.1"
  });
}
`;
