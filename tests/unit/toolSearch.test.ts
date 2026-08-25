/**
 * Unit tests for the tool registry search: tiered scoring, alias/keyword
 * matching, normalization, subsequence fuzz and category extraction.
 */

import { describe, expect, it } from 'vitest';
import { TOOL_REGISTRY, getToolCategories } from '@/lib/tools/registry';
import { normalizeQuery, searchTools } from '@/lib/tools/search';

const ids = (tools: Array<{ id: string }>) => tools.map((t) => t.id);

describe('normalizeQuery', () => {
  it('lowercases, strips punctuation and folds diacritics', () => {
    expect(normalizeQuery('  Héllo, Wörld! ')).toBe('hello world');
  });
});

describe('searchTools', () => {
  it('empty query lists every tool in registry order', () => {
    expect(ids(searchTools(TOOL_REGISTRY, ''))).toEqual([
      'dark-print',
      'enhance',
      'protect',
      'to-images',
      'merge',
      'split',
      'to-pdf',
      'password-gen',
      'qr-gen',
      'word-count',
      'case-convert',
      'nup',
    ]);
    expect(ids(searchTools(TOOL_REGISTRY, '   '))).toHaveLength(12);
  });

  it('matches by title prefix first', () => {
    expect(ids(searchTools(TOOL_REGISTRY, 'dark'))[0]).toBe('dark-print');
    expect(ids(searchTools(TOOL_REGISTRY, 'enh'))[0]).toBe('enhance');
  });

  it('matches aliases — "password" style terms find their tool', () => {
    const fixtures = [
      { id: 'a', title: 'Alpha Tool', aliases: ['sharpen'], keywords: [] },
      { id: 'b', title: 'Beta Tool', aliases: ['password', 'lock'], keywords: [] },
    ];
    expect(ids(searchTools([...fixtures], 'password'))).toEqual(['b']);
    expect(ids(searchTools([...fixtures], 'passwrd'))).toEqual(['b']);
    expect(ids(searchTools([...fixtures], 'lock'))).toEqual(['b']);
  });

  it('matches keywords', () => {
    const hits = searchTools(TOOL_REGISTRY, 'banner');
    expect(hits.map((t) => t.id)).toContain('dark-print');
  });

  it('survives typos via subsequence fuzz ("enchane")', () => {
    expect(ids(searchTools(TOOL_REGISTRY, 'enchane'))).toContain('enhance');
  });

  it('normalizes case and punctuation in queries', () => {
    expect(ids(searchTools(TOOL_REGISTRY, 'DARK-Notes!!'))).toContain('dark-print');
  });

  it('multi-word partial matches surface tools (action phrasing)', () => {
    // "upload" is absent from every tool, but "images" hits Image to PDF.
    const actionHits = ids(searchTools(TOOL_REGISTRY, 'upload a images'));
    expect(actionHits).toContain('to-pdf');
    expect(actionHits[0]).toBe('to-pdf');
  });

  it('partial ratio >= 0.5 still surfaces a tool below full matches', () => {
    expect(ids(searchTools(TOOL_REGISTRY, 'enhance upload'))).toContain('enhance');
  });

  it('returns nothing for unrelated queries', () => {
    expect(searchTools(TOOL_REGISTRY, 'zzzzqqqq')).toEqual([]);
  });

  it('multi-word queries surface tools when at least half the words hit', () => {
    expect(ids(searchTools(TOOL_REGISTRY, 'light ink'))).toContain('enhance');
    expect(ids(searchTools(TOOL_REGISTRY, 'image'))).toContain('to-pdf');
    expect(ids(searchTools(TOOL_REGISTRY, 'image'))).toContain('to-images');
    // One of two words ("ink") still finds ink-related tools.
    expect(ids(searchTools(TOOL_REGISTRY, 'ink zebra'))).toContain('dark-print');
  });

  it('phrases where zero words match stay empty', () => {
    expect(searchTools(TOOL_REGISTRY, 'zebra unicorn')).toEqual([]);
  });
});

describe('getToolCategories', () => {
  it('returns unique categories in preferred order — chips appear once >1 exists', () => {
    expect(getToolCategories(TOOL_REGISTRY)).toEqual(['pdf', 'image', 'security', 'utility', 'text']);
  });
});
