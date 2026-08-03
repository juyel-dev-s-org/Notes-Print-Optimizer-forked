/**
 * Smart PDF Rearrangement - public facade.
 *
 * Modular, dependency-free pipeline:
 *
 *   parser      -> tokenizes file names (numbers / ordinals / romans)
 *   normalizer  -> builds noise-free, order-independent series signatures
 *   sorter      -> locale-independent natural comparison
 *   ruleEngine  -> detects series and plans the final order
 *
 * UI and workflow code should import from this module only, so future
 * algorithm updates stay confined to lib/rearrange.
 */

export type {
  FileNameToken,
  ParsedFileName,
  RearrangePlan,
  RearrangeableItem,
  SeriesCandidate,
  SeriesGroup,
} from './types';

export { parseFileName, romanToNumber, numberToRoman, stripExtension } from './parser';
export { signatureFor, titleCase } from './normalizer';
export { naturalCompare } from './sorter';
export { planSmartOrder, MIN_SERIES_SIZE } from './ruleEngine';
