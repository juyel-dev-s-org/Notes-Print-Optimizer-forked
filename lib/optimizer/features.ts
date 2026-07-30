let cachedOffscreenCanvas: boolean | null = null;
let cachedCreateImageBitmap: boolean | null = null;

export function canUseOffscreenCanvas(): boolean {
  if (cachedOffscreenCanvas !== null) return cachedOffscreenCanvas;
  cachedOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  return cachedOffscreenCanvas;
}

export function canCreateImageBitmap(): boolean {
  if (cachedCreateImageBitmap !== null) return cachedCreateImageBitmap;
  cachedCreateImageBitmap = typeof createImageBitmap !== 'undefined';
  return cachedCreateImageBitmap;
}
