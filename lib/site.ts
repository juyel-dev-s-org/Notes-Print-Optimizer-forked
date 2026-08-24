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

// ---------------------------------------------------------------------------
// Social share images (Open Graph / Twitter) live OUTSIDE this app, in the
// `image` repo, served by jsDelivr. Swapping a card = push a PNG there —
// no app redeploy. The CDN base stays env-overridable so the provider can
// change without code edits.
// ---------------------------------------------------------------------------

const OG_CDN_BASE =
  process.env.NEXT_PUBLIC_OG_CDN_BASE?.replace(/\/$/, '') ||
  'https://cdn.jsdelivr.net/gh/juyel-dev/image@main';

/** Project folder inside the image repo (matches the public route contract). */
export const OG_PROJECT_SLUG = 'print-optimizer';

/**
 * Absolute CDN URL for a share card. `name` is the route slug + '.png'
 * (landing uses 'home.png') — see the image repo's naming contract.
 */
export function ogImageUrl(name: string): string {
  return `${OG_CDN_BASE}/${OG_PROJECT_SLUG}/og/${name}`;
}
