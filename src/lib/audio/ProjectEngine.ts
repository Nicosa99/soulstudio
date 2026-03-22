import JSZip from "jszip";
import { Block, Track, useStudioStore } from "@/store/useStudioStore";

export class ProjectEngineClass {
  async exportSoultune(blocks: Block[], tracks: Track[], journeyId = "MyJourney") {
    // 1. Initialize Archive
    const zip = new JSZip();
    
    // 2. Build App-Compliant Manifest
    const carrierBlocks = blocks.filter(b => b.type === 'carrier');
    const entrainBlock = blocks.find(b => b.type === 'entrainment');

    const manifest = {
      protocol_id: `soulstudio_${Date.now()}`,
      creator_id: "web_studio_user",
      engine_instructions: {
         carrier_frequencies: carrierBlocks.length > 0 ? carrierBlocks.map(b => b.properties.baseFrequency || 100.0) : [136.1],
         binaural_offset: entrainBlock ? (entrainBlock.properties.targetStateHz || 4.0) : 4.0,
         voice_ducking: true
      },
      assets: {} as Record<string, string>,
      studio_ui_state: {
         blocks,
         tracks
      }
    };

    // 3. Bundle Raw Audio Assets into assets/
    const assetsFolder = zip.folder("assets");
    const voiceBlocks = blocks.filter(b => b.type === 'voice' || b.type === 'guide');

    for (const block of voiceBlocks) {
      if (block.properties.fileUrl) {
         try {
            const url = block.properties.fileUrl as string;
            // Attempt to derive original filename or fallback to ID
            const fileName = url.includes('/') ? url.split('/').pop()?.split('?')[0] || `audio_${block.id}.wav` : `audio_${block.id}.wav`;
            
            manifest.assets[block.id] = fileName;

            // Fetch Blob and inject to Zip
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();

            assetsFolder?.file(fileName, arrayBuffer);
         } catch(e) {
            console.error("Failed to bundle asset for block:", block.id, e);
         }
      }
    }

    // 4. Inject Manifest Map
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    // 5. Trigger Asynchronous Download natively without file-saver
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = `${journeyId.replace(/[^a-zA-Z0-9-_]/g, '_')}.soultune`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async importSoultune(file: File) {
    const zip = new JSZip();
    const unzipped = await zip.loadAsync(file);

    const manifestFile = unzipped.file("manifest.json");
    if (!manifestFile) throw new Error("Invalid .soultune architecture: Missing manifest.json");

    const manifestText = await manifestFile.async("string");
    const manifest = JSON.parse(manifestText);

    const state = manifest.studio_ui_state;
    if (!state || !state.blocks) throw new Error("Invalid .soultune archive: Corrupt studio_ui_state");

    // Rehydrate Object URLs from ZIP Blobs
    for (const block of state.blocks) {
      if ((block.type === 'voice' || block.type === 'guide') && manifest.assets[block.id]) {
         const assetFilename = manifest.assets[block.id];
         const audioFile = unzipped.file(`assets/${assetFilename}`);
         if (audioFile) {
            const blob = await audioFile.async("blob");
            // Map the internal ZIP blob directly entirely circumventing cloud re-uploads
            block.properties.fileUrl = URL.createObjectURL(blob);
         }
      }
    }

    // Inject rehydrated payload to Zustand
    useStudioStore.getState().initializeProject({
       tracks: state.tracks || [],
       blocks: state.blocks || []
    });
  }
}

export const ProjectEngine = new ProjectEngineClass();
