# Rollback — Dead Code Removal (2026-08-27)

এই ডকুমেন্টে 2026-08-27 তারিখে মোছা “মরা কোড” এর ব্যাকআপ রাখা হলো। ভুল করে দরকারি কিছু মুছে গেলে এখান থেকে কপি-পেস্ট করে ফেরানো যাবে।

> **নীতি:** শুধু সেই কোড মোছা হয়েছে যা `rg` (ripgrep) + `tsc` + `vitest` + `build` দিয়ে নিশ্চিতভাবে কোথাও `import` / `dynamic import()` / `string` রেফারেন্স নেই। `RESERVED` প্যারামিটার, `console.warn`, `MetricsBus` — এগুলো রাখা হয়েছে।

---

## 1. `lib/kernels/whiteBox.ts` — `normalizeRegion` (dead export)

**মোছার আগে:**
```ts
export function normalizeRegion(r: WhiteBoxRegion, W: number, H: number): WhiteBoxRegion {
  return { x: r.x / W, y: r.y / H, width: r.width / W, height: r.height / H, shape: r.shape };
}
```

**কেন মরা:** `rg` এ শুধু ডেফিনিশন পাওয়া যায়, কোথাও `import { normalizeRegion }` নেই। `WhiteBoxEditor` ভিতরে একই হিসাব inline লেখা ছিল, তাই export টা অব্যবহৃত।

**ফেরাতে হলে:** উপরের ফাংশনটি `whiteBox.ts:77` এ `denormalizeRegion` এর উপরে পেস্ট করুন এবং `WhiteBoxEditor.tsx` এ `normalizeRegion` import করুন।

---

## 2. `components/whitebox/WhiteBoxEditor.tsx` — `mergedPdfBytes` prop

**মোছার আগে:**
```ts
interface Props {
  page: ProcessedPage;
  mergedPdfBytes: Uint8Array | null; // ← removed
  autoRegions: WhiteBoxRegion[];
  manualRegions: WhiteBoxRegion[];
  onApply: (regions: WhiteBoxRegion[]) => void;
  onClose: () => void;
}
export const WhiteBoxEditor: React.FC<Props> = ({ page, mergedPdfBytes: _mergedPdfBytes, ... }) => {
```
এবং `WorkflowView.tsx:278` এ `<WhiteBoxEditor mergedPdfBytes={mergedPdfBytes} ... />`

**কেন মরা:** এডিটর এখন শুধু `opt` (whitened) ছবি দেখায়, `orig` আর লোড করে না (সেভ ~10MB)। `rg` এ `mergedPdfBytes` শুধু এই prop এ পাওয়া যায়, ভিতরে কোথাও `origDataRef` নেই।

**ফেরাতে হলে:** `Props` এ `mergedPdfBytes: Uint8Array | null` ফিরিয়ে আনুন এবং `WorkflowView.tsx` এ প্রপ পাস করুন।

---

## 3. `lib/workers/protocol.ts` — `WorkerType = 'pixel' | 'compose' | 'render'`

**মোছার আগে:**
```ts
export type WorkerType = 'pixel' | 'compose' | 'render';
```

**কেন মরা:** `'render'` এর কোনো `render.worker.ts` ফাইল নেই, `WorkerManager` এ `if (type === 'render')` হ্যান্ডেল নেই, `pool.ts` এও নেই।

**ফেরাতে হলে:** `protocol.ts:1` এ `'render'` ফিরিয়ে আনুন।

---

## 4. `lib/workers/WorkerManager.ts` — `workerUrls` Map + `registerWorkerUrl`

**মোছার আগে:**
```ts
private workerUrls = new Map<WorkerType, string>();
registerWorkerUrl(type: WorkerType, url: string): void {
  this.workerUrls.set(type, url);
}
```

**কেন মরা:** `rg registerWorkerUrl` শুধু ডেফিনিশনে পাওয়া যায়, কোথাও কল নেই। প্রোডাকশনে `registerWorkerFactory` ব্যবহার হয় (`lib/workers/init.ts`).

**ফেরাতে হলে:** উপরের Map ও মেথডটি `WorkerManager.ts:16,30` এ ফিরিয়ে আনুন।

---

## 5. `lib/workers/protocol.ts` + `pixel.worker.ts` + `compose.worker.ts` + `pool.ts` — `CANCEL` / `GET_BUFFER_STATS` / `BUFFER_STATS`

**মোছার আগে:**
```ts
// protocol.ts
| { type: 'CANCEL' } | { type: 'GET_BUFFER_STATS' }
| { type: 'BUFFER_STATS', bufferedCount: number, maxBuffered: number }

// pixel.worker.ts:75-86
if (msg.type === 'GET_BUFFER_STATS') { postMessage({ type: 'BUFFER_STATS', bufferedCount: 0, maxBuffered: 0 }); }
if (msg.type === 'CANCEL') return;

// pool.ts:62-64
if (msg.type === 'BUFFER_STATS') return;
```

**কেন মরা:** এই মেসেজগুলো কোথাও `postMessage` করা হয় না, `pixel.worker.ts` এ `bufferedPages` আগেই মোছা হয়েছে, এখন dummy `0,0` রিটার্ন করে।

**ফেরাতে হলে:** `protocol.ts`, `pixel.worker.ts`, `compose.worker.ts`, `pool.ts` থেকে মোছা লাইনগুলো ফিরিয়ে আনুন।

---

## 6. `components/shared/MetricsPanel.tsx` — DevMetricsPanel

**মোছার আগে:** পুরো ফাইল `MetricsPanel.tsx` (৮১ লাইন) — `DevMetricsPanel` প্রোডাকশনে `return null` করে।

**কেন মরা:** `rg MetricsPanel` শুধু এই ফাইলে পাওয়া যায়, কোথাও `import` নেই। `MetricsBus` কিন্তু **জীবিত** — `ProcessingEngineV2` এখনো `emit` করে।

**ফেরাতে হলে:** `git show HEAD:components/shared/MetricsPanel.tsx` থেকে ফাইলটি ফিরিয়ে আনুন।

---

## 7. `lib/pipeline/checkpoint/CheckpointManager.ts` + `lib/pipeline/index.ts` re-export

**মোছার আগে:** `CheckpointManager.ts` (১২৮ লাইন) এবং `index.ts:2` থেকে `export { CheckpointManager }`

**কেন মরা:** `rg CheckpointManager` শুধু এই দুই ফাইলে পাওয়া যায়, কোথাও `import` নেই। ফিচার ফ্ল্যাগ `pipeline.checkpoint_resume` ও কোথাও চেক হয় না।

**ফেরাতে হলে:** `git show HEAD:lib/pipeline/checkpoint/CheckpointManager.ts` এবং `index.ts` থেকে লাইনটি ফিরিয়ে আনুন।

---

## 8. `lib/optimizer/perf/benchmark.ts` — BenchmarkHarness

**মোছার আগে:** `BenchmarkHarness` ক্লাস + `export const benchmark`

**কেন মরা:** `rg "from.*benchmark"` শুধু `tests/benchmarks` এ পাওয়া যায়, `lib/app/components` এ কেউ import করে না। `console.log` গুলো শুধু বেঞ্চমার্কে।

**ফেরাতে হলে:** `git show HEAD:lib/optimizer/perf/benchmark.ts` থেকে ফাইলটি ফিরিয়ে আনুন বা `tests/` ফোল্ডারে সরান।

---

## কীভাবে রোলব্যাক করবেন

```bash
git log --oneline -- docs/rollback-dead-code-2026-08-27.md
git show <commit>:path/to/file > path/to/file   # যেকোনো ফাইল আগের কমিট থেকে ফেরানো
# অথবা পুরো কমিট রিভার্ট:
git revert <commit-hash>
```

এই ডকুমেন্টটি `main` ব্রাঞ্চে কমিট করা থাকবে, তাই যেকোনো সময় `git show` দিয়ে ফেরানো যাবে।
