import { describe, it, expect } from 'vitest';
import { ParameterGenerator } from '../../lib/optimizer/parameterGenerator';
import { PresetMode } from '../../lib/optimizer/types';

describe('ParameterGenerator', () => {
  const presets: PresetMode[] = ['PW_DARK_SLIDE', 'LIGHT_HANDWRITTEN', 'INK_SAVER_EXTREME', 'DIAGRAM_HIGH_CONTRAST', 'AUTO_ADAPTIVE'];

  it('should return valid parameters for all 5 presets', () => {
    for (const preset of presets) {
      const params = ParameterGenerator.getPresetParameters(preset);
      expect(params.preset).toBe(preset);
      expect(params.backgroundWhiteningThreshold).toBeGreaterThan(0);
      expect(params.contrastEnhancement).toBeGreaterThanOrEqual(0);
      expect(params.sharpenAmount).toBeGreaterThanOrEqual(0);
      expect(params.denoiseAmount).toBeGreaterThanOrEqual(0);
      expect(params.outputQuality).toBeGreaterThan(0);
      expect(params.outputQuality).toBeLessThanOrEqual(1);
    }
  });

  it('should have distinct configurations for different presets', () => {
    const darkSlide = ParameterGenerator.getPresetParameters('PW_DARK_SLIDE');
    const lightHandwritten = ParameterGenerator.getPresetParameters('LIGHT_HANDWRITTEN');
    expect(darkSlide.invertMode).toBe('smart');
    expect(lightHandwritten.invertMode).toBe('none');
  });
});
