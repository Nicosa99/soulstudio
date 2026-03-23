"use client";

import { Settings2, Volume2, Activity, Zap, Layers } from "lucide-react";
import { useStudioStore, Block } from "@/store/useStudioStore";

// ─── Shared slider + number input ────────────────────────────────────────────
function ParamRow({
  label, icon, value, min, max, step = 1, unit, accentClass,
  onChange,
}: {
  label: string;
  icon?: React.ReactNode;
  value: number;
  min: number; max: number; step?: number;
  unit?: string;
  accentClass: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <label className={`text-xs font-semibold text-text-muted flex items-center gap-2`}>
        {icon} {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={`flex-1 ${accentClass} h-1 bg-border rounded-full appearance-none outline-none`}
        />
        <div className="relative w-16 shrink-0">
          <input
            type="number" min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || min)}
            className={`w-full bg-black/50 border border-border rounded text-center text-xs p-1 outline-none focus:border-cyan text-cyan font-mono text-left pl-2 ${unit ? 'pr-5' : 'pr-2'}`}
          />
          {unit && <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-text font-medium">{label}</label>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full relative transition-colors ${value ? 'bg-cyan' : 'bg-border'}`}
      >
        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${value ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

// ─── Single-block panels ──────────────────────────────────────────────────────
function EntrainmentPanel({ block, onProp }: { block: Block; onProp: (k: string, v: any) => void }) {
  return (
    <div className="space-y-6">
      <ParamRow label="CARRIER BASE" icon={<Activity size={14} className="text-cyan" />}
        value={block.properties.baseFrequency ?? 136.1} min={50} max={300} step={0.1} unit="Hz"
        accentClass="accent-cyan" onChange={(v) => onProp('baseFrequency', v)} />
      <ParamRow label="TARGET STATE" icon={<Activity size={14} className="text-cyan" />}
        value={block.properties.targetStateHz ?? 4} min={0.5} max={40} step={0.5} unit="Hz"
        accentClass="accent-cyan" onChange={(v) => onProp('targetStateHz', v)} />
      <ParamRow label="HARMONIZER" icon={<Zap size={14} className="text-cyan" />}
        value={block.properties.harmonizerLevel ?? 0} min={0} max={100} unit="%"
        accentClass="accent-cyan" onChange={(v) => onProp('harmonizerLevel', v)} />
      <ParamRow label="VOLUME" icon={<Volume2 size={14} className="text-cyan" />}
        value={block.properties.volume ?? 50} min={0} max={100} unit="%"
        accentClass="accent-cyan" onChange={(v) => onProp('volume', v)} />
      <p className="text-[10px] text-text-muted leading-relaxed">
        * Sets the binaural offset to induce the target brainwave state.
      </p>
    </div>
  );
}

function CarrierPanel({ block, onProp, onBlock }: { block: Block; onProp: (k: string, v: any) => void; onBlock: (k: string, v: any) => void }) {
  const freq = block.properties.baseFrequency ?? block.properties.frequency ?? 100;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
          <Activity size={14} className="text-violet" /> FREQUENCY
        </label>
        <div className="flex items-center gap-3">
          <input type="range" min={50} max={1000} value={freq}
            onChange={(e) => { const v = parseInt(e.target.value); onBlock('label', `${v}Hz Carrier`); onProp('baseFrequency', v); }}
            className="flex-1 accent-violet h-1 bg-border rounded-full appearance-none outline-none" />
          <div className="relative w-16 shrink-0">
            <input type="number" min={50} max={1000} value={freq}
              onChange={(e) => { const v = parseInt(e.target.value) || 50; onBlock('label', `${v}Hz Carrier`); onProp('baseFrequency', v); }}
              className="w-full bg-black/50 border border-border rounded text-xs p-1 outline-none focus:border-violet text-violet font-mono pl-2 pr-5" />
            <span className="absolute right-1.5 top-1.5 text-[9px] text-text-muted font-mono pointer-events-none">Hz</span>
          </div>
        </div>
      </div>
      <ParamRow label="HARMONIZER" icon={<Zap size={14} className="text-violet" />}
        value={block.properties.harmonizerLevel ?? 0} min={0} max={100} unit="%"
        accentClass="accent-violet" onChange={(v) => onProp('harmonizerLevel', v)} />
      <ParamRow label="VOLUME" icon={<Volume2 size={14} className="text-violet" />}
        value={block.properties.volume ?? 50} min={0} max={100} unit="%"
        accentClass="accent-violet" onChange={(v) => onProp('volume', v)} />
      <div className="space-y-2">
        <label className="text-xs font-semibold text-text-muted">WAVEFORM</label>
        <select value={block.properties.waveform ?? 'sine'} onChange={(e) => onProp('waveform', e.target.value)}
          className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-violet text-text">
          <option value="sine">Sine</option>
          <option value="triangle">Triangle</option>
          <option value="square">Square</option>
        </select>
      </div>
    </div>
  );
}

function AudioPanel({ block, onProp }: { block: Block; onProp: (k: string, v: any) => void }) {
  return (
    <div className="space-y-6">
      <ParamRow label="VOLUME" icon={<Volume2 size={14} className="text-cyan" />}
        value={block.properties.volume ?? 80} min={0} max={100} unit="%"
        accentClass="accent-cyan" onChange={(v) => onProp('volume', v)} />
      <ToggleRow label="AUTO-DUCKING" value={!!block.properties.ducking} onChange={(v) => onProp('ducking', v)} />
      <ToggleRow label="SUBLIMINAL MODE" value={!!block.properties.subliminal} onChange={(v) => onProp('subliminal', v)} />
    </div>
  );
}

function AtmospherePanel({ block, onProp }: { block: Block; onProp: (k: string, v: any) => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-text-muted">ATMOSPHERE TYPE</label>
        <select value={block.properties.atmosphereType ?? 'brownNoise'} onChange={(e) => onProp('atmosphereType', e.target.value)}
          className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-cyan text-text">
          <option value="pinkNoise">Pink Noise</option>
          <option value="brownNoise">Brown Noise</option>
          <option value="rain">Rain</option>
        </select>
      </div>
      <ParamRow label="VOLUME" icon={<Volume2 size={14} className="text-cyan" />}
        value={block.properties.volume ?? 50} min={0} max={100} unit="%"
        accentClass="accent-cyan" onChange={(v) => onProp('volume', v)} />
    </div>
  );
}

// ─── Multi-select panel ────────────────────────────────────────────────────────
function MultiSelectPanel({ blocks, onAll }: { blocks: Block[]; onAll: (k: string, v: any) => void }) {
  const types = [...new Set(blocks.map(b => b.type))];
  const allEntrainment = types.length === 1 && types[0] === 'entrainment';
  const allCarrier = types.length === 1 && types[0] === 'carrier';
  const ref = blocks[0]; // Use first block as reference value

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan/5 border border-cyan/20">
        <Layers size={14} className="text-cyan shrink-0" />
        <p className="text-[11px] text-cyan font-bold uppercase tracking-widest">
          {blocks.length} blocks selected
        </p>
      </div>

      {(allEntrainment || allCarrier) && (
        <>
          {allEntrainment && (
            <>
              <ParamRow label="CARRIER BASE" icon={<Activity size={14} className="text-cyan" />}
                value={ref.properties.baseFrequency ?? 136.1} min={50} max={300} step={0.1} unit="Hz"
                accentClass="accent-cyan" onChange={(v) => onAll('baseFrequency', v)} />
              <ParamRow label="TARGET STATE" icon={<Activity size={14} className="text-cyan" />}
                value={ref.properties.targetStateHz ?? 4} min={0.5} max={40} step={0.5} unit="Hz"
                accentClass="accent-cyan" onChange={(v) => onAll('targetStateHz', v)} />
            </>
          )}
          {allCarrier && (
            <ParamRow label="FREQUENCY" icon={<Activity size={14} className="text-violet" />}
              value={ref.properties.baseFrequency ?? 100} min={50} max={1000} step={1} unit="Hz"
              accentClass="accent-violet" onChange={(v) => onAll('baseFrequency', v)} />
          )}
          <ParamRow label="HARMONIZER" icon={<Zap size={14} className={allCarrier ? "text-violet" : "text-cyan"} />}
            value={ref.properties.harmonizerLevel ?? 0} min={0} max={100} unit="%"
            accentClass={allCarrier ? "accent-violet" : "accent-cyan"} onChange={(v) => onAll('harmonizerLevel', v)} />
        </>
      )}

      <ParamRow label="VOLUME" icon={<Volume2 size={14} className="text-cyan" />}
        value={ref.properties.volume ?? 50} min={0} max={100} unit="%"
        accentClass="accent-cyan" onChange={(v) => onAll('volume', v)} />

      <p className="text-[10px] text-text-muted leading-relaxed">
        Changes apply to all {blocks.length} selected blocks.
      </p>
    </div>
  );
}

// ─── Main Inspector ────────────────────────────────────────────────────────────
export function ContextInspector() {
  const { activeSelection, selectedBlocks, blocks, updateBlock, updateBlocks } = useStudioStore();

  const activeBlock = blocks.find(b => b.id === activeSelection);
  const multiBlocks = selectedBlocks.length > 1
    ? blocks.filter(b => selectedBlocks.includes(b.id))
    : null;

  const onProp = (key: string, value: any) => {
    if (!activeBlock) return;
    updateBlock(activeBlock.id, { properties: { ...activeBlock.properties, [key]: value } });
  };

  const onBlock = (key: string, value: any) => {
    if (!activeBlock) return;
    updateBlock(activeBlock.id, { [key]: value } as any);
  };

  const onAll = (key: string, value: any) => {
    if (!multiBlocks) return;
    updateBlocks(multiBlocks.map(b => b.id), { [key]: value });
  };

  // Empty state
  if (!activeBlock && !multiBlocks) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Settings2 size={18} className="text-cyan" />
          <h2 className="text-sm font-semibold tracking-wide text-text">AUDIO INSPECTOR</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-text-muted">
          <Settings2 size={32} className="mb-4 opacity-50" />
          <p className="text-sm">Select a block on the timeline to edit its properties.</p>
          <p className="text-xs mt-2 opacity-60">Hold Shift to select multiple blocks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Settings2 size={18} className="text-cyan" />
        <h2 className="text-sm font-semibold tracking-wide text-text uppercase">AUDIO INSPECTOR</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {multiBlocks ? (
          <MultiSelectPanel blocks={multiBlocks} onAll={onAll} />
        ) : activeBlock ? (
          <>
            {/* Block identity */}
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">{activeBlock.label}</h3>
                <p className="text-xs text-text-muted font-mono bg-black/50 p-1 px-2 rounded w-fit border border-border">
                  {activeBlock.type.toUpperCase()} · {activeBlock.id.slice(0, 8)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-muted flex items-center gap-2">
                  DURATION (s) <span className="ml-auto font-mono text-text">{Math.round(activeBlock.end_time - activeBlock.start_time)}s</span>
                </label>
                <input
                  type="number" min="1" max="7200"
                  value={Math.round(activeBlock.end_time - activeBlock.start_time)}
                  onChange={(e) => {
                    const newDur = Math.max(1, parseInt(e.target.value || '1'));
                    updateBlock(activeBlock.id, { end_time: activeBlock.start_time + newDur });
                  }}
                  className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-cyan text-text"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-semibold text-text-muted">FADE IN (s)</label>
                  <input type="number" min="0" max="7200" step="0.1"
                    value={activeBlock.properties.fade_in ?? 0}
                    onChange={(e) => onProp('fade_in', parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-cyan text-text" />
                </div>
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-semibold text-text-muted">FADE OUT (s)</label>
                  <input type="number" min="0" max="7200" step="0.1"
                    value={activeBlock.properties.fade_out ?? 0}
                    onChange={(e) => onProp('fade_out', parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/50 border border-border rounded p-2 text-sm outline-none focus:border-cyan text-text" />
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-cyan/20 to-transparent" />

            {activeBlock.type === 'entrainment' && <EntrainmentPanel block={activeBlock} onProp={onProp} />}
            {activeBlock.type === 'carrier' && <CarrierPanel block={activeBlock} onProp={onProp} onBlock={onBlock} />}
            {(activeBlock.type === 'voice' || activeBlock.type === 'guide') && <AudioPanel block={activeBlock} onProp={onProp} />}
            {activeBlock.type === 'atmosphere' && <AtmospherePanel block={activeBlock} onProp={onProp} />}
          </>
        ) : null}
      </div>
    </div>
  );
}
