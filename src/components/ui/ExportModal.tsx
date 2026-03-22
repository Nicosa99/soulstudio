"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Download, Loader2 } from "lucide-react";

export function ExportModal() {
  const { isExporting, exportProgress } = useStudioStore();

  if (!isExporting) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto">
      <div className="flex flex-col items-center bg-[#05080F] border border-[#00F0FF]/30 p-10 rounded-xl shadow-[0_0_50px_rgba(0,240,255,0.15)] max-w-md w-full text-center">
        
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-cyan blur-xl opacity-20 rounded-full animate-pulse"></div>
          <div className="relative w-16 h-16 bg-black border border-cyan/50 rounded-full flex items-center justify-center shadow-[0_0_15px_#00F0FF]">
             <Download size={24} className="text-cyan animate-pulse" />
          </div>
        </div>

        <h2 className="text-white font-bold tracking-widest text-lg mb-2">RENDERING MIXDOWN</h2>
        <p className="text-text-muted text-xs mb-8">Processing Neuro-Acoustic Protocol...</p>

        <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/5 shadow-inner relative">
          <div 
            className="absolute top-0 left-0 bottom-0 bg-cyan shadow-[0_0_10px_#00F0FF] transition-all duration-300 ease-out"
            style={{ width: `${exportProgress}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between w-full">
           <span className="text-[10px] uppercase font-mono tracking-widest text-cyan flex items-center gap-2">
             <Loader2 size={10} className="animate-spin" />
             OfflineAudioContext
           </span>
           <span className="text-[10px] font-mono font-bold text-white">{exportProgress}%</span>
        </div>
        
      </div>
    </div>
  );
}
