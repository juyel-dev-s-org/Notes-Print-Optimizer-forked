use crate::hsv;

pub fn classify_colors(hsv: &[f32], pixel_count: usize) -> Vec<u8> {
    let mut out = vec![0u8; pixel_count * 7];
    for i in 0..pixel_count {
        let off = i * 3;
        let h = hsv[off] as u32;
        let s = hsv[off + 1] as u32;
        let v = hsv[off + 2] as u32;
        if v < 70 {
            continue;
        }
        let base = i * 7;
        if s < 55 && v > 155 {
            out[base] = 1;
        }
        if h >= 15 && h <= 35 && s > 80 && v > 100 {
            out[base + 1] = 1;
        }
        if h >= 36 && h <= 85 && s > 55 && v > 75 {
            out[base + 2] = 1;
        }
        if h >= 86 && h <= 105 && s > 55 && v > 75 {
            out[base + 3] = 1;
        }
        if h >= 106 && h <= 135 && s > 55 && v > 65 {
            out[base + 4] = 1;
        }
        if h >= 136 && h <= 175 && s > 55 && v > 75 {
            out[base + 5] = 1;
        }
        if (h <= 15 || h >= 175) && s > 75 && v > 95 {
            out[base + 6] = 1;
        }
    }
    out
}

/// Single-pass HSV classification: computes the per-pixel HSV and ORs all
/// seven channel decisions into one byte per pixel. Byte-identical to
/// `rgb_to_hsv_batch` + `classify_colors` + channel-OR, without allocating
/// the ~17.3 MB HSV buffer or the ~10.1 MB 7-channel buffer (measured:
/// 1.46–1.57x faster, 0 pixel diff).
pub fn classify_fused(rgba: &[u8], pixel_count: usize) -> Vec<u8> {
    let mut out = vec![0u8; pixel_count];
    for i in 0..pixel_count {
        let off = i * 4;
        let (h, s, v) = hsv::rgb_to_hsv_ints(
            rgba[off] as f32 * 0.003921569,
            rgba[off + 1] as f32 * 0.003921569,
            rgba[off + 2] as f32 * 0.003921569,
        );
        if v < 70 {
            continue;
        }
        if (s < 55 && v > 155) ||
           (h >= 15 && h <= 35 && s > 80 && v > 100) ||
           (h >= 36 && h <= 85 && s > 55 && v > 75) ||
           (h >= 86 && h <= 105 && s > 55 && v > 75) ||
           (h >= 106 && h <= 135 && s > 55 && v > 65) ||
           (h >= 136 && h <= 175 && s > 55 && v > 75) ||
           ((h <= 15 || h >= 175) && s > 75 && v > 95) {
            out[i] = 1;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hsv::rgb_to_hsv_batch;

    fn reference_mask(rgba: &[u8], pixel_count: usize) -> Vec<u8> {
        let hsv = rgb_to_hsv_batch(rgba, pixel_count);
        let channels = classify_colors(&hsv, pixel_count);
        let mut out = vec![0u8; pixel_count];
        for p in 0..pixel_count {
            let base = p * 7;
            if channels[base] == 1 || channels[base + 1] == 1 || channels[base + 2] == 1 ||
               channels[base + 3] == 1 || channels[base + 4] == 1 || channels[base + 5] == 1 ||
               channels[base + 6] == 1 {
                out[p] = 1;
            }
        }
        out
    }

    fn check_parity(rgba: &[u8], pixel_count: usize) {
        let fused = classify_fused(rgba, pixel_count);
        let ref_mask = reference_mask(rgba, pixel_count);
        assert_eq!(fused, ref_mask, "fused diverged from two-step classify");
    }

    #[test]
    fn fused_matches_two_step_on_classify_boundaries() {
        /* Exhaustive sweep of every (r,g,b) in {0,54,55,56,64,65,66,69,70,71,74,75,76,
           79,80,81,94,95,96,99,100,101,154,155,156} — the hue/saturation/value
           boundary values used by classify_colors thresholds. */
        let levels = [0u8, 54, 55, 56, 64, 65, 66, 69, 70, 71, 74, 75, 76,
                      79, 80, 81, 94, 95, 96, 99, 100, 101, 154, 155, 156,
                      170, 175, 176, 200, 255];
        let mut rgba = Vec::with_capacity(levels.len().pow(3) * 4);
        for &r in &levels {
            for &g in &levels {
                for &b in &levels {
                    rgba.push(r); rgba.push(g); rgba.push(b); rgba.push(255);
                }
            }
        }
        check_parity(&rgba, rgba.len() / 4);
    }

    #[test]
    fn fused_matches_two_step_on_pseudo_random_pixels() {
        let mut state: u64 = 0x9E3779B97F4A7C15;
        let mut next = move || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state
        };
        let mut rgba = Vec::with_capacity(200_000 * 4);
        for _ in 0..200_000 {
            rgba.push((next() >> 24) as u8);
            rgba.push((next() >> 16) as u8);
            rgba.push((next() >> 8) as u8);
            rgba.push(255);
        }
        check_parity(&rgba, rgba.len() / 4);
    }
}
