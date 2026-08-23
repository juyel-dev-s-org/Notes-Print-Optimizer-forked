/**
 * Shared output-filename helpers used across every tool's download step.
 */

/** Strips filesystem-hostile characters and caps length. */
export function sanitizeBaseName(input: string): string {
  return input
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** Zero-padded per-page image name, e.g. "notes-p01.jpg". */
export function buildPageImageName(base: string, pageIndex: number, ext: string): string {
  return `${base}-p${String(pageIndex + 1).padStart(2, '0')}.${ext}`;
}
