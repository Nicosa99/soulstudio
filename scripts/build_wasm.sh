#!/bin/bash
set -e

OUT_DIR="public/worklets"
mkdir -p "$OUT_DIR"

echo "Compiling SoulTune Raw-Metal Engine..."

# Strikte Memory-Limits für AudioWorklet Sandbox
FLAGS="-O3 \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=16777216 \
  -s MAXIMUM_MEMORY=67108864 \
  -s EXPORTED_FUNCTIONS=['_process_binaural','_init_engine','_set_voice','_stop_voice','_get_buffer_l','_get_buffer_r'] \
  -s STANDALONE_WASM=1 \
  --no-entry"

if ! command -v emcc &> /dev/null; then
    docker run --rm -v "$(pwd):/src" -w /src emscripten/emsdk \
      emcc src/lib/audio/wasm/soul_synth.cpp $FLAGS -o "$OUT_DIR/soul_synth_v2.wasm"
else
    emcc src/lib/audio/wasm/soul_synth.cpp $FLAGS -o "$OUT_DIR/soul_synth_v2.wasm"
fi

echo "Build complete! Output: $OUT_DIR/soul_synth_v2.wasm"
