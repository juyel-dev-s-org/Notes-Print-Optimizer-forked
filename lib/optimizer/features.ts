/**
 * Feature Flag System v2 - Production-grade feature gating.
 */
export interface FeatureDefinition { readonly key: string; readonly description: string; readonly defaultValue: boolean; readonly category: 'engine' | 'pipeline' | 'ui' | 'experimental' | 'performance'; readonly stable: boolean; }

const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  { key: 'engine.v2.pipeline', description: 'Use the v2 plugin-based pipeline engine', defaultValue: true, category: 'engine', stable: true },
  { key: 'engine.v2.wasm_kernels', description: 'Use WASM-compiled pixel kernels (experimental — OFF by default for stability)', defaultValue: false, category: 'engine', stable: false },
  { key: 'engine.v2.offscreen_canvas', description: 'Use OffscreenCanvas for rendering', defaultValue: true, category: 'engine', stable: true },
  { key: 'pipeline.retry_on_error', description: 'Automatically retry failed page processing', defaultValue: true, category: 'pipeline', stable: true },
  { key: 'pipeline.checkpoint_resume', description: 'Enable checkpoint-based resume', defaultValue: true, category: 'pipeline', stable: true },
  { key: 'pipeline.memory_guard', description: 'Enable adaptive memory pressure management', defaultValue: true, category: 'pipeline', stable: true },
  { key: 'pipeline.backpressure', description: 'Enable scheduler backpressure', defaultValue: true, category: 'pipeline', stable: true },
  { key: 'performance.worker_pool', description: 'Use web worker pool', defaultValue: true, category: 'performance', stable: true },
  { key: 'performance.buffer_pool', description: 'Reuse ArrayBuffer allocations', defaultValue: true, category: 'performance', stable: false },
  { key: 'performance.image_bitmap', description: 'Use createImageBitmap', defaultValue: true, category: 'performance', stable: true },
  { key: 'ui.thumbnail_preview', description: 'Show real-time thumbnail previews', defaultValue: true, category: 'ui', stable: true },
  { key: 'ui.before_after_slider', description: 'Show before/after comparison slider', defaultValue: true, category: 'ui', stable: true },
  { key: 'experimental.smart_color_remap', description: 'AI-assisted smart color remapping', defaultValue: false, category: 'experimental', stable: false },
  { key: 'experimental.gpu_compositing', description: 'Use WebGPU for compositing', defaultValue: false, category: 'experimental', stable: false },
] as const;

type FeatureChangeListener = (key: string, enabled: boolean) => void;
const STORAGE_KEY = 'npo_feature_flags_v2';

class FeatureFlagManager {
  private flags: Map<string, boolean> = new Map();
  private listeners: Set<FeatureChangeListener> = new Set();
  private definitions: Map<string, FeatureDefinition> = new Map();
  private initialized = false;

  constructor() { for (const def of FEATURE_DEFINITIONS) { this.definitions.set(def.key, def); this.flags.set(def.key, def.defaultValue); } }

  init(): void { if (this.initialized) return; this.initialized = true; this.applyCapabilityDefaults(); this.loadPersisted(); }

  private applyCapabilityDefaults(): void {
    if (typeof OffscreenCanvas === 'undefined') this.flags.set('engine.v2.offscreen_canvas', false);
    if (typeof createImageBitmap === 'undefined') this.flags.set('performance.image_bitmap', false);
    if (typeof Worker === 'undefined') this.flags.set('performance.worker_pool', false);
    if (typeof WebAssembly === 'undefined') this.flags.set('engine.v2.wasm_kernels', false);
  }

  private loadPersisted(): void { try { if (typeof localStorage === 'undefined') return; const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; const persisted = JSON.parse(raw) as Record<string, boolean>; for (const [key, value] of Object.entries(persisted)) { if (this.definitions.has(key) && typeof value === 'boolean') this.flags.set(key, value); } } catch { /* */ } }
  private persist(): void { try { if (typeof localStorage === 'undefined') return; const overrides: Record<string, boolean> = {}; for (const [key, value] of this.flags) { const def = this.definitions.get(key); if (def && value !== def.defaultValue) overrides[key] = value; } localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); } catch { /* */ } }

  isEnabled(key: string): boolean { return this.flags.get(key) ?? false; }
  setEnabled(key: string, enabled: boolean): void { if (!this.definitions.has(key)) return; if (this.flags.get(key) === enabled) return; this.flags.set(key, enabled); this.persist(); for (const l of this.listeners) { try { l(key, enabled); } catch { /* */ } } }
  reset(key: string): void { const def = this.definitions.get(key); if (def) this.setEnabled(key, def.defaultValue); }
  resetAll(): void { for (const def of this.definitions.values()) this.flags.set(def.key, def.defaultValue); this.applyCapabilityDefaults(); this.persist(); for (const l of this.listeners) { try { l('*', true); } catch { /* */ } } }
  onChange(listener: FeatureChangeListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getAll(): Array<FeatureDefinition & { enabled: boolean }> { return Array.from(this.definitions.values()).map(def => ({ ...def, enabled: this.flags.get(def.key) ?? def.defaultValue })); }
  getByCategory(category: FeatureDefinition['category']): Array<FeatureDefinition & { enabled: boolean }> { return this.getAll().filter(f => f.category === category); }
  getExperimental(): Array<FeatureDefinition & { enabled: boolean }> { return this.getAll().filter(f => f.category === 'experimental'); }
}

export const featureFlags = new FeatureFlagManager();

let cachedOffscreenCanvas: boolean | null = null;
let cachedCreateImageBitmap: boolean | null = null;
export function canUseOffscreenCanvas(): boolean { if (cachedOffscreenCanvas !== null) return cachedOffscreenCanvas; cachedOffscreenCanvas = typeof OffscreenCanvas !== 'undefined' && featureFlags.isEnabled('engine.v2.offscreen_canvas'); return cachedOffscreenCanvas; }
export function canCreateImageBitmap(): boolean { if (cachedCreateImageBitmap !== null) return cachedCreateImageBitmap; cachedCreateImageBitmap = typeof createImageBitmap !== 'undefined' && featureFlags.isEnabled('performance.image_bitmap'); return cachedCreateImageBitmap; }
