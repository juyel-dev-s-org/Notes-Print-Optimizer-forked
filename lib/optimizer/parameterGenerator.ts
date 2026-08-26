import {
  DocumentProfile,
  PageProfile,
  PresetMode,
  ProcessingParameters,
} from './types';
import { DARK_BG_RATIO_THRESHOLD } from '../kernels/constants';

export class ParameterGenerator {
  /**
   * Returns default parameter configuration for a given preset
   */
  public static getPresetParameters(preset: PresetMode): ProcessingParameters {
    switch (preset) {
      case 'PW_DARK_SLIDE':
        return {
          preset: 'PW_DARK_SLIDE',
          invertMode: 'smart',
          smartColorMapping: true,
          backgroundWhiteningThreshold: 220,
          contrastEnhancement: 25,
          sharpenAmount: 35,
          denoiseAmount: 15,
          bannerCropTopPct: 0,
          bannerCropBottomPct: 0,
          autoTrimMargins: false,
          binaizationThreshold: 0,
          outputQuality: 0.88,
          strokeEnhancement: 'strong',
          dilationKernelSize: 5,
        };

      case 'LIGHT_HANDWRITTEN':
        return {
          preset: 'LIGHT_HANDWRITTEN',
          invertMode: 'none',
          smartColorMapping: false,
          backgroundWhiteningThreshold: 200,
          contrastEnhancement: 35,
          sharpenAmount: 40,
          denoiseAmount: 20,
          bannerCropTopPct: 0,
          bannerCropBottomPct: 0,
          autoTrimMargins: false,
          binaizationThreshold: 0,
          outputQuality: 0.88,
          strokeEnhancement: 'normal',
          dilationKernelSize: 3,
        };

      case 'INK_SAVER_EXTREME':
        return {
          preset: 'INK_SAVER_EXTREME',
          invertMode: 'smart',
          smartColorMapping: true,
          backgroundWhiteningThreshold: 185,
          contrastEnhancement: 50,
          sharpenAmount: 50,
          denoiseAmount: 30,
          bannerCropTopPct: 0,
          bannerCropBottomPct: 0,
          autoTrimMargins: false,
          binaizationThreshold: 190,
          outputQuality: 0.80,
          strokeEnhancement: 'strong',
          dilationKernelSize: 5,
        };

      case 'DIAGRAM_HIGH_CONTRAST':
        return {
          preset: 'DIAGRAM_HIGH_CONTRAST',
          invertMode: 'smart',
          smartColorMapping: true,
          backgroundWhiteningThreshold: 230,
          contrastEnhancement: 45,
          sharpenAmount: 60,
          denoiseAmount: 10,
          bannerCropTopPct: 0,
          bannerCropBottomPct: 0,
          autoTrimMargins: false,
          binaizationThreshold: 0,
          outputQuality: 0.92,
          strokeEnhancement: 'none',
          dilationKernelSize: 0,
        };

      case 'AUTO_ADAPTIVE':
      default:
        return {
          preset: 'AUTO_ADAPTIVE',
          invertMode: 'smart',
          smartColorMapping: true,
          backgroundWhiteningThreshold: 220,
          contrastEnhancement: 20,
          sharpenAmount: 30,
          denoiseAmount: 15,
          bannerCropTopPct: 0,
          bannerCropBottomPct: 0,
          autoTrimMargins: false,
          binaizationThreshold: 0,
          outputQuality: 0.88,
          strokeEnhancement: 'strong',
          dilationKernelSize: 5,
        };
    }
  }

  /**
   * Generates tailored parameters based on individual page metrics
   */
  public static generateAdaptiveForPage(
    pageProfile: PageProfile,
    docProfile: DocumentProfile,
    basePreset: PresetMode = 'AUTO_ADAPTIVE'
  ): ProcessingParameters {
    const baseParams = this.getPresetParameters(basePreset);

    if (basePreset !== 'AUTO_ADAPTIVE') {
      return baseParams;
    }

    const isDark = pageProfile.classification === 'DARK_SLIDE' || pageProfile.darkBackgroundRatio > DARK_BG_RATIO_THRESHOLD;

    // Default to 0 crop so slide content is never cut off
    const topCrop = 0;
    const bottomCrop = 0;

    // Background Whitening
    const whiteningThreshold = isDark ? 225 : Math.max(195, 235 - Math.round(pageProfile.averageBrightness * 0.2));

    // Sharpening based on stroke thickness
    const sharpenAmount = pageProfile.strokeThickness < 2 ? 45 : 25;

    return {
      preset: 'AUTO_ADAPTIVE',
      invertMode: isDark ? 'smart' : 'none',
      smartColorMapping: true,
      backgroundWhiteningThreshold: whiteningThreshold,
      contrastEnhancement: Math.min(50, Math.max(15, Math.round(80 - pageProfile.contrast))),
      sharpenAmount,
      denoiseAmount: pageProfile.estimatedNoise > 30 ? 25 : 10,
      bannerCropTopPct: topCrop,
      bannerCropBottomPct: bottomCrop,
      autoTrimMargins: true,
      binaizationThreshold: 0,
      outputQuality: 0.88,
      strokeEnhancement: pageProfile.strokeThickness < 2 ? 'strong' : 'normal',
    };
  }
}
