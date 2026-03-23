"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { StudioSidebar } from "@/components/panels/StudioSidebar";
import { TimelineWorkspace } from "@/components/panels/TimelineWorkspace";
import { ContextInspector } from "@/components/panels/ContextInspector";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, KeyboardSensor } from "@dnd-kit/core";
import { useStudioStore, Block as BlockModel } from "@/store/useStudioStore";
import { AutoSaveManager } from "@/components/studio/AutoSaveManager";
import { createClient } from "@/utils/supabase/client";
import { Activity, Loader2 } from "lucide-react";

export default function StudioPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const { addBlock, moveBlock, blocks, initializeProject, setSubscriptionStatus, zoomLevel, isSnapEnabled } = useStudioStore();
  
  const PxPerSec = 10 * zoomLevel;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadProjectAndSubscription() {
      try {
        // Parallel fetch for project and subscription
        const [projectRes, subRes] = await Promise.all([
          supabase.from("projects").select("*").eq("id", projectId).single(),
          supabase.from("subscriptions").select("status").single()
        ]);

        if (projectRes.error) throw projectRes.error;
        if (!projectRes.data) throw new Error("Project not found");

        // Set Subscription Status (fallback to 'free')
        if (subRes.data) {
          setSubscriptionStatus(subRes.data.status as any);
        } else {
          setSubscriptionStatus('free');
        }

        // Initialize store with saved state
        const state = projectRes.data.state_json || { tracks: [], blocks: [] };
        initializeProject(state);
      } catch (err: any) {
        console.error("Error loading studio data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (projectId) loadProjectAndSubscription();
  }, [projectId, initializeProject, setSubscriptionStatus, supabase]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveData(null);
    const { active, over, delta } = event;
    if (!over) return;

    const isOverTrack = over.data.current?.isTrack;
    const trackId = over.id as string;

    if (active.data.current?.isAsset && isOverTrack) {
      const assetData = active.data.current;
      const xOffset = Math.max(0, delta.x); 
      let startTime = xOffset / PxPerSec;
      if (isSnapEnabled) startTime = Math.round(startTime);

      addBlock({
        track_id: trackId,
        asset_id: assetData.assetId,
        label: assetData.label,
        type: assetData.type,
        start_time: startTime,
        end_time: startTime + assetData.defaultDuration,
        properties: assetData.properties
      });
    } else if (active.data.current?.isBlock) {
      const blockId = active.id as string;
      const block = blocks.find(b => b.id === blockId);
      if (block) {
        const timeDelta = delta.x / PxPerSec;
        let newStartTime = Math.max(0, block.start_time + timeDelta);
        if (isSnapEnabled) newStartTime = Math.round(newStartTime);
        const newTrackId = isOverTrack ? trackId : block.track_id;
        moveBlock(blockId, newStartTime, newTrackId);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05080F] flex flex-col items-center justify-center gap-6">
        <Activity className="w-12 h-12 text-[#00F0FF] animate-pulse" />
        <div className="flex items-center gap-3 text-white font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF]" />
          Loading Project Data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#05080F] flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Activity className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Project Unavailable</h2>
        <p className="text-slate-400 max-w-md">{error}</p>
        <button onClick={() => router.push("/studio")} className="bg-white/10 text-white px-8 py-3 rounded-full hover:bg-white/20 transition-all">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <DndContext id="dnd-workspace" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <AutoSaveManager projectId={projectId} />
      
      <StudioLayout
        assetLibrary={<StudioSidebar />}
        timeline={<TimelineWorkspace />}
        inspector={<ContextInspector />}
      />

      <DragOverlay dropAnimation={null}>
        {activeId && activeData?.isAsset ? (
          <div className="rounded-md border border-cyan bg-cyan-dim/20 p-3 text-sm text-cyan shadow-[0_0_15px_var(--color-border-glow)] opacity-90 blur-0 max-w-[220px]">
            {activeData.label}
          </div>
        ) : activeId && activeData?.isBlock ? (
          <div className="rounded-md border border-cyan bg-cyan-dim/20 p-2 text-xs font-medium text-cyan shadow-[0_0_15px_var(--color-border-glow)] opacity-90 blur-0">
             Moving Block...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}