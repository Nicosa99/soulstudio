import { Block, useStudioStore, Track } from "@/store/useStudioStore";

interface ActiveBlockGroup {
  type: string;
  source?: AudioBufferSourceNode;
  gain?: GainNode;
  filter?: BiquadFilterNode;
  voiceIndex?: number;
  endTime: number;
}

// ─── GLOBAL HARDWARE & MEMORY (Bypasses HMR Resets) ──────────────────────────
const getGlobalStore = () => {
    if (typeof window === 'undefined') return {} as any;
    const win = window as any;
    if (!win.__SOUL_AUDIO_MEMORY__) {
        win.__SOUL_AUDIO_MEMORY__ = {
            ctx: null,
            wasmNode: null,
            activeBlocks: new Map<string, ActiveBlockGroup>(),
            scheduledIds: new Set<string>(),
            voices: Array.from({ length: 32 }, (_, i) => i),
            audioCache: new Map<string, AudioBuffer>(),
            pinkNoiseBuffer: null,
            brownNoiseBuffer: null,
            isPlaying: false,
            baseTime: 0,
            currentOffset: 0
        };
    }
    return win.__SOUL_AUDIO_MEMORY__;
};

export class AudioEngine {
  private schedulerTimer: any = null;
  private allBlocks: Block[] = [];

  constructor() {
    console.log("AudioEngine: Real-time Controller Linked.");
  }

  // Helper-Getters für den globalen Speicher
  private get mem() { return getGlobalStore(); }
  private get ctx(): AudioContext | null { return this.mem.ctx; }
  private set ctx(v: AudioContext | null) { this.mem.ctx = v; }
  private get wasmNode(): AudioWorkletNode | null { return this.mem.wasmNode; }
  private set wasmNode(v: AudioWorkletNode | null) { this.mem.wasmNode = v; }
  
  public get isPlaying() { return this.mem.isPlaying; }
  public set isPlaying(v: boolean) { this.mem.isPlaying = v; }
  public get currentOffset() { return this.mem.currentOffset; }
  public set currentOffset(v: number) { this.mem.currentOffset = v; }

  private dbToGain(db: number): number {
    if (db <= -100) return 0;
    return Math.pow(10, db / 20);
  }

  async init() {
    if (this.ctx && this.wasmNode) return;

    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtor({ sampleRate: 48000 });
    this.createNoiseBuffers();

    try {
        const res = await fetch('/worklets/soul_synth_v2.wasm');
        const wasmModule = await WebAssembly.compile(await res.arrayBuffer());
        
        await this.ctx.audioWorklet.addModule(`/worklets/SoulTuneProcessor_v2.js?id=${Date.now()}`);
        
        this.wasmNode = new AudioWorkletNode(this.ctx, 'soul-tune-processor', {
            outputChannelCount: [2],
            processorOptions: { wasmModule }
        });
        
        console.log("AudioEngine: Raw-Metal Engine Locked.");
    } catch (e) {
        console.error("AudioEngine: Fatal Init Error", e);
    }
  }

  private createNoiseBuffers() {
    if (!this.ctx || this.mem.pinkNoiseBuffer) return;
    const bufferSize = 5 * this.ctx.sampleRate;
    
    this.mem.brownNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const brownOut = this.mem.brownNoiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        brownOut[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = brownOut[i];
        brownOut[i] *= 3.5;
    }

    this.mem.pinkNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const pinkOut = this.mem.pinkNoiseBuffer.getChannelData(0);
    let b0, b1, b2, b3, b4, b5, b6; b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520; b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.0168980;
        pinkOut[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
    }
  }

  playSequencer = async (blocks: Block[], startOffset: number = 0) => {
    await this.init();
    if (!this.ctx || !this.wasmNode) return;

    if (this.isPlaying) this.stop();

    this.allBlocks = blocks;
    this.currentOffset = startOffset;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.mem.baseTime = this.ctx.currentTime;
    this.isPlaying = true;

    this.mem.masterGain = this.ctx.createGain();
    this.mem.masterGain.gain.value = 0.7;
    this.mem.masterAnalyser = this.ctx.createAnalyser();
    this.mem.masterAnalyser.fftSize = 2048;
    this.mem.masterGain.connect(this.mem.masterAnalyser);
    this.mem.masterAnalyser.connect(this.ctx.destination);

    this.wasmNode.disconnect();
    this.wasmNode.connect(this.mem.masterGain);
    this.wasmNode.port.postMessage({ type: 'RESET' });

    this.schedulerTimer = setInterval(this.runScheduler, 100);
  };

  private runScheduler = () => {
    if (!this.isPlaying || !this.ctx) return;
    const dawTime = this.ctx.currentTime - this.mem.baseTime + this.currentOffset;

    this.allBlocks.forEach(b => {
      if (b.start_time <= dawTime + 0.5 && b.end_time > dawTime && !this.mem.scheduledIds.has(b.id)) {
        this.scheduleBlock(b);
      }
    });

    this.mem.activeBlocks.forEach((group: ActiveBlockGroup, id: string) => {
        if (dawTime > group.endTime) this.cleanupBlock(id);
    });
  };

  private scheduleBlock(b: Block) {
    if (!this.ctx || !this.mem.masterGain) return;
    
    const track = useStudioStore.getState().tracks.find(t => t.id === b.track_id);
    const soloActive = useStudioStore.getState().tracks.some(t => t.isSolo);
    const isMuted = track?.isMuted || (soloActive && !track?.isSolo);
    const trackVol = isMuted ? 0 : (track?.volume ?? 1.0);
    const trackPan = track?.pan ?? 0.0;

    const nodeStart = Math.max(this.ctx.currentTime, this.mem.baseTime + b.start_time - this.currentOffset);
    const endTimeCtx = this.mem.baseTime + b.end_time - this.currentOffset;

    if (b.type === 'carrier' || b.type === 'entrainment') {
        if (this.wasmNode && this.mem.voices.length > 0) {
            const vIdx = this.mem.voices.shift()!;
            const rawVol = b.properties.volume !== undefined ? Number(b.properties.volume) : -12;
            const vol = (rawVol < 0) ? this.dbToGain(rawVol) : (rawVol / 100);
            const typeMult = (b.type === 'carrier' ? 0.6 : 1.0);
            
            this.wasmNode.port.postMessage({
                type: 'SET_VOICE',
                index: vIdx,
                carrier: Number(b.properties.baseFrequency) || 100,
                beat: Number(b.properties.targetStateHz) || 0,
                volume: vol * typeMult * trackVol,
                harmonizer: (Number(b.properties.harmonizerLevel) || 0) / 100,
                pan: trackPan
            });
            
            this.mem.activeBlocks.set(b.id, { type: b.type, voiceIndex: vIdx, endTime: b.end_time });
        }
    } else if (b.type === 'atmosphere') {
        const source = this.ctx.createBufferSource();
        const type = b.properties.atmosphereType ?? 'pinkNoise';
        source.buffer = type === 'brownNoise' ? this.mem.brownNoiseBuffer : this.mem.pinkNoiseBuffer;
        source.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = Number(b.properties.filterCutoff) || 600;
        const gain = this.ctx.createGain();
        const rawVol = b.properties.volume !== undefined ? Number(b.properties.volume) : -24;
        const vol = (rawVol < 0) ? this.dbToGain(rawVol) : (rawVol / 100);
        
        gain.gain.setValueAtTime(0, nodeStart);
        gain.gain.setTargetAtTime(vol * 0.4 * trackVol, nodeStart, 0.1);
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.mem.masterGain);
        
        source.start(nodeStart);
        source.stop(endTimeCtx);
        this.mem.activeBlocks.set(b.id, { type: 'atmosphere', source, gain, filter, endTime: b.end_time });
    } else if (b.type === 'voice' || b.type === 'guide') {
        const url = b.properties.fileUrl as string;
        if (url && this.mem.audioCache.has(url)) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.mem.audioCache.get(url)!;
            const gain = this.ctx.createGain();
            const rawVol = b.properties.volume !== undefined ? Number(b.properties.volume) : -3;
            const vol = (rawVol < 0) ? this.dbToGain(rawVol) : (rawVol / 100);
            const sub = !!b.properties.subliminal;
            
            gain.gain.setValueAtTime(0, nodeStart);
            gain.gain.setTargetAtTime(vol * (sub ? 0.1 : 1.0) * trackVol, nodeStart, 0.1);
            
            source.connect(gain);
            gain.connect(this.mem.masterGain);
            
            const offset = Math.max(0, this.currentOffset - b.start_time);
            source.start(nodeStart, offset);
            source.stop(endTimeCtx);
            this.mem.activeBlocks.set(b.id, { type: b.type, source, gain, endTime: b.end_time });
        }
    }
    this.mem.scheduledIds.add(b.id);
  }

  private cleanupBlock(id: string) {
    const group = this.mem.activeBlocks.get(id);
    if (!group) return;
    try {
        if (group.voiceIndex !== undefined && this.wasmNode) {
            this.wasmNode.port.postMessage({ type: 'STOP_VOICE', index: group.voiceIndex });
            this.mem.voices.push(group.voiceIndex);
        }
        if (group.source) {
            try { group.source.stop(); } catch(e) {}
            group.source.disconnect();
        }
        if (group.gain) group.gain.disconnect();
        if (group.filter) group.filter.disconnect();
    } catch { /* ignore */ }
    this.mem.activeBlocks.delete(id);
  }

  updateBlockProperties = (blocks: Block[], tracks: Track[]) => {
     if (!this.isPlaying || !this.ctx) return;
     this.allBlocks = blocks;
     
     const soloActive = tracks.some(t => t.isSolo);

     this.mem.activeBlocks.forEach((group: ActiveBlockGroup, blockId: string) => {
        const b = blocks.find(x => x.id === blockId);
        if (!b) return;
        
        const track = tracks.find(t => t.id === b.track_id);
        const isMuted = track?.isMuted || (soloActive && !track?.isSolo);
        const trackVol = isMuted ? 0 : (track?.volume ?? 1.0);
        const trackPan = track?.pan ?? 0.0;

        const rawVol = b.properties.volume !== undefined ? Number(b.properties.volume) : -12;
        const vol = (rawVol < 0) ? this.dbToGain(rawVol) : (rawVol / 100);

        if ((group.type === 'carrier' || group.type === 'entrainment') && group.voiceIndex !== undefined) {
            const typeMult = (b.type === 'carrier' ? 0.6 : 1.0);
            this.wasmNode?.port.postMessage({ 
                type: 'SET_VOICE', 
                index: group.voiceIndex,
                carrier: Number(b.properties.baseFrequency) || 100, 
                beat: Number(b.properties.targetStateHz) || 0, 
                volume: vol * typeMult * trackVol,
                harmonizer: (Number(b.properties.harmonizerLevel) || 0) / 100,
                pan: trackPan
            });
        } else if (group.type === 'atmosphere' && group.gain) {
            group.gain.gain.setTargetAtTime(vol * 0.4 * trackVol, this.ctx!.currentTime, 0.05);
            if (group.filter) group.filter.frequency.setTargetAtTime(Number(b.properties.filterCutoff) || 600, this.ctx!.currentTime, 0.05);
        } else if ((group.type === 'voice' || group.type === 'guide') && group.gain) {
            const sub = !!b.properties.subliminal;
            group.gain.gain.setTargetAtTime(vol * (sub ? 0.1 : 1.0) * trackVol, this.ctx!.currentTime, 0.05);
        }
     });
  };

  stop = () => {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    this.schedulerTimer = null;
    this.mem.activeBlocks.forEach((_: any, id: string) => this.cleanupBlock(id));
    this.mem.activeBlocks.clear();
    this.mem.scheduledIds.clear();
    this.mem.voices = Array.from({ length: 32 }, (_, i) => i);
    
    this.wasmNode?.port.postMessage({ type: 'RESET' });
    try { this.wasmNode?.disconnect(); } catch(e) {}
    try { this.mem.masterGain?.disconnect(); } catch(e) {}
    try { this.mem.masterAnalyser?.disconnect(); } catch(e) {}
    
    this.mem.masterGain = null;
    this.mem.masterAnalyser = null;
    this.isPlaying = false;
  };

  getCurrentTime = () => (this.isPlaying && this.ctx) ? this.ctx.currentTime - this.mem.baseTime + this.currentOffset : this.currentOffset;

  getAnalyserData = (destArray: Uint8Array) => {
    if (this.mem.masterAnalyser) {
        this.mem.masterAnalyser.getByteTimeDomainData(destArray as any);
    }
  };
}

export const instance = new AudioEngine();
