import { PDFDocument } from 'pdf-lib';
import type { IPlugin, PluginManifest, PluginContext, PluginResult, PluginMetrics } from '../pipeline/plugin/types';
import { Channels } from '../pipeline/plugin/channels';

const manifest: PluginManifest = {
  id: 'npo.export.pdf@1.0.0',
  name: 'PDF Exporter',
  version: '1.0.0',
  description: 'Assembles composed sheet JPEGs into a final PDF document',
  dependsOn: ['npo.layout.compose@1.0.0'],
  inputChannel: Channels.SHEET_COMPOSITION,
  outputChannel: Channels.PDF_DOCUMENT,
  executionTarget: 'main',
  optional: false,
};

export class ExportPlugin implements IPlugin<{ sheets: ArrayBuffer[]; format: 'jpeg' }, Blob> {
  readonly manifest = manifest;

  async execute(
    input: { sheets: ArrayBuffer[]; format: 'jpeg' },
    ctx: PluginContext,
  ): Promise<PluginResult<Blob>> {
    const t0 = performance.now();
    const pdfDoc = await PDFDocument.create();

    for (const sheetBuf of input.sheets) {
      const embedded = await pdfDoc.embedJpg(sheetBuf);
      const { width, height } = embedded;
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(embedded, { x: 0, y: 0, width, height });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });

    const totalInputBytes = input.sheets.reduce((s, b) => s + b.byteLength, 0);
    const metrics: PluginMetrics = {
      durationMs: Math.round(performance.now() - t0),
      inputBytes: totalInputBytes,
      outputBytes: blob.size,
    };

    return { data: blob, metrics };
  }
}
