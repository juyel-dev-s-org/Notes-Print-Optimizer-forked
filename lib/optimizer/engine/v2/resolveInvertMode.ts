/**
 * Per-page inversion policy — single source of truth.
 *
 * 'smart' is an AUTO mode: only DARK_SLIDE pages invert. LIGHT_SLIDE and
 * MIXED pages keep their original polarity (a global 'smart' must never
 * re-enable inversion there — that is what turned white pages and sticky
 * notes into solid black ink). 'none' and 'simple' are literal user
 * intent and pass through untouched.
 */
import type { PageClassification, ProcessingParameters } from '../../types';

export type InvertMode = ProcessingParameters['invertMode'];

export function resolveEffectiveInvertMode(
  requested: InvertMode,
  classification: PageClassification,
): InvertMode {
  if (requested === 'smart' && classification !== 'DARK_SLIDE') return 'none';
  return requested;
}
