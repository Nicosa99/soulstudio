"use client";

import { ReactNode } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Sliders, FileText, Mic, Square, Play, Send, Trash2, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TopBar } from "./TopBar";

interface StudioLayoutProps {
  assetLibrary: ReactNode;
  timeline: ReactNode;
  inspector: ReactNode;
}

export function StudioLayout({ assetLibrary, timeline, inspector }: StudioLayoutProps) {
  const { 
    isConsoleOpen, 
    setConsoleOpen, 
    activeConsoleModule, 
    isRecording, 
    toggleRecording, 
    currentTime, 
    addBlock,
    addTrack,
    lastRecordingUrl,
    setLastRecordingUrl
  } = useStudioStore();
  
  const [script, setScript] = useState("");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Recording Logic Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setLastRecordingUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
  };

  useEffect(() => {
    if (isRecording) startRecording();
    else stopRecording();
  }, [isRecording]);

  const handlePreviewPlay = () => {
    if (!lastRecordingUrl) return;
    if (isPreviewPlaying) {
      previewAudioRef.current?.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current = new Audio(lastRecordingUrl);
      previewAudioRef.current.onended = () => setIsPreviewPlaying(false);
      previewAudioRef.current.play();
      setIsPreviewPlaying(true);
    }
  };

  const handleSendToTimeline = () => {
    if (!lastRecordingUrl) return;
    
    // 1. Create a NEW track for this recording
    const newTrackId = addTrack({
      name: `VOICE ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      type: 'guide',
      color: 'bg-cyan-500/20 text-cyan-400'
    });

    // 2. Add the block to that specific track
    const tempAudio = new Audio(lastRecordingUrl);
    tempAudio.addEventListener('loadedmetadata', () => {
      addBlock({
        track_id: newTrackId,
        asset_id: `rec-${Date.now()}`,
        label: "Voice Take",
        type: 'voice',
        start_time: currentTime,
        end_time: currentTime + tempAudio.duration,
        properties: { volume: 100, fileUrl: lastRecordingUrl }
      });
      // Optional: clear preview after sending
      setLastRecordingUrl(null);
    });
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg text-white font-sans">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <aside className="h-full flex-shrink-0">{assetLibrary}</aside>

        <div className="flex flex-1 flex-col overflow-hidden border-r border-border relative">
          <main className="flex-1 overflow-hidden relative">{timeline}</main>

          {isConsoleOpen && activeConsoleModule === 'script' && (
            <div className="h-[340px] bg-[#05080F] border-t border-cyan/20 flex flex-col z-30 animate-in slide-in-from-bottom duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
               
               <div className="h-9 bg-[#0A0F1A] border-b border-white/5 flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-cyan/10 border border-cyan/20">
                       <Mic size={12} className="text-cyan" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Mic Booth</span>
                    </div>
                  </div>
                  
                  <button onClick={() => setConsoleOpen(false)} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-red-500/20 text-text-dim hover:text-red-400 transition-all group">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Close Studio</span>
                    <X size={16} />
                  </button>
               </div>

               <div className="flex-1 p-6 flex gap-6 overflow-x-auto">
                  <div className="flex-1 min-w-[650px] border border-white/5 rounded-xl bg-white/[0.02] p-5 flex flex-col gap-4 relative overflow-hidden">
                    <div className="flex items-center justify-between shrink-0">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan/80">Recording Script / Teleprompter</h3>
                      {lastRecordingUrl && !isRecording && (
                        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                          <button onClick={handlePreviewPlay} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 text-cyan">
                            {isPreviewPlaying ? <Square size={12} className="fill-cyan" /> : <Play size={12} className="fill-cyan" />}
                            {isPreviewPlaying ? 'Stop' : 'Listen Back'}
                          </button>
                          <button onClick={handleSendToTimeline} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan text-bg text-[10px] font-black uppercase tracking-widest hover:bg-white shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                            <Send size={12} /> Send to New Track
                          </button>
                          <button onClick={() => setLastRecordingUrl(null)} className="p-2 text-text-dim hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 flex gap-6 min-h-0">
                      <textarea 
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        placeholder="Paste your voice-over script here..."
                        className="flex-1 bg-black/40 border border-white/5 rounded-lg p-4 text-[15px] font-medium text-slate-200 focus:outline-none focus:border-cyan/30 resize-none leading-relaxed"
                      />
                      
                      <div className="w-32 flex flex-col gap-4">
                        <button 
                          onClick={toggleRecording}
                          className={`flex-1 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-500
                            ${isRecording ? 'bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.4)]' : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-red-500/50'}`}
                        >
                          <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${isRecording ? 'border-white/40 scale-90' : 'border-red-500/30'}`}>
                             {isRecording ? <Square size={24} className="fill-white text-white" /> : <Mic size={28} className="text-red-500" />}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isRecording ? 'text-white' : 'text-red-500'}`}>
                            {isRecording ? 'STOP' : 'RECORD'}
                          </span>
                        </button>
                        <div className="h-12 bg-black/60 rounded-xl border border-white/5 flex items-center justify-center">
                           <span className={`font-mono text-xs font-bold ${isRecording ? 'text-red-500 animate-pulse' : 'text-text-dim'}`}>
                             {isRecording ? 'RECORDING' : '00:00:00'}
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-80 border border-white/5 rounded-xl bg-white/[0.02] p-5 flex flex-col gap-6 opacity-50 cursor-not-allowed">
                    <div className="flex items-center gap-2">
                      <Sliders size={16} className="text-violet" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Monitor FX</h3>
                    </div>
                    <p className="text-[9px] text-text-dim uppercase tracking-widest text-center mt-4">Hardware Monitor coming soon</p>
                  </div>
               </div>
            </div>
          )}
        </div>

        <aside className="h-full flex-shrink-0">{inspector}</aside>
      </div>
    </div>
  );
}