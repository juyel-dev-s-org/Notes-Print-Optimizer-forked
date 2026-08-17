import type { WorkerRequest, WorkerResponse } from './protocol';
import { LayoutEngine } from '../optimizer/layoutEngine';

const workerSelf = self as unknown as DedicatedWorkerGlobalScope;

function generateComposeContent(
  ctx: OffscreenCanvasRenderingContext2D,
  dims: { widthPx: number; heightPx: number },
  sheetIndex: number,
  totalSheets: number,
  pageBuffers: ArrayBuffer[],
  pageWidths: number[],
  pageHeights: number[],
  cols: number,
  rows: number,
  marginTop: number,
  marginLeft: number,
  marginRight: number,
  marginBottom: number,
  marginInner: number,
  footerHeight: number,
  footerFontSize: number,
  footerBaseline: number,
  showSlideBorders: boolean,
  showPageNumbers: boolean,
) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, dims.widthPx, dims.heightPx);

  const cellW = Math.max(10, Math.floor((dims.widthPx - marginLeft - marginRight - (cols - 1) * marginInner) / cols));
  const cellH = Math.max(10, Math.floor((dims.heightPx - marginTop - marginBottom - (rows - 1) * marginInner - footerHeight) / rows));

  let tmpCanvas: OffscreenCanvas | null = null;
  let tCtx: OffscreenCanvasRenderingContext2D | null = null;

  for (let i = 0; i < pageBuffers.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cellX = marginLeft + col * (cellW + marginInner);
    const cellY = marginTop + row * (cellH + marginInner);
    const scale = Math.min(cellW / pageWidths[i], cellH / pageHeights[i]);
    const dW = Math.floor(pageWidths[i] * scale), dH = Math.floor(pageHeights[i] * scale);
    const dX = cellX + Math.floor((cellW - dW) / 2), dY = cellY + Math.floor((cellH - dH) / 2);

    const imageData = new ImageData(new Uint8ClampedArray(pageBuffers[i]), pageWidths[i], pageHeights[i]);
    if (!tmpCanvas || tmpCanvas.width !== pageWidths[i] || tmpCanvas.height !== pageHeights[i]) {
      tmpCanvas = new OffscreenCanvas(pageWidths[i], pageHeights[i]);
      tCtx = tmpCanvas.getContext('2d');
    }
    if (tCtx) {
      tCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tmpCanvas, dX, dY, dW, dH);
    }

    if (showSlideBorders) {
      ctx.strokeStyle = '#CCCCCC';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellW, cellH);
    }
  }

  if (showPageNumbers) {
    ctx.fillStyle = '#64748B';
    ctx.font = `500 ${footerFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(LayoutEngine.getSheetFooterText(sheetIndex, totalSheets), dims.widthPx / 2, footerBaseline);
  }
}

workerSelf.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'PING') {
    workerSelf.postMessage({ type: 'PONG' } satisfies WorkerResponse);
    return;
  }

  if (msg.type === 'TERMINATE') {
    workerSelf.close();
    return;
  }

  if (msg.type === 'COMPOSE_SHEET') {
    const { task } = msg;
    try {
      const canvas = new OffscreenCanvas(task.dims.widthPx, task.dims.heightPx);
      const ctx = canvas.getContext('2d')!;

      generateComposeContent(
        ctx, task.dims, task.sheetIndex, task.totalSheets, task.pageBuffers, task.pageWidths, task.pageHeights,
        task.cols, task.rows, task.marginTop, task.marginLeft, task.marginRight,
        task.marginBottom, task.marginInner, task.footerHeight, task.footerFontSize,
        task.footerBaseline, task.showSlideBorders, task.showPageNumbers,
      );

      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
      const buffer = await blob.arrayBuffer();

      const response: WorkerResponse = {
        type: 'SHEET_COMPOSED',
        taskId: task.taskId,
        sheetIndex: task.sheetIndex,
        buffer,
        width: task.dims.widthPx,
        height: task.dims.heightPx,
      };
      workerSelf.postMessage(response, [buffer]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      workerSelf.postMessage({ type: 'ERROR', taskId: task.taskId, error: message } satisfies WorkerResponse);
    }
    return;
  }

  if (msg.type === 'CANCEL') {
    return;
  }
};
