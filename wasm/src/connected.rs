pub fn connected_components(mask: &[u8], width: usize, height: usize) -> Vec<i32> {
    let tp = width * height;
    let mut labels = vec![0i32; tp];
    let mut queue = vec![0usize; tp];
    let mut next_label: i32 = 1;
    for i in 0..tp {
        if mask[i] == 1 && labels[i] == 0 {
            let lb = next_label;
            next_label += 1;
            let mut head = 0usize;
            let mut tail = 0usize;
            queue[tail] = i;
            tail += 1;
            labels[i] = lb;
            while head < tail {
                let cur = queue[head];
                head += 1;
                let cx = cur % width;
                let cy = cur / width;
                let ys = if cy > 0 { cy - 1 } else { cy };
                let ye = if cy + 1 < height { cy + 1 } else { cy };
                let xs = if cx > 0 { cx - 1 } else { cx };
                let xe = if cx + 1 < width { cx + 1 } else { cx };
                for ny in ys..=ye {
                    let ro = ny * width;
                    for nx in xs..=xe {
                        if nx == cx && ny == cy {
                            continue;
                        }
                        let ni = ro + nx;
                        if mask[ni] == 1 && labels[ni] == 0 {
                            labels[ni] = lb;
                            queue[tail] = ni;
                            tail += 1;
                        }
                    }
                }
            }
        }
    }
    labels
}


/// Pre-allocated version of connected_components to avoid heap allocations per call.
pub fn connected_components_with_buffers(
    mask: &[u8],
    width: usize,
    height: usize,
    labels: &mut [i32],
    queue: &mut [usize],
    min_x: &mut [i32],
    min_y: &mut [i32],
    max_x: &mut [i32],
    max_y: &mut [i32],
    area: &mut [i32],
) -> i32 {
    let tp = width * height;
    for i in 0..tp { labels[i] = 0; }
    
    let mut next_label: i32 = 1;
    for i in 0..tp {
        if mask[i] == 1 && labels[i] == 0 {
            let lb = next_label;
            next_label += 1;
            let mut head = 0usize;
            let mut tail = 0usize;
            queue[tail] = i;
            tail += 1;
            labels[i] = lb;
            
            let mut mnx = width as i32;
            let mut mny = height as i32;
            let mut mxx = -1i32;
            let mut mxy = -1i32;
            let mut ar = 0i32;
            
            while head < tail {
                let cur = queue[head];
                head += 1;
                let cx = cur % width;
                let cy = cur / width;
                
                if (cx as i32) < mnx { mnx = cx as i32; }
                if (cx as i32) > mxx { mxx = cx as i32; }
                if (cy as i32) < mny { mny = cy as i32; }
                if (cy as i32) > mxy { mxy = cy as i32; }
                ar += 1;
                
                let ys = if cy > 0 { cy - 1 } else { cy };
                let ye = if cy + 1 < height { cy + 1 } else { cy };
                let xs = if cx > 0 { cx - 1 } else { cx };
                let xe = if cx + 1 < width { cx + 1 } else { cx };
                for ny in ys..=ye {
                    let ro = ny * width;
                    for nx in xs..=xe {
                        if nx == cx && ny == cy { continue; }
                        let ni = ro + nx;
                        if mask[ni] == 1 && labels[ni] == 0 {
                            labels[ni] = lb;
                            queue[tail] = ni;
                            tail += 1;
                        }
                    }
                }
            }
            
            min_x[lb as usize] = mnx;
            min_y[lb as usize] = mny;
            max_x[lb as usize] = mxx;
            max_y[lb as usize] = mxy;
            area[lb as usize] = ar;
        }
    }
    next_label - 1
}
