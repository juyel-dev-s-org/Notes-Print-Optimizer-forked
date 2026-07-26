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
  const icon = categoryIcons[input.category] || '💬';

  let msg = `🌟 *New User Feedback Received*\n\n`;
  msg += `*Rating:* ${stars} (${input.rating}/5)\n`;
  msg += `*Category:* ${icon} ${input.category}\n`;
  
  if (input.feedbackText && input.feedbackText.trim()) {
    msg += `*Comments:*\n\`\`\`\n${input.feedbackText.trim()}\n\`\`\`\n`;
  } else {
    msg += `*Comments:* _No written comment provided._\n`;
  }

  msg += `\n📌 *Version Meta*\n`;
  msg += `• *App Version:* \`v${meta.appVersion}\`\n`;
  msg += `• *Engine:* \`${meta.engineVersion}\`\n`;
  msg += `• *Schema / Payload:* \`v${meta.schemaVersion}\` / \`v${meta.payloadVersion}\`\n`;
  msg += `• *Timestamp:* ${new Date().toLocaleString()}\n`;

  if (diagnostics && input.includeDiagnostics) {
    msg += `\n📱 *Environment & System*\n`;
    msg += `• *OS:* ${diagnostics.os.name} ${diagnostics.os.version}\n`;
    msg += `• *Browser:* ${diagnostics.browser.name} ${diagnostics.browser.version}\n`;
    msg += `• *Display:* ${diagnostics.device.screenResolution} (Viewport: ${diagnostics.device.viewportSize})\n`;
    msg += `• *Workflow Phase:* Phase ${diagnostics.currentPhase}\n`;

    if (diagnostics.pdfStats) {
      const stats = diagnostics.pdfStats;
      msg += `\n📄 *PDF Statistics*\n`;
      msg += `• *Input Files:* ${stats.originalFilesCount} (${stats.originalFileNames.join(', ') || 'Document'})\n`;
      msg += `• *Pages:* ${stats.totalInputPages} input ➔ ${stats.totalOutputPages} output\n`;
      msg += `• *Excluded Pages:* ${stats.excludedPagesCount}\n`;
      msg += `• *Size:* ${stats.originalSizeMB.toFixed(1)} MB ➔ ${stats.optimizedSizeMB.toFixed(1)} MB\n`;
      if (stats.inkSavedPct !== undefined && stats.inkSavedPct > 0) {
        msg += `• *Ink Saved:* ~${stats.inkSavedPct.toFixed(0)}%\n`;
      }
    }

    if (diagnostics.processingSettings) {
      const s = diagnostics.processingSettings;
      msg += `\n⚙️ *Layout Settings*\n`;
      msg += `• *Grid:* ${s.gridFormat} | *Paper:* ${s.paperSize}\n`;
      msg += `• *Orientation:* ${s.orientation}\n`;
      msg += `• *Borders:* ${s.showBorders ? 'Enabled' : 'Disabled'} | *Numbers:* ${s.showPageNumbers ? 'Enabled' : 'Disabled'}\n`;
    }

    if (diagnostics.errorLogs && diagnostics.errorLogs.length > 0) {
      msg += `\n⚠️ *Diagnostics & Errors*\n`;
      diagnostics.errorLogs.forEach((log) => {
        msg += `• \`[${log.level.toUpperCase()}]\` ${log.message.slice(0, 120)}\n`;
      });
    }
  }

  if (attachmentInfo.attached) {
    msg += `\n📎 *Attachment:* ${attachmentInfo.filename} (${attachmentInfo.sizeMB?.toFixed(2)} MB) attached.`;
  } else if (attachmentInfo.omittedReason) {
    msg += `\n📎 *Attachment Note:* ${attachmentInfo.omittedReason}`;
  }

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
