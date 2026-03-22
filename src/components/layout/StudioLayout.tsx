"use client";

import { ReactNode } from "react";
import { TopBar } from "./TopBar";

interface StudioLayoutProps {
  assetLibrary: ReactNode;
  timeline: ReactNode;
  inspector: ReactNode;
}

export function StudioLayout({ assetLibrary, timeline, inspector }: StudioLayoutProps) {
  return (
    <div className="grid h-screen w-screen grid-rows-[48px_1fr] overflow-hidden bg-bg">
      <TopBar />
      <div className="grid h-full grid-cols-[322px_1fr_300px] overflow-hidden">
        {/* Left Pane: Dual-Pane Sidebar */}
        <div className="bg-panel text-text shadow-xl z-20">
          {assetLibrary}
        </div>

        {/* Center Pane: Timeline Workspace */}
        <div className="h-full w-full overflow-hidden bg-bg-deep relative">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.15]"></div>
          {timeline}
        </div>

        {/* Right Pane: Context Inspector */}
        <div className="border-l border-border bg-panel text-text shadow-[-4px_0_15px_rgba(0,0,0,0.5)] z-10">
          {inspector}
        </div>
      </div>
    </div>
  );
}
