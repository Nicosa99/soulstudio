"use client";

import { Download, Cloud, CheckCircle2, Loader2, AlertCircle, Magnet, ZoomIn } from "lucide-react";
import { PlayerControls } from "./PlayerControls";
import { GlobalSettingsLCD } from "./GlobalSettingsLCD";
import { MasterVisualizer } from "./MasterVisualizer";
import { ExportModal } from "@/components/ui/ExportModal";
import { useStudioStore } from "@/store/useStudioStore";
import { instance as AudioEngine } from "@/lib/audio/AudioEngine";
import { ExportEngine } from "@/lib/audio/ExportEngine";
import { ProjectEngine } from "@/lib/audio/ProjectEngine";
import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

export function TopBar() {
  const { blocks, masterTuning, saveStatus, zoomLevel, setZoomLevel, isSnapEnabled, setSnapEnabled, isExporting } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  const supabase = createClient();

  const handleSaveSoultune = async () => {
     try {
        const state = useStudioStore.getState();
        await ProjectEngine.exportSoultune(state.blocks, state.tracks);
        useStudioStore.setState({ saveStatus: 'saved' });
     } catch (err) { alert("Failed to save .soultune project"); }
  };

  const handleImportSoultune = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     try {
        await ProjectEngine.importSoultune(file);
     } catch (err) {
        alert("Failed to load .soultune project. Ensure it's a valid archive.");
     }
     if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = async () => {
    if (useStudioStore.getState().isExporting) return;
    
    // Subscrption Gating Check
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('subscription_status')
        .eq('id', user.id)
        .single();
        
      if (!profile || profile.subscription_status !== 'active') {
         setShowUpgradeModal(true);
         return;
      }
    } else {
       setShowUpgradeModal(true); // Gating guests implicitly
       return;
    }

    try {
      const blob = await ExportEngine.renderMixdown(useStudioStore.getState().getComputedBlocks(), masterTuning);
      if (blob.size === 0) {
        alert("Timeline is empty or all tracks are muted! Add or unmute blocks to export.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `SoulStudio_Mixdown_${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch(err) {
      console.error("Export Failed", err);
      alert("Failed to render Mixdown. See console for details.");
    }
  };

  return (
    <>
    <header className="flex h-12 w-full items-center justify-between border-b border-border bg-panel px-4 shadow-[0_1px_15px_var(--color-border-glow)] z-50 relative">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-cyan-dim text-cyan shadow-[0_0_10px_var(--color-border-glow)]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-wider text-text">SOUL<span className="text-cyan">STUDIO</span></span>
        
        <GlobalSettingsLCD />
      </div>

      <PlayerControls />
      <MasterVisualizer />

      <div className="flex items-center gap-4 text-text-muted">
        {/* Zoom & Snap */}
        <div className="flex items-center gap-3 border-r border-border pr-4 mr-2">
           <button 
             onClick={() => setSnapEnabled(!isSnapEnabled)}
             className={`p-1.5 rounded transition-colors ${isSnapEnabled ? 'text-cyan bg-cyan/10 ring-1 ring-cyan/30' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
             title="Toggle Snap to Grid (1s)"
           >
             <Magnet size={14} />
           </button>
           <div className="flex items-center gap-2 w-24">
             <ZoomIn size={12} className="text-text-muted" />
             <input 
               type="range" min="0.5" max="5" step="0.1"
               value={zoomLevel} 
               onChange={e => setZoomLevel(parseFloat(e.target.value))}
               className="w-full accent-cyan h-1 bg-border rounded-full appearance-none outline-none"
               title="Zoom Level"
             />
           </div>
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest hidden md:flex">
           {saveStatus === 'saved' && <><CheckCircle2 size={14} className="text-cyan" /><span className="text-cyan">Saved to Cloud</span></>}
           {saveStatus === 'saving' && <><Loader2 size={14} className="text-cyan animate-spin" /><span className="text-cyan">Saving...</span></>}
           {saveStatus === 'unsaved' && <><Cloud size={14} className="text-text-muted" /><span>Unsaved</span></>}
           {saveStatus === 'error' && <><AlertCircle size={14} className="text-red-500" /><span className="text-red-500">Sync Error</span></>}
        </div>

        {/* Project Functions */}
        <div className="flex items-center gap-2 border-r border-border pr-4 mr-2">
            <input type="file" accept=".soultune" ref={fileInputRef} className="hidden" onChange={handleImportSoultune} />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex h-7 px-3 items-center justify-center rounded-sm font-bold text-[9px] tracking-wider uppercase bg-panel border border-border text-text hover:bg-white/10 transition-colors"
            >
              LOAD PROJECT
            </button>
            <button 
              onClick={handleSaveSoultune} 
              className="flex h-7 px-3 items-center justify-center rounded-sm font-bold text-[9px] tracking-wider uppercase bg-panel border border-cyan-dim/50 text-cyan hover:bg-cyan/10 transition-colors"
            >
              SAVE .SOULTUNE
            </button>
        </div>

        {/* Export Button */}
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className={`flex h-8 px-4 items-center justify-center gap-2 rounded-md font-bold text-[10px] tracking-wider uppercase transition-all
            ${isExporting 
               ? 'bg-border text-text-muted cursor-not-allowed' 
               : 'bg-cyan text-bg hover:bg-white hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]'
            }`}
        >
          <span className="bg-[#05080F] text-cyan px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase shadow-[0_0_5px_rgba(0,240,255,0.2)]">PRO</span>
          {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {isExporting ? "RENDERING..." : "EXPORT .WAV"}
        </button>
      </div>
    </header>

    {showUpgradeModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
        <div className="w-[450px] rounded-xl border border-cyan/30 bg-[#0A0F1A] p-8 shadow-[0_0_40px_rgba(0,240,255,0.15)] flex flex-col items-center text-center">
           <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan/10 mb-6 drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">
             <span className="text-2xl font-black text-white px-2 tracking-widest">PRO</span>
           </div>
           <h2 className="text-2xl font-bold text-white tracking-wide mb-3">Upgrade Required</h2>
           <p className="text-text-muted text-sm mb-8 leading-relaxed">
             Studio Quality Export requires Creator Pro. Upgrade now to download your neuro-acoustic tracks with full commercial rights.
           </p>
           <button
             onClick={async () => {
                setIsCheckingOut(true);
                try {
                  const res = await fetch('/api/checkout', { method: 'POST' });
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url;
                  } else {
                    alert("Checkout Configuration Missing. Please run standard Stripe Env integrations.");
                  }
                } catch (e) {
                  alert("Checkout routing failed.");
                } finally {
                  setIsCheckingOut(false);
                }
             }}
             disabled={isCheckingOut}
             className="w-full h-12 rounded-md bg-cyan text-bg font-bold tracking-widest uppercase hover:bg-white transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] mb-4 flex items-center justify-center gap-2"
           >
             {isCheckingOut ? <Loader2 size={18} className="animate-spin" /> : null}
             {isCheckingOut ? 'ROUTING TO STRIPE...' : 'Upgrade Now ($49/mo)'}
           </button>
           <button onClick={() => setShowUpgradeModal(false)} className="text-xs text-text-muted hover:text-white transition-colors uppercase tracking-widest font-semibold">
             Cancel
           </button>
        </div>
      </div>
    )}

    <ExportModal />
    </>
  );
}
