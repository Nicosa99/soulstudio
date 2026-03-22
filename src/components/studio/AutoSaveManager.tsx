"use client";

import { useEffect, useRef } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { createClient } from "@/utils/supabase/client";

interface AutoSaveManagerProps {
  projectId: string;
}

export function AutoSaveManager({ projectId }: AutoSaveManagerProps) {
  const { tracks, blocks, saveStatus, setSaveStatus } = useStudioStore();
  const supabase = createClient();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only save if status is 'unsaved'
    if (saveStatus !== 'unsaved') return;

    // Clear existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');

      try {
        const { error } = await supabase
          .from("projects")
          .update({
            state_json: { tracks, blocks },
            // Optional: update name if it changed
          })
          .eq("id", projectId);

        if (error) throw error;
        setSaveStatus('saved');
      } catch (err) {
        console.error("Failed to save project:", err);
        setSaveStatus('error');
      }
    }, 2000); // 2 second debounce

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [tracks, blocks, saveStatus, projectId, setSaveStatus, supabase]);

  return null; // Invisible component
}