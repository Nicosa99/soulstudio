"use client";

import { useDraggable } from "@dnd-kit/core";
import { Block as BlockModel } from "@/store/useStudioStore";
import { useStudioStore } from "@/store/useStudioStore";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { WaveformCanvas } from "./WaveformCanvas";
import { Copy, Trash2 } from "lucide-react";

interface BlockProps {
  block: BlockModel;
}

export function Block({ block }: BlockProps) {
  const { activeSelection, setActiveSelection, updateBlock, isRazorMode, splitBlock, zoomLevel, isSnapEnabled } = useStudioStore();
  const PxPerSec = 10 * zoomLevel;
  
  const isSelected = activeSelection === block.id;
  const [localEndTime, setLocalEndTime] = useState<number | null>(null);
  const [localStartTime, setLocalStartTime] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const [localFadeIn, setLocalFadeIn] = useState<number | null>(null);
  const [localFadeOut, setLocalFadeOut] = useState<number | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    const hideMenu = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', hideMenu);
      document.addEventListener('contextmenu', hideMenu);
    }
    return () => {
      document.removeEventListener('click', hideMenu);
      document.removeEventListener('contextmenu', hideMenu);
    };
  }, [contextMenu]);

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { id: oldId, ...blockData } = block;
    const blockDuration = block.end_time - block.start_time;
    useStudioStore.getState().addBlock({
      ...blockData,
      start_time: block.end_time + 0.1,
      end_time: block.end_time + 0.1 + blockDuration
    });
    setContextMenu(null);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    useStudioStore.getState().removeBlock(block.id);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setActiveSelection(block.id);
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: {
      isBlock: true,
      blockId: block.id,
      trackId: block.track_id
    }
  });

  const effectiveEndTime = localEndTime !== null ? localEndTime : block.end_time;
  const effectiveStartTime = localStartTime !== null ? localStartTime : block.start_time;
  const duration = effectiveEndTime - effectiveStartTime;
  const width = duration * PxPerSec;
  const left = effectiveStartTime * PxPerSec;

  const fadeIn = localFadeIn !== null ? localFadeIn : (block.properties.fade_in as number || 0);
  const fadeOut = localFadeOut !== null ? localFadeOut : (block.properties.fade_out as number || 0);

  const handleFadeInDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setLocalFadeIn(fadeIn);
    const startX = e.clientX;
    const initialFade = fadeIn;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newFade = initialFade + (deltaX / PxPerSec);
      if (isSnapEnabled) newFade = Math.round(newFade);
      newFade = Math.max(0, Math.min(newFade, duration - fadeOut));
      setLocalFadeIn(newFade);
    };
    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setIsResizing(false);
      
      const finalDeltaX = upEvent.clientX - startX;
      let finalFade = initialFade + (finalDeltaX / PxPerSec);
      if (isSnapEnabled) finalFade = Math.round(finalFade);
      finalFade = Math.max(0, Math.min(finalFade, duration - fadeOut));
      
      updateBlock(block.id, { properties: { ...block.properties, fade_in: finalFade } });
      setLocalFadeIn(null);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleFadeOutDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setLocalFadeOut(fadeOut);
    const startX = e.clientX;
    const initialFade = fadeOut;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = startX - moveEvent.clientX; 
      let newFade = initialFade + (deltaX / PxPerSec);
      if (isSnapEnabled) newFade = Math.round(newFade);
      newFade = Math.max(0, Math.min(newFade, duration - fadeIn));
      setLocalFadeOut(newFade);
    };
    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setIsResizing(false);
      
      const finalDeltaX = startX - upEvent.clientX;
      let finalFade = initialFade + (finalDeltaX / PxPerSec);
      if (isSnapEnabled) finalFade = Math.round(finalFade);
      finalFade = Math.max(0, Math.min(finalFade, duration - fadeIn));
      
      updateBlock(block.id, { properties: { ...block.properties, fade_out: finalFade } });
      setLocalFadeOut(null);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleResizeStartRight = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setLocalEndTime(block.end_time);

    const startX = e.clientX;
    const initialEndTime = block.end_time;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / PxPerSec;
      let newEndTime = Math.max(block.start_time + 1, initialEndTime + deltaTime);
      if (isSnapEnabled) newEndTime = Math.round(newEndTime);
      setLocalEndTime(newEndTime);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setIsResizing(false);
      
      const finalDeltaX = upEvent.clientX - startX;
      const finalDeltaTime = finalDeltaX / PxPerSec;
      let finalEndTime = Math.max(block.start_time + 1, initialEndTime + finalDeltaTime);
      if (isSnapEnabled) finalEndTime = Math.round(finalEndTime);
      
      updateBlock(block.id, { end_time: finalEndTime });
      setLocalEndTime(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleResizeStartLeft = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setLocalStartTime(block.start_time);

    const startX = e.clientX;
    const initialStartTime = block.start_time;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / PxPerSec;
      let newStartTime = Math.max(0, initialStartTime + deltaTime);
      if (isSnapEnabled) newStartTime = Math.round(newStartTime);
      newStartTime = Math.min(newStartTime, block.end_time - 1);
      setLocalStartTime(newStartTime);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setIsResizing(false);
      
      const finalDeltaX = upEvent.clientX - startX;
      const finalDeltaTime = finalDeltaX / PxPerSec;
      let finalStartTime = Math.max(0, initialStartTime + finalDeltaTime);
      if (isSnapEnabled) finalStartTime = Math.round(finalStartTime);
      finalStartTime = Math.min(finalStartTime, block.end_time - 1);
      
      updateBlock(block.id, { start_time: finalStartTime });
      setLocalStartTime(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  let colorClass = 'bg-border/20 text-text border-border';
  let glowClass = 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]';

  if (block.type === 'carrier') {
    colorClass = 'bg-track-carrier/20 text-track-carrier border-track-carrier';
    glowClass = 'hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]';
  }
  if (block.type === 'entrainment') {
    colorClass = 'bg-track-entrainment/20 text-track-entrainment border-track-entrainment';
    glowClass = 'hover:drop-shadow-[0_0_8px_rgba(138,43,226,0.5)]';
  }
  if (block.type === 'guide' || block.type === 'voice') {
    colorClass = 'bg-track-guide/20 text-track-guide border-track-guide';
    glowClass = 'hover:drop-shadow-[0_0_8px_rgba(255,107,107,0.5)]';
  }
  if (block.type === 'atmosphere') {
    colorClass = 'bg-track-atmo/20 text-track-atmo border-track-atmo';
    glowClass = 'hover:drop-shadow-[0_0_8px_rgba(78,205,196,0.5)]';
  }

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : {};

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...style,
        position: 'absolute',
        left: `${left}px`,
        width: `${width}px`,
        top: '12px',
        bottom: '12px',
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (isRazorMode) {
           const rect = e.currentTarget.getBoundingClientRect();
           const clickX = e.clientX - rect.left;
           const splitTime = block.start_time + (clickX / PxPerSec);
           splitBlock(block.id, splitTime);
        } else {
           setActiveSelection(block.id);
        }
      }}
      onContextMenu={handleContextMenu}
      className={`rounded-lg border backdrop-blur-sm p-2 text-xs font-medium flex flex-col justify-center shadow-md transition-all overflow-hidden
        ${!isResizing && 'cursor-grab active:cursor-grabbing'}
        ${colorClass} ${glowClass}
        ${isDragging ? 'opacity-70 !shadow-xl scale-[1.02] z-50' : ''}
        ${isSelected ? 'ring-2 ring-white/50 brightness-125 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : ''}
      `}
    >
      {/* SVG Fade Overlay */}
      <svg 
         viewBox="0 0 100 100" 
         preserveAspectRatio="none" 
         className="absolute inset-0 w-full h-full pointer-events-none opacity-20 z-10 mix-blend-overlay"
      >
         <polygon points={`
            0,100
            ${duration > 0 ? (fadeIn / duration) * 100 : 0},0
            ${duration > 0 ? 100 - (fadeOut / duration) * 100 : 100},0
            100,100
         `} fill="white" />
      </svg>

      {/* Fade In Handle */}
      <div 
        className="absolute left-0 top-0 w-4 h-4 cursor-ew-resize hover:bg-white/50 transition-colors z-40 rounded-br bg-white/10"
        onPointerDown={handleFadeInDrag}
      />
      {/* Fade Out Handle */}
      <div 
        className="absolute right-0 top-0 w-4 h-4 cursor-ew-resize hover:bg-white/50 transition-colors z-40 rounded-bl bg-white/10"
        onPointerDown={handleFadeOutDrag}
      />

      {/* Left Edge Drag Handle for Duration */}
      <div 
        className="absolute left-0 top-4 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-bl-lg transition-colors z-30"
        onPointerDown={handleResizeStartLeft}
      />

      <span className="truncate w-full pr-2 select-none pointer-events-none relative z-20 text-white font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{block.label}</span>
      
      {block.properties.fileUrl && (
          <div className="absolute inset-0 z-0 opacity-50 pointer-events-none flex items-center pt-2">
            <WaveformCanvas 
               fileUrl={block.properties.fileUrl} 
               colorHex={block.type === 'voice' || block.type === 'guide' ? '#00F0FF' : '#8A2BE2'} 
               trimStart={block.properties.trimStart || 0}
               duration={duration}
            />
          </div>
      )}
      
      {/* Right Edge Drag Handle for Duration */}
      <div 
        className="absolute right-0 top-4 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-br-lg transition-colors z-30"
        onPointerDown={handleResizeStartRight}
      />

      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[9999] bg-panel border border-border shadow-2xl rounded-md py-1 overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button 
            onClick={handleDuplicate}
            className="w-full text-left px-4 py-2 text-xs text-text hover:bg-cyan-dim/20 hover:text-cyan flex items-center gap-2 transition-colors"
          >
            <Copy size={12} /> Duplicate Block
          </button>
          <button 
            onClick={handleDelete}
            className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-2 transition-colors"
          >
            <Trash2 size={12} /> Delete Block
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
