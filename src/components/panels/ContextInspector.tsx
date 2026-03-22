"use client";

import { Settings2, Volume2, Activity, Zap } from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";

export function ContextInspector() {
  const { activeSelection, blocks, updateBlock } = useStudioStore();
  const activeBlock = blocks.find(b => b.id === activeSelection);

  if (!activeBlock) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Settings2 size={18} className="text-cyan" />
          <h2 className="text-sm font-semibold tracking-wide text-text">INSPECTOR</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-text-muted">
          <Settings2 size={32} className="mb-4 opacity-50" />
          <p className="text-sm">Select a block on the timeline to edit its neuro-acoustic properties.</p>
        </div>
      </div>
    );
  }

  const updateProperty = (key: string, value: any) => {
    updateBlock(activeBlock.id, {
      properties: { ...activeBlock.properties, [key]: value }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Settings2 size={18} className="text-cyan" />
        <h2 className="text-sm font-semibold tracking-wide text-text uppercase">
          {activeBlock.type} INSPECTOR
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">{activeBlock.label}</h3>
            <p className="text-xs text-text-muted font-mono bg-black/50 p-1 px-2 rounded w-fit border border-border">
              {activeBlock.id.slice(0, 8)}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
              DURATION (s) <span className="ml-auto font-mono text-text">{Math.round(activeBlock.end_time - activeBlock.start_time)}s</span>
            </label>
            <input 
              type="number" min="1" max="7200" 
              value={Math.round(activeBlock.end_time - activeBlock.start_time)}
              onChange={(e) => {
                 const newDur = Math.max(1, parseInt(e.target.value || '1'));
                 updateBlock(activeBlock.id, { end_time: activeBlock.start_time + newDur });
              }}
              className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-cyan text-text"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                FADE IN (s)
              </label>
              <input 
                type="number" min="0" max="7200" step="0.1"
                value={activeBlock.properties.fade_in as number || 0}
                onChange={(e) => updateProperty('fade_in', parseFloat(e.target.value) || 0)}
                className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-cyan text-text"
              />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                FADE OUT (s)
              </label>
              <input 
                type="number" min="0" max="7200" step="0.1"
                value={activeBlock.properties.fade_out as number || 0}
                onChange={(e) => updateProperty('fade_out', parseFloat(e.target.value) || 0)}
                className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-cyan text-text"
              />
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-cyan/20 to-transparent"></div>

        {activeBlock.type === 'carrier' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Activity size={14} className="text-violet" /> FREQUENCY
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="50" max="1000" 
                  value={activeBlock.properties.baseFrequency as number ?? (activeBlock.properties.frequency as number) ?? 100}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateBlock(activeBlock.id, {
                      label: `${val}Hz Carrier`,
                      properties: { ...activeBlock.properties, baseFrequency: val }
                    });
                  }}
                  className="flex-1 accent-violet h-1 bg-border rounded-full appearance-none outline-none"
                />
                <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="50" max="1000"
                    value={activeBlock.properties.baseFrequency as number ?? (activeBlock.properties.frequency as number) ?? 100}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 50;
                      updateBlock(activeBlock.id, {
                        label: `${val}Hz Carrier`,
                        properties: { ...activeBlock.properties, baseFrequency: val }
                      });
                    }}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-violet text-violet font-mono text-left pl-2 pr-5"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">Hz</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Zap size={14} className="text-violet" /> HARMONIZER
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="0" max="100" 
                  value={activeBlock.properties.harmonizerLevel as number ?? 0}
                  onChange={(e) => updateProperty('harmonizerLevel', parseInt(e.target.value))}
                  className="flex-1 accent-violet h-1 bg-border rounded-full appearance-none outline-none"
                />
                <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="0" max="100"
                    value={activeBlock.properties.harmonizerLevel as number ?? 0}
                    onChange={(e) => updateProperty('harmonizerLevel', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-violet text-violet font-mono text-left pl-2 pr-4"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">%</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Volume2 size={14} className="text-violet" /> VOLUME
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="0" max="100" 
                  value={activeBlock.properties.volume as number ?? 50}
                  onChange={(e) => updateProperty('volume', parseInt(e.target.value))}
                  className="flex-1 accent-violet h-1 bg-border rounded-full appearance-none outline-none"
                />
                <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="0" max="100"
                    value={activeBlock.properties.volume as number ?? 50}
                    onChange={(e) => updateProperty('volume', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-violet text-violet font-mono text-left pl-2 pr-4"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted">WAVEFORM</label>
              <select 
                value={activeBlock.properties.waveform as string ?? 'sine'}
                onChange={(e) => updateProperty('waveform', e.target.value)}
                className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-violet text-text"
              >
                <option value="sine">Sine</option>
                <option value="triangle">Triangle</option>
                <option value="square">Square</option>
              </select>
            </div>
          </div>
        )}

        {activeBlock.type === 'entrainment' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Activity size={14} className="text-cyan" /> CARRIER BASE
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="50" max="300" step="0.1"
                  value={activeBlock.properties.baseFrequency as number ?? 136.1}
                  onChange={(e) => updateProperty('baseFrequency', parseFloat(e.target.value))}
                  className="flex-1 accent-cyan h-1 bg-border rounded-full appearance-none outline-none"
                />
                <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="50" max="300" step="0.1"
                    value={activeBlock.properties.baseFrequency as number ?? 136.1}
                    onChange={(e) => updateProperty('baseFrequency', parseFloat(e.target.value) || 50)}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-cyan text-cyan font-mono text-left pl-2 pr-5"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">Hz</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Activity size={14} className="text-cyan" /> TARGET STATE
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="0.5" max="40" step="0.5"
                  value={activeBlock.properties.targetStateHz as number ?? 4}
                  onChange={(e) => updateProperty('targetStateHz', parseFloat(e.target.value))}
                  className="flex-1 accent-cyan h-1 bg-border rounded-full appearance-none outline-none"
                />
                <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="0.5" max="40" step="0.5"
                    value={activeBlock.properties.targetStateHz as number ?? 4}
                    onChange={(e) => updateProperty('targetStateHz', parseFloat(e.target.value) || 0.5)}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-cyan text-cyan font-mono text-left pl-2 pr-5"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">Hz</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Zap size={14} className="text-cyan" /> HARMONIZER
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="0" max="100" 
                  value={activeBlock.properties.harmonizerLevel as number ?? 0}
                  onChange={(e) => updateProperty('harmonizerLevel', parseInt(e.target.value))}
                  className="flex-1 accent-cyan h-1 bg-border rounded-full appearance-none outline-none"
                />
                 <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="0" max="100"
                    value={activeBlock.properties.harmonizerLevel as number ?? 0}
                    onChange={(e) => updateProperty('harmonizerLevel', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-cyan text-cyan font-mono text-left pl-2 pr-4"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">%</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Volume2 size={14} className="text-cyan" /> VOLUME
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="0" max="100" 
                  value={activeBlock.properties.volume as number ?? 50}
                  onChange={(e) => updateProperty('volume', parseInt(e.target.value))}
                  className="flex-1 accent-cyan h-1 bg-border rounded-full appearance-none outline-none"
                />
                <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="0" max="100"
                    value={activeBlock.properties.volume as number ?? 50}
                    onChange={(e) => updateProperty('volume', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-cyan text-cyan font-mono text-left pl-2 pr-4"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">%</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-text-muted max-w-xs leading-relaxed">
              * Sets the precise binaural offset to induce the target brainwave state.
            </div>
          </div>
        )}

        {activeBlock.type === 'voice' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Volume2 size={14} className="text-cyan" /> VOLUME
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="0" max="100" 
                  value={activeBlock.properties.volume as number ?? 80}
                  onChange={(e) => updateProperty('volume', parseInt(e.target.value))}
                  className="flex-1 accent-cyan h-1 bg-border rounded-full appearance-none outline-none"
                />
                <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="0" max="100"
                    value={activeBlock.properties.volume as number ?? 80}
                    onChange={(e) => updateProperty('volume', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-cyan text-cyan font-mono text-left pl-2 pr-4"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-text font-medium flex items-center gap-2">
                 AUTO-DUCKING
              </label>
              <button 
                onClick={() => updateProperty('ducking', !activeBlock.properties.ducking)}
                className={`w-10 h-5 rounded-full relative transition-colors ${activeBlock.properties.ducking ? 'bg-cyan' : 'bg-border'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${activeBlock.properties.ducking ? 'left-6' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-text font-medium flex items-center gap-2">
                 SUBLIMINAL MODE
              </label>
              <button 
                onClick={() => updateProperty('subliminal', !activeBlock.properties.subliminal)}
                className={`w-10 h-5 rounded-full relative transition-colors ${activeBlock.properties.subliminal ? 'bg-cyan' : 'bg-border'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${activeBlock.properties.subliminal ? 'left-6' : 'left-1'}`}></div>
              </button>
            </div>
          </div>
        )}

        {activeBlock.type === 'atmosphere' && (
           <div className="space-y-6">
             <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted">ATMOSPHERE TYPE</label>
              <select 
                value={activeBlock.properties.atmosphereType as string ?? 'brownNoise'}
                onChange={(e) => updateProperty('atmosphereType', e.target.value)}
                className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-cyan text-text"
              >
                <option value="pinkNoise">Pink Noise</option>
                <option value="brownNoise">Brown Noise</option>
                <option value="rain">Rain</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                <Volume2 size={14} className="text-cyan" /> VOLUME
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="0" max="100" 
                  value={activeBlock.properties.volume as number ?? 50}
                  onChange={(e) => updateProperty('volume', parseInt(e.target.value))}
                  className="flex-1 accent-cyan h-1 bg-border rounded-full appearance-none outline-none"
                />
                <div className="relative w-16 shrink-0">
                  <input 
                    type="number" min="0" max="100"
                    value={activeBlock.properties.volume as number ?? 50}
                    onChange={(e) => updateProperty('volume', parseInt(e.target.value) || 0)}
                    className="w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-cyan text-cyan font-mono text-left pl-2 pr-4"
                  />
                  <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">%</span>
                </div>
              </div>
            </div>
           </div>
        )}
      </div>
    </div>
  );
}
