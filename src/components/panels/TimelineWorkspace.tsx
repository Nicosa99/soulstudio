"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { TrackLane } from "@/components/timeline/TrackLane";
import { Block } from "@/components/timeline/Block";
import { useEffect, useRef, useState } from "react";
import { instance as audio } from "@/lib/audio/AudioEngine";
import { Block as BlockType, Track as TrackType } from "@/store/useStudioStore";

export function TimelineWorkspace() {
  const { tracks, blocks, isRazorMode, setRazorMode, isPlaying, currentTime, setCurrentTime, splitBlock, zoomLevel, isSnapEnabled, getProjectDuration } = useStudioStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const PxPerSec = 10 * zoomLevel;
  const projectDuration = getProjectDuration();
  const timelineWidth = projectDuration * PxPerSec;

  const [isSlicing, setIsSlicing] = useState(false);
  const [sliceX, setSliceX] = useState(0);
  const [sliceStartY, setSliceStartY] = useState(0);
  const [sliceCurrentY, setSliceCurrentY] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const animatePlayhead = () => {
      if (isPlaying && audio) {
        setCurrentTime(audio.getCurrentTime());
        animationFrameId = requestAnimationFrame(animatePlayhead);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(animatePlayhead);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, setCurrentTime]);

  // Reactive bridge from Store to AudioEngine
  useEffect(() => {
    if (isPlaying && audio) {
      audio.updateBlockProperties(
        blocks, 
        tracks
      );
    }
  }, [blocks, tracks, isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CRITICAL SAFEGUARD: Skip shortcuts if user is typing
      const activeTag = document.activeElement?.tagName;
      const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
      const isMonaco = document.activeElement?.closest('.monaco-editor');
      if (isInput || isMonaco) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Ctrl + Z
      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const temporal = (useStudioStore as unknown as { temporal: { getState: () => { undo: () => void } } }).temporal;
        if (temporal) temporal.getState().undo();
      }

      // Redo: Ctrl + Shift + Z or Ctrl + Y
      if ((cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') || (cmdOrCtrl && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        const temporal = (useStudioStore as unknown as { temporal: { getState: () => { redo: () => void } } }).temporal;
        if (temporal) temporal.getState().redo();
      }

      // Copy: Ctrl + C
      if (cmdOrCtrl && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        useStudioStore.getState().copyBlock();
      }

      // Paste: Ctrl + V
      if (cmdOrCtrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        useStudioStore.getState().pasteBlock();
      }

      // Razor Mode: C
      if (!cmdOrCtrl && (e.key === 'c' || e.key === 'C')) {
        setRazorMode(true);
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedBlocks, removeBlocks } = useStudioStore.getState();
        if (selectedBlocks.length > 0) {
          removeBlocks(selectedBlocks);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        setRazorMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setRazorMode]);

  useEffect(() => {
    // Listener must be on the inner scroll container so preventDefault() fires
    // before the browser handles the native scroll/zoom.
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
        const currentZoom = useStudioStore.getState().zoomLevel;
        const newZoom = Math.max(0.1, Math.min(currentZoom + zoomDelta, 5.0));
        useStudioStore.getState().setZoomLevel(newZoom);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const timelineBgStyle = {
    backgroundSize: `${PxPerSec * 10}px 100%`,
    backgroundImage: `linear-gradient(to right, var(--color-border) 1px, transparent 1px)`
  };

  const handleTimelineClick = () => {
    if (!isRazorMode) {
      useStudioStore.getState().setActiveSelection(null);
      useStudioStore.getState().setSelectedBlocks([]);
    }
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    let newTime = Math.max(0, clickX / PxPerSec);
    if (isSnapEnabled) newTime = Math.round(newTime);
    setCurrentTime(newTime);
    
    // Auto-resume sync if playing
    if (isPlaying && audio) {
      audio.stop();
      audio.playSequencer(useStudioStore.getState().getComputedBlocks(), newTime);
    }
  };

  return (
    <div 
      className={`flex h-full flex-col relative overflow-hidden bg-bg-deep ${isRazorMode ? 'cursor-crosshair' : ''}`}
      ref={timelineRef}
      onClick={handleTimelineClick}
    >
      <div ref={scrollRef} className="flex-1 overflow-auto w-full relative">
        {/* Time Ruler (Sticky Top) */}
        <div 
          className="sticky top-0 h-10 flex bg-panel border-b border-border z-30 w-max min-w-full cursor-text text-xs font-mono text-text-muted shadow-md"
          onClick={handleRulerClick}
        >
           
           {/* Top Left Corner Blank Space */}
           <div className="sticky left-0 w-[220px] h-full bg-panel border-r border-border z-40 shrink-0 flex items-center px-4">
             <span className="text-[10px] uppercase tracking-widest text-text-dim">TIMELINE</span>
           </div>

           {/* Ruler Numbers */}
           <div 
             className="relative flex-1 flex items-center cursor-text hover:bg-black/30 transition-colors"
             style={{ ...timelineBgStyle, minWidth: `${timelineWidth}px` }}
             onClick={handleRulerClick}
           >
             {/* Playhead Vertical Line */}
             <div 
               className="absolute top-0 bottom-[-2000px] w-[2px] bg-cyan shadow-[0_0_10px_#00F0FF] z-50 pointer-events-none transition-transform will-change-transform"
               style={{ transform: `translateX(${currentTime * PxPerSec}px)` }}
             >
                <div className="absolute -top-1 -left-1.5 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-cyan"></div>
             </div>

             {Array.from({ length: Math.ceil(projectDuration / 10) + 1 }).map((_, i) => {
                const totalSecs = i * 10;
                const mins = Math.floor(totalSecs / 60);
                const secs = totalSecs % 60;
                const label = `${mins}:${secs.toString().padStart(2, '0')}`;
                return (
                  <div key={i} className="absolute top-0 bottom-0 pl-1 pt-1 text-[10px] pointer-events-none" style={{ left: `${totalSecs * PxPerSec}px` }}>
                     {label}
                  </div>
                );
             })}
           </div>
        </div>

        {/* Tracks Container */}
        <div className="flex flex-col relative w-max" style={{ minWidth: `${timelineWidth + 220}px` }}>
           
           {/* Razor Overlay */}
           {isRazorMode && (
             <div 
                className="absolute inset-0 z-50 cursor-crosshair touch-none"
                onPointerDown={(e) => {
                   const rect = e.currentTarget.getBoundingClientRect();
                   setSliceX(e.clientX - rect.left);
                   setSliceStartY(e.clientY - rect.top);
                   setSliceCurrentY(e.clientY - rect.top);
                   setIsSlicing(true);
                   e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                   if (!isSlicing) return;
                   const rect = e.currentTarget.getBoundingClientRect();
                   setSliceCurrentY(e.clientY - rect.top);
                }}
                onPointerUp={(e) => {
                   if (!isSlicing) return;
                   setIsSlicing(false);
                   e.currentTarget.releasePointerCapture(e.pointerId);
                   
                   let splitTime = (sliceX - 220) / PxPerSec;
                   if (isSnapEnabled) splitTime = Math.round(splitTime);
                   
                   const minY = Math.min(sliceStartY, sliceCurrentY);
                   const maxY = Math.max(sliceStartY, sliceCurrentY);
                   
                   // Math: Ruler height = 32px. Track height = 96px.
                   tracks.forEach((track: TrackType, index: number) => {
                      const trackTop = 32 + (index * 96);
                      const trackBottom = trackTop + 96;
                      
                      // Check if slice line passed through this track vertically
                      if (maxY >= trackTop - 10 && minY <= trackBottom + 10) {
                          const blocksToSplit = blocks.filter((b: BlockType) => b.track_id === track.id && b.start_time < splitTime && b.end_time > splitTime);
                          blocksToSplit.forEach((b: BlockType) => splitBlock(b.id, splitTime));
                      }
                   });
                }}
             >
                {isSlicing && (
                    <div 
                       className="absolute w-[2px] bg-red-500 shadow-[0_0_10px_rgba(255,0,0,1)] z-50 pointer-events-none before:content-[''] before:absolute before:-top-2 before:-left-1.5 before:w-3 before:h-3 before:border-2 before:border-red-500 before:bg-black before:rounded-full"
                       style={{ 
                          left: sliceX - 1, 
                          top: Math.min(sliceStartY, sliceCurrentY), 
                          height: Math.max(2, Math.abs(sliceCurrentY - sliceStartY))
                       }} 
                    />
                )}
             </div>
           )}

           {tracks.map((track: TrackType) => (
             <TrackLane key={track.id} track={track}>
               {blocks
                 .filter((b: BlockType) => b.track_id === track.id)
                 .map((block: BlockType) => (
                   <Block key={block.id} block={block} />
                 ))
               }
             </TrackLane>
           ))}
           
           {/* Add Track Button Space */}
           <div className="flex h-24 w-max min-w-full border-b border-border/30 bg-transparent">
             <div className="sticky left-0 top-0 bottom-0 w-[220px] bg-panel border-r border-border p-4 flex items-center justify-center z-20 shrink-0">
                <button 
                  onClick={() => useStudioStore.getState().addTrack({ name: 'NEW TRACK', type: 'guide', color: 'bg-border/30 text-white' })}
                  className="w-full h-10 border border-dashed border-text-muted/50 rounded flex items-center justify-center gap-2 text-xs font-semibold text-text-muted hover:text-white hover:border-white/50 hover:bg-white/5 transition-all"
                >
                  + ADD TRACK
                </button>
             </div>
             <div className="flex-1 opacity-30" style={timelineBgStyle}></div>
           </div>
        </div>
      </div>
    </div>
  );
}