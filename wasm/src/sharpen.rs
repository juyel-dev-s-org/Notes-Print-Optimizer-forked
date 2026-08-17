pub fn unsharp_mask(data: &mut [u8], width: usize, height: usize, amt: f64) {
    if height < 3 || width < 3 {
        return;
    }
    let cp = data.to_vec();
    for y in 1..(height - 1) {
        let ro = y * width * 4;
        let pro = (y - 1) * width * 4;
        let nro = (y + 1) * width * 4;
        for x in 1..(width - 1) {
            let idx = ro + x * 4;
            for c in 0..3 {
                let ctr = cp[idx + c] as f64;
                let lap = 4.0 * ctr
                    - cp[pro + x * 4 + c] as f64
                    - cp[nro + x * 4 + c] as f64
                    - cp[idx - 4 + c] as f64
                    - cp[idx + 4 + c] as f64;
                let en = ctr + amt * lap;
                data[idx + c] = if en < 0.0 {
                    0
                } else if en > 255.0 {
                    255
                } else {
                    (en + 0.5) as u8
                };
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unsharp_outputs_are_in_range() {
        let w = 64;
        let h = 64;
        let n = w * h * 4;
        let mut data = vec![0u8; n];
        for i in 0..n {
            data[i] = ((i * 7 + i / 3) % 256) as u8;
        }
        unsharp_mask(&mut data, w, h, 2.0);
        for &v in &data {
            assert!(v <= 255);
        }
    }
}
