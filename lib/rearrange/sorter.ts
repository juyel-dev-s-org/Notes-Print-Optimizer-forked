/**
 * Smart PDF Rearrangement - natural order comparator.
 *
 * Locale-independent "natural" comparison: digit runs compare numerically
 * ("file 2" < "file 10"), everything else compares by plain code units on
 * lower-cased text. String#localeCompare is avoided on purpose (slow and
 * device-dependent).
 */

const RUN_SPLIT_RE = /\d+|\D+/g;
const DIGITS_ONLY_RE = /^\d+$/;

/**
 * Run-split cache — comparators re-visit the same names many times during a
 * sort, so tokenizing once per distinct string removes the repeated regex
 * work (the classic "parse inside the comparator" cost). Bounded to keep
 * memory flat on pathological inputs.
 */
const RUNS_CACHE_MAX = 1000;
const runsCache = new Map<string, string[]>();

function getRuns(s: string): string[] {
  let runs = runsCache.get(s);
  if (!runs) {
    runs = s.toLowerCase().match(RUN_SPLIT_RE) ?? [];
    if (runsCache.size >= RUNS_CACHE_MAX) runsCache.clear();
    runsCache.set(s, runs);
  }
  return runs;
}

/** Numeric compare of two digit strings without precision loss. */
function compareDigitRuns(a: string, b: string): number {
  const sa = a.replace(/^0+/, '') || '0';
  const sb = b.replace(/^0+/, '') || '0';
  if (sa.length !== sb.length) return sa.length < sb.length ? -1 : 1;
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

/** Natural comparison. Returns <0 / 0 / >0 like a usual comparator. */
export function naturalCompare(a: string, b: string): number {
  if (a === b) return 0;
  const runsA = getRuns(a);
  const runsB = getRuns(b);
  const len = Math.min(runsA.length, runsB.length);
  for (let i = 0; i < len; i += 1) {
    const ra = runsA[i];
    const rb = runsB[i];
    const na = DIGITS_ONLY_RE.test(ra);
    const nb = DIGITS_ONLY_RE.test(rb);
    if (na && nb) {
      const c = compareDigitRuns(ra, rb);
      if (c !== 0) return c;
    } else if (ra !== rb) {
      return ra < rb ? -1 : 1;
    }
  }
  return runsA.length - runsB.length;
}
