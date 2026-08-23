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
    expect(ids(searchTools(TOOL_REGISTRY, ''))).toEqual(['dark-print', 'enhance', 'protect', 'to-images']);
    expect(ids(searchTools(TOOL_REGISTRY, '   '))).toHaveLength(4);
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

  it('returns nothing for unrelated queries', () => {
    expect(searchTools(TOOL_REGISTRY, 'zzzzqqqq')).toEqual([]);
  });

  it('multi-word queries require every word somewhere', () => {
    expect(ids(searchTools(TOOL_REGISTRY, 'light ink'))).toContain('enhance');
    expect(searchTools(TOOL_REGISTRY, 'ink zebra')).toEqual([]);
  });
});

describe('getToolCategories', () => {
  it('returns unique categories in registry order — chips appear once >1 exists', () => {
    expect(getToolCategories(TOOL_REGISTRY)).toEqual(['pdf', 'security']);
  });
});
