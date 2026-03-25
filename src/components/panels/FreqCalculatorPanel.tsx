"use client";

import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Calculator, Globe, Zap, Radio, Plus, CheckCircle2 } from "lucide-react";

const PLANETARY_FREQS = [
  { name: "Earth (Om)", freq: 136.1, color: "text-green-400", desc: "Heart Chakra / Relaxation" },
  { name: "Sun", freq: 126.22, color: "text-yellow-400", desc: "Vitality / Concentration" },
  { name: "Moon", freq: 210.42, color: "text-slate-300", desc: "Emotions / Sexual Energy" },
  { name: "Venus", freq: 221.23, color: "text-pink-400", desc: "Love / Harmony" },
];

const SOLFEGGIO_FREQS = [
  { name: "UT - 396 Hz", freq: 396, desc: "Liberating Guilt & Fear" },
  { name: "RE - 417 Hz", freq: 417, desc: "Undoing Situations & Change" },
  { name: "MI - 528 Hz", freq: 528, desc: "Transformation & Miracles" },
  { name: "FA - 639 Hz", freq: 639, desc: "Connecting / Relationships" },
];

const BRAINWAVE_TARGETS = [
  { name: "Delta", freq: 1.5, desc: "Deep Sleep / Healing" },
  { name: "Theta", freq: 4.5, desc: "Meditation / Memory" },
  { name: "Alpha", freq: 10.5, desc: "Relaxation / Focus" },
  { name: "Beta", freq: 14.5, desc: "Alertness / Logic" },
];

export function FreqCalculatorPanel() {
  const { addBlock, currentTime } = useStudioStore();
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const injectFreq = (name: string, base: number, beat: number = 0) => {
    const id = crypto.randomUUID().substring(0, 8);
    addBlock({
      track_id: 'track-entrainment',
      asset_id: `calc-${id}`,
      label: name.toUpperCase(),
      type: beat > 0 ? 'entrainment' : 'carrier',
      start_time: currentTime,
      end_time: currentTime + 300, // 5 minutes default
      properties: {
        baseFrequency: base,
        targetStateHz: beat,
        volume: -24, // Professional default dB
        waveform: 'sine'
      }
    });
    setLastAdded(name);
    setTimeout(() => setLastAdded(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Calculator size={16} className="text-violet" />
        <h2 className="text-xs font-bold tracking-widest text-text uppercase">Frequency Lab</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        
        {/* Planetary Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-text-dim tracking-[0.2em] flex items-center gap-2 uppercase">
            <Globe size={12} /> Planetary (Cousto)
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {PLANETARY_FREQS.map(f => (
              <button 
                key={f.name}
                onClick={() => injectFreq(f.name, f.freq)}
                className="group flex flex-col p-3 rounded-lg bg-white/5 border border-white/5 hover:border-cyan/30 hover:bg-white/10 transition-all text-left relative overflow-hidden"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[11px] font-bold ${f.color}`}>{f.name}</span>
                  <span className="text-[10px] font-mono text-white/40">{f.freq}Hz</span>
                </div>
                <p className="text-[9px] text-text-dim leading-tight">{f.desc}</p>
                <Plus size={14} className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 text-cyan transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* Solfeggio Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-text-dim tracking-[0.2em] flex items-center gap-2 uppercase">
            <Zap size={12} /> Solfeggio Scale
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {SOLFEGGIO_FREQS.map(f => (
              <button 
                key={f.name}
                onClick={() => injectFreq(f.name, f.freq)}
                className="group flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:border-violet/30 hover:bg-white/10 transition-all"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-violet-300">{f.name}</span>
                  <span className="text-[9px] text-text-dim">{f.desc}</span>
                </div>
                <Plus size={14} className="text-violet-400 opacity-40 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        {/* Brainwave Targets */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-text-dim tracking-[0.2em] flex items-center gap-2 uppercase">
            <Radio size={12} /> Neural Targets
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {BRAINWAVE_TARGETS.map(f => (
              <button 
                key={f.name}
                onClick={() => injectFreq(f.name, 136.1, f.freq)}
                className="p-2 rounded bg-black/40 border border-white/5 hover:border-cyan/50 text-[10px] font-bold text-center transition-all"
              >
                {f.name} ({f.freq}Hz)
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Success Toast Overlay */}
      {lastAdded && (
        <div className="p-3 bg-cyan/10 border-t border-cyan/20 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={14} className="text-cyan" />
          <p className="text-[10px] text-cyan font-bold uppercase tracking-widest">{lastAdded} Injected</p>
        </div>
      )}
    </div>
  );
}