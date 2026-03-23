"use client";

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { useStudioStore, Block, Track } from "@/store/useStudioStore";
import { Copy, Play, AlertCircle, CheckCircle2, Wand2 } from "lucide-react";

// Helper: Convert linear gain (0.0 - 1.0) to decibels (dB)
const linearToDb = (linear: number) => {
  if (linear <= 0) return -100;
  return Math.round(20 * Math.log10(linear) * 10) / 10;
};

export function JsonPlaybookPanel() {
  const { tracks: currentTracks, blocks, initializeProject, projectName } = useStudioStore();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const currentState = { name: projectName, tracks: currentTracks, blocks };
    setCode(JSON.stringify(currentState, null, 2));
  }, [currentTracks, blocks, projectName]);

  const handleCopyPrompt = () => {
    const prompt = `Act as a neuro-acoustic engineer. Generate a valid JSON object with 'tracks' and 'blocks'. Output ONLY raw JSON.`;
    navigator.clipboard.writeText(prompt);
    alert("AI Prompt copied!");
  };

  const handleApply = () => {
    try {
      setError(null);
      setSuccess(false);
      const parsed = JSON.parse(code);
      
      let finalState: any = { tracks: [], blocks: [], name: "" };

      // SMART PARSER V4: DIRECT dB MAPPING
      if (parsed.flow_logic && parsed.spectral_definitions) {
        console.log("Parsing Research Schema V4 (Direct dB)...");
        
        finalState.name = parsed.title || parsed.journey_id;
        
        const dynamicTracks: Track[] = [
          { id: 'track-guide', name: 'THE GUIDE', type: 'guide', color: 'bg-track-guide text-track-guide', volume: 1.0 },
          { id: 'track-atmosphere', name: 'ATMOSPHERICS', type: 'atmosphere', color: 'bg-track-atmo text-track-atmo', volume: 1.0 }
        ];
        
        const convertedBlocks: Block[] = [];
        let timelineCursor = 0;

        let maxOscillators = 0;
        Object.values(parsed.spectral_definitions).forEach((state: any) => {
          if (state.oscillators?.length > maxOscillators) maxOscillators = state.oscillators.length;
        });

        for (let i = 0; i < maxOscillators; i++) {
          dynamicTracks.push({
            id: `track-entrainment-${i}`,
            name: `LAYER ${i + 1}`,
            type: 'entrainment',
            color: i === 0 ? 'bg-track-carrier text-track-carrier' : 'bg-track-entrainment text-track-entrainment',
            volume: 1.0
          });
        }

        parsed.flow_logic.phases.forEach((phase: any) => {
          const duration = phase.duration_sec || 60;
          const spectralState = parsed.spectral_definitions[phase.target_spectral_state];
          
          if (spectralState && spectralState.oscillators) {
            spectralState.oscillators.forEach((osc: any, index: number) => {
              const beat = Math.abs(osc.freq_r - osc.freq_l);
              const base = (osc.freq_r + osc.freq_l) / 2;

              convertedBlocks.push({
                id: crypto.randomUUID(),
                track_id: `track-entrainment-${index}`,
                asset_id: `osc-${phase.id}-${index}`,
                label: `${phase.target_spectral_state.replace('state_', '').toUpperCase()}`,
                type: 'entrainment',
                start_time: timelineCursor,
                end_time: timelineCursor + duration,
                properties: {
                  baseFrequency: base,
                  targetStateHz: beat,
                  // Convert linear vol (0.3) to dB (approx -10.5dB)
                  volume: linearToDb(osc.vol), 
                  waveform: osc.waveform || 'sine',
                  comment: osc.comment || ""
                }
              });
            });
          }

          if (phase.guidance_ref && phase.guidance_ref !== "") {
            convertedBlocks.push({
              id: crypto.randomUUID(),
              track_id: 'track-guide',
              asset_id: `voice-${phase.id}`,
              label: "GUIDANCE: " + phase.id.replace('phase_', ''),
              type: 'voice',
              start_time: timelineCursor,
              end_time: timelineCursor + duration,
              properties: { volume: -3, fileUrl: phase.guidance_ref } // Default -3dB for clear voice
            });
          }

          timelineCursor += duration;
        });

        // Add Noise Floor with NATIVE dB
        if (parsed.audio_engine_config?.noise_floor) {
          const nf = parsed.audio_engine_config.noise_floor;
          convertedBlocks.push({
            id: crypto.randomUUID(),
            track_id: 'track-atmosphere',
            asset_id: 'gen-noise',
            label: `PINK NOISE (${nf.base_vol_db}dB)`,
            type: 'atmosphere',
            start_time: 0,
            end_time: timelineCursor,
            properties: { 
              volume: nf.base_vol_db || -56, // USE NATIVE dB VALUE
              filterCutoff: nf.filter_cutoff_hz || 600,
              lfoRate: nf.lfo_rate_hz || 0.05
            }
          });
        }

        finalState.tracks = dynamicTracks;
        finalState.blocks = convertedBlocks;
      } 
      else if (parsed.tracks && parsed.blocks) {
        finalState = parsed;
      }

      initializeProject(finalState);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="p-4 border-b border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 size={14} className="text-cyan" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-text">Research Importer V4</h3>
          </div>
          <button onClick={handleCopyPrompt} className="text-[10px] font-bold text-text-muted hover:text-cyan transition-colors">
            COPY PROMPT
          </button>
        </div>
        <button onClick={handleApply} className="w-full py-2.5 rounded-md bg-cyan text-bg font-bold text-[10px] tracking-widest uppercase hover:bg-white transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)]">
          Sync Timeline (dB Native)
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="json"
          theme="vs-dark"
          value={code}
          onChange={(v) => setCode(v || "")}
          options={{ fontSize: 11, minimap: { enabled: false }, automaticLayout: true }}
        />
      </div>
      {error && <div className="p-3 bg-red-500/10 text-[10px] text-red-400 font-mono border-t border-red-500/20">{error}</div>}
      {success && <div className="p-3 bg-cyan/10 text-[10px] text-cyan font-bold uppercase border-t border-cyan/20">DB PARITY SYNC OK</div>}
    </div>
  );
}