"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { useState, useEffect } from "react";

export function GlobalSettingsLCD() {
  const { masterTuning, setMasterTuning, bpm, setBpm } = useStudioStore();
  const [tuningEdit, setTuningEdit] = useState<string | null>(null);
  const [bpmEdit, setBpmEdit] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (tuningEdit !== null) setTuningEdit(null);
      if (bpmEdit !== null) setBpmEdit(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [tuningEdit, bpmEdit]);

  return (
    <div className="flex items-center ml-8 bg-[#030509] border-2 border-white/10 rounded overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,1)] ring-1 ring-black h-12">
      
      {/* Pitch LCD Segment */}
      <div 
        className="flex flex-col justify-center px-4 h-full cursor-text hover:bg-white/5 transition-colors relative border-r border-white/5"
        onClick={(e) => { e.stopPropagation(); setTuningEdit(masterTuning.toString()); setBpmEdit(null); }}
      >
        <span className="text-[7.5px] text-white/40 tracking-[0.25em] font-bold uppercase mb-[1px]">MASTER PITCH</span>
        <div className="font-mono text-lg text-violet font-bold leading-none drop-shadow-[0_0_10px_rgba(138,43,226,0.8)] tracking-widest flex items-baseline gap-1">
          {tuningEdit !== null ? (
            <input 
              className="w-16 bg-transparent text-left outline-none text-violet drop-shadow-[0_0_10px_rgba(138,43,226,1)]"
              autoFocus
              value={tuningEdit}
              onChange={(e) => setTuningEdit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setMasterTuning(parseInt(tuningEdit) || 432);
                  setTuningEdit(null);
                }
              }}
            />
          ) : `${masterTuning}`}
          {tuningEdit === null && <span className="text-[9px] text-violet/60 tracking-normal drop-shadow-none">Hz</span>}
        </div>
      </div>

      {/* BPM LCD Segment */}
      <div 
        className="flex flex-col justify-center px-4 h-full cursor-text hover:bg-white/5 transition-colors relative"
        onClick={(e) => { e.stopPropagation(); setBpmEdit(bpm.toString()); setTuningEdit(null); }}
      >
        <span className="text-[7.5px] text-white/40 tracking-[0.25em] font-bold uppercase mb-[1px]">TEMPO</span>
        <div className="font-mono text-lg text-cyan font-bold leading-none drop-shadow-[0_0_10px_rgba(0,240,255,0.8)] tracking-widest flex items-baseline gap-1">
          {bpmEdit !== null ? (
            <input 
              className="w-12 bg-transparent text-left outline-none text-cyan drop-shadow-[0_0_12px_rgba(0,240,255,1)]"
              autoFocus
              value={bpmEdit}
              onChange={(e) => setBpmEdit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setBpm(parseInt(bpmEdit) || 60);
                  setBpmEdit(null);
                }
              }}
            />
          ) : `${bpm}`}
           {bpmEdit === null && <span className="text-[9px] text-cyan/60 tracking-normal drop-shadow-none">BPM</span>}
        </div>
      </div>

    </div>
  );
}
