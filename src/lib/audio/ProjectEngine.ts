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

  static async importSoultune(file: File): Promise<{ blocks: Block[], tracks: Track[] }> {
    const zip = await JSZip.loadAsync(file);
    const manifestFile = zip.file("manifest.json");
    
    if (!manifestFile) throw new Error("Invalid .soultune file: manifest.json missing");
    
    const manifest = JSON.parse(await manifestFile.async("string"));
    return {
      blocks: manifest.blocks || [],
      tracks: manifest.tracks || []
    };
  }
}