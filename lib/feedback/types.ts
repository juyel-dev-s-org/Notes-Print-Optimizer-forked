export interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenResolution: string;
  viewportSize: string;
  devicePixelRatio: number;
  touchSupport: boolean;
  hardwareConcurrency?: number;
  deviceMemoryGB?: number;
}

export interface BrowserInfo {
  name: string;
  version: string;
}

export interface OsInfo {
  name: string;
  version: string;
}

export interface PdfStats {
  originalFilesCount: number;
  originalFileNames: string[];
  originalFileSizesMB?: number[];
  mergedPdfSizeMB?: number;
  totalInputPages: number;
  totalOutputPages: number;
  excludedPagesCount: number;
  originalSizeMB: number;
  optimizedSizeMB: number;
  inkSavedPct?: number;
  processingTimeMs?: number;
  analysisTimeMs?: number;
  optimizationTimeMs?: number;
  layoutTimeMs?: number;
}

export interface ProcessingSettings {
  gridFormat: string;
  paperSize: string;
  orientation: string;
  showBorders: boolean;
  showPageNumbers: boolean;
}

export interface ErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
}

export interface DiagnosticsData {
  device: DeviceInfo;
  browser: BrowserInfo;
  os: OsInfo;
  pdfStats: PdfStats | null;
  processingSettings: ProcessingSettings | null;
  currentPhase: number;
  errorLogs: ErrorLogEntry[];
  performance: {
    memoryUsageMB?: number;
    canvasSupport: boolean;
    webglSupport: boolean;
  };
}

export type FeedbackCategory = 'General' | 'Bug' | 'Print Quality' | 'Feature Request';

export interface FeedbackUserInput {
  rating: number; // 1-5
  category: FeedbackCategory;
  feedbackText: string;
  attachPdf: boolean;
  includeDiagnostics: boolean;
}

export interface TelegramOperation {
  endpoint: string; // e.g. 'sendMessage', 'sendDocument', 'sendPhoto'
  payload: Record<string, unknown>;
}

export interface RelayTransportEnvelope {
  version: string;   // Transport protocol version e.g. "1.0"
  provider: string;  // e.g. "telegram"
  operations: TelegramOperation[];

  // Web app domain metadata & diagnostics for logging, auditing, and developer UI previews
  meta: {
    schemaVersion: string; // e.g. "1.0.0"
    appVersion: string;    // e.g. "1.2.0"
    engineVersion: string; // e.g. "v2.0.0-wasm"
    payloadVersion: string;// e.g. "1.0.0"
    timestamp: string;     // ISO timestamp
  };

  feedback: {
    rating: number;
    category: FeedbackCategory;
    text: string;
    attachPdfRequested: boolean;
    includeDiagnostics: boolean;
  };

  diagnostics?: DiagnosticsData;
}

// Retain FeedbackPayload as an alias for RelayTransportEnvelope for backwards compatibility
export type FeedbackPayload = RelayTransportEnvelope;
