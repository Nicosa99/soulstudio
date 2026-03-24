"use client";

import { Download, Cloud, CheckCircle2, Loader2, AlertCircle, Magnet, ZoomIn, Mic, Square } from "lucide-react";
import { PlayerControls } from "./PlayerControls";
import { GlobalSettingsLCD } from "./GlobalSettingsLCD";
import { MasterVisualizer } from "./MasterVisualizer";
import { ExportModal } from "@/components/ui/ExportModal";
import { useStudioStore } from "@/store/useStudioStore";
import { instance as AudioEngine } from "@/lib/audio/AudioEngine";
import { ExportEngine } from "@/lib/audio/ExportEngine";
import { ProjectEngine } from "@/lib/audio/ProjectEngine";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function TopBar() {
  const { 
    projectName,
    setProjectName,
    blocks, 
    masterTuning, 
    saveStatus, 
    zoomLevel, 
    setZoomLevel, 
    isSnapEnabled, 
    setSnapEnabled, 
    isExporting,
    isRecording,
    toggleRecording,
    currentTime,
    subscriptionStatus,
    addBlock,
    initializeProject
  } = useStudioStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  const supabase = createClient();

  // Recording Logic Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false, 
          noiseSuppression: false, 
          autoGainControl: false 
        } 
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordStartTimeRef.current = currentTime;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Get duration
        const tempAudio = new Audio(audioUrl);
        tempAudio.addEventListener('loadedmetadata', () => {
          const duration = tempAudio.duration;
          
          addBlock({
            track_id: 'track-guide', // The Guide
            asset_id: `rec-${Date.now()}`,
            label: "Voice Recording",
            type: 'voice',
            start_time: recordStartTimeRef.current,
            end_time: recordStartTimeRef.current + duration,
            properties: { volume: 80, fileUrl: audioUrl }
          });
        });

        // Stop all tracks in stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Recording failed", err);
      alert("Microphone access denied or failed.");
      toggleRecording(); // reset state
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Sync isRecording state with actual Engine
  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRecording]);

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
     console.log("Loading file:", file.name, file.type);
     try {
        let projectData: any;
        
        if (file.name.endsWith('.json')) {
          const text = await file.text();
          projectData = JSON.parse(text);
          console.log("Importing raw JSON:", projectData);
        } else {
          projectData = await ProjectEngine.importSoultune(file);
          console.log("Importing .soultune ZIP:", projectData);
        }
        
        if (projectData) {
          initializeProject(projectData);
          console.log("Project initialized in store");
        }
     } catch (err) {
        console.error("Import failed:", err);
        alert("Failed to load project. Ensure it's a valid JSON or .soultune archive.");
     }
     if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = async () => {
    if (isExporting) return;
    if (subscriptionStatus !== 'active') {
       setShowUpgradeModal(true);
       return;
    }

    try {
      const computedBlocks = useStudioStore.getState().blocks;
      const blob = await ExportEngine.renderMixdown(computedBlocks, masterTuning);
      if (blob.size === 0) {
        alert("Timeline is empty! Add blocks to export.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '_')}_${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch(err) {
      console.error("Export Failed", err);
      alert("Failed to render Mixdown.");
    }
  };

  return (
    <>
    <header className="flex h-12 w-full items-center justify-between border-b border-border bg-panel px-4 shadow-[0_1px_15px_var(--color-border-glow)] z-50 relative text-white">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-cyan-dim text-cyan shadow-[0_0_10px_var(--color-border-glow)]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        
        {/* Step 1: Editable Project Name */}
        <input 
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent border-none text-white/80 hover:text-white focus:outline-none focus:ring-1 focus:ring-[#00F0FF] rounded px-2 text-sm font-semibold tracking-wider w-48 transition-all"
          placeholder="Untitled Journey"
        />
        
        <GlobalSettingsLCD />
      </div>

      <div className="flex items-center gap-4">
        <PlayerControls />
        
        {/* Step 4: Record Button */}
        <button
          onClick={toggleRecording}
          className={`group flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300
            ${isRecording 
              ? 'bg-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,1)]' 
              : 'bg-white/5 hover:bg-white/10 text-red-500/70 hover:text-red-500'
            }`}
          title={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? <Square size={14} className="fill-white text-white" /> : <Mic size={16} />}
        </button>
      </div>

      <MasterVisualizer />

      <div className="flex items-center gap-4 text-text-muted">
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

        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest hidden md:flex">
           {saveStatus === 'saved' && <><CheckCircle2 size={14} className="text-cyan" /><span className="text-cyan">Cloud Sync: OK</span></>}
           {saveStatus === 'saving' && <><Loader2 size={14} className="text-cyan animate-spin" /><span className="text-cyan">Uploading...</span></>}
           {saveStatus === 'unsaved' && <><Cloud size={14} className="text-text-muted" /><span>Unsaved Changes</span></>}
           {saveStatus === 'error' && <><AlertCircle size={14} className="text-red-500" /><span className="text-red-500">Sync Error</span></>}
        </div>

        <div className="flex items-center gap-2 border-r border-border pr-4 mr-2">
            <input type="file" accept=".soultune,.json" ref={fileInputRef} className="hidden" onChange={handleImportSoultune} />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex h-7 px-3 items-center justify-center rounded-sm font-bold text-[9px] tracking-wider uppercase bg-panel border border-border text-text hover:bg-white/10 transition-colors"
            >
              LOAD
            </button>
            <button 
              onClick={handleSaveSoultune} 
              className="flex h-7 px-3 items-center justify-center rounded-sm font-bold text-[9px] tracking-wider uppercase bg-panel border border-cyan-dim/50 text-cyan hover:bg-cyan/10 transition-colors"
            >
              SAVE .SOULTUNE
            </button>
        </div>

        <button 
          onClick={handleExport}
          disabled={isExporting}
          className={`flex h-8 px-4 items-center justify-center gap-2 rounded-md font-bold text-[10px] tracking-wider uppercase transition-all
            ${isExporting 
               ? 'bg-border text-text-muted cursor-not-allowed' 
               : 'bg-cyan text-[#05080F] hover:bg-white hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]'
            }`}
        >
          {subscriptionStatus !== 'active' && (
            <span className="bg-[#05080F] text-cyan px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase shadow-[0_0_5px_rgba(0,240,255,0.2)]">PRO</span>
          )}
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
           <h2 className="text-2xl font-bold text-white tracking-wide mb-3 text-white">Upgrade Required</h2>
           <p className="text-text-muted text-sm mb-8 leading-relaxed text-slate-400">
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
                    alert(data.error || "Checkout Configuration Missing.");
                  }
                } catch (e) {
                  alert("Checkout routing failed.");
                } finally {
                  setIsCheckingOut(false);
                }
             }}
             disabled={isCheckingOut}
             className="w-full h-12 rounded-md bg-cyan text-[#05080F] font-bold tracking-widest uppercase hover:bg-white transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] mb-4 flex items-center justify-center gap-2"
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
