/**
 * Loads read-only Markdown documents from `public/content/` at runtime.
 * Documents are fetched once and cached in memory for the session.
 */

import type { ContentId } from './types';

/** ContentId -> file name under `public/content/`. */
const CONTENT_FILES: Record<ContentId, string> = {
  'about': 'ABOUT.md',
  'user-guide': 'USER_GUIDE.md',
  'faq': 'FAQ.md',
  'whats-new': 'WHATS_NEW.md',
  'changelog': 'CHANGELOG.md',
  'privacy-policy': 'PRIVACY_POLICY.md',
  'terms-of-use': 'TERMS_OF_USE.md',
  'jsl-license': 'JSL_LICENSE.md',
  'copyright-notice': 'COPYRIGHT_NOTICE.md',
};

const cache = new Map<ContentId, string>();

/** Resolve the deployment base path (GitHub Pages uses /Notes-Print-Optimizer). */
function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

/**
 * Fetch and cache a Markdown document. Returns null if it cannot be loaded.
 */
export async function loadContent(id: ContentId): Promise<string | null> {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;

  const file = CONTENT_FILES[id];
  if (!file) return null;

  try {
    const res = await fetch(`${basePath()}/content/${file}`, { cache: 'no-cache' });
    if (!res.ok) return null;
    const text = await res.text();
    cache.set(id, text);
    return text;
  } catch {
    return null;
  }
}

/** Clear the in-memory content cache (e.g. after a cache wipe). */
export function clearContentCache(): void {
  cache.clear();
}
