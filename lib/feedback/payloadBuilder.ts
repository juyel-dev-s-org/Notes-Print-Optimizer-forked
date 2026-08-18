import { FeedbackPayload, FeedbackUserInput, PdfStats, ProcessingSettings, TelegramOperation } from './types';
import { collectDiagnostics } from './systemDiagnostics';

export const CURRENT_TRANSPORT_VERSION = '1.0';
export const CURRENT_SCHEMA_VERSION = '1.0.0';
export const CURRENT_APP_VERSION = '1.2.0';
export const CURRENT_PAYLOAD_VERSION = '1.0.0';

/**
 * Converts a Blob to base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip header like data:application/pdf;base64,
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Short non-reversible identifier for a filename.
 * Avoids leaking user document names into the feedback channel while
 * still letting the author identify which submission they received.
 */
function hashFilename(name: string): string {
  const base = name.replace(/\.(pdf|PDF)$/i, '');
  let hash = 5381;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) + hash + base.charCodeAt(i)) | 0;
  }
  return `doc_${(hash >>> 0).toString(36).slice(0, 6)}${name.slice(-4)}`;
}

/**
 * Generates structured Telegram Markdown formatted message
 */
export function buildTelegramMarkdownMessage(
  input: FeedbackUserInput,
  diagnostics: ReturnType<typeof collectDiagnostics> | null,
  attachmentInfo: { attached: boolean; filename?: string; sizeMB?: number; omittedReason?: string },
  meta: { schemaVersion: string; appVersion: string; engineVersion: string; payloadVersion: string }
): string {
  const stars = '⭐'.repeat(Math.max(1, Math.min(5, input.rating)));
  const categoryIcons: Record<string, string> = {
    'General': '💬',
    'Bug': '🐞',
    'Print Quality': '🖨️',
    'Feature Request': '🚀',
  };
  const icon = categoryIcons[input.category] || '📂';

  // Format comment content
  const commentContent = input.feedbackText && input.feedbackText.trim()
    ? input.feedbackText.trim()
    : '_No written comment provided._';

  // Determine Platform
  let platformStr = 'Desktop';
  if (diagnostics) {
    const osName = diagnostics.os.name;
    const ua = diagnostics.device.userAgent || '';
    if (osName === 'iOS' || ua.includes('iPhone')) {
      platformStr = 'Mobile (iOS)';
    } else if (ua.includes('iPad')) {
      platformStr = 'Tablet (iPadOS)';
    } else if (osName === 'Android') {
      platformStr = ua.includes('Mobile') ? 'Mobile (Android)' : 'Tablet (Android)';
    } else if (diagnostics.device.touchSupport && parseInt(diagnostics.device.viewportSize.split('x')[0] || '1000', 10) < 768) {
      platformStr = 'Mobile';
    }
  }

  // Request ID and Timestamp
  const requestId = Math.random().toString(36).substring(2, 10).toLowerCase();
  const now = new Date();
  const utcTimestamp = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const buildDateStr = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, '0')}.${String(now.getUTCDate()).padStart(2, '0')}-01`;

  let msg = `🌟 *New User Feedback*\n\n`;
  msg += `⭐ *Rating:* ${input.rating}/5 (${stars})\n`;
  msg += `📂 *Category:* ${icon} ${input.category}\n\n`;
  
  msg += `💬 *Comments*\n`;
  msg += `────────────\n`;
  msg += `${commentContent}\n\n`;

  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📌 *Version*\n`;
  msg += `• *App:* v${meta.appVersion}\n`;
  msg += `• *Build:* ${buildDateStr}\n`;
  msg += `• *Engine:* ${meta.engineVersion}\n`;
  msg += `• *Schema:* v${meta.schemaVersion}\n`;
  msg += `• *Payload:* v${meta.payloadVersion}\n\n`;

  if (diagnostics && input.includeDiagnostics) {
    const browserVer = diagnostics.browser.version.split('.')[0] || diagnostics.browser.version;
    const osVerStr = diagnostics.os.version && diagnostics.os.version !== 'Unknown' ? ` ${diagnostics.os.version}` : '';

    msg += `📱 *Environment*\n`;
    msg += `• *Platform:* ${platformStr}\n`;
    msg += `• *OS:* ${diagnostics.os.name}${osVerStr}\n`;
    msg += `• *Browser:* ${diagnostics.browser.name} ${browserVer}\n`;
    msg += `• *Screen:* ${diagnostics.device.screenResolution}\n`;
    msg += `• *Viewport:* ${diagnostics.device.viewportSize}\n\n`;

    if (diagnostics.pdfStats) {
      const stats = diagnostics.pdfStats;
      msg += `📄 *PDF*\n`;
      msg += `• *Raw PDFs:* ${stats.originalFilesCount} file${stats.originalFilesCount === 1 ? '' : 's'}\n`;
      if (stats.originalFileNames && stats.originalFileNames.length > 0) {
        const fileList = stats.originalFileNames.map((name, idx) => {
          const sz = stats.originalFileSizesMB?.[idx];
          const safeName = hashFilename(name);
          return sz ? `${safeName} (${sz.toFixed(2)} MB)` : safeName;
        }).join(', ');
        msg += `• *Raw Files:* ${fileList}\n`;
      }
      if (stats.mergedPdfSizeMB) {
        msg += `• *After Merged Size:* ${stats.mergedPdfSizeMB.toFixed(2)} MB\n`;
      }
      msg += `• *Pages:* ${stats.totalInputPages} input → ${stats.totalOutputPages} output\n`;
      msg += `• *Size Reduction:* ${stats.originalSizeMB.toFixed(1)} MB → ${stats.optimizedSizeMB.toFixed(1)} MB\n`;
      if (stats.inkSavedPct !== undefined && stats.inkSavedPct > 0) {
        msg += `• *Ink Saved:* ~${stats.inkSavedPct.toFixed(0)}%\n`;
      }
      msg += `\n`;
    }

    if (diagnostics.processingSettings) {
      const s = diagnostics.processingSettings;
      const stats = diagnostics.pdfStats;
      const statusStr = diagnostics.currentPhase >= 4 ? 'Success' : `Phase ${diagnostics.currentPhase}`;
      msg += `⚙️ *Processing*\n`;
      msg += `• *Status:* ${statusStr}\n`;
      msg += `• *Phase:* ${diagnostics.currentPhase}\n`;
      msg += `• *Layout:* ${s.gridFormat}\n`;
      msg += `• *Paper:* ${s.paperSize}\n`;
      msg += `• *Orientation:* ${s.orientation.charAt(0).toUpperCase() + s.orientation.slice(1)}\n`;
      msg += `• *Borders:* ${s.showBorders ? 'On' : 'Off'}\n`;
      msg += `• *Numbers:* ${s.showPageNumbers ? 'On' : 'Off'}\n`;

      if (stats) {
        if (stats.analysisTimeMs) {
          msg += `• *Analyzing Slide Structure:* ${(stats.analysisTimeMs / 1000).toFixed(2)} s\n`;
        }
        if (stats.optimizationTimeMs) {
          msg += `• *Optimizing Slides:* ${(stats.optimizationTimeMs / 1000).toFixed(2)} s\n`;
        }
        if (stats.layoutTimeMs) {
          msg += `• *Layout Processing:* ${(stats.layoutTimeMs / 1000).toFixed(2)} s\n`;
        }
        if (stats.processingTimeMs) {
          msg += `• *Total Processing Time:* ${(stats.processingTimeMs / 1000).toFixed(2)} s\n`;
        }
      }
      msg += `\n`;
    }
  }

  if (attachmentInfo.attached) {
    msg += `📎 *Attachment:* ${attachmentInfo.filename} (${attachmentInfo.sizeMB?.toFixed(2)} MB)\n\n`;
  }

  msg += `🆔 *Request ID:* \`${requestId}\`\n`;
  msg += `🕒 ${utcTimestamp}`;

  return msg;
}

/**
 * Builds the generic, versioned transport envelope (FeedbackPayload)
 */
export async function buildFeedbackPayload(
  input: FeedbackUserInput,
  currentPhase: number,
  engineVersion: string,
  pdfStats: PdfStats | null,
  processingSettings: ProcessingSettings | null,
  pdfBlob: Blob | null
): Promise<FeedbackPayload> {
  const diagnostics = input.includeDiagnostics
    ? collectDiagnostics(currentPhase, pdfStats, processingSettings)
    : undefined;

  let base64PdfData: string | undefined = undefined;
  let pdfSizeBytes = 0;
  const attachmentInfo = {
    attached: false,
    filename: undefined as string | undefined,
    sizeMB: undefined as number | undefined,
    omittedReason: undefined as string | undefined,
  };

  if (input.attachPdf && pdfBlob) {
    pdfSizeBytes = pdfBlob.size;
    const sizeMB = pdfSizeBytes / (1024 * 1024);

    if (sizeMB <= 15) {
      const filename = 'PW_Print_Ready_Notes_Feedback.pdf';
      base64PdfData = await blobToBase64(pdfBlob);
      attachmentInfo.attached = true;
      attachmentInfo.filename = filename;
      attachmentInfo.sizeMB = sizeMB;
    } else {
      attachmentInfo.omittedReason = `PDF attachment exceeds size limit (${sizeMB.toFixed(1)} MB > 15 MB limit)`;
    }
  } else if (input.attachPdf && !pdfBlob) {
    attachmentInfo.omittedReason = 'No output PDF available to attach';
  }

  const meta = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: CURRENT_APP_VERSION,
    engineVersion: engineVersion || 'v2.0.0-wasm',
    payloadVersion: CURRENT_PAYLOAD_VERSION,
    timestamp: new Date().toISOString(),
  };

  const telegramMessage = buildTelegramMarkdownMessage(
    input,
    diagnostics || null,
    attachmentInfo,
    meta
  );

  // Construct operations array for the generic relay
  const operations: TelegramOperation[] = [
    {
      endpoint: 'sendMessage',
      payload: {
        text: telegramMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      },
    },
  ];

  if (attachmentInfo.attached && base64PdfData && attachmentInfo.filename) {
    operations.push({
      endpoint: 'sendDocument',
      payload: {
        caption: `📎 Attached PDF for Feedback (${input.category})`,
        base64File: {
          fieldName: 'document',
          filename: attachmentInfo.filename,
          mimeType: 'application/pdf',
          base64Data: base64PdfData,
          sizeBytes: pdfSizeBytes,
        },
      },
    });
  }

  return {
    version: CURRENT_TRANSPORT_VERSION,
    provider: 'telegram',
    operations,
    meta,
    feedback: {
      rating: input.rating,
      category: input.category,
      text: input.feedbackText.trim(),
      attachPdfRequested: input.attachPdf,
      includeDiagnostics: input.includeDiagnostics,
    },
    diagnostics,
  };
}
