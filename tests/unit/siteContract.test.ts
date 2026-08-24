/**
 * Route-contract gate — the registry is the single source of truth for the
 * public URL space. These tests freeze the contract so slugs, metadata and
 * navigation can never silently drift apart (tri-source consistency).
 */

import { describe, expect, it } from 'vitest';
import {
  TOOL_REGISTRY,
  getAllToolSlugs,
  getToolBySlug,
  modeForSlug,
  slugForMode,
  toolHref,
} from '@/lib/tools/registry';
import { ogImageUrl } from '@/lib/site';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('public route contract', () => {
  it('every tool has a unique, kebab-case, non-empty slug', () => {
    const slugs = getAllToolSlugs();
    expect(slugs.length).toBe(TOOL_REGISTRY.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(SLUG_RE);
  });

  it('mode <-> slug roundtrip is lossless for every tool', () => {
    for (const tool of TOOL_REGISTRY) {
      expect(slugForMode(tool.id)).toBe(tool.slug);
      expect(modeForSlug(tool.slug)).toBe(tool.id);
      expect(getToolBySlug(tool.slug)?.id).toBe(tool.id);
    }
  });

  it('toolHref always emits the trailing-slash directory form', () => {
    for (const tool of TOOL_REGISTRY) {
      expect(toolHref(tool.id)).toBe(`/tools/${tool.slug}/`);
    }
  });

  it('unknown slugs resolve to null (landing), never throw', () => {
    expect(modeForSlug('not-a-tool')).toBeNull();
    expect(getToolBySlug('not-a-tool')).toBeUndefined();
  });

  it('SEO copy is present and unique per tool', () => {
    const titles = TOOL_REGISTRY.map((t) => t.seoTitle);
    const descs = TOOL_REGISTRY.map((t) => t.seoDescription);
    expect(new Set(titles).size).toBe(TOOL_REGISTRY.length);
    expect(new Set(descs).size).toBe(TOOL_REGISTRY.length);
    for (const t of TOOL_REGISTRY) {
      expect(t.seoTitle.length).toBeGreaterThan(15);
      expect(t.seoDescription.length).toBeGreaterThan(60);
      expect(t.seoDescription.length).toBeLessThanOrEqual(320);
    }
  });

  it('known flagship slugs are frozen (public URL contract)', () => {
    // Renaming any of these breaks published URLs — treat failures as a
    // breaking-change signal requiring an explicit redirect plan.
    const frozen: Record<string, string> = {
      'dark-print': 'dark-print',
      enhance: 'enhance-light-pdf',
      protect: 'protect-pdf',
      'to-images': 'pdf-to-images',
      merge: 'merge-pdf',
      split: 'split-pdf',
      'to-pdf': 'image-to-pdf',
    };
    for (const [id, slug] of Object.entries(frozen)) {
      expect(slugForMode(id as never)).toBe(slug);
    }
  });

  it('share-card URLs follow the image-repo naming contract', () => {
    // Structural, env-independent: <base>/<project>/og/<name>.png where name
    // is the route slug (landing: home.png). The base itself is env-swappable
    // (NEXT_PUBLIC_OG_CDN_BASE) — only the path shape is frozen. The PNGs live
    // in github.com/juyel-dev/image (see its README rules).
    for (const tool of TOOL_REGISTRY) {
      const url = ogImageUrl(`${tool.slug}.png`);
      expect(url.startsWith('https://')).toBe(true);
      expect(url).toContain('/print-optimizer/og/');
      expect(url.endsWith(`/og/${tool.slug}.png`)).toBe(true);
      expect(url).not.toMatch(/[^:]\/\//); // no double slashes
    }
    expect(ogImageUrl('home.png').endsWith('/og/home.png')).toBe(true);
  });

  it('default share-card provider is the jsDelivr image repo', () => {
    // Snapshot of the zero-config default; overriding NEXT_PUBLIC_OG_CDN_BASE
    // in the hosting env intentionally changes this without breaking the
    // structural test above.
    expect(ogImageUrl('merge-pdf.png')).toBe(
      'https://cdn.jsdelivr.net/gh/juyel-dev/image@main/print-optimizer/og/merge-pdf.png',
    );
  });
});
