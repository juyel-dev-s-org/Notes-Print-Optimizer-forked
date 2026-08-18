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

pub fn unsharp_mask_bw(data: &mut [u8], width: usize, height: usize, amt: f64) {
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
            let ctr = cp[idx] as f64;
            let lap = 4.0 * ctr
                - cp[pro + x * 4] as f64
                - cp[nro + x * 4] as f64
                - cp[idx - 4] as f64
                - cp[idx + 4] as f64;
            let en = ctr + amt * lap;
            let v = if en < 0.0 {
                0
            } else if en > 255.0 {
                255
            } else {
                (en + 0.5) as u8
            };
            data[idx] = v;
            data[idx + 1] = v;
            data[idx + 2] = v;
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

    #[test]
    fn unsharp_bw_matches_unsharp_on_black_white() {
        let w = 97;
        let h = 61;
        let n = w * h * 4;
        /* Strictly B/W data, as produced by the composite step */
        let mut bw = vec![0u8; n];
        for i in 0..n / 4 {
            let v: u8 = if (i * 7 + i / 3) % 5 == 0 { 0 } else { 255 };
            bw[i * 4] = v;
            bw[i * 4 + 1] = v;
            bw[i * 4 + 2] = v;
            bw[i * 4 + 3] = 255;
        }
        let mut a = bw.clone();
        unsharp_mask(&mut a, w, h, 0.35);
        let mut b = bw.clone();
        unsharp_mask_bw(&mut b, w, h, 0.35);
        assert_eq!(a, b, "1-channel BW unsharp must be byte-identical to 3-channel on B/W data");
        /* Alpha must remain untouched */
        for i in 0..n / 4 {
            assert_eq!(b[i * 4 + 3], 255);
        }
    }
}
