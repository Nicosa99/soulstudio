"use client";

import { Library, Mic, Waves, Cloud } from "lucide-react";
import { DraggableAsset } from "./DraggableAsset";

export function AssetLibrary() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Library size={18} className="text-cyan" />
        <h2 className="text-sm font-semibold tracking-wide text-text">ASSET LIBRARY</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-muted tracking-widest flex items-center gap-2">
            <Mic size={14} /> VOICE TRACKS
          </h3>
          <div className="flex flex-col gap-2">
            <DraggableAsset
              id="voice-vsl"
              label="The Protocol - VSL Hook"
              type="voice"
              colorClass="hover:border-cyan hover:bg-cyan-dim/10"
              defaultDuration={120}
              properties={{ volume: 80, subliminal: false, ducking: true }}
            >
              The Protocol - VSL Hook
            </DraggableAsset>
            <DraggableAsset
              id="voice-dissociation"
              label="Dissociation Script A"
              type="voice"
              colorClass="hover:border-cyan hover:bg-cyan-dim/10"
              defaultDuration={180}
              properties={{ volume: 80, subliminal: true, ducking: true }}
            >
              Dissociation Script A
            </DraggableAsset>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-muted tracking-widest flex items-center gap-2">
            <Waves size={14} className="text-violet" /> ENTRAINMENT
          </h3>
          <div className="flex flex-col gap-2">
            <DraggableAsset
              id="entrain-delta"
              label="1.5Hz Delta (Body Sleep)"
              type="entrainment"
              colorClass="hover:border-violet hover:bg-violet-dim/10"
              defaultDuration={1800}
              properties={{ targetStateHz: 1.5, targetState: 'Physical Dissociation', waveform: 'sine', sweep: true, baseFrequency: 136.1, harmonizerLevel: 0 }}
            >
              1.5Hz Delta (Body Sleep)
            </DraggableAsset>
            <DraggableAsset
              id="entrain-theta"
              label="4.0Hz Theta (Mind Awake)"
              type="entrainment"
              colorClass="hover:border-violet hover:bg-violet-dim/10"
              defaultDuration={1800}
              properties={{ targetStateHz: 4.0, targetState: 'Lucid Hypnagogia', waveform: 'sine', sweep: false, baseFrequency: 136.1, harmonizerLevel: 0 }}
            >
              4.0Hz Theta (Mind Awake)
            </DraggableAsset>
            <DraggableAsset
              id="entrain-carrier"
              label="432Hz Carrier"
              type="carrier"
              colorClass="hover:border-violet hover:bg-violet-dim/10"
              defaultDuration={3600}
              properties={{ frequency: 100.0, baseFrequency: 100.0, harmonizerLevel: 0, targetState: 'Baseline Harmonics', waveform: 'sine', sweep: false }}
            >
              432Hz Carrier
            </DraggableAsset>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-muted tracking-widest flex items-center gap-2">
            <Cloud size={14} /> ATMOSPHERICS
          </h3>
          <div className="flex flex-col gap-2">
            <DraggableAsset
              id="atmo-brown"
              label="150Hz Brown Noise Floor"
              type="atmosphere"
              colorClass="hover:border-border hover:bg-border/50"
              defaultDuration={3600}
              properties={{ volume: 50, filterCutoff: 150 }}
            >
              150Hz Brown Noise Floor
            </DraggableAsset>
          </div>
        </div>
      </div>
    </div>
  );
}
