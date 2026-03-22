import { create } from 'zustand';

export type TrackType = 'carrier' | 'entrainment' | 'guide' | 'atmosphere';
export type BlockType = 'voice' | 'entrainment' | 'atmosphere' | 'carrier' | 'guide';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  isMuted?: boolean;
  isSolo?: boolean;
  volume?: number; // 0.0 to 1.0
  pan?: number;    // -1.0 to 1.0
}

export interface Block {
  id: string;
  track_id: string;
  asset_id: string;
  label: string;
  type: BlockType;
  start_time: number; // in seconds
  end_time: number;   // in seconds
  properties: Record<string, any>;
}

export interface StudioState {
  tracks: Track[];
  blocks: Block[];
  userUploads: any[];
  activeSelection: string | null;
  isRazorMode: boolean;
  isPlaying: boolean;
  currentTime: number;
  masterTuning: number;
  bpm: number;
  zoomLevel: number;
  isSnapEnabled: boolean;
  saveStatus: SaveStatus;
  isExporting: boolean;
  exportProgress: number;

  // Actions
  initializeProject: (data: { tracks: Track[], blocks: Block[] }) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setExportStatus: (isExporting: boolean, progress: number) => void;
  getComputedBlocks: () => Block[];
  addUpload: (file: any) => void;
  addTrack: (track: Omit<Track, 'id'> & { id?: string }) => void;
  removeTrack: (id: string) => void;
  renameTrack: (id: string, name: string) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  setTrackVolume: (id: string, volume: number) => void;
  setTrackPan: (id: string, pan: number) => void;
  addBlock: (block: Omit<Block, 'id'>) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  setActiveSelection: (id: string | null) => void;
  moveBlock: (id: string, start_time: number, track_id: string) => void;
  splitBlock: (id: string, time: number) => void;
  setRazorMode: (active: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setMasterTuning: (freq: number) => void;
  setBpm: (bpm: number) => void;
  setZoomLevel: (zoom: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
}

const INITIAL_TRACKS: Track[] = [
  { id: 'track-carrier', name: 'CARRIER MATRIX', type: 'carrier', color: 'bg-track-carrier text-track-carrier', isMuted: false, isSolo: false },
  { id: 'track-entrainment', name: 'NEURAL ENTRAINMENT', type: 'entrainment', color: 'bg-track-entrainment text-track-entrainment', isMuted: false, isSolo: false },
  { id: 'track-guide', name: 'THE GUIDE', type: 'guide', color: 'bg-track-guide text-track-guide', isMuted: false, isSolo: false },
  { id: 'track-atmosphere', name: 'ATMOSPHERICS', type: 'atmosphere', color: 'bg-track-atmo text-track-atmo', isMuted: false, isSolo: false },
];

export const useStudioStore = create<StudioState>((set, get) => ({
  tracks: INITIAL_TRACKS,
  blocks: [],
  userUploads: [],
  activeSelection: null,
  isRazorMode: false,
  isPlaying: false,
  currentTime: 0,
  masterTuning: 432,
  bpm: 60,
  zoomLevel: 1,
  isSnapEnabled: true,
  saveStatus: 'saved',
  isExporting: false,
  exportProgress: 0,

  initializeProject: (data) => set({ 
    tracks: data.tracks && data.tracks.length > 0 ? data.tracks : INITIAL_TRACKS, 
    blocks: data.blocks || [],
    saveStatus: 'saved' 
  }),

  setExportStatus: (isExporting, exportProgress = 0) => set({ isExporting, exportProgress }),

  getComputedBlocks: () => {
    const state = get();
    const isAnySolo = state.tracks.some((t: Track) => t.isSolo);
    return state.blocks.map((b: Block) => {
       const track = state.tracks.find((t: Track) => t.id === b.track_id);
       let targetVol = b.properties.volume ?? (b.type === 'atmosphere' || b.type === 'entrainment' || b.type === 'carrier' ? 50 : 80);
       if (track && (track.isMuted || (isAnySolo && !track.isSolo))) {
          targetVol = 0;
       }
       return { ...b, properties: { ...b.properties, volume: targetVol } };
    });
  },

  setSaveStatus: (status) => set({ saveStatus: status }),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  stop: () => set({ isPlaying: false, currentTime: 0 }),
  seek: (seconds) => set((state) => ({ currentTime: Math.max(0, state.currentTime + seconds) })),
  setMasterTuning: (freq) => set((state) => ({ masterTuning: Math.max(400, Math.min(440, freq)), saveStatus: 'unsaved' })),
  setBpm: (bpm) => set((state) => ({ bpm: Math.max(30, Math.min(200, bpm)), saveStatus: 'unsaved' })),
  setZoomLevel: (zoom) => set({ zoomLevel: Math.max(0.1, Math.min(5, zoom)) }),
  setSnapEnabled: (enabled) => set({ isSnapEnabled: enabled }),

  addBlock: (blockData) => set((state) => ({
    blocks: [...state.blocks, { ...blockData, id: crypto.randomUUID() }],
    saveStatus: 'unsaved'
  })),

  addUpload: (file) => set((state) => ({ userUploads: [...state.userUploads, file] })),
  addTrack: (track) => set((state) => ({ 
    tracks: [...state.tracks, { ...track, id: track.id || crypto.randomUUID() } as Track],
    saveStatus: 'unsaved'
  })),
  removeTrack: (id) => set((state) => ({ 
    tracks: state.tracks.filter(t => t.id !== id),
    blocks: state.blocks.filter(b => b.track_id !== id),
    saveStatus: 'unsaved'
  })),
  renameTrack: (id, name) => set((state) => ({
    tracks: state.tracks.map(t => t.id === id ? { ...t, name } : t),
    saveStatus: 'unsaved'
  })),
  toggleMute: (id) => set((state) => ({
    tracks: state.tracks.map(t => t.id === id ? { ...t, isMuted: !t.isMuted } : t),
    saveStatus: 'unsaved'
  })),
  toggleSolo: (id) => set((state) => ({
    tracks: state.tracks.map(t => t.id === id ? { ...t, isSolo: !t.isSolo } : t),
    saveStatus: 'unsaved'
  })),
  setTrackVolume: (id, volume) => set((state) => ({
    tracks: state.tracks.map(t => t.id === id ? { ...t, volume: Math.max(0, Math.min(1, volume)) } : t),
    saveStatus: 'unsaved'
  })),
  setTrackPan: (id, pan) => set((state) => ({
    tracks: state.tracks.map(t => t.id === id ? { ...t, pan: Math.max(-1, Math.min(1, pan)) } : t),
    saveStatus: 'unsaved'
  })),

  removeBlock: (id) => set((state) => ({
    blocks: state.blocks.filter(b => b.id !== id),
    activeSelection: state.activeSelection === id ? null : state.activeSelection,
    saveStatus: 'unsaved'
  })),

  updateBlock: (id, updates) => set((state) => ({
    blocks: state.blocks.map(b => b.id === id ? { ...b, ...updates } : b),
    saveStatus: 'unsaved'
  })),

  setActiveSelection: (id) => set({ activeSelection: id }),

  moveBlock: (id, newStartTime, newTrackId) => set((state) => {
    return {
      blocks: state.blocks.map(b => {
        if (b.id !== id) return b;
        const duration = b.end_time - b.start_time;
        return {
          ...b,
          start_time: newStartTime,
          end_time: newStartTime + duration,
          ...(newTrackId ? { track_id: newTrackId } : {})
        };
      }),
      saveStatus: 'unsaved'
    };
  }),

  splitBlock: (id, splitTime) => set((state) => {
    const block = state.blocks.find(b => b.id === id);
    if (!block || splitTime <= block.start_time || splitTime >= block.end_time) return state;

    const currentTrim = block.properties.trimStart || 0;
    const splitOffset = splitTime - block.start_time;

    const block1: Block = { ...block, end_time: splitTime };
    const block2: Block = { 
       ...block, 
       id: crypto.randomUUID(), 
       start_time: splitTime,
       properties: { ...block.properties, trimStart: currentTrim + splitOffset }
    };

    return {
      blocks: [...state.blocks.filter(b => b.id !== id), block1, block2],
      saveStatus: 'unsaved'
    };
  }),

  setRazorMode: (isRazor) => set({ isRazorMode: isRazor }),
}));
