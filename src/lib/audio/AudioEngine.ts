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

  init() {
    if (this.ctx) return;
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtor();
    this.createBrownNoiseBuffer();
  }

  private createBrownNoiseBuffer() {
    if (!this.ctx || this.noiseBuffer) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02; // Approximate 1/f integration
        lastOut = output[i];
        output[i] *= 3.5; // Gain compensation
    }
  }

  async playSequencer(blocks: Block[], startOffset: number = 0, masterTuning: number = 432) {
    this.init();
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

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
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
    this.masterGain.gain.value = 0.7; // Headroom maximum 0.7 to prevent clipping
    
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;

    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.masterCompressor);

    // Track Mixing Channels
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

    // Filter valid blocks
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
         const targetVol = ((block.properties.volume as number) ?? 50) / 100 * 0.4;
         gain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
         if (fadeIn > 0) {
             gain.gain.linearRampToValueAtTime(targetVol, nodeStart + fadeIn);
         } else {
             gain.gain.setTargetAtTime(targetVol, nodeStart, 0.05);
         }

         noiseSource.connect(filter);
         filter.connect(gain);
         gain.connect(destNode);

         if (fadeOut > 0) {
             gain.gain.setValueAtTime(targetVol, Math.max(nodeStart, endTimeCtx - fadeOut));
             gain.gain.linearRampToValueAtTime(0, endTimeCtx);
         } else {
             gain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
         }
         
         noiseSource.start(nodeStart, bufferOffset);
         noiseSource.stop(endTimeCtx);
         
         this.activeBlocks.set(block.id, {
            type: 'atmosphere',
            source: noiseSource,
            filter: filter,
            gain: gain
         });
      }
      else if (block.type === 'carrier') {
         const baseFreq = (block.properties.baseFrequency as number) ?? (block.properties.frequency as number) ?? 100.0;
         const waveform = (block.properties.waveform as string ?? 'sine') as OscillatorType;
         const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
         const levelFraction = harmonizerLevel / 100;

         const fadeIn = (block.properties.fade_in as number) || 0;
         const fadeOut = (block.properties.fade_out as number) || 0;
         const vol = ((block.properties.volume as number) ?? 50) / 100 * 0.6;
         
         const blockGain = this.ctx.createGain();
         blockGain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
         if (fadeIn > 0) {
             blockGain.gain.linearRampToValueAtTime(vol, nodeStart + fadeIn);
         } else {
             blockGain.gain.setTargetAtTime(vol, nodeStart, 0.05);
         }
         blockGain.connect(destNode);

         const oscillators: OscillatorNode[] = [];
         const overtoneGains: GainNode[] = [];

         // Base (Fundamental)
         const osc1 = this.ctx.createOscillator();
         osc1.type = waveform;
         osc1.frequency.value = baseFreq;
         const gain1 = this.ctx.createGain();
         gain1.gain.value = 1.0;
         osc1.connect(gain1);
         gain1.connect(blockGain);
         oscillators.push(osc1);
         overtoneGains.push(gain1);

         // Octave (x2)
         const osc2 = this.ctx.createOscillator();
         osc2.type = waveform;
         osc2.frequency.value = baseFreq * 2;
         const gain2 = this.ctx.createGain();
         gain2.gain.value = 0.3 * levelFraction;
         osc2.connect(gain2);
         gain2.connect(blockGain);
         oscillators.push(osc2);
         overtoneGains.push(gain2);

         // Perfect Fifth above Octave (x3)
         const osc3 = this.ctx.createOscillator();
         osc3.type = waveform;
         osc3.frequency.value = baseFreq * 3;
         const gain3 = this.ctx.createGain();
         gain3.gain.value = 0.1 * levelFraction;
         osc3.connect(gain3);
         gain3.connect(blockGain);
         oscillators.push(osc3);
         overtoneGains.push(gain3);

         oscillators.forEach(osc => {
           osc.start(nodeStart);
           osc.stop(endTimeCtx);
         });
         
         if (fadeOut > 0) {
             blockGain.gain.setValueAtTime(vol, Math.max(nodeStart, endTimeCtx - fadeOut));
             blockGain.gain.linearRampToValueAtTime(0, endTimeCtx);
         } else {
             blockGain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
         }

         this.activeBlocks.set(block.id, {
            type: 'carrier',
            oscillators,
            overtoneGains,
            blockGain
         });
      }
      else if (block.type === 'entrainment') {
         const baseFreq = (block.properties.baseFrequency as number) ?? 136.1;
         const targetHz = (block.properties.targetStateHz as number) ?? 4.0;
         const waveform = (block.properties.waveform as string ?? 'sine') as OscillatorType;
         const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
         const levelFraction = harmonizerLevel / 100;

         const pannerL = this.ctx.createStereoPanner();
         pannerL.pan.value = -1;
         const pannerR = this.ctx.createStereoPanner();
         pannerR.pan.value = 1;

         const spatialPanner = this.ctx.createStereoPanner();
         spatialPanner.pan.value = 0;
         
         const fadeIn = (block.properties.fade_in as number) || 0;
         const fadeOut = (block.properties.fade_out as number) || 0;
         const vol = ((block.properties.volume as number) ?? 50) / 100 * 1.0;
         
         const blockGain = this.ctx.createGain();
         blockGain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
         if (fadeIn > 0) {
             blockGain.gain.linearRampToValueAtTime(vol, nodeStart + fadeIn);
         } else {
             blockGain.gain.setTargetAtTime(vol, nodeStart, 0.05);
         }

         pannerL.connect(spatialPanner);
         pannerR.connect(spatialPanner);
         spatialPanner.connect(blockGain);
         blockGain.connect(destNode);

         const oscillatorsL: OscillatorNode[] = [];
         const overtoneGainsL: GainNode[] = [];
         const oscillatorsR: OscillatorNode[] = [];
         const overtoneGainsR: GainNode[] = [];

         // Helper to spawn a pair
         const spawnBinauralPair = (mult: number, volFactor: number) => {
             const oscL = this.ctx!.createOscillator();
             oscL.type = waveform;
             oscL.frequency.value = baseFreq * mult;
             const gainL = this.ctx!.createGain();
             gainL.gain.value = volFactor;
             oscL.connect(gainL);
             gainL.connect(pannerL);
             oscillatorsL.push(oscL);
             overtoneGainsL.push(gainL);

             const oscR = this.ctx!.createOscillator();
             oscR.type = waveform;
             oscR.frequency.value = (baseFreq + targetHz) * mult;
             const gainR = this.ctx!.createGain();
             gainR.gain.value = volFactor;
             oscR.connect(gainR);
             gainR.connect(pannerR);
             oscillatorsR.push(oscR);
             overtoneGainsR.push(gainR);
         };

         // Base (Fundamental)
         spawnBinauralPair(1, 1.0);
         // Octave (x2)
         spawnBinauralPair(2, 0.3 * levelFraction);
         // Perfect Fifth above Octave (x3)
         spawnBinauralPair(3, 0.1 * levelFraction);

         const sweepEnabled = block.properties.sweep ?? true;
         const lfoNodes: AudioNode[] = [];
         if (sweepEnabled) {
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.05; // 20 second sweep
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.8;
            lfo.connect(lfoGain);
            lfoGain.connect(spatialPanner.pan);
            lfo.start(nodeStart);
            lfo.stop(endTimeCtx);
            lfoNodes.push(lfo, lfoGain);
         }

         [...oscillatorsL, ...oscillatorsR].forEach(osc => {
             osc.start(nodeStart);
             osc.stop(endTimeCtx);
         });

         if (fadeOut > 0) {
             blockGain.gain.setValueAtTime(vol, Math.max(nodeStart, endTimeCtx - fadeOut));
             blockGain.gain.linearRampToValueAtTime(0, endTimeCtx);
         } else {
             blockGain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
         }

         this.activeBlocks.set(block.id, {
            type: 'entrainment',
            oscillatorsL,
            oscillatorsR,
            overtoneGainsL,
            overtoneGainsR,
            blockGain,
            spatialPanner,
            lfoNodes
         });
      }
      else if (block.type === 'voice' || block.type === 'guide') {
         const fileUrl = block.properties.fileUrl as string;
         const source = this.ctx.createBufferSource();
         const buffer = fileUrl ? this.audioCache.get(fileUrl) : null;
         
         if (buffer) {
             source.buffer = buffer;
         }

         const fadeIn = (block.properties.fade_in as number) || 0;
         const fadeOut = (block.properties.fade_out as number) || 0;
         const gain = this.ctx.createGain();
         const vol = (block.properties.volume as number) ?? 80;
         const subMode = block.properties.subliminal ?? false;
         const targetVol = subMode ? (vol / 100) * 0.1 : (vol / 100);
         
         gain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
         if (fadeIn > 0) {
             gain.gain.linearRampToValueAtTime(targetVol, nodeStart + fadeIn);
         } else {
             gain.gain.setTargetAtTime(targetVol, nodeStart, 0.05);
         }

         source.connect(gain);
         gain.connect(destNode);

         if (fadeOut > 0) {
             gain.gain.setValueAtTime(targetVol, Math.max(nodeStart, endTimeCtx - fadeOut));
             gain.gain.linearRampToValueAtTime(0, endTimeCtx);
         } else {
             gain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
         }
         
         if (buffer) {
             source.start(nodeStart, bufferOffset);
             source.stop(endTimeCtx);
         }

         this.activeBlocks.set(block.id, {
            type: 'voice',
            gain,
            source
         });
      }
    });

    this.isPlaying = true;
  }

  updateBlockProperties(blocks: Block[], masterTuning: number) {
     if (!this.isPlaying || !this.ctx) return;
     const now = this.ctx.currentTime;
     
     const { tracks } = useStudioStore.getState();
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

        if (group.type === 'carrier') {
           const baseFreq = (block.properties.baseFrequency as number) ?? (block.properties.frequency as number) ?? 100.0;
           const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
           const levelFraction = harmonizerLevel / 100;
           const waveform = (block.properties.waveform as string ?? 'sine') as OscillatorType;
           const vol = (block.properties.volume as number) ?? 50;

           group.blockGain.gain.setTargetAtTime((vol / 100) * 0.6, now, 0.05);

           group.oscillators[0].frequency.setTargetAtTime(baseFreq, now, 0.1);
           group.oscillators[1].frequency.setTargetAtTime(baseFreq * 2, now, 0.1);
           group.oscillators[2].frequency.setTargetAtTime(baseFreq * 3, now, 0.1);

           group.overtoneGains[1].gain.setTargetAtTime(0.3 * levelFraction, now, 0.1);
           group.overtoneGains[2].gain.setTargetAtTime(0.1 * levelFraction, now, 0.1);

           group.oscillators.forEach((osc: OscillatorNode) => {
              if (osc.type !== waveform) osc.type = waveform;
           });
        }
        else if (group.type === 'entrainment') {
           const baseFreq = (block.properties.baseFrequency as number) ?? 136.1;
           const targetHz = (block.properties.targetStateHz as number) ?? 4.0;
           const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
           const levelFraction = harmonizerLevel / 100;
           const waveform = (block.properties.waveform as string ?? 'sine') as OscillatorType;
           const vol = (block.properties.volume as number) ?? 50;

           group.blockGain.gain.setTargetAtTime((vol / 100) * 1.0, now, 0.05);

           group.oscillatorsL[0].frequency.setTargetAtTime(baseFreq, now, 0.1);
           group.oscillatorsR[0].frequency.setTargetAtTime(baseFreq + targetHz, now, 0.1);
           
           group.oscillatorsL[1].frequency.setTargetAtTime(baseFreq * 2, now, 0.1);
           group.oscillatorsR[1].frequency.setTargetAtTime((baseFreq + targetHz) * 2, now, 0.1);

           group.oscillatorsL[2].frequency.setTargetAtTime(baseFreq * 3, now, 0.1);
           group.oscillatorsR[2].frequency.setTargetAtTime((baseFreq + targetHz) * 3, now, 0.1);

           group.overtoneGainsL[1].gain.setTargetAtTime(0.3 * levelFraction, now, 0.1);
           group.overtoneGainsR[1].gain.setTargetAtTime(0.3 * levelFraction, now, 0.1);
           group.overtoneGainsL[2].gain.setTargetAtTime(0.1 * levelFraction, now, 0.1);
           group.overtoneGainsR[2].gain.setTargetAtTime(0.1 * levelFraction, now, 0.1);
           
           [...group.oscillatorsL, ...group.oscillatorsR].forEach((osc: OscillatorNode) => {
              if (osc.type !== waveform) osc.type = waveform;
           });
        }
        else if (group.type === 'atmosphere') {
           const cutoff = (block.properties.filterCutoff as number) ?? 150;
           group.filter.frequency.setTargetAtTime(cutoff, now, 0.05);

           const vol = (block.properties.volume as number) ?? 50;
           group.gain.gain.setTargetAtTime((vol / 100) * 0.4, now, 0.05);
        }
        else if (group.type === 'voice') {
           const vol = (block.properties.volume as number) ?? 80;
           const subMode = block.properties.subliminal ?? false;
           const targetVol = subMode ? (vol / 100) * 0.1 : (vol / 100);
           group.gain.gain.setTargetAtTime(targetVol, now, 0.05);
        }
     });
  }

  getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) return this.currentOffset;
    return this.ctx.currentTime - this.baseTime + this.currentOffset;
  }

  getAnalyserData(destArray: Uint8Array) {
    if (this.masterAnalyser) {
        this.masterAnalyser.getByteTimeDomainData(destArray as any);
    }
  }

  stop() {
    if (!this.ctx) return;
    this.activeBlocks.forEach(group => {
       try {
          if (group.oscillators) group.oscillators.forEach((o: any) => o.stop());
          if (group.oscillatorsL) group.oscillatorsL.forEach((o: any) => o.stop());
          if (group.oscillatorsR) group.oscillatorsR.forEach((o: any) => o.stop());
          if (group.source) group.source.stop();
          if (group.lfoNodes) {
             group.lfoNodes.forEach((n: any) => { if (n instanceof OscillatorNode) n.stop(); });
          }
       } catch (e) { /* ignore already stopped */ }
    });
    this.activeBlocks.clear();
    
    if (this.masterGain) this.masterGain.disconnect();
    if (this.masterCompressor) this.masterCompressor.disconnect();
    
    this.isPlaying = false;
  }

}

export const instance = new AudioEngine();
