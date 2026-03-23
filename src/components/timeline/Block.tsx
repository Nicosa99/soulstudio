"use client";

import { useDraggable } from "@dnd-kit/core";
import { Block as BlockModel, useStudioStore } from "@/store/useStudioStore";
import { CSS } from "@dnd-kit/utilities";
import { Mic, Waves, Cloud, Music } from "lucide-react";
import { WaveformCanvas } from "./WaveformCanvas";

interface BlockProps {
  block: BlockModel;
}

export function Block({ block }: BlockProps) {
  const { selectedBlocks, setActiveSelection, setSelectedBlocks, toggleBlockSelection, zoomLevel } = useStudioStore();
  const isSelected = selectedBlocks.includes(block.id);
  const isMultiSelected = selectedBlocks.length > 1 && isSelected;
  const PxPerSec = 10 * zoomLevel;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: {
      isBlock: true,
      blockId: block.id,
      trackId: block.track_id
    }
  });

  const width = (block.end_time - block.start_time) * PxPerSec;
  const left = block.start_time * PxPerSec;

  const style = {
    transform: CSS.Translate.toString(transform),
    width: `${width}px`,
    left: `${left}px`,
    opacity: isDragging ? 0.5 : 1,
  };

  const getIcon = () => {
    switch (block.type) {
      case 'voice': return <Mic size={12} />;
      case 'entrainment': return <Waves size={12} />;
      case 'atmosphere': return <Cloud size={12} />;
      default: return <Music size={12} />;
    }
  };

  const getBlockColor = () => {
    if (isMultiSelected) return 'bg-cyan/20 border-cyan shadow-[0_0_12px_rgba(0,240,255,0.4)]';
    if (isSelected) return 'bg-white/20 border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]';
    switch (block.type) {
      case 'voice': return 'bg-cyan-900/40 border-cyan/40 text-cyan';
      case 'entrainment': return 'bg-violet-900/40 border-violet/40 text-violet';
      case 'atmosphere': return 'bg-white/5 border-white/10 text-white/60';
      default: return 'bg-white/10 border-white/20 text-white';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        if (e.shiftKey) {
          toggleBlockSelection(block.id);
        } else {
          setActiveSelection(block.id);
        }
      }}
      className={`absolute top-2 bottom-2 rounded-md border p-2 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition-all select-none overflow-hidden ${getBlockColor()}`}
    >
      {/* Waveform Background: Always render for voice blocks with valid URL */}
      {block.type === 'voice' && block.properties?.fileUrl && (
        <div className="absolute inset-0 z-0">
          <WaveformCanvas 
            fileUrl={block.properties.fileUrl} 
            color="#00F0FF" 
            width={width} 
            height={80} 
          />
        </div>
      )}

      {/* Content Label Layer */}
      <div className="flex items-center gap-1.5 shrink-0 relative z-10 pointer-events-none">
        <span className="opacity-70">{getIcon()}</span>
        <span className="text-[10px] font-black uppercase tracking-widest truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {block.label}
        </span>
      </div>
      
      {block.type === 'entrainment' && (
        <div className="text-[8px] font-mono opacity-50 relative z-10 pointer-events-none">
          {block.properties?.targetStateHz}Hz • {block.properties?.baseFrequency}Hz
        </div>
      )}
    </div>
  );
}