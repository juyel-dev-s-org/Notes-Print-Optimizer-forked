/**
 * Minimal, dependency-free Markdown renderer for in-app documents.
 *
 * Content is authored by the project (not user supplied), but we still escape
 * all HTML first and only re-introduce a small, safe whitelist of formatting.
 * This keeps the bundle tiny and avoids shipping a full Markdown library.
 */

const SAFE_LINK = /^(https?:\/\/|mailto:|\/)/i;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline formatting: bold, italic, inline code, links. Operates on escaped text. */
function renderInline(escaped: string): string {
  let out = escaped;
  // inline code first so its contents are not further formatted
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  // links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const safe = SAFE_LINK.test(href) ? href : '#';
    const target = safe.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${safe}"${target} class="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">${text}</a>`;
  });
  // bold then italic
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out;
}

/**
 * Convert a Markdown string to safe HTML. Supports headings, paragraphs,
 * unordered/ordered lists, blockquotes, horizontal rules and inline styles.
 */
export function markdownToHtml(markdown: string): string {
  const lines = escapeHtml(markdown.replace(/\r\n/g, '\n')).split('\n');
  const html: string[] = [];

  let inUl = false;
  let inOl = false;
  let inQuote = false;
  let para: string[] = [];

  const closeLists = () => {
    if (inUl) { html.push('</ul>'); inUl = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
    if (inQuote) { html.push('</blockquote>'); inQuote = false; }
  };
  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${renderInline(para.join(' '))}</p>`);
      para = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { flushPara(); closeLists(); continue; }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara(); closeLists();
      const level = heading[1].length;
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs'];
      html.push(`<h${level} class="font-bold text-white mt-5 mb-2 ${sizes[level - 1]}">${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara(); closeLists();
      html.push('<hr class="my-4 border-slate-700" />');
      continue;
    }

    const ul = trimmed.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inOl) { html.push('</ol>'); inOl = false; }
      if (inQuote) { html.push('</blockquote>'); inQuote = false; }
      if (!inUl) { html.push('<ul class="list-disc pl-5 space-y-1.5 my-2">'); inUl = true; }
      html.push(`<li>${renderInline(ul[1])}</li>`);
      continue;
    }

    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (inQuote) { html.push('</blockquote>'); inQuote = false; }
      if (!inOl) { html.push('<ol class="list-decimal pl-5 space-y-1.5 my-2">'); inOl = true; }
      html.push(`<li>${renderInline(ol[1])}</li>`);
      continue;
    }

    const quote = trimmed.match(/^&gt;\s?(.*)$/);
    if (quote) {
      flushPara();
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (inOl) { html.push('</ol>'); inOl = false; }
      if (!inQuote) { html.push('<blockquote class="border-l-2 border-indigo-500/50 pl-3 my-2 text-slate-400">'); inQuote = true; }
      html.push(`<p>${renderInline(quote[1])}</p>`);
      continue;
    }

    // default: paragraph text
    closeLists();
    para.push(trimmed);
  }

  flushPara();
  closeLists();
  return html.join('\n');
}
