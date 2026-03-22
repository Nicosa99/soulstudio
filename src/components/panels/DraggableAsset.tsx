"use client";

import { useDraggable } from "@dnd-kit/core";
import { ReactNode } from "react";
import { BlockType } from "@/store/useStudioStore";

interface DraggableAssetProps {
  id: string; // The asset ID
  label: string;
  type: BlockType;
  colorClass: string;
  defaultDuration: number;
  properties: Record<string, unknown>;
  children: ReactNode;
}

export function DraggableAsset({ 
  id, 
  label, 
  type, 
  colorClass, 
  defaultDuration, 
  properties, 
  children 
}: DraggableAssetProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${id}`,
    data: {
      isAsset: true,
      assetId: id,
      label,
      type,
      defaultDuration,
      properties
    }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-md border border-border bg-bg p-3 text-sm transition-colors cursor-grab active:cursor-grabbing ${colorClass} ${isDragging ? 'opacity-50 blur-sm' : ''}`}
    >
      {children}
    </div>
  );
}
