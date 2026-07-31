import { useEffect, useRef } from 'react';

interface PerformanceEntry {
  name: string;
  value: number;
  timestamp: number;
}

const logs: PerformanceEntry[] = [];

function log(name: string, value: number) {
  const entry = { name, value, timestamp: Date.now() };
  logs.push(entry);
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Monitor] ${name}:`, value);
  }
}

export function getMonitorLogs(): PerformanceEntry[] {
  return [...logs];
}

export function useMonitor() {
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;

    log('app.loaded', performance.now());

    if ('performance' in window && typeof PerformanceObserver !== 'undefined') {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          log(`perf.${entry.entryType}.${entry.name}`, entry.duration || entry.startTime || 0);
        }
      });
      try { obs.observe({ type: 'largest-contentful-paint', buffered: true }); } catch { /* not supported */ }
      try { obs.observe({ type: 'first-input', buffered: true }); } catch { /* not supported */ }
      try { obs.observe({ type: 'layout-shift', buffered: true }); } catch { /* not supported */ }
    }

    const handleError = () => {
      log('error.uncaught', 1);
    };

    const handleRejection = () => {
      log('error.unhandledRejection', 1);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
}
