/**
 * Page Processor Web Worker - Self-contained pixel processing kernels.
 */
const hsvOut: [number, number, number] = [0, 0, 0];
function rgbToHsvInline(r: number, g: number, b: number): void {
  const rN = r * 0.00392156862745098, gN = g * 0.00392156862745098, bN = b * 0.00392156862745098;
  const vN = rN > gN ? (rN > bN ? rN : bN) : (gN > bN ? gN : bN);
  const mn = rN < gN ? (rN < bN ? rN : bN) : (gN < bN ? gN : bN);
  const delta = vN - mn; let hN = 0;
  if (delta !== 0) { if (vN === rN) hN = 60 * (((gN - bN) / delta) % 6);
    else if (vN === gN) hN = 60 * ((bN - rN) / delta + 2);
    else hN = 60 * ((rN - gN) / delta + 4); if (hN < 0) hN += 360; }
  hsvOut[0] = (hN * 0.5 + 0.5) | 0; hsvOut[1] = (vN === 0 ? 0 : (delta / vN) * 255 + 0.5) | 0; hsvOut[2] = (vN * 255 + 0.5) | 0;
}
let ccLabels: Int32Array | null = null, ccQueue: Int32Array | null = null, ccCap = 0;
function ensureCC(size: number): void { if (ccCap < size) { ccLabels = new Int32Array(size); ccQueue = new Int32Array(size); ccCap = size; } else ccLabels!.fill(0, 0, size); }
function stripDecorativeFills(mask: Uint8Array, w: number, h: number): void {
  const tp = w * h; ensureCC(tp); const labels = ccLabels!, queue = ccQueue!; let cl = 1;
  const sMinX: number[] = [0], sMinY: number[] = [0], sMaxX: number[] = [0], sMaxY: number[] = [0], sArea: number[] = [0];
  for (let i = 0; i < tp; i++) { if (mask[i] === 1 && labels[i] === 0) { const lb = cl++;
    let mnx = w, mny = h, mxx = -1, mxy = -1, ar = 0, hd = 0, tl = 0;
    queue[tl++] = i; labels[i] = lb;
    while (hd < tl) { const cu = queue[hd++], cx = cu % w, cy = (cu / w) | 0;
      if (cx < mnx) mnx = cx; if (cx > mxx) mxx = cx; if (cy < mny) mny = cy; if (cy > mxy) mxy = cy; ar++;
      const yS = cy > 0 ? cy - 1 : cy, yE = cy < h - 1 ? cy + 1 : cy, xS = cx > 0 ? cx - 1 : cx, xE = cx < w - 1 ? cx + 1 : cx;
      for (let ny = yS; ny <= yE; ny++) { const ro = ny * w; for (let nx = xS; nx <= xE; nx++) {
        if (nx === cx && ny === cy) continue; const ni = ro + nx;
        if (mask[ni] === 1 && labels[ni] === 0) { labels[ni] = lb; queue[tl++] = ni; } } } }
    sMinX.push(mnx); sMinY.push(mny); sMaxX.push(mxx); sMaxY.push(mxy); sArea.push(ar); } }
  const drop = new Uint8Array(cl);
  for (let lb = 1; lb < cl; lb++) { const cw = sMaxX[lb] - sMinX[lb] + 1, ch = sMaxY[lb] - sMinY[lb] + 1;
    if (sArea[lb] >= 200 && cw / Math.max(ch, 1) > 2.2 && cw / w > 0.20 && sMinY[lb] / h < 0.15 && sArea[lb] > cw * ch * 0.3) drop[lb] = 1; }
  for (let i = 0; i < tp; i++) { const l = labels[i]; if (l > 0 && drop[l] === 1) mask[i] = 0; }
}
function removeNoise(mask: Uint8Array, w: number, h: number): void {
  const tp = w * h; ensureCC(tp); const labels = ccLabels!, queue = ccQueue!; let cl = 1; const sArea: number[] = [0];
  for (let i = 0; i < tp; i++) { if (mask[i] === 1 && labels[i] === 0) { const lb = cl++; let ar = 0, hd = 0, tl = 0;
    queue[tl++] = i; labels[i] = lb;
    while (hd < tl) { const cu = queue[hd++], cx = cu % w, cy = (cu / w) | 0; ar++;
      const yS = cy > 0 ? cy - 1 : cy, yE = cy < h - 1 ? cy + 1 : cy, xS = cx > 0 ? cx - 1 : cx, xE = cx < w - 1 ? cx + 1 : cx;
      for (let ny = yS; ny <= yE; ny++) { const ro = ny * w; for (let nx = xS; nx <= xE; nx++) {
        if (nx === cx && ny === cy) continue; const ni = ro + nx;
        if (mask[ni] === 1 && labels[ni] === 0) { labels[ni] = lb; queue[tl++] = ni; } } } }
    sArea.push(ar); } }
  const minA = Math.max(6, (tp / 600000) | 0);
  for (let i = 0; i < tp; i++) { const l = labels[i]; if (l > 0 && sArea[l] < minA) mask[i] = 0; }
}
function applyMaskDilation(mask: Uint8Array, w: number, h: number, ks: number): void {
  const copy = new Uint8Array(mask); const off = (ks / 2) | 0; const offsets: Array<[number, number]> = [];
  if (ks === 3) offsets.push([0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]);
  else if (ks === 5) { for (let kx = -2; kx <= 2; kx++) offsets.push([kx, 0]);
    for (let ky = -2; ky <= 2; ky++) { if (ky === 0) continue; offsets.push([-1, ky], [0, ky], [1, ky]); }
    offsets.push([-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [0, -2], [0, 2]);
  } else { for (let ky = -off; ky <= off; ky++) for (let kx = -off; kx <= off; kx++) offsets.push([kx, ky]); }
  for (let y = off; y < h - off; y++) { const ro = y * w;
    for (let x = off; x < w - off; x++) { if (copy[ro + x] === 1) for (let k = 0; k < offsets.length; k++) mask[(y + offsets[k][1]) * w + (x + offsets[k][0])] = 1; } }
}
function applyUnsharpMask(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  const cp = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) { const ro = y * w * 4, pro = (y - 1) * w * 4, nro = (y + 1) * w * 4;
    for (let x = 1; x < w - 1; x++) { const idx = ro + x * 4;
      for (let c = 0; c < 3; c++) { const ctr = cp[idx + c];
        const lap = 4 * ctr - cp[pro + x * 4 + c] - cp[nro + x * 4 + c] - cp[idx - 4 + c] - cp[idx + 4 + c];
        const en = ctr + amt * lap; data[idx + c] = en < 0 ? 0 : en > 255 ? 255 : (en + 0.5) | 0; } } }
}
function calcInk(data: Uint8ClampedArray): number {
  const tp = data.length / 4; let nw = 0; const st = Math.max(1, Math.floor(Math.sqrt(tp / 50000))); let sm = 0;
  for (let i = 0; i < data.length; i += 4 * st) { if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 240) nw++; sm++; }
  return Number(((nw / sm) * 100).toFixed(1));
}
function processPage(src: Uint8ClampedArray, sw: number, sh: number, params: any, profile: any) {
  const inkBefore = calcInk(src);
  const ct = Math.floor(sh * (params.bannerCropTopPct / 100)), cb = Math.floor(sh * (params.bannerCropBottomPct / 100));
  const dw = sw, dh = Math.max(10, sh - ct - cb); const dst = new Uint8ClampedArray(dw * dh * 4);
  const cc = params.invertMode === 'smart';
  const dark = profile.classification === 'DARK_SLIDE' || profile.darkBackgroundRatio > 0.4;
  const proc = params.invertMode !== 'none' || dark;
  if (!proc) { for (let y = 0; y < dh; y++) { const sro = (y + ct) * sw * 4, dro = y * dw * 4;
    for (let x = 0; x < dw; x++) { const si = sro + x * 4, di = dro + x * 4;
      dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = 255; } }
    return { dst, dw, dh, inkBefore, inkAfter: calcInk(dst) }; }
  const tp = dw * dh; const fm = new Uint8Array(tp);
  if (cc) { const cm: Uint8Array[] = []; const cf: boolean[] = [false, false, false, false, false, false, false];
    for (let c = 0; c < 7; c++) cm.push(new Uint8Array(tp));
    for (let y = 0; y < dh; y++) { const sro = (y + ct) * sw * 4, dro = y * dw;
      for (let x = 0; x < dw; x++) { const si = sro + x * 4;
        rgbToHsvInline(src[si], src[si + 1], src[si + 2]);
        const h = hsvOut[0], s = hsvOut[1], v = hsvOut[2]; if (v < 70) continue; const pi = dro + x;
        if (s < 55 && v > 155) { cm[0][pi] = 1; cf[0] = true; }
        if (h >= 15 && h <= 35 && s > 80 && v > 100) { cm[1][pi] = 1; cf[1] = true; }
        if (h >= 36 && h <= 85 && s > 55 && v > 75) { cm[2][pi] = 1; cf[2] = true; }
        if (h >= 86 && h <= 105 && s > 55 && v > 75) { cm[3][pi] = 1; cf[3] = true; }
        if (h >= 106 && h <= 135 && s > 55 && v > 65) { cm[4][pi] = 1; cf[4] = true; }
        if (h >= 136 && h <= 175 && s > 55 && v > 75) { cm[5][pi] = 1; cf[5] = true; }
        if (((h <= 15) || (h >= 175)) && s > 75 && v > 95) { cm[6][pi] = 1; cf[6] = true; } } }
    for (let c = 0; c < 7; c++) { if (cf[c]) { stripDecorativeFills(cm[c], dw, dh); for (let i = 0; i < tp; i++) if (cm[c][i] === 1) fm[i] = 1; } }
  } else { for (let y = 0; y < dh; y++) { const sro = (y + ct) * sw * 4, dro = y * dw;
    for (let x = 0; x < dw; x++) { const si = sro + x * 4;
      if (0.299 * src[si] + 0.587 * src[si + 1] + 0.114 * src[si + 2] >= 70) fm[dro + x] = 1; } } }
  if (params.strokeEnhancement !== 'none') applyMaskDilation(fm, dw, dh, params.strokeEnhancement === 'strong' ? 5 : 3);
  removeNoise(fm, dw, dh);
  for (let i = 0; i < tp; i++) { const di = i * 4, v = fm[i] === 1 ? 0 : 255; dst[di] = v; dst[di + 1] = v; dst[di + 2] = v; dst[di + 3] = 255; }
  if (params.sharpenAmount > 0) applyUnsharpMask(dst, dw, dh, params.sharpenAmount / 100);
  return { dst, dw, dh, inkBefore, inkAfter: calcInk(dst) };
}
interface WorkerGlobalCtx {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(message: any, transfer: Transferable[]): void;
  close(): void;
}
const ctx = self as unknown as WorkerGlobalCtx;
ctx.onmessage = (e: MessageEvent) => { const msg = e.data;
  if (msg.type === 'PROCESS_PAGE') { try { const src = new Uint8ClampedArray(msg.buffer);
    const r = processPage(src, msg.width, msg.height, msg.params, msg.profile);
    ctx.postMessage({ type: 'PAGE_PROCESSED', pageIndex: msg.pageIndex, width: r.dw, height: r.dh,
      buffer: r.dst.buffer, inkCoverageBeforePct: r.inkBefore, inkCoverageAfterPct: r.inkAfter }, [r.dst.buffer]);
  } catch (err: any) { ctx.postMessage({ type: 'PAGE_ERROR', pageIndex: msg.pageIndex, error: err?.message || 'Worker error' }); }
  } else if (msg.type === 'TERMINATE') { ctx.close(); } };
