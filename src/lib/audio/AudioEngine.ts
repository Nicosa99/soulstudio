import { Block, useStudioStore, Track } from "@/store/useStudioStore";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  public isPlaying = false;
  private baseTime = 0;
  public currentOffset = 0;

  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private trackChannels = new Map<string, { gain: GainNode, panner: StereoPannerNode }>();
  private activeBlocks = new Map<string, any>();
  private noiseBuffer: AudioBuffer | null = null;
  private audioCache = new Map<string, AudioBuffer>();
  
  private wasmModule: WebAssembly.Module | null = null;
  private isWasmLoaded = false;

  // Helper: Convert dB to Linear Gain
  private dbToGain(db: number): number {
    if (db === -Infinity) return 0;
    return Math.pow(10, db / 20);
  }

  // Helper: Handle mixed input (Percentage or dB)
  private getGainFromVolume(vol: number): number {
    if (vol < 0) return this.dbToGain(vol);
    return vol / 100;
  }

  async init() {
    if (this.ctx) return;
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtor({ sampleRate: 48000 }); // strict 48000Hz for neuro-acoustic C++ WASM
    this.createBrownNoiseBuffer();

    if (!this.isWasmLoaded) {
      try {
        const response = await fetch('/worklets/soul_synth.wasm');
        if (response.ok) {
          const wasmBuffer = await response.arrayBuffer();
          this.wasmModule = await WebAssembly.compile(wasmBuffer);
          await this.ctx.audioWorklet.addModule('/worklets/SoulTuneProcessor.js');
          this.isWasmLoaded = true;
          console.log("AudioEngine: Wasm God-Mode initialized.");
        }
      } catch (err) {
        console.error("Failed to load Wasm audio module:", err);
      }
    }
  }

  private createBrownNoiseBuffer() {
    if (!this.ctx || this.noiseBuffer) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
    }
  }

  async playSequencer(blocks: Block[], startOffset: number = 0, masterTuning: number = 432) {
    await this.init();
    if (!this.ctx) return;
    
    const urlsToLoad = blocks
       .filter(b => b.type === 'voice' || b.type === 'guide')
       .map(b => b.properties.fileUrl as string)
       .filter(url => url && !this.audioCache.has(url));

    if (urlsToLoad.length > 0) {
       await Promise.all(urlsToLoad.map(async (url) => {
          try {
             const res = await fetch(url);
             const arr = await res.arrayBuffer();
             const buf = await this.ctx!.decodeAudioData(arr);
             this.audioCache.set(url, buf);
          } catch(e) { console.error("Failed to decode audio", e); }
       }));
    }

    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.isPlaying) return;

    this.baseTime = this.ctx.currentTime + 0.05;
    this.currentOffset = startOffset;
    this.activeBlocks.clear();

    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -12;
    this.masterCompressor.knee.value = 40;
    this.masterCompressor.ratio.value = 2;
    this.masterCompressor.attack.value = 0.5;
    this.masterCompressor.release.value = 1.0;
    this.masterCompressor.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7; // Hard limit master headroom
    
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;

    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.masterCompressor);

    this.trackChannels.clear();
    const { tracks } = useStudioStore.getState();
    tracks.forEach(track => {
        const panNode = this.ctx!.createStereoPanner();
        panNode.pan.value = track.pan ?? 0.0;
        const gainNode = this.ctx!.createGain();
        gainNode.gain.value = track.volume ?? 1.0;
        panNode.connect(gainNode);
        gainNode.connect(this.masterGain!);
        this.trackChannels.set(track.id, { gain: gainNode, panner: panNode });
    });

    const validBlocks = blocks.filter(b => b.end_time > b.start_time && b.end_time > startOffset);

    validBlocks.forEach(block => {
      if (!this.ctx || !this.masterGain) return;
      const trackChannel = this.trackChannels.get(block.track_id);
      const destNode = trackChannel ? trackChannel.panner : this.masterGain;
      const nodeStart = Math.max(this.baseTime, this.baseTime + block.start_time - startOffset);
      const endTimeCtx = this.baseTime + block.end_time - startOffset;
      const trimStart = (block.properties.trimStart as number) || 0;
      const bufferOffset = Math.max(0, startOffset - block.start_time) + trimStart;

      if (block.type === 'atmosphere') {
         const noiseSource = this.ctx.createBufferSource();
         noiseSource.buffer = this.noiseBuffer;
         noiseSource.loop = true;
         const filter = this.ctx.createBiquadFilter();
         filter.type = 'lowpass';
         filter.frequency.value = (block.properties.filterCutoff as number) ?? 150;
         const fadeIn = (block.properties.fade_in as number) || 0;
         const fadeOut = (block.properties.fade_out as number) || 0;
         const gain = this.ctx.createGain();
         const targetVol = this.getGainFromVolume(block.properties.volume ?? 50) * 0.4;
         gain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
         if (fadeIn > 0) gain.gain.linearRampToValueAtTime(targetVol, nodeStart + fadeIn);
         else gain.gain.setTargetAtTime(targetVol, nodeStart, 0.05);
         noiseSource.connect(filter);
         filter.connect(gain);
         gain.connect(destNode);
         if (fadeOut > 0) {
             gain.gain.setValueAtTime(targetVol, Math.max(nodeStart, endTimeCtx - fadeOut));
             gain.gain.linearRampToValueAtTime(0, endTimeCtx);
         } else gain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
         noiseSource.start(nodeStart, bufferOffset);
         noiseSource.stop(endTimeCtx);
         this.activeBlocks.set(block.id, { type: 'atmosphere', source: noiseSource, filter, gain });
      }
      else if (block.type === 'carrier' || block.type === 'entrainment') {
         const baseFreq = (block.properties.baseFrequency as number) ?? 100.0;
         const targetHz = (block.properties.targetStateHz as number) || 0;
         const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
         const levelFraction = harmonizerLevel / 100;
         const fadeIn = (block.properties.fade_in as number) || 0;
         const fadeOut = (block.properties.fade_out as number) || 0;
         const vol = this.getGainFromVolume(block.properties.volume ?? 50) * (block.type === 'carrier' ? 0.6 : 1.0);
         
         const blockGain = this.ctx.createGain();
         blockGain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
         if (fadeIn > 0) blockGain.gain.linearRampToValueAtTime(vol, nodeStart + fadeIn);
         else blockGain.gain.setTargetAtTime(vol, nodeStart, 0.05);
         blockGain.connect(destNode);

         // We use the new Wasm God-Mode nodes if available
         const wasmNodes: AudioWorkletNode[] = [];

         if (this.isWasmLoaded && this.wasmModule) {
            const spawnWasmPair = (mult: number, volFactor: number) => {
                const worklet = new AudioWorkletNode(this.ctx!, 'soul-tune-processor', {
                   outputChannelCount: [2],
                   processorOptions: { wasmModule: this.wasmModule }
                });
                
                worklet.port.postMessage({
                    type: 'UPDATE_PLAYBOOK',
                    carrier: baseFreq * mult,
                    beat: targetHz * mult,
                    volume: volFactor
                });
   
                worklet.connect(blockGain);
                wasmNodes.push(worklet);
            };

            spawnWasmPair(1, 1.0);
            spawnWasmPair(2, 0.3 * levelFraction);
            spawnWasmPair(3, 0.1 * levelFraction);
         }

         if (fadeOut > 0) {
             blockGain.gain.setValueAtTime(vol, Math.max(nodeStart, endTimeCtx - fadeOut));
             blockGain.gain.linearRampToValueAtTime(0, endTimeCtx);
         } else blockGain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);

         this.activeBlocks.set(block.id, { type: block.type, wasmNodes, blockGain });
      }
      else if (block.type === 'voice' || block.type === 'guide') {
         const fileUrl = block.properties.fileUrl as string;
         const source = this.ctx.createBufferSource();
         const buffer = fileUrl ? this.audioCache.get(fileUrl) : null;
         if (buffer) source.buffer = buffer;
         const fadeIn = (block.properties.fade_in as number) || 0;
         const fadeOut = (block.properties.fade_out as number) || 0;
         const gain = this.ctx.createGain();
         const subMode = block.properties.subliminal ?? false;
         const targetVol = this.getGainFromVolume(block.properties.volume ?? 80) * (subMode ? 0.1 : 1.0);
         gain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
         if (fadeIn > 0) gain.gain.linearRampToValueAtTime(targetVol, nodeStart + fadeIn);
         else gain.gain.setTargetAtTime(targetVol, nodeStart, 0.05);
         source.connect(gain);
         gain.connect(destNode);
         if (fadeOut > 0) {
             gain.gain.setValueAtTime(targetVol, Math.max(nodeStart, endTimeCtx - fadeOut));
             gain.gain.linearRampToValueAtTime(0, endTimeCtx);
         } else gain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
         if (buffer) { source.start(nodeStart, bufferOffset); source.stop(endTimeCtx); }
         this.activeBlocks.set(block.id, { type: 'voice', gain, source });
      }
    });
    this.isPlaying = true;
  }

  updateBlockProperties(blocks: Block[], tracks: Track[], masterTuning: number) {
     if (!this.isPlaying || !this.ctx) return;
     const now = this.ctx.currentTime;
     // The tracks are passed in, so we don't strictly need to fetch them from the store, but we can use them to update panning/volume.
     tracks.forEach(track => {
        const channel = this.trackChannels.get(track.id);
        if (channel) {
            channel.gain.gain.setTargetAtTime(track.volume ?? 1.0, now, 0.05);
            channel.panner.pan.setTargetAtTime(track.pan ?? 0.0, now, 0.05);
        }
     });

     blocks.forEach(block => {
        const group = this.activeBlocks.get(block.id);
        if (!group) return;
        const vol = this.getGainFromVolume(block.properties.volume ?? 50);

        if (group.type === 'carrier' || group.type === 'entrainment') {
           const baseFreq = (block.properties.baseFrequency as number) ?? 100.0;
           const targetHz = (block.properties.targetStateHz as number) || 0;
           const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
           const levelFraction = harmonizerLevel / 100;
           
           group.blockGain.gain.setTargetAtTime(vol * (group.type === 'carrier' ? 0.6 : 1.0), now, 0.05);
           
           if (group.wasmNodes && group.wasmNodes.length >= 3) {
               group.wasmNodes[0].port.postMessage({ carrier: baseFreq, beat: targetHz, volume: 1.0 });
               group.wasmNodes[1].port.postMessage({ carrier: baseFreq * 2, beat: targetHz * 2, volume: 0.3 * levelFraction });
               group.wasmNodes[2].port.postMessage({ carrier: baseFreq * 3, beat: targetHz * 3, volume: 0.1 * levelFraction });
           }
        }
        else if (group.type === 'atmosphere') {
           group.gain.gain.setTargetAtTime(vol * 0.4, now, 0.05);
        }
        else if (group.type === 'voice') {
           const subMode = block.properties.subliminal ?? false;
           group.gain.gain.setTargetAtTime(vol * (subMode ? 0.1 : 1.0), now, 0.05);
        }
     });
  }

  getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) return this.currentOffset;
    return this.ctx.currentTime - this.baseTime + this.currentOffset;
  }

  getAnalyserData(destArray: Uint8Array) {
    if (this.masterAnalyser) this.masterAnalyser.getByteTimeDomainData(destArray as any);
  }

  stop() {
    if (!this.ctx) return;
    this.activeBlocks.forEach(group => {
       try {
          if (group.wasmNodes) {
              group.wasmNodes.forEach((node: AudioWorkletNode) => node.disconnect());
          }
          if (group.source) group.source.stop();
       } catch (e) {}
    });
    this.activeBlocks.clear();
    if (this.masterGain) this.masterGain.disconnect();
    if (this.masterCompressor) this.masterCompressor.disconnect();
    this.isPlaying = false;
  }
}

export const instance = new AudioEngine();
