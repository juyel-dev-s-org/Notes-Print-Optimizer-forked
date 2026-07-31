export type ChannelId = string;

export const Channels = {
  RAW_PDF: 'channel:raw-pdf',
  PAGE_IMAGE: 'channel:page-image',
  PAGE_PROFILE: 'channel:page-profile',
  OPTIMIZED_IMAGE: 'channel:optimized',
  SHEET_COMPOSITION: 'channel:sheets',
  PDF_DOCUMENT: 'channel:pdf-output',
  THUMBNAIL: 'channel:thumbnail',
} as const;

export type PageProfile = import('../../optimizer/types').PageProfile;

export interface ChannelDataMap {
  [Channels.RAW_PDF]: ArrayBuffer;
  [Channels.PAGE_IMAGE]: { imageData: ImageData; pageNumber: number };
  [Channels.PAGE_PROFILE]: { imageData: ImageData; pageNumber: number; profile: PageProfile };
  [Channels.OPTIMIZED_IMAGE]: { imageData: ImageData; pageNumber: number; profile: PageProfile; inkBefore: number; inkAfter: number };
  [Channels.SHEET_COMPOSITION]: { sheets: ArrayBuffer[]; format: 'jpeg' };
  [Channels.PDF_DOCUMENT]: Blob;
  [Channels.THUMBNAIL]: { dataUrl: string; pageNumber: number };
}
