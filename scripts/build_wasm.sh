#!/bin/bash
set -e

OUT_DIR="public/worklets"
mkdir -p "$OUT_DIR"

echo "Compiling soul_synth.cpp to WebAssembly for AudioWorklet..."

# Use Docker with Emscripten if emcc is not installed locally
if ! command -v emcc &> /dev/null; then
    echo "emcc not found locally. Using emscripten/emsdk Docker image..."
    docker run --rm -v "$(pwd):/src" -w /src emscripten/emsdk \
      emcc src/lib/audio/wasm/soul_synth.cpp \
      -O3 \
      -s WASM=1 \
      -s EXPORTED_FUNCTIONS="['_process_binaural', '_malloc', '_free']" \
      -s ALLOW_MEMORY_GROWTH=1 \
      -s STANDALONE_WASM=1 \
      --no-entry \
      -o "$OUT_DIR/soul_synth.wasm"
else
    emcc src/lib/audio/wasm/soul_synth.cpp \
      -O3 \
      -s WASM=1 \
      -s EXPORTED_FUNCTIONS="['_process_binaural', '_malloc', '_free']" \
      -s ALLOW_MEMORY_GROWTH=1 \
      -s STANDALONE_WASM=1 \
      --no-entry \
      -o "$OUT_DIR/soul_synth.wasm"
fi

echo "Build complete! Output: $OUT_DIR/soul_synth.wasm"
