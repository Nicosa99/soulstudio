import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Block, Track } from "@/store/useStudioStore";

export class ProjectEngine {
  static async exportSoultune(blocks: Block[], tracks: Track[]) {
    const zip = new JSZip();
    
    // Core Manifest with enhanced Engine Instructions for Mobile Parity
    const manifest = {
      version: "2.0",
      exported_at: new Date().toISOString(),
      tracks: tracks,
      blocks: blocks,
      engine_instructions: {
        voice_ducking: true,
        dsp_rules: {
          panning_method: "strict_channel_merger",
          harmonizer_overtones: [
            { multiplier: 2, gain_ratio: 0.3 },
            { multiplier: 3, gain_ratio: 0.1 }
          ],
          fade_curve: "linear",
          sample_rate: 48000
        }
      }
    };

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `SoulStudio_Project_${Date.now()}.soultune`);
  }

  static async importSoultune(file: File): Promise<any> {
    const zip = await JSZip.loadAsync(file);
    const manifestFile = zip.file("manifest.json");
    
    if (!manifestFile) throw new Error("Invalid .soultune file: manifest.json missing");
    
    const manifest = JSON.parse(await manifestFile.async("string"));
    
    // 1. Extract all audio files from the ZIP and create Blob URLs
    const assetMap = new Map<string, string>();
    const zipFiles = Object.keys(zip.files);
    
    for (const path of zipFiles) {
      if (path.endsWith('.mp3') || path.endsWith('.wav') || path.endsWith('.ogg')) {
        const fileData = await zip.files[path].async("blob");
        const blobUrl = URL.createObjectURL(fileData);
        // Normalize the path to match manifest references (strip leading slashes etc)
        const normalizedZipPath = path.startsWith('/') ? path : `/${path}`;
        assetMap.set(normalizedZipPath, blobUrl);
        // Also map without leading slash for flexibility
        assetMap.set(path.startsWith('/') ? path.slice(1) : path, blobUrl);
      }
    }

    const normalizePath = (path: string) => {
      if (!path) return "";
      if (path.startsWith('http') || path.startsWith('blob:')) return path;
      
      // Check if we have an extracted blob for this path
      const normalizedQuery = path.startsWith('/') ? path : `/${path}`;
      if (assetMap.has(normalizedQuery)) {
        return assetMap.get(normalizedQuery)!;
      }
      
      return path.startsWith('/') ? path : `/${path}`;
    };

    // 2. Map blocks to use the extracted Blob URLs
    if (manifest.blocks) {
      manifest.blocks = manifest.blocks.map((b: Block) => {
        if (b.properties?.fileUrl) {
          return {
            ...b,
            properties: {
              ...b.properties,
              fileUrl: normalizePath(b.properties.fileUrl as string)
            }
          };
        }
        return b;
      });
    }

    // 3. Handle Research Schema V4 Background Music tracks if present
    if (manifest.audio_engine_config?.background_music?.tracks) {
      manifest.audio_engine_config.background_music.tracks = 
        manifest.audio_engine_config.background_music.tracks.map((t: string) => normalizePath(t));
    }

    return manifest;
  }
}