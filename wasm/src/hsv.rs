/// Shared per-pixel RGB→HSV conversion. Returns the truncated integer
/// channels (h: 0..180, s/v: 0..255) exactly as produced by the original
/// batch implementation — both `rgb_to_hsv_batch` and the fused
/// `classify_fused` must use this so the two can never diverge.
pub fn rgb_to_hsv_ints(r: f32, g: f32, b: f32) -> (u32, u32, u32) {
    let mx = r.max(g).max(b);
    let mn = r.min(g).min(b);
    let delta = mx - mn;
    let mut h = 0.0;
    if delta != 0.0 {
        if mx == r {
            h = 60.0 * (((g - b) / delta) % 6.0);
        } else if mx == g {
            h = 60.0 * ((b - r) / delta + 2.0);
        } else {
            h = 60.0 * ((r - g) / delta + 4.0);
        }
        if h < 0.0 {
            h += 360.0;
        }
    }
    let h_int = (h * 0.5 + 0.5) as u32;
    let s_int = if mx == 0.0 { 0.0 } else { (delta / mx) * 255.0 + 0.5 } as u32;
    let v_int = (mx * 255.0 + 0.5) as u32;
    (h_int, s_int, v_int)
}

pub fn rgb_to_hsv_batch(rgba: &[u8], pixel_count: usize) -> Vec<f32> {
    let mut out = Vec::with_capacity(pixel_count * 3);
    for i in 0..pixel_count {
        let off = i * 4;
        let (h, s, v) = rgb_to_hsv_ints(
            rgba[off] as f32 * 0.003921569,
            rgba[off + 1] as f32 * 0.003921569,
            rgba[off + 2] as f32 * 0.003921569,
        );
        out.push(h as f32);
        out.push(s as f32);
        out.push(v as f32);
    }
    out
}
