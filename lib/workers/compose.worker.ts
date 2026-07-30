import type { WorkerRequest, WorkerResponse } from './protocol';

function generateComposeContent(
  ctx: OffscreenCanvasRenderingContext2D,
  dims: { widthPx: number; heightPx: number },
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
  showSlideBorders: boolean,
  showPageNumbers: boolean,
) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, dims.widthPx, dims.heightPx);

  const cellW = Math.max(10, Math.floor((dims.widthPx - marginLeft - marginRight - (cols - 1) * marginInner) / cols));
  const cellH = Math.max(10, Math.floor((dims.heightPx - marginTop - marginBottom - (rows - 1) * marginInner) / rows));

  for (let i = 0; i < pageBuffers.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cellX = marginLeft + col * (cellW + marginInner);
    const cellY = marginTop + row * (cellH + marginInner);
    const scale = Math.min(cellW / pageWidths[i], cellH / pageHeights[i]);
    const dW = Math.floor(pageWidths[i] * scale), dH = Math.floor(pageHeights[i] * scale);
    const dX = cellX + Math.floor((cellW - dW) / 2), dY = cellY + Math.floor((cellH - dH) / 2);

    const imageData = new ImageData(new Uint8ClampedArray(pageBuffers[i]), pageWidths[i], pageHeights[i]);
    const tmp = new OffscreenCanvas(pageWidths[i], pageHeights[i]);
    const tCtx = tmp.getContext('2d')!;
    tCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tmp, dX, dY, dW, dH);

    if (showSlideBorders) {
      ctx.strokeStyle = '#CCCCCC';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellW, cellH);
    }
  }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'PING') {
    (self as any).postMessage({ type: 'PONG' } satisfies WorkerResponse);
    return;
  }

  if (msg.type === 'TERMINATE') {
    self.close();
    return;
  }

  if (msg.type === 'COMPOSE_SHEET') {
    const { task } = msg;
    try {
      const canvas = new OffscreenCanvas(task.dims.widthPx, task.dims.heightPx);
      const ctx = canvas.getContext('2d')!;

      generateComposeContent(
        ctx, task.dims, task.pageBuffers, task.pageWidths, task.pageHeights,
        task.cols, task.rows, task.marginTop, task.marginLeft, task.marginRight,
        task.marginBottom, task.marginInner, task.showSlideBorders, task.showPageNumbers,
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
      (self as any).postMessage(response, [buffer]);
    } catch (err: any) {
      (self as any).postMessage({ type: 'ERROR', taskId: task.taskId, error: err?.message ?? String(err) } satisfies WorkerResponse);
    }
    return;
  }

  if (msg.type === 'CANCEL') {
    return;
  }
};
