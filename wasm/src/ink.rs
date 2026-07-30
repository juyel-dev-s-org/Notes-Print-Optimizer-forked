pub fn ink_coverage(data: &[u8], pixel_count: usize, threshold: u8) -> f64 {
    let st = ((pixel_count as f64 / 50000.0).sqrt().floor() as usize).max(1);
    let mut nw = 0usize;
    let mut sm = 0usize;
    let len = data.len();
    let mut i = 0;
    while i < len {
        let lum = 0.299 * data[i] as f64 + 0.587 * data[i + 1] as f64 + 0.114 * data[i + 2] as f64;
        if lum < threshold as f64 {
            nw += 1;
        }
        sm += 1;
        i += 4 * st;
    }
    if sm == 0 {
        return 0.0;
    }
    let pct = (nw as f64 / sm as f64) * 100.0;
    (pct * 10.0).round() / 10.0
}
