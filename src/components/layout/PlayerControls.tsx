"use client";

import { Play, Pause, Square, Rewind, FastForward } from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";
import { instance as audio } from "@/lib/audio/AudioEngine";
import { useEffect } from "react";

export function PlayerControls() {
  const { isPlaying, togglePlay, stop, seek, blocks, currentTime } = useStudioStore();

  // Sync AudioEngine with store state on primary play toggle
  useEffect(() => {
    if (!audio) return;
    if (isPlaying) {
      // Only read blocks and currentTime on the exact moment play is toggled
      const currentBlocks = useStudioStore.getState().blocks;
      const startTime = useStudioStore.getState().currentTime;
      audio.playSequencer(currentBlocks, startTime);
    } else {
      audio.stop();
    }
  }, [isPlaying]); // DANGEROUS: Do NOT add currentTime here! It updates 60fps and causes an OOM loop!

  const handlePlay = () => {
    togglePlay();
  };

  const handleStop = () => {
    stop();
    if (audio) {
      audio.stop();
    }
  };

  const handleSeek = (amount: number) => {
    const newTime = Math.max(0, currentTime + amount);
    seek(newTime);
    
    // Auto-resume sync if playing
    if (isPlaying && audio) {
      audio.stop();
      audio.playSequencer(blocks, newTime);
    }
  };

  // Format time MM:SS:mss
  const formatTime = (timeInSeconds: number) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    const ms = Math.floor((timeInSeconds % 1) * 1000);
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="flex items-center gap-6">
      {/* Time Display */}
      <div className="bg-black/80 border border-border px-3 py-1 rounded text-cyan font-mono text-sm tracking-widest shadow-[inset_0_0_10px_rgba(0,240,255,0.1)] w-28 text-center">
        {formatTime(currentTime)}
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-2 border border-border bg-black/50 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => handleSeek(-15)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border hover:text-white"
        >
          <Rewind size={16} fill="currentColor" />
        </button>
        
        <button 
          onClick={handleStop}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border hover:text-white"
        >
          <Square size={14} fill="currentColor" />
        </button>

        <button 
          onClick={handlePlay}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all shadow-[0_0_15px_var(--color-border-glow)]
            ${isPlaying 
              ? 'bg-cyan text-black hover:bg-cyan-dim border border-transparent shadow-[0_0_20px_rgba(0,240,255,0.6)]' 
              : 'bg-cyan-dim text-cyan hover:bg-cyan hover:text-black shadow-[0_0_10px_rgba(0,240,255,0.2)]'}
          `}
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="ml-1" fill="currentColor" />}
        </button>
        
        <button 
          onClick={() => handleSeek(15)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border hover:text-white"
        >
          <FastForward size={16} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
