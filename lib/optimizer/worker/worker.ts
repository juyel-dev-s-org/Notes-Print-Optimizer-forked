import {
  processPage,
  calculateInkCoverage,
  setWasmHooks,
} from './kernels';
import { ensureWasm, applyMaskDilation as wasmDilation, applyUnsharpMask as wasmUnsharp } from '../wasm/wasmRuntime';
import type { WorkerRequest, WorkerResponse, ComposeSheetParams } from './protocol';

let cancelled = false;

ensureWasm().then(() => setWasmHooks(wasmDilation, wasmUnsharp));

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'TERMINATE') { (self as any).close(); return; }
  if (msg.type === 'CANCEL') { cancelled = true; return; }
  if (msg.type === 'COMPOSE_SHEET') { composeSheet(msg.params); return; }
  if (msg.type !== 'PROCESS_PAGE') return;

  cancelled = false;

  try {
    const srcData = new Uint8ClampedArray(msg.buffer);
    const inkBefore = calculateInkCoverage(srcData);
    const result = processPage(srcData, msg.width, msg.height, msg.params, msg.profile);
    if (cancelled) return;
    const outData = new Uint8ClampedArray(result.buffer);
    const inkAfter = calculateInkCoverage(outData);

    const response: WorkerResponse = {
      type: 'PAGE_PROCESSED',
      pageIndex: msg.pageIndex,
      buffer: result.buffer,
      width: result.width,
      height: result.height,
      inkCoverageBeforePct: inkBefore,
      inkCoverageAfterPct: inkAfter,
    };
    (self as any).postMessage(response, [result.buffer]);
  } catch (err) {
    if (cancelled) return;
    const response: WorkerResponse = {
      type: 'PAGE_ERROR',
      pageIndex: msg.pageIndex,
      error: String(err),
    };
    (self as any).postMessage(response);
  }
};

async function composeSheet(params: ComposeSheetParams): Promise<void> {
  try {
    const { sheetIndex, totalSheets, pageBuffers, pageWidths, pageHeights, dims, cols, rows } = params;
    const canvas = new OffscreenCanvas(dims.widthPx, dims.heightPx);
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, dims.widthPx, dims.heightPx);

    const cellW = Math.max(10, Math.floor((dims.widthPx - params.marginLeft - params.marginRight - (cols - 1) * params.marginInner) / cols));
    const cellH = Math.max(10, Math.floor((dims.heightPx - params.marginTop - params.marginBottom - (rows - 1) * params.marginInner) / cols));

    for (let i = 0; i < pageBuffers.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const cellX = params.marginLeft + col * (cellW + params.marginInner);
      const cellY = params.marginTop + row * (cellH + params.marginInner);
      const scale = Math.min(cellW / pageWidths[i], cellH / pageHeights[i]);
      const dW = Math.floor(pageWidths[i] * scale);
      const dH = Math.floor(pageHeights[i] * scale);
      const dX = cellX + Math.floor((cellW - dW) / 2);
      const dY = cellY + Math.floor((cellH - dH) / 2);

      const bmp = await createImageBitmap(new Blob([pageBuffers[i]], { type: 'image/jpeg' }));
      ctx.drawImage(bmp, dX, dY, dW, dH);
      bmp.close();

      if (params.showSlideBorders) {
        ctx.strokeStyle = '#D2D2D2';
        ctx.lineWidth = 2;
        ctx.strokeRect(cellX - 1, cellY - 1, cellW + 2, cellH + 2);
      }
    }

    if (params.showPageNumbers) {
      ctx.fillStyle = '#64748B';
      ctx.font = `500 ${Math.round(dims.dpi * 0.08)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Sheet ${sheetIndex + 1} of ${totalSheets}  \u2022  PW Notes Print Optimizer`,
        dims.widthPx / 2, dims.heightPx - Math.max(10, Math.round(params.marginBottom * 0.4)));
    }

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const buffer = await blob.arrayBuffer();
    const response: WorkerResponse = {
      type: 'SHEET_COMPOSED',
      sheetIndex,
      buffer,
      width: dims.widthPx,
      height: dims.heightPx,
    };
    (self as any).postMessage(response, [buffer]);
  } catch (err) {
    const response: WorkerResponse = {
      type: 'COMPOSE_ERROR',
      sheetIndex: params.sheetIndex,
      error: String(err),
    };
    (self as any).postMessage(response);
  }
}