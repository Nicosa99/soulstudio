import { Block, useStudioStore, Track } from "@/store/useStudioStore";

interface ActiveBlockGroup {
  type: string;
  source?: AudioBufferSourceNode;
  gain?: GainNode;
  startTime: number;
  endTime: number;
  voiceIndex?: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  public isPlaying = false;
  private baseTime = 0;
  public currentOffset = 0;

  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private trackNodes = new Map<string, { volume: number, pan: number }>();
  private activeBlocks = new Map<string, ActiveBlockGroup>();
  private scheduledBlockIds = new Set<string>();
  private noiseBuffer: AudioBuffer | null = null;
  private audioCache = new Map<string, AudioBuffer>();
  
  private wasmModule: WebAssembly.Module | null = null;
  private isWasmLoaded = false;
  private wasmBinauralNode: AudioWorkletNode | null = null;
  
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private allBlocks: Block[] = [];
  private availableVoiceIndices: number[] = Array.from({ length: 32 }, (_, i) => i);

  private dbToGain(db: number): number {
    if (db === -Infinity) return 0;
    return Math.pow(10, db / 20);
  }

  private getGainFromVolume(vol: number): number {
    if (vol < 0) return this.dbToGain(vol);
    return vol / 100;
  }

  async init() {
    if (this.ctx) return;
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtor({ sampleRate: 48000 }); 
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
    const bufferSize = 5 * this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 2.0;
    }
  }

  playSequencer = async (blocks: Block[], startOffset: number = 0) => {
    await this.init();
    if (!this.ctx) return;
    
    this.stop();

    this.allBlocks = blocks;
    this.currentOffset = startOffset;
    
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.baseTime = this.ctx.currentTime;
    this.isPlaying = true;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // CRITICAL: Single Wasm Node for everything
    if (this.isWasmLoaded && this.wasmModule) {
        this.wasmBinauralNode = new AudioWorkletNode(this.ctx, 'soul-tune-processor', {
            outputChannelCount: [2],
            processorOptions: { wasmModule: this.wasmModule }
        });
        this.wasmBinauralNode.connect(this.masterGain);
    }

    this.trackNodes.clear();
    const { tracks } = useStudioStore.getState();
    tracks.forEach(track => {
        this.trackNodes.set(track.id, { 
            volume: track.volume ?? 1.0, 
            pan: track.pan ?? 0.0 
        });
    });

    const urlsToLoad = blocks
       .filter(b => b.type === 'voice' || b.type === 'guide')
       .map(b => b.properties.fileUrl as string)
       .filter(url => url && !this.audioCache.has(url));

    if (urlsToLoad.length > 0) {
       await Promise.all(urlsToLoad.map(async (url) => {
          try {
             const res = await fetch(url);
             if (!res.ok) return;
             const arr = await res.arrayBuffer();
             const buf = await this.ctx!.decodeAudioData(arr);
             this.audioCache.set(url, buf);
          } catch { /* ignore */ }
       }));
    }

    this.runScheduler();
    this.schedulerTimer = setInterval(this.runScheduler, 100);
  };

  private runScheduler = () => {
    if (!this.isPlaying || !this.ctx) return;
    const lookahead = 0.5;
    const now = this.ctx.currentTime;
    const currentDAWTime = now - this.baseTime + this.currentOffset;

    this.allBlocks.forEach(block => {
      if (block.start_time <= currentDAWTime + lookahead && block.end_time > currentDAWTime && !this.scheduledBlockIds.has(block.id)) {
        this.scheduleBlock(block);
      }
    });

    this.activeBlocks.forEach((group, id) => {
        if (currentDAWTime > group.endTime) {
            this.cleanupBlock(id);
        }
    });
  };

  private scheduleBlock(block: Block) {
    if (!this.ctx || !this.masterGain) return;
    
    const track = this.trackNodes.get(block.track_id);
    const nodeStart = Math.max(this.ctx.currentTime, this.baseTime + block.start_time - this.currentOffset);
    const endTimeCtx = this.baseTime + block.end_time - this.currentOffset;
    const fadeIn = (block.properties.fade_in as number) || 0;
    const fadeOut = (block.properties.fade_out as number) || 0;

    if (block.type === 'atmosphere') {
       const noiseSource = this.ctx.createBufferSource();
       noiseSource.buffer = this.noiseBuffer;
       noiseSource.loop = true;
       const filter = this.ctx.createBiquadFilter();
       filter.type = 'lowpass';
       filter.frequency.value = (block.properties.filterCutoff as number) ?? 600;
       const gain = this.ctx.createGain();
       const targetVol = this.getGainFromVolume(block.properties.volume ?? 50) * 0.4 * (track?.volume ?? 1.0);
       gain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
       if (fadeIn > 0) gain.gain.linearRampToValueAtTime(targetVol, nodeStart + fadeIn);
       else gain.gain.setTargetAtTime(targetVol, nodeStart, 0.05);
       noiseSource.connect(filter);
       filter.connect(gain);
       gain.connect(this.masterGain);
       if (fadeOut > 0) {
           gain.gain.setValueAtTime(targetVol, Math.max(nodeStart, endTimeCtx - fadeOut));
           gain.gain.linearRampToValueAtTime(0, endTimeCtx);
       } else gain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.02), 0.01);
       noiseSource.start(nodeStart);
       noiseSource.stop(endTimeCtx);
       this.activeBlocks.set(block.id, { type: 'atmosphere', source: noiseSource, gain, startTime: block.start_time, endTime: block.end_time });
    }
    else if (block.type === 'carrier' || block.type === 'entrainment') {
       const baseFreq = (block.properties.baseFrequency as number) ?? 100.0;
       const targetHz = (block.properties.targetStateHz as number) || 0;
       const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
       const levelFraction = harmonizerLevel / 100;
       const blockVol = this.getGainFromVolume(block.properties.volume ?? 50) * (block.type === 'carrier' ? 0.6 : 1.0);
       const trackVol = track?.volume ?? 1.0;
       const trackPan = track?.pan ?? 0.0;
       
       if (this.wasmBinauralNode && this.availableVoiceIndices.length > 0) {
           const vIdx = this.availableVoiceIndices.shift()!;
           this.wasmBinauralNode.port.postMessage({
               type: 'SET_VOICE',
               index: vIdx,
               carrier: baseFreq,
               beat: targetHz,
               volume: blockVol * trackVol,
               harmonizer: levelFraction,
               pan: trackPan
           });
           this.activeBlocks.set(block.id, { type: block.type, voiceIndex: vIdx, startTime: block.start_time, endTime: block.end_time });
       }
    }
    else if (block.type === 'voice' || block.type === 'guide') {
       const fileUrl = block.properties.fileUrl as string;
       if (!this.audioCache.has(fileUrl)) return;
       const source = this.ctx.createBufferSource();
       source.buffer = this.audioCache.get(fileUrl)!;
       const gain = this.ctx.createGain();
       const subMode = block.properties.subliminal ?? false;
       const targetVol = this.getGainFromVolume(block.properties.volume ?? 80) * (subMode ? 0.1 : 1.0) * (track?.volume ?? 1.0);
       gain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
       if (fadeIn > 0) gain.gain.linearRampToValueAtTime(targetVol, nodeStart + fadeIn);
       else gain.gain.setTargetAtTime(targetVol, nodeStart, 0.05);
       source.connect(gain);
       gain.connect(this.masterGain);
       if (fadeOut > 0) {
           gain.gain.setValueAtTime(targetVol, Math.max(nodeStart, endTimeCtx - fadeOut));
           gain.gain.linearRampToValueAtTime(0, endTimeCtx);
       } else gain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
       const trimStart = (block.properties.trimStart as number) || 0;
       const bufferOffset = Math.max(0, this.currentOffset - block.start_time) + trimStart;
       source.start(nodeStart, bufferOffset); 
       source.stop(endTimeCtx); 
       this.activeBlocks.set(block.id, { type: 'voice', gain, source, startTime: block.start_time, endTime: block.end_time });
    }
    this.scheduledBlockIds.add(block.id);
  }

  private cleanupBlock(id: string) {
    const group = this.activeBlocks.get(id);
    if (!group) return;
    try {
        if (group.voiceIndex !== undefined && this.wasmBinauralNode) {
            this.wasmBinauralNode.port.postMessage({ type: 'STOP_VOICE', index: group.voiceIndex });
            this.availableVoiceIndices.push(group.voiceIndex);
        }
        if (group.source) group.source.stop();
        if (group.gain) group.gain.disconnect();
    } catch { /* ignore */ }
    this.activeBlocks.delete(id);
  }

  updateBlockProperties = (blocks: Block[], tracks: Track[]) => {
     if (!this.isPlaying || !this.ctx) return;
     const now = this.ctx.currentTime;
     this.allBlocks = blocks;
     
     tracks.forEach(track => {
        this.trackNodes.set(track.id, { 
            volume: track.volume ?? 1.0, 
            pan: track.pan ?? 0.0 
        });
     });

     blocks.forEach(block => {
        const group = this.activeBlocks.get(block.id);
        if (!group) return;
        const vol = this.getGainFromVolume(block.properties.volume ?? 50);
        const track = this.trackNodes.get(block.track_id);

        if ((group.type === 'carrier' || group.type === 'entrainment') && group.voiceIndex !== undefined && this.wasmBinauralNode) {
           const baseFreq = (block.properties.baseFrequency as number) ?? 100.0;
           const targetHz = (block.properties.targetStateHz as number) || 0;
           this.wasmBinauralNode.port.postMessage({ 
               type: 'SET_VOICE', 
               index: group.voiceIndex,
               carrier: baseFreq, 
               beat: targetHz, 
               volume: vol * (group.type === 'carrier' ? 0.6 : 1.0) * (track?.volume ?? 1.0), 
               harmonizer: (block.properties.harmonizerLevel as number ?? 0) / 100,
               pan: track?.pan ?? 0.0
           });
        }
        else if (group.type === 'atmosphere' && group.gain) {
           group.gain.gain.setTargetAtTime(vol * 0.4 * (track?.volume ?? 1.0), now, 0.02);
        }
        else if (group.type === 'voice' && group.gain) {
           group.gain.gain.setTargetAtTime(vol * (block.properties.subliminal ? 0.1 : 1.0) * (track?.volume ?? 1.0), now, 0.02);
        }
     });
  };

  getCurrentTime = (): number => {
    if (!this.isPlaying || !this.ctx) return this.currentOffset;
    return this.ctx.currentTime - this.baseTime + this.currentOffset;
  };

  getAnalyserData = (destArray: Uint8Array) => {
    if (this.masterAnalyser) this.masterAnalyser.getByteTimeDomainData(destArray);
  };

  stop = () => {
    if (this.schedulerTimer) {
        clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
    }
    
    // 1. Cleanup all active sources and filters
    this.activeBlocks.forEach((_, id) => {
        this.cleanupBlock(id);
    });
    
    this.activeBlocks.clear();
    this.scheduledBlockIds.clear(); 
    this.availableVoiceIndices = Array.from({ length: 32 }, (_, i) => i);
    
    // 2. DISCONNECT AND KILL THE WASM NODE
    if (this.wasmBinauralNode) {
        try {
            this.wasmBinauralNode.port.postMessage({ type: 'RESET' });
            this.wasmBinauralNode.disconnect();
        } catch (e) {
            console.warn("AudioEngine: Error killing Wasm node", e);
        }
        this.wasmBinauralNode = null;
    }

    // 3. CLEANUP MASTER GRAPH
    if (this.masterAnalyser) {
        this.masterAnalyser.disconnect();
        this.masterAnalyser = null;
    }

    if (this.masterGain) {
        this.masterGain.disconnect();
        this.masterGain = null;
    }

    this.isPlaying = false;
  };
}

export const instance = new AudioEngine();
