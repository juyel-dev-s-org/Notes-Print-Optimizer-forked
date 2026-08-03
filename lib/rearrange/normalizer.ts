/**
 * Smart PDF Rearrangement - signature normalizer.
 *
 * Converts a file-name stem (with one candidate index token removed) into a
 * canonical series signature: lower-cased, noise-free and order-independent
 * (sorted word set). Two files belong to the same series iff their
 * signatures match, regardless of word order or separator style.
 */

/**
 * Presentation/container words that carry no subject identity.
 * Kept conservative on purpose: dropping too many words would risk merging
 * unrelated subjects into one series.
 */
const NOISE_WORDS = new Set<string>([
  'the', 'a', 'an', 'of', 'for', 'in', 'on', 'to', 'and',
  'pdf', 'file', 'files', 'doc', 'docs', 'document', 'documents',
  'version', 'ver', 'final', 'revised', 'updated', 'new', 'copy', 'original', 'merged',
  'notes', 'note', 'lectures', 'lecture', 'classes', 'class', 'lesson', 'lessons',
  'slides', 'slide', 'handout', 'handouts', 'sheet', 'sheets', 'material', 'materials',
  'part', 'chapter', 'ch', 'unit', 'units', 'module', 'modules', 'session', 'sessions',
  'volume', 'vol', 'book', 'books', 'level', 'episode', 'ep',
  'pw', 'physicswallah', 'wallah',
]);

/** Any run of non-alphanumeric characters acts as a word boundary. */
const WORD_SPLIT_RE = /[^a-z0-9\u00C0-\u024F]+/i;

/**
 * Build the series signature for a stem with the token at
 * [removeStart, removeEnd) taken out.
 *
 * Noise words ("class", "notes", "part", ...) are dropped first. When a name
 * consists ONLY of noise words ("Class Notes 1", "21st Lecture"), the noise
 * words themselves form the signature so such series are still detected.
 * Returns '' when nothing remains (never a valid signature).
 */
export function signatureFor(stem: string, removeStart: number, removeEnd: number): string {
  const stripped = `${stem.slice(0, removeStart)} ${stem.slice(removeEnd)}`.toLowerCase();
  const words = stripped.split(WORD_SPLIT_RE).filter(Boolean);
  if (words.length === 0) return '';

  const kept = words.filter((w) => !NOISE_WORDS.has(w));
  const base = kept.length > 0 ? kept : words;
  return [...base].sort().join(' ');
}

/** Title-case a signature for display ("basic maths" -> "Basic Maths"). */
export function titleCase(signature: string): string {
  return signature.replace(/(^|\s)([a-z0-9\u00C0-\u024F])/gi, (m) => m.toUpperCase());
}
