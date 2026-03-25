class SoulTuneProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        try {
            const wasmModule = options.processorOptions.wasmModule;
            const wasmInstance = new WebAssembly.Instance(wasmModule, {
                env: {
                    emscripten_notify_memory_growth: () => {}
                },
                wasi_snapshot_preview1: {
                    proc_exit: () => {}
                }
            });
            
            this.wasm = wasmInstance.exports;
            // Support both standard emscripten and our custom internal exports
            this.malloc = this.wasm.malloc_internal || this.wasm.malloc;
            this.free = this.wasm.free_internal || this.wasm.free;

            if (this.wasm.init_engine) this.wasm.init_engine();
            
            this.frames = 128;
            if (this.malloc) {
                this.ptrLeft = this.malloc(this.frames * 4);
                this.ptrRight = this.malloc(this.frames * 4);
                this.outLeft = new Float32Array(this.wasm.memory.buffer, this.ptrLeft, this.frames);
                this.outRight = new Float32Array(this.wasm.memory.buffer, this.ptrRight, this.frames);
            }
            
            this.port.onmessage = (event) => {
                const data = event.data;
                if (!this.wasm) return;

                if (data.type === 'SET_VOICE') {
                    if (this.wasm.set_voice) {
                        const mappedPan = (data.pan + 1) / 2;
                        this.wasm.set_voice(data.index, data.carrier, data.beat, data.volume, data.harmonizer, mappedPan);
                    }
                } else if (data.type === 'STOP_VOICE') {
                    if (this.wasm.stop_voice) this.wasm.stop_voice(data.index);
                } else if (data.type === 'RESET') {
                    if (this.wasm.init_engine) this.wasm.init_engine();
                }
            };
        } catch (e) {
            console.error("SoulTuneProcessor: Failed to initialize WASM", e);
        }
    }

    process(inputs, outputs) {
        const output = outputs[0];
        if (!output || output.length < 2 || !this.wasm || !this.ptrLeft) return true;
        
        const channelLeft = output[0];
        const channelRight = output[1];
        const currentFrames = channelLeft.length;

        // Re-allocate only if frame size changes (rare in Web Audio)
        if (currentFrames !== this.frames && this.malloc && this.free) {
            this.free(this.ptrLeft);
            this.free(this.ptrRight);
            this.frames = currentFrames;
            this.ptrLeft = this.malloc(this.frames * 4);
            this.ptrRight = this.malloc(this.frames * 4);
            this.outLeft = new Float32Array(this.wasm.memory.buffer, this.ptrLeft, this.frames);
            this.outRight = new Float32Array(this.wasm.memory.buffer, this.ptrRight, this.frames);
        } else if (this.outLeft.buffer !== this.wasm.memory.buffer) {
             // Re-view if memory grew
             this.outLeft = new Float32Array(this.wasm.memory.buffer, this.ptrLeft, this.frames);
             this.outRight = new Float32Array(this.wasm.memory.buffer, this.ptrRight, this.frames);
        }

        if (this.wasm.process_binaural) {
            this.wasm.process_binaural(this.ptrLeft, this.ptrRight, currentFrames, sampleRate);
            channelLeft.set(this.outLeft.subarray(0, currentFrames));
            channelRight.set(this.outRight.subarray(0, currentFrames));
        }

        return true;
    }
}

registerProcessor('soul-tune-processor', SoulTuneProcessor);
