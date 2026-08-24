/**
 * FAQ content contract — the content layer (lib/content/faqs.ts) is
 * decoupled from the registry on purpose, so these gates make silent drift
 * impossible: every tool MUST have FAQs, and copy must stay clean
 * (encoding regressions included).
 */

import { describe, expect, it } from 'vitest';
import { TOOL_REGISTRY, getAllToolSlugs } from '@/lib/tools/registry';
import { TOOL_FAQS, buildFaqJsonLd, getFaqsForSlug } from '@/lib/content/faqs';

const MOJIBAKE_RE = /Â|â€|Ã¢|ï¿½/;

describe('FAQ content contract', () => {
  it('every tool in the registry has an FAQ entry', () => {
    for (const slug of getAllToolSlugs()) {
      expect(TOOL_FAQS[slug], `missing FAQs for ${slug}`).toBeDefined();
    }
    // and no orphan entries for tools that do not exist
    expect(Object.keys(TOOL_FAQS).sort()).toEqual([...getAllToolSlugs()].sort());
  });

  it('each tool has 4–6 unique, non-trivial Q&As', () => {
    for (const slug of getAllToolSlugs()) {
      const faqs = getFaqsForSlug(slug);
      expect(faqs.length, `${slug}`).toBeGreaterThanOrEqual(4);
      expect(faqs.length, `${slug}`).toBeLessThanOrEqual(6);

      const questions = faqs.map((f) => f.q);
      expect(new Set(questions).size, `${slug} duplicate question`).toBe(questions.length);

      for (const f of faqs) {
        expect(f.q.trim().length).toBeGreaterThan(8);
        expect(f.a.trim().length).toBeGreaterThan(40);
        // ~600 chars keeps answers snippet-friendly and the DOM light.
        expect(f.a.length).toBeLessThanOrEqual(600);
      }
    }
  });

  it('content is encoding-clean (no mojibake sentinels)', () => {
    for (const [slug, faqs] of Object.entries(TOOL_FAQS)) {
      for (const f of faqs) {
        expect(f.q, `${slug}: "${f.q}"`).not.toMatch(MOJIBAKE_RE);
        expect(f.a, `${slug}: "${f.q}"`).not.toMatch(MOJIBAKE_RE);
      }
    }
  });

  it('buildFaqJsonLd mirrors the visible accordion exactly', () => {
    for (const tool of TOOL_REGISTRY) {
      const faqs = getFaqsForSlug(tool.slug);
      const ld = buildFaqJsonLd(`https://x/tools/${tool.slug}/`, faqs) as Record<string, unknown>;
      expect(ld['@type']).toBe('FAQPage');
      expect(ld['@id']).toBe(`https://x/tools/${tool.slug}/#faq`);
      const main = ld.mainEntity as Array<Record<string, unknown>>;
      expect(main).toHaveLength(faqs.length);
      main.forEach((node, i) => {
        expect(node['@type']).toBe('Question');
        expect(node.name).toBe(faqs[i].q);
        const ans = node.acceptedAnswer as Record<string, unknown>;
        expect(ans['@type']).toBe('Answer');
        expect(ans.text).toBe(faqs[i].a);
      });
    }
  });
});
