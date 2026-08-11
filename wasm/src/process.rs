//! Monolithic pixel processing pipeline.
//!
//! Performs the entire processPage pipeline (HSV classify → decorative strip →
//! dilate → noise removal → B/W composite → unsharp sharpen) in a single call,
//! keeping all intermediate buffers in WASM linear memory. This avoids the
//! many JS↔WASM round-trip copies that previously made per-kernel WASM calls
//! slower than pure JS.

use crate::{hsv, classify, decorative, noise, mask_ops, sharpen};

/// Run the full processPage pipeline on a cropped RGBA buffer.
///
/// * `rgba` - Cropped RGBA bytes (width × height × 4).
/// * `width`, `height` - Cropped dimensions.
/// * `invert_mode_smart` - If true, use HSV color classification to extract
///   foreground via 7 channel masks. Otherwise, use luminance threshold.
/// * `is_dark` - True if the slide has a dark background (affects processing).
/// * `dilation_ks` - Dilation kernel size (0 = none, 3 or 5 typical).
/// * `sharpen_amount` - Unsharp mask amount, normalized to 0..1.
///
/// Returns the output B/W RGBA buffer (same dimensions).
pub fn process_page(
    mut rgba: Vec<u8>,
    width: u32,
    height: u32,
    invert_mode_smart: bool,
    is_dark: bool,
    dilation_ks: u32,
    sharpen_amount: f64,
) -> Vec<u8> {
    let dw = width as usize;
    let dh = height as usize;
    let tp = dw * dh;
    let expected = tp * 4;

    // The Vec buffer is the wasm-allocated region that passArray8ToWasm0
    // already copied the input into (C1). Resize in place to normalize —
    // truncates when too long, zero-pads when too short. No extra copy
    // (the old .to_vec() defensive copy was the redundant C2).
    if rgba.len() != expected {
        rgba.resize(expected, 0);
    }
    let mut data = rgba;

    let should_process = invert_mode_smart || is_dark;

    // Fast path: no processing, just ensure alpha=255
    if !should_process {
        for i in 0..tp {
            data[i * 4 + 3] = 255;
        }
        return data;
    }

    // Foreground mask
    let mut fm = vec![0u8; tp];

    if invert_mode_smart {
        // HSV classify -> OR all channels directly into fm (single pass CC later)
        let hsv_buf = hsv::rgb_to_hsv_batch(&data, tp);
        let channels = classify::classify_colors(&hsv_buf, tp);
        for p in 0..tp {
            let base = p * 7;
            if channels[base] == 1 || channels[base + 1] == 1 || channels[base + 2] == 1 ||
               channels[base + 3] == 1 || channels[base + 4] == 1 || channels[base + 5] == 1 ||
               channels[base + 6] == 1 {
                fm[p] = 1;
            }
        }
    } else {
        // Luminance-based extraction (isDark branch)
        for p in 0..tp {
            let r = data[p * 4] as f64;
            let g = data[p * 4 + 1] as f64;
            let b = data[p * 4 + 2] as f64;
            if 0.299 * r + 0.587 * g + 0.114 * b >= 70.0 {
                fm[p] = 1;
            }
        }
    }

    // Dilation
    if dilation_ks > 0 {
        mask_ops::dilate_mask(&mut fm, dw, dh, dilation_ks as usize);
    }

    // Combined Decorative Fill + Noise Removal (Single CC Pass)
    let mut labels = vec![0i32; tp];
    let mut queue = vec![0usize; tp];
    let mut min_x = vec![dw as i32; tp];
    let mut min_y = vec![dh as i32; tp];
    let mut max_x = vec![-1i32; tp];
    let mut max_y = vec![-1i32; tp];
    let mut area = vec![0i32; tp];
    
    let mut next_label: i32 = 1;
    for i in 0..tp {
        if fm[i] == 1 && labels[i] == 0 {
            let lb = next_label;
            next_label += 1;
            let mut head = 0usize;
            let mut tail = 0usize;
            queue[tail] = i;
            tail += 1;
            labels[i] = lb;
            
            let mut mnx = dw as i32;
            let mut mny = dh as i32;
            let mut mxx = -1i32;
            let mut mxy = -1i32;
            let mut ar = 0i32;
            
            while head < tail {
                let cur = queue[head];
                head += 1;
                let cx = cur % dw;
                let cy = cur / dw;
                
                if (cx as i32) < mnx { mnx = cx as i32; }
                if (cx as i32) > mxx { mxx = cx as i32; }
                if (cy as i32) < mny { mny = cy as i32; }
                if (cy as i32) > mxy { mxy = cy as i32; }
                ar += 1;
                
                if cy > 0 { let ni = cur - dw; if fm[ni] == 1 && labels[ni] == 0 { labels[ni] = lb; queue[tail] = ni; tail += 1; } }
                if cy < dh - 1 { let ni = cur + dw; if fm[ni] == 1 && labels[ni] == 0 { labels[ni] = lb; queue[tail] = ni; tail += 1; } }
                if cx > 0 { let ni = cur - 1; if fm[ni] == 1 && labels[ni] == 0 { labels[ni] = lb; queue[tail] = ni; tail += 1; } }
                if cx < dw - 1 { let ni = cur + 1; if fm[ni] == 1 && labels[ni] == 0 { labels[ni] = lb; queue[tail] = ni; tail += 1; } }
            }
            min_x[lb as usize] = mnx;
            min_y[lb as usize] = mny;
            max_x[lb as usize] = mxx;
            max_y[lb as usize] = mxy;
            area[lb as usize] = ar;
        }
    }
    
    let min_area = (tp / 600000).max(6) as i32;
    for l in 1..next_label {
        let idx = l as usize;
        let ar = area[idx];
        if ar < min_area {
            continue; // Will be removed as noise implicitly since we only keep fm[i]=1 if labels[i] is valid? Wait, we need to remove them from fm!
        }
        let cw = (max_x[idx] - min_x[idx] + 1) as f64;
        let ch = (max_y[idx] - min_y[idx] + 1) as f64;
        let is_decorative = ar >= 200
            && cw / ch.max(1.0) > 2.2
            && cw / (dw as f64) > 0.20
            && (min_y[idx] as f64) / (dh as f64) < 0.15
            && (ar as f64) > cw * ch * 0.3;
            
        if ar < min_area || is_decorative {
            // mark for removal
            min_x[idx] = -9999; // flag to drop
        }
    }
    
    for i in 0..tp {
        let l = labels[i] as usize;
        if l > 0 && min_x[l] == -9999 {
            fm[i] = 0;
        }
    }

    // Composite: mask → B/W RGBA
    for p in 0..tp {
        let di = p * 4;
        let val: u8 = if fm[p] == 1 { 0 } else { 255 };
        data[di] = val;
        data[di + 1] = val;
        data[di + 2] = val;
        data[di + 3] = 255;
    }

    // Sharpen (unsharp mask)
    if sharpen_amount > 0.0 {
        sharpen::unsharp_mask(&mut data, dw, dh, sharpen_amount);
    }

    data
}
