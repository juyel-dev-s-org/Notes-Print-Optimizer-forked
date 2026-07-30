import { WASM_BASE64 } from './kernels.wasm.generated';
import { applyMaskDilation as jsDilation, applyUnsharpMask as jsUnsharp } from '../../kernels';

interface WasmExports {
  memory: WebAssembly.Memory;
  applyMaskDilation(data: number, copy: number, w: number, h: number, ks: number): void;
  applyUnsharpMask(data: number, copy: number, w: number, h: number, amt: number): void;
}

function decodeBase64(base64: string): Uint8Array {
  const bin = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let wasmReady: Promise<boolean> | null = null;
let wasm: WasmExports | null = null;

async function initWasm(): Promise<boolean> {
  try {
    if (typeof WebAssembly === 'undefined') return false;
    const bytes = decodeBase64(WASM_BASE64);
    const result: any = await WebAssembly.instantiate(bytes, {});
    const instance: any = result.instance;
    wasm = instance.exports as unknown as WasmExports;
    return true;
  } catch {
    return false;
  }
}

function ensureMem(size: number): boolean {
  if (!wasm) return false;
  const mem = wasm.memory;
  const needed = Math.ceil(size / 65536);
  if (mem.buffer.byteLength < size) {
    try { mem.grow(needed - mem.buffer.byteLength / 65536); } catch { return false; }
  }
  return true;
}

export async function ensureWasm(): Promise<void> {
  if (wasmReady === null) wasmReady = initWasm();
  await wasmReady;
}

export function applyMaskDilation(mask: Uint8Array, w: number, h: number, ks: number): void {
  if (!wasm || !ensureMem(mask.length * 2)) { jsDilation(mask, w, h, ks); return; }
  const mem = new Uint8Array(wasm.memory.buffer);
  mem.set(mask, 0);
  wasm.applyMaskDilation(0, mask.length, w, h, ks);
  mask.set(mem.subarray(0, mask.length));
}

export function applyUnsharpMask(data: Uint8ClampedArray, w: number, h: number, amt: number): void {
  if (!wasm || !ensureMem(data.length * 2)) { jsUnsharp(data, w, h, amt); return; }
  const mem = new Uint8Array(wasm.memory.buffer);
  mem.set(data, 0);
  wasm.applyUnsharpMask(0, data.length, w, h, amt);
  data.set(mem.subarray(0, data.length));
}



