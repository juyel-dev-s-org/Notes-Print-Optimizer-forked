import { BrowserInfo, DeviceInfo, DiagnosticsData, ErrorLogEntry, OsInfo, PdfStats, ProcessingSettings } from './types';

// Global Diagnostic Error Logger for collecting non-sensitive runtime errors
class DiagnosticLogger {
  private static logs: ErrorLogEntry[] = [];
  private static maxLogs = 10;

  public static logError(message: string, level: 'error' | 'warn' | 'info' = 'error') {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message: String(message).slice(0, 300),
    });
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  public static getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  public static clearLogs() {
    this.logs = [];
  }
}

export { DiagnosticLogger };

/**
 * Detects browser name and version from user agent
 */
export function detectBrowser(): BrowserInfo {
  if (typeof window === 'undefined') return { name: 'Server', version: '1.0' };

  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';

  if (ua.includes('Firefox/')) {
    name = 'Firefox';
    version = ua.split('Firefox/')[1]?.split(' ')[0] || 'Unknown';
  } else if (ua.includes('Edg/')) {
    name = 'Edge';
    version = ua.split('Edg/')[1]?.split(' ')[0] || 'Unknown';
  } else if (ua.includes('Chrome/')) {
    name = 'Chrome';
    version = ua.split('Chrome/')[1]?.split(' ')[0] || 'Unknown';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    name = 'Safari';
    version = ua.split('Version/')[1]?.split(' ')[0] || 'Unknown';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    name = 'Opera';
    version = ua.split('OPR/')[1]?.split(' ')[0] || 'Unknown';
  }

  return { name, version };
}

/**
 * Detects operating system from user agent and platform
 */
export function detectOs(): OsInfo {
  if (typeof window === 'undefined') return { name: 'Server', version: '1.0' };

  const ua = navigator.userAgent;
  let name = 'Unknown OS';
  let version = 'Unknown';

  if (ua.includes('Win')) {
    name = 'Windows';
    if (ua.includes('Windows NT 10.0')) version = '10 / 11';
    else if (ua.includes('Windows NT 6.3')) version = '8.1';
    else if (ua.includes('Windows NT 6.1')) version = '7';
  } else if (ua.includes('Mac OS X')) {
    name = 'macOS';
    version = ua.split('Mac OS X ')[1]?.split(')')[0]?.replace(/_/g, '.') || 'Unknown';
  } else if (ua.includes('Android')) {
    name = 'Android';
    version = ua.split('Android ')[1]?.split(';')[0] || 'Unknown';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    name = 'iOS';
    version = ua.split('OS ')[1]?.split(' ')[0]?.replace(/_/g, '.') || 'Unknown';
  } else if (ua.includes('Linux')) {
    name = 'Linux';
  }

  return { name, version };
}

/**
 * Collects hardware and device metrics
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'Server',
      platform: 'Server',
      screenResolution: 'N/A',
      viewportSize: 'N/A',
      devicePixelRatio: 1,
      touchSupport: false,
    };
  }

  const nav = navigator as Navigator & { deviceMemory?: number };

  return {
    userAgent: nav.userAgent,
    platform: nav.platform || 'Unknown',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0,
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    deviceMemoryGB: nav.deviceMemory || undefined,
  };
}

/**
 * Checks canvas and WebGL capability
 */
export function checkCapabilities() {
  if (typeof window === 'undefined') return { canvasSupport: false, webglSupport: false };

  let canvasSupport = false;
  let webglSupport = false;

  try {
    const canvas = document.createElement('canvas');
    canvasSupport = !!(canvas.getContext && canvas.getContext('2d'));
    webglSupport = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    canvasSupport = false;
    webglSupport = false;
  }

  let memoryUsageMB: number | undefined = undefined;
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const mem = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
    if (mem && mem.usedJSHeapSize) {
      memoryUsageMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
    }
  }

  return {
    canvasSupport,
    webglSupport,
    memoryUsageMB,
  };
}

/**
 * Assembles full DiagnosticsData payload
 */
export function collectDiagnostics(
  currentPhase: number,
  pdfStats: PdfStats | null,
  processingSettings: ProcessingSettings | null
): DiagnosticsData {
  const browser = detectBrowser();
  const os = detectOs();
  const device = getDeviceInfo();
  const capabilities = checkCapabilities();
  const errorLogs = DiagnosticLogger.getLogs();

  return {
    device,
    browser,
    os,
    pdfStats,
    processingSettings,
    currentPhase,
    errorLogs,
    performance: {
      memoryUsageMB: capabilities.memoryUsageMB,
      canvasSupport: capabilities.canvasSupport,
      webglSupport: capabilities.webglSupport,
    },
  };
}
