import { Block, useStudioStore } from "@/store/useStudioStore";

class ExportEngineClass {
    
  async renderMixdown(blocks: Block[], masterTuning: number = 432): Promise<Blob> {
    const { setExportStatus } = useStudioStore.getState();
    setExportStatus(true, 0);

    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += (95 - progress) * 0.1;
        setExportStatus(true, Math.round(progress));
    }, 200);

    try {
        const validBlocks = blocks.filter(b => b.end_time > b.start_time);
        if (validBlocks.length === 0) {
            clearInterval(progressInterval);
            setExportStatus(false, 0);
            return new Blob();
        }

        const urlsToLoad = validBlocks
           .filter(b => b.type === 'voice' || b.type === 'guide')
           .map(b => b.properties.fileUrl as string)
           .filter(Boolean);

        const audioCache = new Map<string, AudioBuffer>();
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
        const tempCtx = new AudioCtor();

        if (urlsToLoad.length > 0) {
           await Promise.allSettled(urlsToLoad.map(async (url) => {
              if (audioCache.has(url)) return;
              try {
                 const res = await fetch(url);
                 const arr = await res.arrayBuffer();
                 const buf = await tempCtx.decodeAudioData(arr);
                 audioCache.set(url, buf);
              } catch(e) { console.error("Failed to decode export audio", e); }
           }));
        }

        const duration = Math.max(...validBlocks.map(b => b.end_time));
        const sampleRate = 44100;
        const OfflineCtor = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
        const offlineCtx = new OfflineCtor(2, Math.ceil(sampleRate * duration), sampleRate);

        const noiseBufferLength = 2 * sampleRate;
        const offlineNoiseBuffer = offlineCtx.createBuffer(1, noiseBufferLength, sampleRate);
        const output = offlineNoiseBuffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < noiseBufferLength; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5;
        }

        const masterCompressor = offlineCtx.createDynamicsCompressor();
        masterCompressor.threshold.value = -12;
        masterCompressor.knee.value = 40;
        masterCompressor.ratio.value = 2;
        masterCompressor.attack.value = 0.5;
        masterCompressor.release.value = 1.0;
        masterCompressor.connect(offlineCtx.destination);

        const masterGain = offlineCtx.createGain();
        masterGain.gain.value = 0.7; // Headroom
        masterGain.connect(masterCompressor);

        // Track Mixers
        const offlineTrackChannels = new Map<string, { gain: GainNode, panner: StereoPannerNode }>();
        const { tracks } = useStudioStore.getState();
        tracks.forEach(track => {
            const panNode = offlineCtx.createStereoPanner();
            panNode.pan.value = track.pan ?? 0.0;
            
            const gainNode = offlineCtx.createGain();
            gainNode.gain.value = track.volume ?? 1.0;
            
            panNode.connect(gainNode);
            gainNode.connect(masterGain);
            
            offlineTrackChannels.set(track.id, { gain: gainNode, panner: panNode });
        });

        validBlocks.forEach(block => {
          const trackChannel = offlineTrackChannels.get(block.track_id);
          const destNode = trackChannel ? trackChannel.panner : masterGain;
          const nodeStart = block.start_time;
          const endTimeCtx = block.end_time;

          if (block.type === 'atmosphere') {
             const noiseSource = offlineCtx.createBufferSource();
             noiseSource.buffer = offlineNoiseBuffer;
             noiseSource.loop = true;

             const filter = offlineCtx.createBiquadFilter();
             filter.type = 'lowpass';
             filter.frequency.value = (block.properties.filterCutoff as number) ?? 150;

             const fadeIn = (block.properties.fade_in as number) || 0;
             const fadeOut = (block.properties.fade_out as number) || 0;
             const gain = offlineCtx.createGain();
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
             
             noiseSource.start(nodeStart);
             noiseSource.stop(endTimeCtx);
          }
          else if (block.type === 'carrier') {
             const baseFreq = (block.properties.baseFrequency as number) ?? (block.properties.frequency as number) ?? 100.0;
             const waveform = (block.properties.waveform as string ?? 'sine') as OscillatorType;
             const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
             const levelFraction = harmonizerLevel / 100;
             const fadeIn = (block.properties.fade_in as number) || 0;
             const fadeOut = (block.properties.fade_out as number) || 0;
             const vol = ((block.properties.volume as number) ?? 50) / 100 * 0.6;
             
             const blockGain = offlineCtx.createGain();
             blockGain.gain.setValueAtTime(0, Math.max(0, nodeStart - 0.01));
             if (fadeIn > 0) {
                 blockGain.gain.linearRampToValueAtTime(vol, nodeStart + fadeIn);
             } else {
                 blockGain.gain.setTargetAtTime(vol, nodeStart, 0.05);
             }
             blockGain.connect(destNode);

             const spawnOsc = (mult: number, volFactor: number) => {
                 const osc = offlineCtx.createOscillator();
                 osc.type = waveform;
                 osc.frequency.value = baseFreq * mult;
                 const g = offlineCtx.createGain();
                 g.gain.value = volFactor;
                 osc.connect(g);
                 g.connect(blockGain);
                 osc.start(nodeStart);
                 osc.stop(endTimeCtx);
             };

             spawnOsc(1, 1.0);
             spawnOsc(2, 0.3 * levelFraction);
             spawnOsc(3, 0.1 * levelFraction);

             if (fadeOut > 0) {
                 blockGain.gain.setValueAtTime(vol, Math.max(nodeStart, endTimeCtx - fadeOut));
                 blockGain.gain.linearRampToValueAtTime(0, endTimeCtx);
             } else {
                 blockGain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
             }
          }
          else if (block.type === 'entrainment') {
             const baseFreq = (block.properties.baseFrequency as number) ?? 136.1;
             const targetHz = (block.properties.targetStateHz as number) ?? 4.0;
             const waveform = (block.properties.waveform as string ?? 'sine') as OscillatorType;
             const harmonizerLevel = (block.properties.harmonizerLevel as number) ?? 0;
             const levelFraction = harmonizerLevel / 100;

             const pannerL = offlineCtx.createStereoPanner();
             pannerL.pan.value = -1;
             const pannerR = offlineCtx.createStereoPanner();
             pannerR.pan.value = 1;

             const spatialPanner = offlineCtx.createStereoPanner();
             spatialPanner.pan.value = 0;
             
             const fadeIn = (block.properties.fade_in as number) || 0;
             const fadeOut = (block.properties.fade_out as number) || 0;
             const vol = ((block.properties.volume as number) ?? 50) / 100 * 1.0;
             
             const blockGain = offlineCtx.createGain();
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

             const spawnBinauralPair = (mult: number, volFactor: number) => {
                 const oscL = offlineCtx.createOscillator();
                 oscL.type = waveform;
                 oscL.frequency.value = baseFreq * mult;
                 const gainL = offlineCtx.createGain();
                 gainL.gain.value = volFactor;
                 oscL.connect(gainL);
                 gainL.connect(pannerL);
                 oscL.start(nodeStart);
                 oscL.stop(endTimeCtx);

                 const oscR = offlineCtx.createOscillator();
                 oscR.type = waveform;
                 oscR.frequency.value = (baseFreq + targetHz) * mult;
                 const gainR = offlineCtx.createGain();
                 gainR.gain.value = volFactor;
                 oscR.connect(gainR);
                 gainR.connect(pannerR);
                 oscR.start(nodeStart);
                 oscR.stop(endTimeCtx);
             };

             spawnBinauralPair(1, 1.0);
             spawnBinauralPair(2, 0.3 * levelFraction);
             spawnBinauralPair(3, 0.1 * levelFraction);

             const sweepEnabled = block.properties.sweep ?? true;
             if (sweepEnabled) {
                const lfo = offlineCtx.createOscillator();
                lfo.type = 'sine';
                lfo.frequency.value = 0.05;
                const lfoGain = offlineCtx.createGain();
                lfoGain.gain.value = 0.8;
                lfo.connect(lfoGain);
                lfoGain.connect(spatialPanner.pan);
                lfo.start(nodeStart);
                lfo.stop(endTimeCtx);
             }
             if (fadeOut > 0) {
                 blockGain.gain.setValueAtTime(vol, Math.max(nodeStart, endTimeCtx - fadeOut));
                 blockGain.gain.linearRampToValueAtTime(0, endTimeCtx);
             } else {
                 blockGain.gain.setTargetAtTime(0, Math.max(0, endTimeCtx - 0.05), 0.01);
             }
          }
          else if (block.type === 'voice' || block.type === 'guide') {
             const fileUrl = block.properties.fileUrl as string;
             const source = offlineCtx.createBufferSource();
             const buffer = fileUrl ? audioCache.get(fileUrl) : null;
             
             if (buffer) {
                 source.buffer = buffer;
             }

             const fadeIn = (block.properties.fade_in as number) || 0;
             const fadeOut = (block.properties.fade_out as number) || 0;
             const gain = offlineCtx.createGain();
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
                 const trimStart = (block.properties.trimStart as number) || 0;
                 source.start(nodeStart, trimStart);
                 source.stop(endTimeCtx);
             }
          }
        });

        const renderedBuffer = await offlineCtx.startRendering();
        
        clearInterval(progressInterval);
        setExportStatus(true, 100);

        tempCtx.close();
        
        return this.audioBufferToWav(renderedBuffer);
        
    } catch (err) {
        clearInterval(progressInterval);
        setExportStatus(false, 0);
        throw err;
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new ArrayBuffer(length);
    const view = new DataView(out);
    let channels = [];
    let sample = 0;
    let offset = 0;
    let pos = 0;

    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
       channels.push(buffer.getChannelData(i));
    }

    while(pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset])); 
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
        view.setInt16(pos, sample, true); 
        pos += 2;
      }
      offset++;
    }

    return new Blob([view], { type: "audio/wav" });
  }
}

export const ExportEngine = new ExportEngineClass();
