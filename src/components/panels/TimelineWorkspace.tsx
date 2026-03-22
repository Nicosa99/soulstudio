"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { TrackLane } from "@/components/timeline/TrackLane";
import { Block } from "@/components/timeline/Block";
import { useEffect, useRef, useState } from "react";
import { instance as AudioEngine } from "@/lib/audio/AudioEngine";

export function TimelineWorkspace() {
  const { tracks, blocks, isRazorMode, setRazorMode, isPlaying, currentTime, setCurrentTime, masterTuning, activeSelection, splitBlock, setActiveSelection, zoomLevel, isSnapEnabled } = useStudioStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const PxPerSec = 10 * zoomLevel;
  const [isSlicing, setIsSlicing] = useState(false);
  const [sliceX, setSliceX] = useState(0);
  const [sliceStartY, setSliceStartY] = useState(0);
  const [sliceCurrentY, setSliceCurrentY] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const animatePlayhead = () => {
      if (isPlaying && AudioEngine) {
        setCurrentTime(AudioEngine.getCurrentTime());
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
    if (isPlaying && AudioEngine) {
      AudioEngine.updateBlockProperties(useStudioStore.getState().getComputedBlocks(), masterTuning);
    }
  }, [blocks, tracks, masterTuning, isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        setRazorMode(true);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
        
        const selectedId = useStudioStore.getState().activeSelection;
        if (selectedId) {
          useStudioStore.getState().removeBlock(selectedId);
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
    const el = timelineRef.current;
    if (!el) return;
    
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
        const currentZoom = useStudioStore.getState().zoomLevel;
        let newZoom = currentZoom + zoomDelta;
        newZoom = Math.max(0.1, Math.min(newZoom, 5.0));
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
    if (isPlaying && AudioEngine) {
      AudioEngine.stop();
      AudioEngine.playSequencer(useStudioStore.getState().getComputedBlocks(), newTime);
    }
  };

  return (
    <div 
      className={`flex h-full flex-col relative overflow-hidden bg-bg-deep ${isRazorMode ? 'cursor-crosshair' : ''}`}
      ref={timelineRef}
      onClick={handleTimelineClick}
    >
      <div className="flex-1 overflow-auto w-full relative">
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
             className="relative flex-1 min-w-[2000px] flex items-center cursor-text hover:bg-black/30 transition-colors"
             style={timelineBgStyle}
             onClick={handleRulerClick}
           >
             {/* Playhead Vertical Line */}
             <div 
               className="absolute top-0 bottom-[-2000px] w-[2px] bg-cyan shadow-[0_0_10px_#00F0FF] z-50 pointer-events-none transition-transform will-change-transform"
               style={{ transform: `translateX(${currentTime * PxPerSec}px)` }}
             >
                <div className="absolute -top-1 -left-1.5 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-cyan"></div>
             </div>

             {Array.from({ length: 200 }).map((_, i) => {
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
        <div className="flex flex-col relative w-max min-w-full">
           
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
                   tracks.forEach((track: any, index: number) => {
                      const trackTop = 32 + (index * 96);
                      const trackBottom = trackTop + 96;
                      
                      // Check if slice line passed through this track vertically
                      if (maxY >= trackTop - 10 && minY <= trackBottom + 10) {
                          const blocksToSplit = blocks.filter((b: any) => b.track_id === track.id && b.start_time < splitTime && b.end_time > splitTime);
                          blocksToSplit.forEach((b: any) => splitBlock(b.id, splitTime));
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

           {tracks.map((track: any) => (
             <TrackLane key={track.id} track={track}>
               {blocks
                 .filter((b: any) => b.track_id === track.id)
                 .map((block: any) => (
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
