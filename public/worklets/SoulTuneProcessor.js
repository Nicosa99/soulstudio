class SoulTuneProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // Retrieve the compiled WebAssembly.Module sent from the main thread
        const wasmModule = options.processorOptions.wasmModule;
        
        // Instantiate the WASM module synchronously since it's already compiled
        const wasmInstance = new WebAssembly.Instance(wasmModule, {
            env: {
                emscripten_notify_memory_growth: function() {}
            },
            wasi_snapshot_preview1: {
                proc_exit: function() {}
            }
        });
        
        this.wasm = wasmInstance.exports;
        
        // Standard Web Audio API frame size is 128
        this.frames = 128;
        
        // Allocate Memory via Emscripten malloc. Float32 takes 4 bytes.
        this.ptrLeft = this.wasm.malloc(this.frames * 4);
        this.ptrRight = this.wasm.malloc(this.frames * 4);
        
        // Create TypedArray views mapped to the WASM memory buffer
        this.outLeft = new Float32Array(this.wasm.memory.buffer, this.ptrLeft, this.frames);
        this.outRight = new Float32Array(this.wasm.memory.buffer, this.ptrRight, this.frames);
        
        // Default DSP State
        this.carrier = 0.0;
        this.beat = 0.0;
        this.volume = 0.0;

        // Message port receiver to update JSON state smoothly from AudioEngine
        this.port.onmessage = (event) => {
            const data = event.data;
            if (data.type === 'UPDATE_PLAYBOOK') {
                if (data.carrier !== undefined) this.carrier = data.carrier;
                if (data.beat !== undefined) this.beat = data.beat;
                if (data.volume !== undefined) this.volume = data.volume;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        
        // We require strict stereo (binaural) channel configuration
        if (!output || output.length < 2) return true;
        
        const channelLeft = output[0];
        const channelRight = output[1];
        
        // Memory views can be invalidated if the underlying WASM buffer grows
        if (this.outLeft.buffer !== this.wasm.memory.buffer) {
             this.outLeft = new Float32Array(this.wasm.memory.buffer, this.ptrLeft, this.frames);
             this.outRight = new Float32Array(this.wasm.memory.buffer, this.ptrRight, this.frames);
        }

        // Delegate heavy floating-point calculation directly to pure C++ WASM
        this.wasm.process_binaural(
            this.ptrLeft, 
            this.ptrRight, 
            channelLeft.length, 
            sampleRate, // globally available in AudioWorkletGlobalScope
            this.carrier, 
            this.beat, 
            this.volume
        );
        
        // Populate the JS Audio node output streams with the C++ generated arrays
        channelLeft.set(this.outLeft);
        channelRight.set(this.outRight);

        // Keep Processor alive
        return true;
    }
}

// Register the processor in the AudioWorkletGlobalScope
registerProcessor('soul-tune-processor', SoulTuneProcessor);