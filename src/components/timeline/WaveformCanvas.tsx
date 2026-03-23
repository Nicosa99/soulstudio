"use client";

import { useEffect, useRef, useState } from "react";

interface WaveformCanvasProps {
  fileUrl: string;
  color: string;
  width: number;
  height: number;
}

export function WaveformCanvas({ fileUrl, color, width, height }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!fileUrl || fileUrl === "" || fileUrl.startsWith('http://fake')) {
      setPeaks(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    async function loadAndProcessAudio() {
      let audioCtx: AudioContext | null = null;
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        
        // FAIL-SAFE DECODING
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer).catch(err => {
          console.warn("Decoding failed for:", fileUrl, err);
          return null;
        });
        
        if (!isMounted || !audioBuffer) {
          if (isMounted) {
            setPeaks(null);
            setIsLoading(false);
          }
          return;
        }

        const channelData = audioBuffer.getChannelData(0);
        const sampleCount = Math.min(Math.floor(width / 2), 1000); 
        const step = Math.floor(channelData.length / sampleCount);
        const result = [];

        for (let i = 0; i < sampleCount; i++) {
          let max = 0;
          for (let j = 0; j < step; j++) {
            const datum = Math.abs(channelData[i * step + j]);
            if (datum > max) max = datum;
          }
          result.push(max);
        }

        setPeaks(result);
        setIsLoading(false);
      } catch (err) {
        console.warn("Waveform processing failed (Safe Catch):", fileUrl);
        if (isMounted) {
          setPeaks(null);
          setIsLoading(false);
        }
      } finally {
        if (audioCtx) audioCtx.close();
      }
    }

    loadAndProcessAudio();
    return () => { isMounted = false; };
  }, [fileUrl, width]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    
    // If no peaks (error or empty), draw a subtle flat baseline
    if (!peaks || peaks.length === 0) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const barWidth = width / peaks.length;
    const centerY = height / 2;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;

    peaks.forEach((peak, i) => {
      const x = i * barWidth;
      const barHeight = Math.max(1, peak * height * 0.9);
      const y = centerY - barHeight / 2;
      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight);
    });
  }, [peaks, width, height, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="absolute inset-0 pointer-events-none z-0"
      style={{ opacity: isLoading ? 0.2 : 1 }}
    />
  );
}