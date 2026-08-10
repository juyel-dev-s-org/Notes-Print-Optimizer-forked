/**
 * Augment Navigator and Performance interfaces for non-standard APIs
 * used throughout the codebase (deviceMemory, performance.memory, etc.)
 */

interface Navigator {
  /** @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory */
  deviceMemory?: number;
  /** @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator userAgentData */
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
    brands?: Array<{ brand: string; version: string }>;
  };
}

interface Performance {
  /** @see https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory */
  memory?: {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
  };
}

/** Scheduler API for cooperative scheduling */
interface Scheduler {
  yield(): Promise<void>;
}

declare const scheduler: Scheduler | undefined;
