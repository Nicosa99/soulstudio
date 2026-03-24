import { create } from 'zustand';
import { temporal } from 'zundo';

export type TrackType = 'carrier' | 'entrainment' | 'guide' | 'atmosphere';
export type BlockType = 'voice' | 'entrainment' | 'atmosphere' | 'carrier' | 'guide';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
export type SubscriptionStatus = 'free' | 'active' | 'canceled';

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  isMuted?: boolean;
  isSolo?: boolean;
  volume?: number;
  pan?: number;
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
  projectName: string;
  tracks: Track[];
  blocks: Block[];
  userUploads: any[];
  activeSelection: string | null;
  selectedBlocks: string[];
  clipboard: Block | null;
  isRazorMode: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  currentTime: number;
  masterTuning: number;
  bpm: number;
  saveStatus: SaveStatus;
  subscriptionStatus: SubscriptionStatus;
  zoomLevel: number;
  isSnapEnabled: boolean;
  isExporting: boolean;
  isConsoleOpen: boolean;
  activeConsoleModule: string | null;
  lastRecordingUrl: string | null;

  // Actions
  setProjectName: (name: string) => void;
  initializeProject: (data: { name?: string, tracks: Track[], blocks: Block[] }) => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  setSaveStatus: (status: SaveStatus) => void;
  addUpload: (file: any) => void;
  addTrack: (track: Omit<Track, 'id'> & { id?: string }) => string;
  removeTrack: (id: string) => void;
  duplicateTrack: (id: string) => void;
  renameTrack: (id: string, name: string) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  setTrackVolume: (id: string, vol: number) => void;
  setTrackPan: (id: string, pan: number) => void;
  addBlock: (block: Omit<Block, 'id'>) => void;
  removeBlock: (id: string) => void;
  removeBlocks: (ids: string[]) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  updateBlocks: (ids: string[], propertyUpdates: Record<string, any>) => void;
  setActiveSelection: (id: string | null) => void;
  setSelectedBlocks: (ids: string[]) => void;
  toggleBlockSelection: (id: string) => void;
  moveBlock: (id: string, start_time: number, track_id: string) => void;
  splitBlock: (id: string, time: number) => void;
  copyBlock: () => void;
  pasteBlock: () => void;
  setRazorMode: (active: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setRecording: (recording: boolean) => void;
  toggleRecording: () => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setMasterTuning: (freq: number) => void;
  setBpm: (bpm: number) => void;
  setZoomLevel: (level: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setExporting: (exporting: boolean) => void;
  setConsoleOpen: (open: boolean) => void;
  setActiveConsoleModule: (moduleId: string | null) => void;
  setLastRecordingUrl: (url: string | null) => void;
  getComputedBlocks: () => Block[];
  getProjectDuration: () => number;
}

const INITIAL_TRACKS: Track[] = [
  { id: 'track-carrier', name: 'CARRIER MATRIX', type: 'carrier', color: 'bg-track-carrier text-track-carrier', volume: 1.0, pan: 0.0 },
  { id: 'track-entrainment', name: 'NEURAL ENTRAINMENT', type: 'entrainment', color: 'bg-track-entrainment text-track-entrainment', volume: 1.0, pan: 0.0 },
  { id: 'track-guide', name: 'THE GUIDE', type: 'guide', color: 'bg-track-guide text-track-guide', volume: 1.0, pan: 0.0 },
  { id: 'track-atmosphere', name: 'ATMOSPHERICS', type: 'atmosphere', color: 'bg-track-atmo text-track-atmo', volume: 1.0, pan: 0.0 },
];

export const useStudioStore = create<StudioState>()(
  temporal(
    (set, get) => ({
      projectName: "Untitled Journey",
      tracks: INITIAL_TRACKS,
      blocks: [],
      userUploads: [],
      activeSelection: null,
      selectedBlocks: [],
      clipboard: null,
      isRazorMode: false,
      isPlaying: false,
      isRecording: false,
      currentTime: 0,
      masterTuning: 432,
      bpm: 60,
      saveStatus: 'saved',
      subscriptionStatus: 'free',
      zoomLevel: 1,
      isSnapEnabled: true,
      isExporting: false,
      isConsoleOpen: false,
      activeConsoleModule: null,
      lastRecordingUrl: null,

      setProjectName: (name) => set({ projectName: name, saveStatus: 'unsaved' }),

      initializeProject: (data: any) => set((state) => {
        let tracks = data.tracks || [];
        let blocks = data.blocks || [];
        const name = data.name || data.projectName || data.title || data.journey_id || state.projectName;

        // SMART PARSER V4: Handle Research Playbook Schema
        if (data.flow_logic && data.spectral_definitions) {
          console.log("Store: Parsing Research Schema V4...");
          
          const linearToDb = (linear: number) => {
            if (linear <= 0) return -100;
            return Math.round(20 * Math.log10(linear) * 10) / 10;
          };

          const normalizePath = (path: string) => {
            if (!path) return "";
            if (path.startsWith('http') || path.startsWith('blob:')) return path;
            return path.startsWith('/') ? path : `/${path}`;
          };

          const dynamicTracks: Track[] = [
            { id: 'track-guide', name: 'THE GUIDE', type: 'guide', color: 'bg-track-guide text-track-guide', volume: 1.0, pan: 0.0 },
            { id: 'track-atmosphere', name: 'PINK NOISE', type: 'atmosphere', color: 'bg-track-atmo text-track-atmo', volume: 1.0, pan: 0.0 }
          ];

          // Add ONE track for BGM Playlist
          if (data.audio_engine_config?.background_music?.enabled) {
            dynamicTracks.push({
              id: 'track-bgm-playlist',
              name: 'BGM PLAYLIST',
              type: 'atmosphere',
              color: 'bg-track-atmo text-track-atmo',
              volume: 1.0,
              pan: 0.0
            });
          }
          
          const convertedBlocks: Block[] = [];
          let timelineCursor = 0;

          let maxOscillators = 0;
          Object.values(data.spectral_definitions).forEach((stateDef: any) => {
            if (stateDef.oscillators?.length > maxOscillators) maxOscillators = stateDef.oscillators.length;
          });

          for (let i = 0; i < maxOscillators; i++) {
            dynamicTracks.push({
              id: `track-entrainment-${i}`,
              name: `LAYER ${i + 1}`,
              type: 'entrainment',
              color: i === 0 ? 'bg-track-carrier text-track-carrier' : 'bg-track-entrainment text-track-entrainment',
              volume: 1.0,
              pan: 0.0
            });
          }

          data.flow_logic.phases.forEach((phase: any) => {
            const duration = phase.duration_sec || 60;
            const spectralState = data.spectral_definitions[phase.target_spectral_state];
            
            if (spectralState && spectralState.oscillators) {
              spectralState.oscillators.forEach((osc: any, index: number) => {
                const beat = Math.abs(osc.freq_r - osc.freq_l);
                const base = (osc.freq_r + osc.freq_l) / 2;

                convertedBlocks.push({
                  id: crypto.randomUUID(),
                  track_id: `track-entrainment-${index}`,
                  asset_id: `osc-${phase.id}-${index}`,
                  label: `${phase.target_spectral_state.replace('state_', '').toUpperCase()}`,
                  type: 'entrainment',
                  start_time: timelineCursor,
                  end_time: timelineCursor + duration,
                  properties: {
                    baseFrequency: base,
                    targetStateHz: beat,
                    volume: linearToDb(osc.vol), 
                    waveform: osc.waveform || 'sine',
                    comment: osc.comment || ""
                  }
                });
              });
            }

            if (phase.guidance_ref && phase.guidance_ref !== "") {
              convertedBlocks.push({
                id: crypto.randomUUID(),
                track_id: 'track-guide',
                asset_id: `voice-${phase.id}`,
                label: "GUIDANCE: " + phase.id.replace('phase_', ''),
                type: 'voice',
                start_time: timelineCursor,
                end_time: timelineCursor + duration,
                properties: { 
                  volume: -3, 
                  fileUrl: normalizePath(phase.guidance_ref) 
                }
              });
            }

            timelineCursor += duration;
          });

          if (data.audio_engine_config?.background_music?.enabled) {
            const bgm = data.audio_engine_config.background_music;
            const bgmTracks = bgm.tracks || [];
            const bgmVol = bgm.volume_db || -20;
            if (bgmTracks.length > 0) {
              const slotDuration = timelineCursor / bgmTracks.length;
              bgmTracks.forEach((trackUrl: string, idx: number) => {
                convertedBlocks.push({
                  id: crypto.randomUUID(),
                  track_id: 'track-bgm-playlist',
                  asset_id: `bgm-${idx}`,
                  label: `SONG: ${trackUrl.split('/').pop()}`,
                  type: 'atmosphere',
                  start_time: idx * slotDuration,
                  end_time: (idx + 1) * slotDuration,
                  properties: { 
                    volume: bgmVol,
                    fileUrl: normalizePath(trackUrl),
                    fade_in: bgm.crossfade_sec || 10,
                    fade_out: bgm.crossfade_sec || 10
                  }
                });
              });
            }
          }

          if (data.audio_engine_config?.noise_floor) {
            const nf = data.audio_engine_config.noise_floor;
            convertedBlocks.push({
              id: crypto.randomUUID(),
              track_id: 'track-atmosphere',
              asset_id: 'gen-noise',
              label: `PINK NOISE (${nf.base_vol_db}dB)`,
              type: 'atmosphere',
              start_time: 0,
              end_time: timelineCursor,
              properties: { 
                volume: nf.base_vol_db || -56,
                filterCutoff: nf.filter_cutoff_hz || 600,
                lfoRate: nf.lfo_rate_hz || 0.05
              }
            });
          }

          tracks = dynamicTracks;
          blocks = convertedBlocks;
        }

        return { 
          projectName: name,
          tracks: tracks.length > 0 ? tracks.map((t: any) => ({ ...t, volume: t.volume ?? 1.0, pan: t.pan ?? 0.0 })) : INITIAL_TRACKS,
          blocks: blocks.map((b: any) => ({ ...b, properties: { ...b.properties } })),
          saveStatus: 'saved' 
        };
      }),

      setSubscriptionStatus: (status) => set({ subscriptionStatus: status }),
      setSaveStatus: (status) => set({ saveStatus: status }),
      setPlaying: (playing) => set({ isPlaying: playing }),
      setRecording: (recording) => set({ isRecording: recording }),
      toggleRecording: () => {
        const { isRecording, isPlaying, togglePlay } = get();
        if (!isRecording && !isPlaying) togglePlay();
        set({ isRecording: !isRecording });
      },
      setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      stop: () => set({ isPlaying: false, isRecording: false, currentTime: 0 }),
      seek: (seconds) => set((state) => ({ currentTime: Math.max(0, state.currentTime + seconds) })),
      setMasterTuning: (freq) => set((state) => ({ masterTuning: Math.max(400, Math.min(440, freq)), saveStatus: 'unsaved' })),
      setBpm: (bpm) => set((state) => ({ bpm: Math.max(30, Math.min(200, bpm)), saveStatus: 'unsaved' })),
      setZoomLevel: (level) => set({ zoomLevel: level }),
      setSnapEnabled: (enabled) => set({ isSnapEnabled: enabled }),
      setExporting: (exporting) => set({ isExporting: exporting }),
      setConsoleOpen: (open) => set((state) => ({ isConsoleOpen: open, activeConsoleModule: open ? state.activeConsoleModule : null })),
      setActiveConsoleModule: (moduleId) => set({ activeConsoleModule: moduleId }),
      setLastRecordingUrl: (url) => set({ lastRecordingUrl: url }),

      getComputedBlocks: () => get().blocks,

      getProjectDuration: () => {
        const { blocks } = get();
        if (blocks.length === 0) return 600; 
        const maxEnd = Math.max(...blocks.map(b => b.end_time));
        return Math.max(600, maxEnd + 60);
      },

      addBlock: (blockData) => set((state) => ({
        blocks: [...state.blocks, { ...blockData, id: crypto.randomUUID() }],
        saveStatus: 'unsaved'
      })),

      addUpload: (file) => set((state) => ({ userUploads: [...state.userUploads, file] })),
      
      addTrack: (track) => {
        const id = track.id || crypto.randomUUID();
        set((state) => ({ 
          tracks: [...state.tracks, { ...track, id } as Track],
          saveStatus: 'unsaved'
        }));
        return id;
      },
      
      removeTrack: (id) => set((state) => ({
        tracks: state.tracks.filter(t => t.id !== id),
        blocks: state.blocks.filter(b => b.track_id !== id),
        saveStatus: 'unsaved'
      })),

      duplicateTrack: (id) => set((state) => {
        const track = state.tracks.find(t => t.id === id);
        if (!track) return state;
        const newTrackId = crypto.randomUUID();
        const newTrack: Track = { ...track, id: newTrackId, name: `${track.name} (Copy)` };
        const newBlocks: Block[] = state.blocks
          .filter(b => b.track_id === id)
          .map(b => ({ ...b, id: crypto.randomUUID(), track_id: newTrackId, properties: { ...b.properties } }));
        const trackIndex = state.tracks.findIndex(t => t.id === id);
        const newTracks = [...state.tracks];
        newTracks.splice(trackIndex + 1, 0, newTrack);
        return { tracks: newTracks, blocks: [...state.blocks, ...newBlocks], saveStatus: 'unsaved' };
      }),
      
      renameTrack: (id, name) => set((state) => ({
        tracks: state.tracks.map(t => t.id === id ? { ...t, name } : t),
        saveStatus: 'unsaved'
      })),

      toggleMute: (id) => set((state) => ({ tracks: state.tracks.map(t => t.id === id ? { ...t, isMuted: !t.isMuted } : t) })),
      toggleSolo: (id) => set((state) => ({ tracks: state.tracks.map(t => t.id === id ? { ...t, isSolo: !t.isSolo } : t) })),
      setTrackVolume: (id, volume) => set((state) => ({ tracks: state.tracks.map(t => t.id === id ? { ...t, volume } : t) })),
      setTrackPan: (id, pan) => set((state) => ({ tracks: state.tracks.map(t => t.id === id ? { ...t, pan } : t) })),

      removeBlock: (id) => set((state) => ({
        blocks: state.blocks.filter(b => b.id !== id),
        activeSelection: state.activeSelection === id ? null : state.activeSelection,
        selectedBlocks: state.selectedBlocks.filter(s => s !== id),
        saveStatus: 'unsaved'
      })),

      removeBlocks: (ids) => set((state) => ({
        blocks: state.blocks.filter(b => !ids.includes(b.id)),
        activeSelection: ids.includes(state.activeSelection ?? '') ? null : state.activeSelection,
        selectedBlocks: [],
        saveStatus: 'unsaved'
      })),

      updateBlock: (id, updates) => set((state) => ({
        blocks: state.blocks.map(b => b.id === id ? { ...b, ...updates } : b),
        saveStatus: 'unsaved'
      })),

      updateBlocks: (ids, propertyUpdates) => set((state) => ({
        blocks: state.blocks.map(b =>
          ids.includes(b.id)
            ? { ...b, properties: { ...b.properties, ...propertyUpdates } }
            : b
        ),
        saveStatus: 'unsaved'
      })),

      setActiveSelection: (id) => set({ activeSelection: id, selectedBlocks: id ? [id] : [] }),

      setSelectedBlocks: (ids) => set({ selectedBlocks: ids, activeSelection: ids[ids.length - 1] ?? null }),

      toggleBlockSelection: (id) => set((state) => {
        const already = state.selectedBlocks.includes(id);
        const selectedBlocks = already
          ? state.selectedBlocks.filter(s => s !== id)
          : [...state.selectedBlocks, id];
        return { selectedBlocks, activeSelection: selectedBlocks[selectedBlocks.length - 1] ?? null };
      }),

      moveBlock: (id, newStartTime, newTrackId) => set((state) => {
        return {
          blocks: state.blocks.map(b => {
            if (b.id !== id) return b;
            const duration = b.end_time - b.start_time;
            return { ...b, start_time: newStartTime, end_time: newStartTime + duration, ...(newTrackId ? { track_id: newTrackId } : {}) };
          }),
          saveStatus: 'unsaved'
        };
      }),

      splitBlock: (id, splitTime) => set((state) => {
        const block = state.blocks.find(b => b.id === id);
        if (!block || splitTime <= block.start_time || splitTime >= block.end_time) return state;
        const block1: Block = { ...block, end_time: splitTime };
        const block2: Block = { ...block, id: crypto.randomUUID(), start_time: splitTime };
        return { blocks: [...state.blocks.filter(b => b.id !== id), block1, block2], saveStatus: 'unsaved' };
      }),

      copyBlock: () => {
        const { activeSelection, blocks } = get();
        if (!activeSelection) return;
        const block = blocks.find(b => b.id === activeSelection);
        if (block) set({ clipboard: { ...block, properties: { ...block.properties } } });
      },

      pasteBlock: () => {
        const { clipboard, currentTime, blocks } = get();
        if (!clipboard) return;
        const duration = clipboard.end_time - clipboard.start_time;
        const newBlock: Block = { ...clipboard, id: crypto.randomUUID(), start_time: currentTime, end_time: currentTime + duration, properties: { ...clipboard.properties } };
        set({ blocks: [...blocks, newBlock], activeSelection: newBlock.id, saveStatus: 'unsaved' });
      },

      setRazorMode: (isRazor) => set({ isRazorMode: isRazor }),
    }),
    { partialize: (state) => ({ projectName: state.projectName, blocks: state.blocks, tracks: state.tracks }) }
  )
);
