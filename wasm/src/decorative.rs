use crate::connected;

pub fn strip_decorative_fills(mask: &mut [u8], width: usize, height: usize) {
    let tp = width * height;
    let labels = connected::connected_components(mask, width, height);
    let mut cl: i32 = 0;
    for &l in &labels {
        if l > cl {
            cl = l;
        }
    }
    let count = (cl + 1) as usize;
    let mut min_x = vec![width as i32; count];
    let mut min_y = vec![height as i32; count];
    let mut max_x = vec![-1i32; count];
    let mut max_y = vec![-1i32; count];
    let mut area = vec![0i32; count];
    let mut any = vec![false; count];
    any[0] = true;
    for i in 0..tp {
        let l = labels[i] as usize;
        if l == 0 {
            continue;
        }
        any[l] = true;
        let cx = (i % width) as i32;
        let cy = (i / width) as i32;
        if cx < min_x[l] { min_x[l] = cx; }
        if cx > max_x[l] { max_x[l] = cx; }
        if cy < min_y[l] { min_y[l] = cy; }
        if cy > max_y[l] { max_y[l] = cy; }
        area[l] += 1;
    }
    let mut drop = vec![false; count];
    for l in 1..count {
        if !any[l] { continue; }
        let cw = (max_x[l] - min_x[l] + 1) as f64;
        let ch = (max_y[l] - min_y[l] + 1) as f64;
        let ar = area[l] as f64;
        let is_decorative = ar >= 200.0
            && cw / ch.max(1.0) > 2.2
            && cw / (width as f64) > 0.20
            && (min_y[l] as f64) / (height as f64) < 0.15
            && ar > cw * ch * 0.3;
        if is_decorative
        {
            drop[l] = true;
        }
    }
    for i in 0..tp {
        let l = labels[i] as usize;
        if drop[l] {
            mask[i] = 0;
        }
    }
}
