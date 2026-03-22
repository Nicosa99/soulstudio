"use client";

import { useEffect, useRef, useState } from "react";

interface WaveformCanvasProps {
  fileUrl: string;
  colorHex: string;
  trimStart: number;
  duration: number;
}

// Global cache
const cache = new Map<string, { peaks: number[], durationSecs: number }>();

export function WaveformCanvas({ fileUrl, colorHex, trimStart, duration }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioData, setAudioData] = useState<{ peaks: number[], durationSecs: number } | null>(cache.get(fileUrl) || null);

  useEffect(() => {
    if (cache.has(fileUrl)) return;

    let isMounted = true;
    const fetchAndDecode = async () => {
      try {
        const res = await fetch(fileUrl);
        const arrayBuffer = await res.arrayBuffer();
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtor();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0);
        // High density sampling
        const samples = 3000;
        const blockSize = Math.floor(rawData.length / samples);
        const newPeaks = [];

        for (let i = 0; i < samples; i++) {
          let max = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            const val = Math.abs(rawData[start + j]);
            if (val > max) max = val;
          }
          newPeaks.push(max);
        }

        const data = { peaks: newPeaks, durationSecs: audioBuffer.duration };
        
        if (isMounted) {
          cache.set(fileUrl, data);
          setAudioData(data);
        }
      } catch (err) {
        console.error("Failed to decode waveform", err);
      }
    };

    fetchAndDecode();
    return () => { isMounted = false; };
  }, [fileUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioData) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colorHex;
    
    const centerY = height / 2;
    
    // Calculate the array slice bounds for the current visible frame
    const { peaks, durationSecs } = audioData;
    const peakFramesPerSec = peaks.length / durationSecs;
    const startIndex = Math.floor(trimStart * peakFramesPerSec);
    const endIndex = Math.min(peaks.length, Math.floor((trimStart + duration) * peakFramesPerSec));
    const renderPeaks = peaks.slice(startIndex, endIndex);

    if (renderPeaks.length === 0) return;

    const step = width / renderPeaks.length;
    
    ctx.beginPath();
    for (let i = 0; i < renderPeaks.length; i++) {
       const x = i * step;
       const peakHeight = Math.max(1, (renderPeaks[i] * height) / 2); 
       
       ctx.globalAlpha = 0.5;
       ctx.fillRect(x, centerY - peakHeight, Math.max(0.5, step - 0.2), peakHeight * 2);
    }
  }, [audioData, colorHex, trimStart, duration]);

  return (
    <canvas 
      ref={canvasRef}
      className="absolute inset-x-0 bottom-0 top-0 h-full w-full pointer-events-none mix-blend-screen opacity-60 z-10"
    />
  );
}
