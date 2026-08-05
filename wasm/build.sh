#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
wasm-pack build --target web --release --out-dir pkg
cp pkg/npo_wasm_bg.wasm ../public/wasm/npo_wasm_bg.wasm
cp pkg/npo_wasm.js ../public/wasm/npo_wasm.js
echo "WASM build complete: $(wc -c < pkg/npo_wasm_bg.wasm) bytes (glue + binary copied to public/wasm/)"
