"use client";

import { useEffect, useRef } from "react";
import { instance as audio } from "@/lib/audio/AudioEngine";
import { useStudioStore } from "@/store/useStudioStore";

export function MasterVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isPlaying } = useStudioStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    const dataArray = new Uint8Array(1024); // fftSize is 2048, so bin count is 1024

    const draw = () => {
      animationFrame = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.fillStyle = '#02040A';
      ctx.fillRect(0, 0, width, height);
      
      if (!isPlaying) {
         // Draw flat line
         ctx.lineWidth = 1;
         ctx.strokeStyle = '#00F0FF';
         ctx.globalAlpha = 0.3;
         ctx.beginPath();
         ctx.moveTo(0, height / 2);
         ctx.lineTo(width, height / 2);
         ctx.stroke();
         return;
      }

      audio.getAnalyserData(dataArray);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#00F0FF';
      ctx.globalAlpha = 0.9;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#00F0FF';
      
      ctx.beginPath();

      const sliceWidth = width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0; 
        const y = v * height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    };

    draw();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isPlaying]);

  return (
    <div className="flex flex-col items-center justify-center p-1.5 bg-[#02040A] rounded-md border border-white/5 shadow-inner mx-4">
      <span className="text-[8px] text-text-dim uppercase tracking-[0.2em] mb-1 leading-none">Master Out</span>
      <canvas 
        ref={canvasRef} 
        width={120} 
        height={20} 
        className="block"
      />
    </div>
  );
}
