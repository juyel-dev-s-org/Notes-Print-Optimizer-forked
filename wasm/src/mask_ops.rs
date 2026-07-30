pub fn dilate_mask(mask: &mut [u8], width: usize, height: usize, ks: usize) {
    let copy = mask.to_vec();
    let off = ks / 2;
    let mut offsets: Vec<(i32, i32)> = Vec::new();
    if ks == 3 {
        offsets = vec![(0, -1), (-1, 0), (0, 0), (1, 0), (0, 1)];
    } else if ks == 5 {
        for kx in -2i32..=2 {
            offsets.push((kx, 0));
        }
        for ky in -2i32..=2 {
            if ky == 0 { continue; }
            offsets.push((-1, ky));
            offsets.push((0, ky));
            offsets.push((1, ky));
        }
        offsets.push((-2, -1));
        offsets.push((2, -1));
        offsets.push((-2, 0));
        offsets.push((2, 0));
        offsets.push((-2, 1));
        offsets.push((2, 1));
        offsets.push((0, -2));
        offsets.push((0, 2));
    } else {
        for ky in -(off as i32)..=(off as i32) {
            for kx in -(off as i32)..=(off as i32) {
                offsets.push((kx, ky));
            }
        }
    }
    for y in off..(height - off) {
        let ro = y * width;
        for x in off..(width - off) {
            if copy[ro + x] == 1 {
                for &(kx, ky) in &offsets {
                    let ny = (y as i32 + ky) as usize;
                    let nx = (x as i32 + kx) as usize;
                    mask[ny * width + nx] = 1;
                }
            }
        }
    }
}
