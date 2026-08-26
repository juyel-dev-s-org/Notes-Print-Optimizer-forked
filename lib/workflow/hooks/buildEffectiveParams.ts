import { ParameterGenerator } from '../../optimizer/parameterGenerator';
import type { ProcessingParameters } from '../../optimizer/types';
import type { ProcessingToggleState } from '../types';

/* ----------------------------------------------------------------
 * buildEffectiveParams
 *
 * Merges the selected preset defaults with any manually-enabled
 * toggle overrides from the settings panel.
 *
 * - Stroke/Dilation OFF -> dilationKernelSize forced to 0
 *   (raw PDF preserved, NO morphology at all).
 * - Stroke/Dilation ON  -> uses the slider value from masterParams.
 * - Other toggles OFF   -> preset default value is used.
 * - Other toggles ON    -> masterParams slider value overrides preset.
 * ---------------------------------------------------------------- */
export function buildEffectiveParams(
  masterParams: ProcessingParameters,
  toggles: ProcessingToggleState,
): ProcessingParameters {
  const presetDefaults = ParameterGenerator.getPresetParameters(masterParams.preset);

  const effective: ProcessingParameters = {
    ...presetDefaults,
    preset: masterParams.preset,
    invertMode: masterParams.invertMode,
    smartColorMapping: masterParams.smartColorMapping,
    bannerCropTopPct: masterParams.bannerCropTopPct,
    bannerCropBottomPct: masterParams.bannerCropBottomPct,
    autoTrimMargins: masterParams.autoTrimMargins,
    binaizationThreshold: masterParams.binaizationThreshold,
    outputQuality: masterParams.outputQuality,
  };

  // Stroke / Dilation
  if (toggles.strokeDilation) {
    effective.dilationKernelSize = masterParams.dilationKernelSize;
    effective.strokeEnhancement = masterParams.strokeEnhancement;
  } else {
    effective.dilationKernelSize = 0;
    effective.strokeEnhancement = 'none';
  }

  // Sharpen
  effective.sharpenAmount = toggles.sharpen
    ? masterParams.sharpenAmount
    : presetDefaults.sharpenAmount;

  // Contrast
  effective.contrastEnhancement = toggles.contrast
    ? masterParams.contrastEnhancement
    : presetDefaults.contrastEnhancement;

  // Denoise
  effective.denoiseAmount = toggles.denoise
    ? masterParams.denoiseAmount
    : presetDefaults.denoiseAmount;

  // BG Whitening
  effective.backgroundWhiteningThreshold = toggles.bgWhitening
    ? masterParams.backgroundWhiteningThreshold
    : presetDefaults.backgroundWhiteningThreshold;

  // Auto white-box heal — pipeline flag, no preset involvement.
  effective.autoWhiteBoxFix = toggles.autoWhiteBoxFix;

  return effective;
}
