import { useDroppable } from "@dnd-kit/core";
import { Activity, MoreHorizontal, Edit2, Trash2 } from "lucide-react";
import { Track, useStudioStore } from "@/store/useStudioStore";
import { ReactNode, useState, useRef, useEffect } from "react";

interface TrackLaneProps {
  track: Track;
  children?: ReactNode;
}

export function TrackLane({ track, children }: TrackLaneProps) {
  const { removeTrack, renameTrack, toggleMute, toggleSolo, setTrackVolume, setTrackPan } = useStudioStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleRename = () => {
    setIsMenuOpen(false);
    const newName = window.prompt("Enter new track name:", track.name);
    if (newName && newName.trim()) {
      renameTrack(track.id, newName.trim());
    }
  };

  const { setNodeRef, isOver } = useDroppable({
    id: track.id,
    data: {
      isTrack: true,
      trackId: track.id,
      trackType: track.type
    }
  });

  return (
    <div className="flex h-24 w-max min-w-full border-b border-border bg-transparent group">
      
      <div className="sticky left-0 top-0 bottom-0 w-[220px] bg-[#0A0F1A] border-r border-border p-3 flex flex-col justify-between z-20 shrink-0 shadow-[2px_0_10px_rgba(0,0,0,0.5)] transition-colors group-hover:bg-[#0E1524]">
         <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded shadow-[0_0_5px_currentColor] border border-white/20 ${track.color.split(' ')[0]}`} />
              <h3 className="text-[11px] font-bold uppercase tracking-wide truncate text-white drop-shadow-md">{track.name}</h3>
            </div>
            
            <div ref={menuRef} className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-white transition-colors"
              >
                <MoreHorizontal size={12} />
              </button>
              
              {isMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-36 bg-panel border border-border shadow-2xl rounded-md z-50 py-1 overflow-hidden">
                  <button 
                    onClick={handleRename}
                    className="w-full text-left px-3 py-2 text-xs text-text hover:bg-cyan-dim/20 hover:text-cyan flex items-center gap-2 transition-colors"
                  >
                    <Edit2 size={12} /> Rename Track
                  </button>
                  <button 
                    onClick={() => { setIsMenuOpen(false); removeTrack(track.id); }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 size={12} /> Delete Track
                  </button>
                </div>
              )}
            </div>
         </div>

         <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleMute(track.id)}
                className={`w-5 h-5 flex-shrink-0 rounded border text-[9px] font-bold transition-colors shadow-sm cursor-pointer
                  ${track.isMuted 
                    ? 'bg-red-500/20 text-red-500 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]' 
                    : 'bg-black/50 text-text-muted border-border hover:bg-border hover:text-white'}`}
              >
                M
              </button>
              <button 
                onClick={() => toggleSolo(track.id)}
                className={`w-5 h-5 flex-shrink-0 rounded border text-[9px] font-bold transition-colors shadow-sm cursor-pointer
                  ${track.isSolo 
                    ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                    : 'bg-black/50 text-text-muted border-border hover:bg-border hover:text-white'}`}
              >
                S
              </button>
              <input 
                 type="range" min="0" max="1" step="0.01" 
                 value={track.volume ?? 1.0}
                 onChange={(e) => setTrackVolume(track.id, parseFloat(e.target.value))}
                 className="w-full h-1 accent-[#00F0FF] bg-black/40 rounded-full appearance-none outline-none cursor-ew-resize hover:bg-white/20 transition-colors" 
                 title={`Volume: ${Math.round((track.volume ?? 1.0) * 100)}%`}
              />
            </div>
            <div className="flex items-center gap-2 pl-[48px]">
              <span className="text-[8px] text-text-muted font-mono tracking-widest w-4">PAN</span>
              <input 
                 type="range" min="-1" max="1" step="0.01" 
                 value={track.pan ?? 0.0}
                 onChange={(e) => setTrackPan(track.id, parseFloat(e.target.value))}
                 className="w-full h-1 accent-[#8A2BE2] bg-black/40 rounded-full appearance-none outline-none cursor-ew-resize hover:bg-white/20 transition-colors"
                 title={`Pan: ${Math.round((track.pan ?? 0.0) * 100)}%`}
              />
            </div>
         </div>
      </div>
      
      {/* The Droppable Zone (Right Column) */}
      <div 
        ref={setNodeRef}
        className={`relative flex-1 min-w-[2000px] bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px)] bg-[size:100px_100%] transition-colors ${
          isOver ? 'bg-cyan-dim/10' : ''
        }`}
        onClick={(e) => {
          if (useStudioStore.getState().isRazorMode) {
             const rect = e.currentTarget.getBoundingClientRect();
             const clickX = e.clientX - rect.left;
             const splitTime = clickX / 10;
             const blocks = useStudioStore.getState().blocks;
             const blockToSplit = blocks.find(b => b.track_id === track.id && splitTime >= b.start_time && splitTime <= b.end_time);
             if (blockToSplit) {
               useStudioStore.getState().splitBlock(blockToSplit.id, splitTime);
             }
          }
        }}
      >
         {children}
      </div>
    </div>
  );
}
