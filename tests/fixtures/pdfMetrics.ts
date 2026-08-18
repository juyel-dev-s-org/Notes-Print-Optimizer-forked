/**
 * Shared helpers for fixture-driven tests and benches.
 *
 * applyEngineRecipe() is the ONE place that mirrors the production recipe
 * used by ProcessingEngineV2 (classification -> preset -> main-thread JS
 * pipeline). The golden suite and the Node baseline both call it, so the
 * recipe can never drift between coverage and timing.
 */
import { analyzeImageData } from '../../lib/optimizer/analysis';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';
import { processPage, type KernelProcessResult } from '../../lib/kernels/processPage';

export interface RecipeOutput {
  profile: { classification: string; darkBackgroundRatio: number };
  params: ReturnType<typeof ParameterGenerator.getPresetParameters>;
  result: KernelProcessResult;
}

export function applyEngineRecipe(imageData: ImageData, pageIndex: number): RecipeOutput {
  const profile = analyzeImageData(imageData, pageIndex);
  const preset: 'PW_DARK_SLIDE' | 'LIGHT_HANDWRITTEN' =
    profile.classification === 'DARK_SLIDE' ? 'PW_DARK_SLIDE' : 'LIGHT_HANDWRITTEN';
  const params = ParameterGenerator.getPresetParameters(preset);
  const result = processPage(imageData.data, imageData.width, imageData.height, params, {
    classification: profile.classification,
    darkBackgroundRatio: profile.darkBackgroundRatio,
  });
  return { profile, params, result };
}

/** Fraction (x100, 2 decimals) of pixels whose red channel is darker than 128. */
export function countInk(rgba: Uint8Array | Uint8ClampedArray): number {
  let dark = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] < 128) dark++;
  }
  return Math.round((dark / (rgba.length / 4)) * 10000) / 100;
}