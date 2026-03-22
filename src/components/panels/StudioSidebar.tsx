"use client";

import { useState, useRef } from "react";
import { Layers, CloudUpload, Settings2, Mic, Waves, Cloud, Loader2 } from "lucide-react";
import { DraggableAsset } from "./DraggableAsset";
import { useStudioStore } from "@/store/useStudioStore";
import { createClient } from "@/utils/supabase/client";

export function StudioSidebar() {
  const [activeTab, setActiveTab] = useState<'library' | 'uploads' | 'settings'>('library');
  const { userUploads, addUpload } = useStudioStore();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      const { data, error } = await supabase.storage
        .from('user-assets')
        .upload(`audio/${fileName}`, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('user-assets')
        .getPublicUrl(data.path);

      // Get Duration
      const audio = new Audio(publicUrl);
      audio.addEventListener('loadedmetadata', () => {
         const duration = Math.ceil(audio.duration);
         
         addUpload({
            id: `upload-${Date.now()}`,
            label: file.name,
            type: "voice",
            properties: { volume: 80, ducking: true, fileUrl: publicUrl },
            defaultDuration: duration
         });
         setIsUploading(false);
      });
      audio.addEventListener('error', () => {
         console.warn("Failed to load audio metadata via Audio object fallback to 120s");
         addUpload({
            id: `upload-${Date.now()}`,
            label: file.name,
            type: "voice",
            properties: { volume: 80, ducking: true, fileUrl: publicUrl },
            defaultDuration: 120
         });
         setIsUploading(false);
      });
      
    } catch (err) {
      console.error("Upload failed", err);
      alert("Upload failed. Ensure the 'user-assets' Supabase Storage bucket exists.");
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* Pane 1: Icon Strip */}
      <div className="w-[72px] flex-shrink-0 bg-[#05080F] border-r border-border flex flex-col items-center py-4 gap-6">
        <button 
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'library' ? 'text-cyan' : 'text-text-muted hover:text-white'}`}
        >
          <Layers size={24} />
          <span className="text-[10px] font-medium tracking-wide">Library</span>
        </button>
        <button 
          onClick={() => setActiveTab('uploads')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'uploads' ? 'text-cyan' : 'text-text-muted hover:text-white'}`}
        >
          <CloudUpload size={24} />
          <span className="text-[10px] font-medium tracking-wide">Uploads</span>
        </button>
        <div className="mt-auto">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-cyan' : 'text-text-muted hover:text-white'}`}
          >
            <Settings2 size={24} />
            <span className="text-[10px] font-medium tracking-wide">Settings</span>
          </button>
        </div>
      </div>

      {/* Pane 2: Content Area */}
      <div className="w-[250px] flex-shrink-0 bg-[#0A0F1A] border-r border-border flex flex-col h-full overflow-hidden">
        
        {activeTab === 'library' && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border p-4 shrink-0">
              <Layers size={18} className="text-cyan" />
              <h2 className="text-sm font-semibold tracking-wide text-text uppercase">ASSET LIBRARY</h2>
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
        )}

        {activeTab === 'uploads' && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border p-4 shrink-0">
              <CloudUpload size={18} className="text-cyan" />
              <h2 className="text-sm font-semibold tracking-wide text-text uppercase">YOUR UPLOADS</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <input 
                type="file" 
                accept="audio/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`w-full rounded-xl border-2 border-dashed border-cyan/50 p-6 flex flex-col items-center justify-center gap-2 text-cyan-dim transition-all group
                  ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan/10 hover:border-cyan hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]'}`}
              >
                {isUploading ? <Loader2 size={32} className="animate-spin text-cyan" /> : <CloudUpload size={32} className="group-hover:scale-110 transition-transform" />}
                <span className="text-sm font-semibold text-white">{isUploading ? "Uploading..." : "Upload Audio"}</span>
                <span className="text-xs text-text-muted text-center max-w-[150px]">MP3, WAV up to 50MB</span>
              </button>

              {userUploads.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-text-muted tracking-widest flex items-center gap-2">
                    <Mic size={14} /> CUSTOM TRACKS
                  </h3>
                  <div className="flex flex-col gap-2">
                    {userUploads.map((file: any) => (
                      <DraggableAsset
                        key={file.id}
                        id={file.id}
                        label={file.label}
                        type="voice"
                        colorClass="hover:border-cyan hover:bg-cyan-dim/10"
                        defaultDuration={file.defaultDuration}
                        properties={file.properties}
                      >
                        {file.label}
                      </DraggableAsset>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted">
            <Settings2 size={32} className="mb-4 opacity-50" />
            <p className="text-sm">Studio configuration panel coming soon.</p>
          </div>
        )}

      </div>
    </div>
  );
}
