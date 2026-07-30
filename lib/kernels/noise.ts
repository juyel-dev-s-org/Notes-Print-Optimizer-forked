import { ensureCC, getCCLabels, getCCQueue } from './connectedComponents';

export function stripDecorativeFills(mask: Uint8Array, w: number, h: number): void {
  const tp = w * h; ensureCC(tp);
  const labels = getCCLabels(), queue = getCCQueue();
  let cl = 1;
  const sMinX: number[] = [0], sMinY: number[] = [0], sMaxX: number[] = [0], sMaxY: number[] = [0], sArea: number[] = [0];
  for (let i = 0; i < tp; i++) {
    if (mask[i] === 1 && labels[i] === 0) {
      const lb = cl++;
      let mnx = w, mny = h, mxx = -1, mxy = -1, ar = 0, hd = 0, tl = 0;
      queue[tl++] = i; labels[i] = lb;
      while (hd < tl) {
        const cu = queue[hd++], cx = cu % w, cy = (cu / w) | 0;
        if (cx < mnx) mnx = cx; if (cx > mxx) mxx = cx;
        if (cy < mny) mny = cy; if (cy > mxy) mxy = cy; ar++;
        const yS = cy > 0 ? cy - 1 : cy, yE = cy < h - 1 ? cy + 1 : cy;
        const xS = cx > 0 ? cx - 1 : cx, xE = cx < w - 1 ? cx + 1 : cx;
        for (let ny = yS; ny <= yE; ny++) { const ro = ny * w;
          for (let nx = xS; nx <= xE; nx++) { if (nx === cx && ny === cy) continue;
            const ni = ro + nx;
            if (mask[ni] === 1 && labels[ni] === 0) { labels[ni] = lb; queue[tl++] = ni; } } }
      }
      sMinX.push(mnx); sMinY.push(mny); sMaxX.push(mxx); sMaxY.push(mxy); sArea.push(ar);
    }
  }
  const drop = new Uint8Array(cl);
  for (let lb = 1; lb < cl; lb++) {
    const cw = sMaxX[lb] - sMinX[lb] + 1, ch = sMaxY[lb] - sMinY[lb] + 1;
    if (sArea[lb] >= 200 && cw / Math.max(ch, 1) > 2.2 && cw / w > 0.20 && sMinY[lb] / h < 0.15 && sArea[lb] > cw * ch * 0.3) drop[lb] = 1;
  }
  for (let i = 0; i < tp; i++) { const l = labels[i]; if (l > 0 && drop[l] === 1) mask[i] = 0; }
}

export function removeNoise(mask: Uint8Array, w: number, h: number): void {
  const tp = w * h; ensureCC(tp);
  const labels = getCCLabels(), queue = getCCQueue();
  let cl = 1; const sArea: number[] = [0];
  for (let i = 0; i < tp; i++) {
    if (mask[i] === 1 && labels[i] === 0) {
      const lb = cl++; let ar = 0, hd = 0, tl = 0;
      queue[tl++] = i; labels[i] = lb;
      while (hd < tl) {
        const cu = queue[hd++], cx = cu % w, cy = (cu / w) | 0; ar++;
        const yS = cy > 0 ? cy - 1 : cy, yE = cy < h - 1 ? cy + 1 : cy;
        const xS = cx > 0 ? cx - 1 : cx, xE = cx < w - 1 ? cx + 1 : cx;
        for (let ny = yS; ny <= yE; ny++) { const ro = ny * w;
          for (let nx = xS; nx <= xE; nx++) { if (nx === cx && ny === cy) continue;
            const ni = ro + nx;
            if (mask[ni] === 1 && labels[ni] === 0) { labels[ni] = lb; queue[tl++] = ni; } } }
      }
      sArea.push(ar);
    }
  }
  const minA = Math.max(6, (tp / 600000) | 0);
  for (let i = 0; i < tp; i++) { const l = labels[i]; if (l > 0 && sArea[l] < minA) mask[i] = 0; }
}
