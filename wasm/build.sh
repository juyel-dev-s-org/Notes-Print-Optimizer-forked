#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
wasm-pack build --target web --release --out-dir pkg
cp pkg/npo_wasm_bg.wasm ../public/wasm/npo_wasm_bg.wasm
echo "WASM build complete: $(wc -c < pkg/npo_wasm_bg.wasm) bytes"
