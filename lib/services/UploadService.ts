export interface UploadedItem {
  id: string;
  file: File;
  name: string;
  sizeMB: string;
  arrayBuffer: ArrayBuffer;
}

export class UploadService {
  static async readFiles(files: File[]): Promise<UploadedItem[]> {
    let counter = 0;
    const items: UploadedItem[] = [];
    for (const file of files) {
      counter++;
      const buffer = await file.arrayBuffer();
      items.push({
        id: `file-${counter}-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`,
        file, name: file.name,
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
        arrayBuffer: buffer,
      });
    }
    return items;
  }

  static async mergeAndPreview(items: UploadedItem[]): Promise<{ pdfBlob: Blob; pdfBytes: Uint8Array; thumbnails: string[] } | null> {
    if (items.length === 0) return null;
    // Defer pdf-lib (via PdfExporter) until a merge is actually requested.
    const { PdfExporter } = await import('../optimizer/pdfExporter');
    const buffers = items.map(it => it.arrayBuffer);
    const { pdfBytes, pdfBlob } = await PdfExporter.mergePdfBuffers(buffers);
    const pdfjsLib = await PdfExporter.initPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const renderCount = Math.min(totalPages, 12);
    const thumbnails: string[] = [];
    for (let i = 1; i <= renderCount; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b || new Blob()), 'image/jpeg', 0.6));
      thumbnails.push(URL.createObjectURL(blob));
    }
    return { pdfBlob, pdfBytes, thumbnails };
  }

  static async generateSamplePdf(): Promise<UploadedItem> {
    const { SamplePdfGenerator } = await import('../optimizer/samplePdfGenerator');
    const sampleBytes = await SamplePdfGenerator.generateSamplePWDoc();
    const pdfBuffer = sampleBytes.buffer as ArrayBuffer;
    const file = new File([pdfBuffer], 'PW_Sample_Class_Notes.pdf', { type: 'application/pdf' });
    return {
      id: 'sample-pw-notes', file, name: file.name,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      arrayBuffer: pdfBuffer,
    };
  }
}
