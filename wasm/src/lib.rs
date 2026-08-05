mod hsv;
mod classify;
mod connected;
mod decorative;
mod noise;
mod mask_ops;
mod sharpen;
mod ink;
mod process;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn rgb_to_hsv_batch(rgba: &[u8], pixel_count: u32) -> Vec<f32> {
    hsv::rgb_to_hsv_batch(rgba, pixel_count as usize)
}

#[wasm_bindgen]
pub fn classify_colors(hsv: &[f32], pixel_count: u32) -> Vec<u8> {
    classify::classify_colors(hsv, pixel_count as usize)
}

#[wasm_bindgen]
pub fn connected_components(mask: &[u8], width: u32, height: u32) -> Vec<i32> {
    connected::connected_components(mask, width as usize, height as usize)
}

#[wasm_bindgen]
pub fn strip_decorative_fills(mask: &mut [u8], width: u32, height: u32) {
    decorative::strip_decorative_fills(mask, width as usize, height as usize);
}

#[wasm_bindgen]
pub fn remove_noise(mask: &mut [u8], width: u32, height: u32) {
    noise::remove_noise(mask, width as usize, height as usize);
}

#[wasm_bindgen]
pub fn dilate_mask(mask: &mut [u8], width: u32, height: u32, ks: u32) {
    mask_ops::dilate_mask(mask, width as usize, height as usize, ks as usize);
}

#[wasm_bindgen]
pub fn unsharp_mask(data: &mut [u8], width: u32, height: u32, amt: f64) {
    sharpen::unsharp_mask(data, width as usize, height as usize, amt);
}

#[wasm_bindgen]
pub fn ink_coverage(data: &[u8], pixel_count: u32, threshold: u8) -> f64 {
    ink::ink_coverage(data, pixel_count as usize, threshold)
}

#[wasm_bindgen]
pub fn process_page(
    rgba: &[u8],
    width: u32,
    height: u32,
    invert_mode_smart: bool,
    is_dark: bool,
    dilation_ks: u32,
    sharpen_amount: f64,
) -> Vec<u8> {
    process::process_page(rgba, width, height, invert_mode_smart, is_dark, dilation_ks, sharpen_amount)
}
