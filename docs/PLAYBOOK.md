# SoulStudio AI Playbook Engine — User Guide

This document explains how to use the **AI Playbook Engine** (JSON Editor) to generate and import professional neuro-acoustic protocols using external AI models (Claude, ChatGPT).

---

## 1. Concept: "The DAW for AI Engineers"

SoulStudio allows you to bridge the gap between AI-driven protocol design and real-time synthesis. Instead of manually dragging blocks, you can instruct an AI to design a complex 20-minute session with precise brainwave ramps, and paste it directly into the studio.

---

## 2. The Workflow

### Step A: Access the Code Panel
1. Open your project in the [Studio Dashboard](https://studio.soultune.app/studio).
2. On the left sidebar, click the **Terminal/Code** icon.
3. This opens the **AI Playbook Editor** powered by Monaco (VS Code).

### Step B: Generate with AI
1. Click the **"COPY AI PROMPT"** button. This copies a strict system prompt to your clipboard.
2. Paste this prompt into **Claude 3.5 Sonnet** or **ChatGPT-4o**.
3. Add your specific goal to the prompt, for example:
   > "... Create a 15-minute protocol for deep athletic recovery, starting at 10Hz Alpha and ramping down to 1.5Hz Delta."
4. Copy the raw JSON output from the AI.

### Step C: Apply to Timeline
1. Delete the existing code in the **AI Playbook Editor**.
2. Paste the AI-generated JSON.
3. Click the glowing cyan **"APPLY TO TIMELINE"** button.
4. Your DAW will instantly populate with the generated tracks and blocks.

---

## 3. JSON Schema Reference

If you are writing playbooks manually, use this structure:

### Tracks
| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier (e.g., `track-delta`) |
| `name` | string | Display name (e.g., `DEEP RECOVERY`) |
| `type` | string | `carrier`, `entrainment`, `guide`, or `atmosphere` |
| `color` | string | Tailwind class (e.g., `bg-track-carrier text-track-carrier`) |

### Blocks
| Field | Type | Description |
|---|---|---|
| `track_id` | string | Must match an existing track's `id` |
| `type` | string | `voice`, `entrainment`, `atmosphere`, `carrier`, `guide` |
| `start_time` | number | Offset in seconds |
| `end_time` | number | End point in seconds |
| `properties` | object | DSP settings (e.g., `baseFrequency: 432`, `targetStateHz: 4.5`) |

---

## 4. Tips for Best Results

1. **Ramping:** To create a "ramp" (e.g. 10Hz to 4Hz), generate multiple blocks back-to-back with slightly decreasing `targetStateHz`.
2. **Layering:** Ensure your `atmosphere` tracks (Brown Noise) cover the entire duration of your session for a seamless experience.
3. **Validation:** If the JSON is invalid, the editor will show a red error toast. Check for missing commas or unmatched track IDs.
