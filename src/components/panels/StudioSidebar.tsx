"use client";

import { useState, useRef, useEffect } from "react";
import { Layers, CloudUpload, Settings2, Mic, Waves, Cloud, Loader2, Terminal, Blocks, Bot, Calculator, Smartphone, ArrowLeft, Folder, Activity, Plus } from "lucide-react";
import { DraggableAsset } from "./DraggableAsset";
import { JsonPlaybookPanel } from "./JsonPlaybookPanel";
import { FreqCalculatorPanel } from "./FreqCalculatorPanel";
import { useStudioStore } from "@/store/useStudioStore";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export function StudioSidebar() {
  const [activeTab, setActiveTab] = useState<'library' | 'uploads' | 'projects' | 'code' | 'apps' | 'apps-freq' | 'settings'>('library');
  const { userUploads, addUpload, setConsoleOpen, setActiveConsoleModule } = useStudioStore();
  const [isUploading, setIsUploading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (activeTab === 'projects') {
      fetchProjects();
    }
  }, [activeTab]);

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        setProjects(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

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

      const audio = new Audio(publicUrl);
      audio.addEventListener('loadedmetadata', () => {
         addUpload({
            id: `upload-${Date.now()}`,
            label: file.name,
            type: "voice",
            properties: { volume: 80, ducking: true, fileUrl: publicUrl },
            defaultDuration: Math.ceil(audio.duration)
         });
         setIsUploading(false);
      });
    } catch (err) {
      console.error("Upload failed", err);
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* Pane 1: Icon Strip */}
      <div className="w-[72px] flex-shrink-0 bg-[#05080F] border-r border-border flex flex-col items-center py-4 gap-6">
        <button onClick={() => setActiveTab('library')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'library' ? 'text-cyan' : 'text-text-muted hover:text-white'}`}>
          <Layers size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Library</span>
        </button>
        <button onClick={() => setActiveTab('uploads')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'uploads' ? 'text-cyan' : 'text-text-muted hover:text-white'}`}>
          <CloudUpload size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Uploads</span>
        </button>
        <button onClick={() => setActiveTab('projects')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'projects' ? 'text-cyan' : 'text-text-muted hover:text-white'}`}>
          <Folder size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Projects</span>
        </button>
        <button onClick={() => setActiveTab('code')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'code' ? 'text-cyan' : 'text-text-muted hover:text-white'}`}>
          <Terminal size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Code</span>
        </button>
        <button onClick={() => setActiveTab('apps')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab.startsWith('apps') ? 'text-cyan' : 'text-text-muted hover:text-white'}`}>
          <Blocks size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Apps</span>
        </button>
        <div className="mt-auto">
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-cyan' : 'text-text-muted hover:text-white'}`}>
            <Settings2 size={22} /><span className="text-[9px] font-bold uppercase tracking-tighter">Setup</span>
          </button>
        </div>
      </div>

      {/* Pane 2: Content Area */}
      <div className="w-[250px] flex-shrink-0 bg-[#0A0F1A] border-r border-border flex flex-col h-full overflow-hidden">
        
        {activeTab === 'library' && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border p-4 shrink-0">
              <Layers size={16} className="text-cyan" />
              <h2 className="text-xs font-bold tracking-widest text-text uppercase">Studio Assets</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-text-dim tracking-[0.2em] flex items-center gap-2 uppercase">Voice Tracks</h3>
                <DraggableAsset id="voice-vsl" label="The Protocol - Hook" type="voice" colorClass="hover:border-cyan hover:bg-cyan-dim/10" defaultDuration={120} properties={{ volume: 80, ducking: true }}>The Protocol - Hook</DraggableAsset>
              </div>
              <div className="space-y-3 pt-2">
                <h3 className="text-[10px] font-black text-text-dim tracking-[0.2em] flex items-center gap-2 uppercase">Entrainment</h3>
                <DraggableAsset id="entrain-theta" label="4.0Hz Theta" type="entrainment" colorClass="hover:border-violet hover:bg-violet-dim/10" defaultDuration={1800} properties={{ targetStateHz: 4.0, baseFrequency: 136.1 }}>4.0Hz Theta</DraggableAsset>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'uploads' && (
          <div className="flex h-full flex-col p-4 gap-4">
            <h2 className="text-xs font-bold tracking-widest text-text uppercase">Your Files</h2>
            <button onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-text-muted hover:border-cyan hover:text-cyan transition-all">
              <CloudUpload size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Upload Audio</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
              <div className="flex items-center gap-2">
                <Folder size={16} className="text-cyan" />
                <h2 className="text-xs font-bold tracking-widest text-text uppercase">My Projects</h2>
              </div>
              <Link href="/studio/new" className="p-1 hover:bg-white/5 rounded text-cyan">
                <Plus size={16} />
              </Link>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoadingProjects ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                  <Loader2 size={16} className="animate-spin text-cyan" />
                  <span className="text-[9px] uppercase font-bold tracking-widest">Loading...</span>
                </div>
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <Link 
                    key={project.id} 
                    href={`/studio/${project.id}`}
                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl hover:border-cyan/30 hover:bg-cyan/5 transition-all group"
                  >
                    <div className="p-2 bg-white/5 rounded-lg group-hover:bg-cyan/10 transition-colors">
                      <Activity size={14} className="text-text-muted group-hover:text-cyan" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[11px] font-bold text-white truncate uppercase tracking-wide">
                        {project.name || "Untitled"}
                      </span>
                      <span className="text-[9px] text-text-muted">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 opacity-30">
                  <Folder size={24} className="mx-auto mb-2" />
                  <p className="text-[10px] font-bold uppercase">No projects found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'code' && <JsonPlaybookPanel />}

        {activeTab === 'apps' && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border p-4 shrink-0">
              <Blocks size={16} className="text-cyan" />
              <h2 className="text-xs font-bold tracking-widest text-text uppercase">Apps Ecosystem</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 gap-3">
              {/* AI Voice App */}
              <div 
                onClick={() => {
                  setConsoleOpen(true);
                  setActiveConsoleModule('script');
                }}
                className="relative group bg-white/5 border border-cyan/20 rounded-xl p-4 transition-all hover:bg-cyan/5 hover:border-cyan/50 cursor-pointer overflow-hidden shadow-[0_0_15px_rgba(0,240,255,0.05)]"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-cyan/10 rounded-lg text-cyan"><Bot size={18} /></div>
                  <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">Mic Booth</h3>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">Pro recording studio with integrated script teleprompter.</p>
              </div>

              {/* Freq Calculator App */}
              <button 
                onClick={() => setActiveTab('apps-freq')}
                className="relative group bg-white/5 border border-white/5 rounded-xl p-4 transition-all hover:bg-white/10 hover:border-violet/30 cursor-pointer text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-violet/10 rounded-lg text-violet"><Calculator size={18} /></div>
                  <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">Frequency Lab</h3>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">Calculate planetary and Solfeggio harmonics.</p>
              </button>

              {/* App Publisher */}
              <div className="relative group bg-white/5 border border-white/5 rounded-xl p-4 transition-all opacity-40 cursor-not-allowed overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/5 rounded-lg text-white/40"><Smartphone size={18} /></div>
                  <h3 className="text-[11px] font-bold text-white uppercase tracking-wider text-white/40">App Sync</h3>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">Sync directly to the mobile app.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'apps-freq' && (
          <div className="flex h-full flex-col">
            <button 
              onClick={() => setActiveTab('apps')}
              className="flex items-center gap-2 p-4 text-[10px] font-bold text-text-muted hover:text-white transition-colors border-b border-border bg-black/20"
            >
              <ArrowLeft size={12} /> BACK TO APPS
            </button>
            <div className="flex-1 overflow-hidden">
              <FreqCalculatorPanel />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted font-sans">
            <Settings2 size={32} className="mb-4 opacity-50 text-cyan" />
            <p className="text-[10px] uppercase tracking-widest font-black">Studio Configuration</p>
            <p className="text-[9px] mt-2 opacity-40">Manage global audio and workspace defaults.</p>
          </div>
        )}
      </div>
    </div>
  );
}