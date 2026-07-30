use crate::connected;

pub fn remove_noise(mask: &mut [u8], width: usize, height: usize) {
    let tp = width * height;
    let labels = connected::connected_components(mask, width, height);
    let mut cl: i32 = 0;
    for &l in &labels {
        if l > cl {
            cl = l;
        }
    }
    let count = (cl + 1) as usize;
    let mut area = vec![0i32; count];
    for i in 0..tp {
        let l = labels[i] as usize;
        if l > 0 {
            area[l] += 1;
        }
    }
    let min_area = (tp / 600000).max(6) as i32;
    for i in 0..tp {
        let l = labels[i] as usize;
        if l > 0 && area[l] < min_area {
            mask[i] = 0;
        }
    }
}
