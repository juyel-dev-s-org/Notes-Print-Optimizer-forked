import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { markdownToHtml } from '@/lib/menu/markdown';
import { MenuRegistry } from '@/lib/menu/registry';
import { loadContent, clearContentCache } from '@/lib/menu/contentLoader';
import { menuRegistry } from '@/lib/menu';
import type { MenuItemConfig, MenuSectionConfig } from '@/lib/menu';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const item = (id: string, overrides: Partial<MenuItemConfig> = {}): MenuItemConfig => ({
  id,
  icon: 'info',
  title: id,
  action: { type: 'noop' },
  ...overrides,
});

const section = (
  id: string,
  items: MenuItemConfig[],
  overrides: Partial<MenuSectionConfig> = {}
): MenuSectionConfig => ({
  id,
  icon: 'wrench',
  title: id,
  items,
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* markdownToHtml                                                      */
/* ------------------------------------------------------------------ */
describe('menu/markdown: markdownToHtml', () => {
  it('renders headings with the correct level and text', () => {
    expect(markdownToHtml('# Title')).toContain('<h1');
    expect(markdownToHtml('# Title')).toContain('Title');
    expect(markdownToHtml('### Sub')).toContain('<h3');
    expect(markdownToHtml('###### Tiny')).toContain('<h6');
  });

  it('renders plain paragraphs', () => {
    expect(markdownToHtml('Hello world')).toContain('<p>Hello world</p>');
  });

  it('renders bold, italic and inline code', () => {
    const html = markdownToHtml('**bold** and *italic* and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('renders external http links in a new tab', () => {
    const html = markdownToHtml('[site](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders mailto links without target="_blank"', () => {
    const html = markdownToHtml('[mail](mailto:a@b.com)');
    expect(html).toContain('href="mailto:a@b.com"');
    expect(html).not.toContain('target="_blank"');
  });

  it('neutralises unsafe link schemes to href="#"', () => {
    const html = markdownToHtml('[x](javascript:alert(1))');
    expect(html).toContain('href="#"');
    expect(html).not.toContain('javascript:');
  });

  it('renders unordered and ordered lists', () => {
    const ul = markdownToHtml('- a\n- b');
    expect(ul).toContain('<ul');
    expect(ul).toContain('<li>a</li>');
    expect(ul).toContain('<li>b</li>');

    const ol = markdownToHtml('1. one\n2. two');
    expect(ol).toContain('<ol');
    expect(ol).toContain('<li>one</li>');
  });

  it('renders blockquotes', () => {
    const html = markdownToHtml('> quoted text');
    expect(html).toContain('<blockquote');
    expect(html).toContain('quoted text');
  });

  it('renders horizontal rules', () => {
    expect(markdownToHtml('---')).toContain('<hr');
    expect(markdownToHtml('***')).toContain('<hr');
  });

  it('escapes raw HTML to prevent XSS', () => {
    const html = markdownToHtml('Hello <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML inside headings and attributes', () => {
    const html = markdownToHtml('# T <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('handles a mixed document', () => {
    const md = '# Doc\n\nIntro **bold**.\n\n- a\n- b\n\n---\n\n> end';
    const html = markdownToHtml(md);
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<ul');
    expect(html).toContain('<hr');
    expect(html).toContain('<blockquote');
  });
});

/* ------------------------------------------------------------------ */
/* MenuRegistry                                                        */
/* ------------------------------------------------------------------ */
describe('menu/registry: MenuRegistry', () => {
  it('resolves registered sections in declaration order', () => {
    const reg = new MenuRegistry();
    reg.register(section('a', [item('a.1')]));
    reg.register(section('b', [item('b.1')]));
    expect(reg.resolve().map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('filters out hidden items', () => {
    const reg = new MenuRegistry();
    reg.register(section('a', [item('a.show'), item('a.hide', { hidden: true })]));
    expect(reg.resolve()[0].items.map((i) => i.id)).toEqual(['a.show']);
  });

  it('drops sections whose items are all hidden', () => {
    const reg = new MenuRegistry();
    reg.register(section('a', [item('a.hide', { hidden: true })]));
    reg.register(section('b', [item('b.show')]));
    expect(reg.resolve().map((s) => s.id)).toEqual(['b']);
  });

  it('replaces a section re-registered under the same id', () => {
    const reg = new MenuRegistry();
    reg.register(section('a', [item('a.old')], { title: 'Old' }));
    reg.register(section('a', [item('a.new')], { title: 'New' }));
    const resolved = reg.resolve();
    expect(resolved).toHaveLength(1);
    expect(resolved[0].title).toBe('New');
    expect(resolved[0].items[0].id).toBe('a.new');
  });

  it('unregisters a section by id', () => {
    const reg = new MenuRegistry();
    reg.register(section('a', [item('a.1')]));
    reg.unregister('a');
    expect(reg.resolve()).toHaveLength(0);
  });

  it('validate passes for a clean registry', () => {
    const reg = new MenuRegistry();
    reg.register(section('a', [item('a.1'), item('a.2')]));
    reg.register(section('b', [item('b.1')]));
    expect(reg.validate().valid).toBe(true);
  });

  it('validate flags duplicate item ids across sections', () => {
    const reg = new MenuRegistry();
    reg.register(section('a', [item('dup')]));
    reg.register(section('b', [item('dup')]));
    const result = reg.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('dup'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* contentLoader (fetch mocked)                                        */
/* ------------------------------------------------------------------ */
describe('menu/contentLoader: loadContent', () => {
  beforeEach(() => {
    clearContentCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and returns the markdown text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '# About' });
    vi.stubGlobal('fetch', fetchMock);
    const result = await loadContent('about');
    expect(result).toBe('# About');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/content/ABOUT.md');
  });

  it('caches results so repeat loads do not refetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'body' });
    vi.stubGlobal('fetch', fetchMock);
    await loadContent('faq');
    await loadContent('faq');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: async () => '' }));
    expect(await loadContent('faq')).toBeNull();
  });

  it('returns null when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await loadContent('faq')).toBeNull();
  });

  it('refetches after clearContentCache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'x' });
    vi.stubGlobal('fetch', fetchMock);
    await loadContent('faq');
    clearContentCache();
    await loadContent('faq');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------------------ */
/* Shared registry + config integration                                */
/* ------------------------------------------------------------------ */
describe('menu: shared registry (menu.config integration)', () => {
  it('resolves the six expected sections in order', () => {
    const ids = menuRegistry.resolve().map((s) => s.id);
    expect(ids).toEqual(['tools', 'privacy', 'community', 'resources', 'legal', 'developer']);
  });

  it('has no duplicate section or item ids', () => {
    expect(menuRegistry.validate().valid).toBe(true);
  });

  it('every item declares a supported action type', () => {
    const valid = ['link', 'content', 'feedback', 'clear-cache', 'app', 'noop'];
    for (const s of menuRegistry.resolve()) {
      for (const it of s.items) {
        expect(valid).toContain(it.action.type);
      }
    }
  });
});
