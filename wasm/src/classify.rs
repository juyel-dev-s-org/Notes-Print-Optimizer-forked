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
