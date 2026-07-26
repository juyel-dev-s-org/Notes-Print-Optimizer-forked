export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Generic, Stateless & Payload-Agnostic Telegram Bot Relay
 * Pipeline: Web App -> Google Apps Script -> Telegram Bot API
 * 
 * Instructions:
 * 1. Go to https://script.google.com/
 * 2. Create a new project.
 * 3. Paste this code into Code.gs.
 * 4. Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID below or in Project Settings -> Script Properties.
 * 5. Click "Deploy" -> "New deployment" -> Select "Web app".
 * 6. Execute as: "Me", Who has access: "Anyone".
 * 7. Deploy and copy the Web App URL into your web app configuration.
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

      // Inject default chat_id if not present in the operation payload
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
`;
