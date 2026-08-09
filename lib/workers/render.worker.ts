import type { WorkerRequest, WorkerResponse } from './protocol';

let pdfjsLib: any = null;

async function ensurePdfjs(): Promise<void> {
  if (pdfjsLib) return;
  pdfjsLib = await import('pdfjs-dist');
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

  if (msg.type === 'RENDER_PAGE') {
    const { task } = msg;
    try {
      await ensurePdfjs();

      const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(task.pdfBuffer) }).promise;
      const page = await pdfDoc.getPage(task.pageIndex);
      const viewport = page.getViewport({ scale: task.scale });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const imageBitmap = canvas.transferToImageBitmap();

      const response: WorkerResponse = {
        type: 'PAGE_RENDERED',
        taskId: task.taskId,
        pageIndex: task.pageIndex,
        buffer: new ArrayBuffer(0),
        width: viewport.width,
        height: viewport.height,
      };
      (self as any).postMessage(response);
    } catch (err: any) {
      (self as any).postMessage({ type: 'ERROR', taskId: task.taskId, error: err?.message ?? String(err) } satisfies WorkerResponse);
    }
    return;
  }

  if (msg.type === 'CANCEL') {
    return;
  }
};
