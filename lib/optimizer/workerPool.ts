/**
 * Persistent Web Worker Pool with Inline Blob URL Worker.
 * 
 * CRITICAL: Uses inline Blob URL instead of external .ts file because
 * GitHub Pages serves .ts files with MIME type "video/mp2t" which causes
 * browsers to reject them as module scripts.
 * 
 * Optimizations:
 * - Single-pass HSV evaluation (7N -> N pixel visits)
 * - Pre-allocated CC buffers (zero per-call allocation)
 * - Persistent workers (no create/destroy per page)
 * - Single-copy transfer with original ImageData reference for fallback
 *   (eliminates 2x memory overhead per page — Phase 1 / C-2 fix)
 */
import { PageProfile, ProcessingParameters } from './types';
import { ImageProcessingKernels } from './pixelKernels';

export interface WorkerProcessResult {
  pageIndex: number;
  optimizedImageData: ImageData;
  inkCoverageBeforePct: number;
  inkCoverageAfterPct: number;
}

interface QueuedTask {
  pageIndex: number;
  buffer: ArrayBuffer;
  /** Reference to original ImageData for fallback (no extra copy needed). */
  sourceImageData: ImageData;
  width: number;
  height: number;
  params: ProcessingParameters;
  profile: PageProfile;
  resolve: (r: WorkerProcessResult) => void;
  reject: (e: Error) => void;
}

interface PooledWorker {
  worker: Worker;
  busy: boolean;
  currentTask: QueuedTask | null;
}

function getInlineWorkerScript(): string {
  return `
'use strict';
var ccLabels = null, ccQueue = null, ccCapacity = 0;
function ensureCC(size) {
  if (ccCapacity < size) { ccLabels = new Int32Array(size); ccQueue = new Int32Array(size); ccCapacity = size; }
  else { ccLabels.fill(0, 0, size); }
}
function rgbToHsv(r, g, b, out) {
  var rN = r * 0.00392156862745098, gN = g * 0.00392156862745098, bN = b * 0.00392156862745098;
  var vN = rN > gN ? (rN > bN ? rN : bN) : (gN > bN ? gN : bN);
  var mn = rN < gN ? (rN < bN ? rN : bN) : (gN < bN ? gN : bN);
  var delta = vN - mn, hN = 0;
  if (delta !== 0) {
    if (vN === rN) hN = 60 * (((gN - bN) / delta) % 6);
    else if (vN === gN) hN = 60 * ((bN - rN) / delta + 2);
    else hN = 60 * ((rN - gN) / delta + 4);
    if (hN < 0) hN += 360;
  }
  out[0] = (hN * 0.5 + 0.5) | 0;
  out[1] = (vN === 0 ? 0 : (delta / vN) * 255 + 0.5) | 0;
  out[2] = (vN * 255 + 0.5) | 0;
}
function stripDecorativeFills(mask, w, h) {
  var tp = w * h; ensureCC(tp);
  var labels = ccLabels, queue = ccQueue, cl = 1;
  var sMinX = [0], sMinY = [0], sMaxX = [0], sMaxY = [0], sArea = [0];
  for (var i = 0; i < tp; i++) {
    if (mask[i] === 1 && labels[i] === 0) {
      var lb = cl++, mnx = w, mny = h, mxx = -1, mxy = -1, ar = 0, hd = 0, tl = 0;
      queue[tl++] = i; labels[i] = lb;
      while (hd < tl) {
        var cu = queue[hd++], cx = cu % w, cy = (cu / w) | 0;
        if (cx < mnx) mnx = cx; if (cx > mxx) mxx = cx;
        if (cy < mny) mny = cy; if (cy > mxy) mxy = cy; ar++;
        var yS = cy > 0 ? cy - 1 : cy, yE = cy < h - 1 ? cy + 1 : cy;
        var xS = cx > 0 ? cx - 1 : cx, xE = cx < w - 1 ? cx + 1 : cx;
        for (var ny = yS; ny <= yE; ny++) { var ro = ny * w;
          for (var nx = xS; nx <= xE; nx++) { if (nx === cx && ny === cy) continue;
            var ni = ro + nx;
            if (mask[ni] === 1 && labels[ni] === 0) { labels[ni] = lb; queue[tl++] = ni; } } }
      }
      sMinX.push(mnx); sMinY.push(mny); sMaxX.push(mxx); sMaxY.push(mxy); sArea.push(ar);
    }
  }
  var drop = new Uint8Array(cl);
  for (var lb2 = 1; lb2 < cl; lb2++) {
    var cw = sMaxX[lb2] - sMinX[lb2] + 1, ch = sMaxY[lb2] - sMinY[lb2] + 1;
    if (sArea[lb2] >= 200 && cw / Math.max(ch, 1) > 2.2 && cw / w > 0.20 && sMinY[lb2] / h < 0.15 && sArea[lb2] > cw * ch * 0.3) drop[lb2] = 1;
  }
  for (var i2 = 0; i2 < tp; i2++) { var l = labels[i2]; if (l > 0 && drop[l] === 1) mask[i2] = 0; }
}
function removeNoise(mask, w, h) {
  var tp = w * h; ensureCC(tp);
  var labels = ccLabels, queue = ccQueue, cl = 1, sArea = [0];
  for (var i = 0; i < tp; i++) {
    if (mask[i] === 1 && labels[i] === 0) {
      var lb = cl++, ar = 0, hd = 0, tl = 0;
      queue[tl++] = i; labels[i] = lb;
      while (hd < tl) {
        var cu = queue[hd++], cx = cu % w, cy = (cu / w) | 0; ar++;
        var yS = cy > 0 ? cy - 1 : cy, yE = cy < h - 1 ? cy + 1 : cy;
        var xS = cx > 0 ? cx - 1 : cx, xE = cx < w - 1 ? cx + 1 : cx;
        for (var ny = yS; ny <= yE; ny++) { var ro = ny * w;
          for (var nx = xS; nx <= xE; nx++) { if (nx === cx && ny === cy) continue;
            var ni = ro + nx;
            if (mask[ni] === 1 && labels[ni] === 0) { labels[ni] = lb; queue[tl++] = ni; } } }
      }
      sArea.push(ar);
    }
  }
  var minA = Math.max(6, (tp / 600000) | 0);
  for (var i2 = 0; i2 < tp; i2++) { var l = labels[i2]; if (l > 0 && sArea[l] < minA) mask[i2] = 0; }
}
function applyMaskDilation(mask, w, h, ks) {
  var copy = new Uint8Array(mask), off = (ks / 2) | 0;
  var offsets = [];
  if (ks === 3) { offsets.push([0,-1],[-1,0],[0,0],[1,0],[0,1]); }
  else if (ks === 5) {
    for (var kx = -2; kx <= 2; kx++) offsets.push([kx, 0]);
    for (var ky = -2; ky <= 2; ky++) { if (ky === 0) continue; offsets.push([-1,ky],[0,ky],[1,ky]); }
    offsets.push([-2,-1],[2,-1],[-2,0],[2,0],[-2,1],[2,1],[0,-2],[0,2]);
  } else { for (var ky2 = -off; ky2 <= off; ky2++) for (var kx2 = -off; kx2 <= off; kx2++) offsets.push([kx2, ky2]); }
  for (var y = off; y < h - off; y++) { var ro = y * w;
    for (var x = off; x < w - off; x++) {
      if (copy[ro + x] === 1) for (var k = 0; k < offsets.length; k++) mask[(y + offsets[k][1]) * w + (x + offsets[k][0])] = 1; } }
}
function applyUnsharpMask(data, w, h, amt) {
  var cp = new Uint8ClampedArray(data);
  for (var y = 1; y < h - 1; y++) { var ro = y * w * 4, pro = (y-1) * w * 4, nro = (y+1) * w * 4;
    for (var x = 1; x < w - 1; x++) { var idx = ro + x * 4;
      for (var c = 0; c < 3; c++) { var ctr = cp[idx + c];
        var lap = 4*ctr - cp[pro+x*4+c] - cp[nro+x*4+c] - cp[idx-4+c] - cp[idx+4+c];
        var en = ctr + amt * lap; data[idx+c] = en < 0 ? 0 : en > 255 ? 255 : (en+0.5)|0; } } }
}
function calcInk(data) {
  var tp = data.length / 4, nw = 0, st = Math.max(1, Math.floor(Math.sqrt(tp / 50000))), sm = 0;
  for (var i = 0; i < data.length; i += 4 * st) {
    if (0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2] < 240) nw++; sm++; }
  return Number(((nw / sm) * 100).toFixed(1));
}
function processPage(buffer, width, height, params, profile) {
  var src = new Uint8ClampedArray(buffer);
  var sw = width, sh = height;
  var ct = Math.floor(sh * (params.bannerCropTopPct / 100));
  var cb = Math.floor(sh * (params.bannerCropBottomPct / 100));
  var dw = sw, dh = Math.max(10, sh - ct - cb);
  var dst = new Uint8ClampedArray(dw * dh * 4);
  var convertColors = params.invertMode === 'smart';
  var isDark = profile.classification === 'DARK_SLIDE' || profile.darkBackgroundRatio > 0.4;
  var shouldProcess = params.invertMode !== 'none' || isDark;
  if (!shouldProcess) {
    for (var y = 0; y < dh; y++) { var sro = (y+ct)*sw*4, dro = y*dw*4;
      for (var x = 0; x < dw; x++) { var si = sro+x*4, di = dro+x*4;
        dst[di]=src[si]; dst[di+1]=src[si+1]; dst[di+2]=src[si+2]; dst[di+3]=255; } }
    return { buffer: dst.buffer, width: dw, height: dh };
  }
  var tp = dw * dh, fm = new Uint8Array(tp);
  var hsv = [0, 0, 0];
  if (convertColors) {
    var cm = [], cf = [false,false,false,false,false,false,false];
    for (var c = 0; c < 7; c++) cm.push(new Uint8Array(tp));
    for (var y2 = 0; y2 < dh; y2++) { var sro2 = (y2+ct)*sw*4, dro2 = y2*dw;
      for (var x2 = 0; x2 < dw; x2++) { var si2 = sro2+x2*4;
        rgbToHsv(src[si2], src[si2+1], src[si2+2], hsv);
        var h = hsv[0], s = hsv[1], v = hsv[2];
        if (v < 70) continue; var pi = dro2+x2;
        if (s < 55 && v > 155) { cm[0][pi]=1; cf[0]=true; }
        if (h>=15 && h<=35 && s>80 && v>100) { cm[1][pi]=1; cf[1]=true; }
        if (h>=36 && h<=85 && s>55 && v>75) { cm[2][pi]=1; cf[2]=true; }
        if (h>=86 && h<=105 && s>55 && v>75) { cm[3][pi]=1; cf[3]=true; }
        if (h>=106 && h<=135 && s>55 && v>65) { cm[4][pi]=1; cf[4]=true; }
        if (h>=136 && h<=175 && s>55 && v>75) { cm[5][pi]=1; cf[5]=true; }
        if (((h<=15)||(h>=175)) && s>75 && v>95) { cm[6][pi]=1; cf[6]=true; } } }
    for (var c2 = 0; c2 < 7; c2++) {
      if (cf[c2]) { stripDecorativeFills(cm[c2], dw, dh); for (var i = 0; i < tp; i++) if (cm[c2][i]===1) fm[i]=1; } }
  } else {
    for (var y3 = 0; y3 < dh; y3++) { var sro3 = (y3+ct)*sw*4, dro3 = y3*dw;
      for (var x3 = 0; x3 < dw; x3++) { var si3 = sro3+x3*4;
        if (0.299*src[si3]+0.587*src[si3+1]+0.114*src[si3+2] >= 70) fm[dro3+x3]=1; } }
  }
  if (params.strokeEnhancement !== 'none') applyMaskDilation(fm, dw, dh, params.strokeEnhancement === 'strong' ? 5 : 3);
  removeNoise(fm, dw, dh);
  for (var i2 = 0; i2 < tp; i2++) { var di2 = i2*4, val = fm[i2]===1 ? 0 : 255;
    dst[di2]=val; dst[di2+1]=val; dst[di2+2]=val; dst[di2+3]=255; }
  if (params.sharpenAmount > 0) applyUnsharpMask(dst, dw, dh, params.sharpenAmount / 100);
  return { buffer: dst.buffer, width: dw, height: dh };
}
self.onmessage = function(e) {
  var msg = e.data;
  if (msg.type === 'TERMINATE') { self.close(); return; }
  if (msg.type !== 'PROCESS_PAGE') return;
  try {
    var srcData = new Uint8ClampedArray(msg.buffer);
    var inkBefore = calcInk(srcData);
    var result = processPage(msg.buffer, msg.width, msg.height, msg.params, msg.profile);
    var outData = new Uint8ClampedArray(result.buffer);
    var inkAfter = calcInk(outData);
    self.postMessage({ type: 'PAGE_PROCESSED', pageIndex: msg.pageIndex,
      buffer: result.buffer, width: result.width, height: result.height,
      inkCoverageBeforePct: inkBefore, inkCoverageAfterPct: inkAfter }, [result.buffer]);
  } catch (err) {
    self.postMessage({ type: 'PAGE_ERROR', pageIndex: msg.pageIndex, error: String(err) });
  }
};
`;
}

class PersistentWorkerPool {
  private workers: PooledWorker[] = [];
  private taskQueue: QueuedTask[] = [];
  private initialized = false;
  private blobUrl: string | null = null;
  private useWorkers: boolean;

  constructor() {
    this.useWorkers = typeof window !== 'undefined' && typeof Worker !== 'undefined';
  }

  private initialize(): void {
    if (this.initialized || !this.useWorkers) return;
    try {
      const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const poolSize = isMobile ? 1 : Math.min(4, Math.max(1, cores - 1));

      // Create Blob URL for inline worker - avoids GitHub Pages MIME type issues
      const script = getInlineWorkerScript();
      const blob = new Blob([script], { type: 'application/javascript' });
      this.blobUrl = URL.createObjectURL(blob);

      for (let i = 0; i < poolSize; i++) {
        const worker = new Worker(this.blobUrl);
        const pooled: PooledWorker = { worker, busy: false, currentTask: null };
        worker.onmessage = (e: MessageEvent) => this.onMsg(pooled, e);
        worker.onerror = () => this.onErr(pooled);
        this.workers.push(pooled);
      }
      this.initialized = true;
    } catch {
      this.useWorkers = false;
      this.workers = [];
    }
  }

  private onMsg(p: PooledWorker, e: MessageEvent): void {
    const msg = e.data;
    const task = p.currentTask;
    if (!task) return;

    if (msg.type === 'PAGE_PROCESSED') {
      task.resolve({
        pageIndex: msg.pageIndex,
        optimizedImageData: new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height),
        inkCoverageBeforePct: msg.inkCoverageBeforePct,
        inkCoverageAfterPct: msg.inkCoverageAfterPct,
      });
    } else if (msg.type === 'PAGE_ERROR') {
      this.fallback(task);
    }
    p.busy = false;
    p.currentTask = null;
    this.dispatchNext();
  }

  private onErr(p: PooledWorker): void {
    if (p.currentTask) this.fallback(p.currentTask);
    p.busy = false;
    p.currentTask = null;

    // Replace dead worker
    try {
      const idx = this.workers.indexOf(p);
      if (idx !== -1 && this.blobUrl) {
        p.worker.terminate();
        const nw = new Worker(this.blobUrl);
        const np: PooledWorker = { worker: nw, busy: false, currentTask: null };
        nw.onmessage = (e: MessageEvent) => this.onMsg(np, e);
        nw.onerror = () => this.onErr(np);
        this.workers[idx] = np;
      }
    } catch {
      const idx = this.workers.indexOf(p);
      if (idx !== -1) this.workers.splice(idx, 1);
    }
    this.dispatchNext();
  }

  /**
   * Fallback: process on main thread using the original ImageData reference.
   * No extra buffer copy is needed — the source ImageData retains its own
   * ArrayBuffer which was never transferred or detached.
   */
  private fallback(task: QueuedTask): void {
    try {
      const img = task.sourceImageData;
      const ib = ImageProcessingKernels.calculateInkCoverage(img);
      const opt = ImageProcessingKernels.processImage(img, task.params, task.profile);
      const ia = ImageProcessingKernels.calculateInkCoverage(opt);
      task.resolve({
        pageIndex: task.pageIndex,
        optimizedImageData: opt,
        inkCoverageBeforePct: ib,
        inkCoverageAfterPct: ia,
      });
    } catch (e) {
      task.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private dispatchNext(): void {
    if (this.taskQueue.length === 0) return;
    const idle = this.workers.find(w => !w.busy);
    if (!idle) return;
    this.send(idle, this.taskQueue.shift()!);
  }

  private send(p: PooledWorker, task: QueuedTask): void {
    p.busy = true;
    p.currentTask = task;
    p.worker.postMessage({
      type: 'PROCESS_PAGE',
      pageIndex: task.pageIndex,
      width: task.width,
      height: task.height,
      buffer: task.buffer,
      params: task.params,
      profile: task.profile,
    }, [task.buffer]);
  }

  public async processPage(
    pageIndex: number,
    imageData: ImageData,
    params: ProcessingParameters,
    profile: PageProfile
  ): Promise<WorkerProcessResult> {
    this.initialize();

    if (!this.useWorkers || this.workers.length === 0) {
      // Direct main-thread processing (no worker available)
      return new Promise((resolve, reject) => {
        this.fallback({
          pageIndex,
          buffer: imageData.data.buffer,
          sourceImageData: imageData,
          width: imageData.width, height: imageData.height,
          params, profile, resolve, reject,
        });
      });
    }

    return new Promise((resolve, reject) => {
      // Single copy for worker transfer. The original imageData.data.buffer
      // remains intact as fallback — no second allocation needed.
      const workerBuffer = imageData.data.buffer.slice(0);
      const task: QueuedTask = {
        pageIndex,
        buffer: workerBuffer,
        sourceImageData: imageData,
        width: imageData.width, height: imageData.height,
        params, profile, resolve, reject,
      };
      const idle = this.workers.find(w => !w.busy);
      if (idle) this.send(idle, task);
      else this.taskQueue.push(task);
    });
  }

  public getStats() {
    return {
      poolSize: this.workers.length,
      busyCount: this.workers.filter(w => w.busy).length,
      queueLength: this.taskQueue.length,
      initialized: this.initialized,
    };
  }

  public destroy(): void {
    for (const p of this.workers) {
      try { p.worker.postMessage({ type: 'TERMINATE' }); p.worker.terminate(); } catch { /* noop */ }
    }
    this.workers = [];
    this.taskQueue = [];
    this.initialized = false;
    if (this.blobUrl) { URL.revokeObjectURL(this.blobUrl); this.blobUrl = null; }
  }
}

export const workerPool = new PersistentWorkerPool();
