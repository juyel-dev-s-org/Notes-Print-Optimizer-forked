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
        // HSV classify → 7 channel masks → decorative strip → OR into fm
        let hsv_buf = hsv::rgb_to_hsv_batch(&data, tp);
        let channels = classify::classify_colors(&hsv_buf, tp);
        for c in 0..7usize {
            // Skip empty channels
            let mut has_data = false;
            let mut i = c;
            while i < tp * 7 {
                if channels[i] == 1 {
                    has_data = true;
                    break;
                }
                i += 7;
            }
            if !has_data {
                continue;
            }
            // Extract channel mask
            let mut cm = vec![0u8; tp];
            for p in 0..tp {
                if channels[p * 7 + c] == 1 {
                    cm[p] = 1;
                }
            }
            // Strip decorative fills (modifies cm in-place)
            decorative::strip_decorative_fills(&mut cm, dw, dh);
            // Merge into fm
            for p in 0..tp {
                if cm[p] == 1 {
                    fm[p] = 1;
                }
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

    // Noise removal
    noise::remove_noise(&mut fm, dw, dh);

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
