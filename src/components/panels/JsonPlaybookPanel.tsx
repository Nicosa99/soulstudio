"use client";

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { useStudioStore } from "@/store/useStudioStore";
import { Wand2 } from "lucide-react";

export function JsonPlaybookPanel() {
  const { tracks: currentTracks, blocks, initializeProject, projectName } = useStudioStore();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const currentState = { name: projectName, tracks: currentTracks, blocks };
    const json = JSON.stringify(currentState, null, 2);
    
    // Use requestAnimationFrame to avoid "setState within effect" warning if it's strictly synchronous
    const frame = requestAnimationFrame(() => {
        setCode(prev => prev === json ? prev : json);
    });
    return () => cancelAnimationFrame(frame);
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
      
      console.log("Applying JSON via Panel...", parsed);
      initializeProject(parsed);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Panel Apply failed:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
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