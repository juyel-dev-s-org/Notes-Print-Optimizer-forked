pub fn rgb_to_hsv_batch(rgba: &[u8], pixel_count: usize) -> Vec<f32> {
    let mut out = Vec::with_capacity(pixel_count * 3);
    for i in 0..pixel_count {
        let off = i * 4;
        let r = rgba[off] as f32 * 0.003921569;
        let g = rgba[off + 1] as f32 * 0.003921569;
        let b = rgba[off + 2] as f32 * 0.003921569;
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
        out.push((h * 0.5 + 0.5) as u32 as f32);
        let s = if mx == 0.0 { 0.0 } else { (delta / mx) * 255.0 + 0.5 };
        out.push(s as u32 as f32);
        let v = mx * 255.0 + 0.5;
        out.push(v as u32 as f32);
    }
    out
}
