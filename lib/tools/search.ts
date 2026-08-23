/**
 * Lightweight fuzzy search over the tool registry.
 * Zero dependencies — tiered scoring beats any generic library at this
 * scale (dozens of tools) while staying fully unit-testable.
 *
 * Tiers (high → low): exact title > title prefix > title substring >
 * alias match > keyword match > all-words-match > bounded-edit-distance
 * fuzz (catches typos & transpositions like "enchane").
 */

export interface SearchableTool {
  title: string;
  aliases: string[];
  keywords: string[];
}

/** Lowercase, fold diacritics, keep [a-z0-9 ] only, collapse spaces. */
export function normalizeQuery(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Damerau-Levenshtein distance with early exit once `max` is exceeded. */
function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array<number>(b.length + 1);
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      curr[j] = d;
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) {
      prev2[j] = prev[j];
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
}

function fuzzScore(tool: SearchableTool, q: string): number {
  if (q.includes(' ')) return 0; // fuzz only single-word queries
  const tolerance = q.length >= 6 ? 2 : 1;
  const candidates = [...normalizeQuery(tool.title).split(' '), ...tool.aliases.map((a) => normalizeQuery(a))];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (boundedEditDistance(q, candidate, tolerance) <= tolerance) return 30;
  }
  return 0;
}

function scoreTool(tool: SearchableTool, q: string): number {
  const title = normalizeQuery(tool.title);
  if (!q) return 1; // empty query lists everything in registry order

  if (title === q) return 100;
  if (title.startsWith(q)) return 90;
  if (title.includes(q)) return 80;

  for (const alias of tool.aliases) {
    const a = normalizeQuery(alias);
    if (a === q) return 75;
    if (a.includes(q)) return 65;
  }

  for (const keyword of tool.keywords) {
    if (normalizeQuery(keyword).includes(q)) return 50;
  }

  // Every query word appears somewhere (title/alias/keywords).
  const haystack = normalizeQuery(
    [tool.title, ...tool.aliases, ...tool.keywords].join(' '),
  );
  const words = q.split(' ');
  if (words.length > 1 && words.every((w) => haystack.includes(w))) return 40;

  return fuzzScore(tool, q);
}

/** Filtered + ranked copies of the input tools, best match first. */
export function searchTools<T extends SearchableTool>(tools: T[], query: string): T[] {
  const q = normalizeQuery(query);
  // No query → keep registry order untouched.
  if (!q) return tools.filter(() => true);
  return tools
    .map((tool) => ({ tool, score: scoreTool(tool, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.tool.title.localeCompare(b.tool.title))
    .map(({ tool }) => tool);
}
