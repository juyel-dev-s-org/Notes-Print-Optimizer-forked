/**
 * Central site configuration — the single authoritative source for every
 * absolute public URL (metadataBase, canonicals, Open Graph, sitemap, robots,
 * JSON-LD). Host-agnostic by design:
 *
 *   NEXT_PUBLIC_SITE_URL            → explicit override (any host)
 *   VERCEL_PROJECT_PRODUCTION_URL   → automatic on Vercel production
 *   legacy GitHub Pages fallback    → last resort so nothing silently breaks
 *
 * Nothing else in the codebase may hard-code a production domain.
 */

const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, '');

export const SITE_URL =
  explicit ||
  (vercel ? `https://${vercel}` : 'https://juyel-dev.github.io/Notes-Print-Optimizer');

/** Build-time base path (Pages-style subpath deploys); '' at root hosts. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** Prefix a root-relative path with the deploy base path. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** Absolute public URL for a root-relative path (canonical/OG/sitemap/JSON-LD). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${withBase(path)}`;
}
