# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
# Development (local, no Docker)
npm run dev       # Next.js dev server (Turbopack)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint

# Development (Docker, preferred for HMR stability)
docker-compose -f docker-compose.dev.yml up -d --build
docker-compose -f docker-compose.dev.yml build --no-cache studio-dev  # after npm install

# Production (Docker)
docker-compose up -d --build
docker-compose down
```

App runs on `http://localhost:3002`.

## Architecture

SoulStudio is a browser-based DAW (Digital Audio Workstation) for consciousness engineering and brainwave entrainment. It is a Next.js App Router application with Supabase Auth + PostgreSQL and Stripe billing.

### Data flow

1. **Zustand store** (`src/store/useStudioStore.ts`) is the single source of truth for all visual/timeline state: `tracks[]`, `blocks[]`, `currentTime`, `isPlaying`, etc. UI state is fully decoupled from the Web Audio API graph.
2. **AudioEngine** (`src/lib/audio/AudioEngine.ts`) reads blocks from the store at play-time and synthesizes audio using the Web Audio API. It does not write back to the store.
3. **AutoSaveManager** (`src/components/studio/AutoSaveManager.tsx`) subscribes to store changes and debounces a Supabase upsert every 2 seconds.
4. **ExportEngine** (`src/lib/audio/ExportEngine.ts`) mirrors AudioEngine DSP logic but uses `OfflineAudioContext` for WAV rendering.
5. **ProjectEngine** (`src/lib/audio/ProjectEngine.ts`) serializes/deserializes `.soultune` files (ZIP + `manifest.json`).

### Feature implementation order (from GEMINI.md)

When adding any feature, modify files in this sequence:
1. TypeScript types/interfaces
2. `useStudioStore.ts` — state, actions, selectors
3. `AudioEngine.ts` — DSP changes if applicable
4. React components — last

### Block types

Each `Block` on the timeline has a `type` field that determines AudioEngine routing:
- `carrier` — oscillator + 2nd/3rd harmonics (harmonizerLevel)
- `entrainment` — binaural beats via `ChannelMergerNode` (left/right channel separation)
- `atmosphere` — brown noise + biquad lowpass filter
- `voice` / `guide` — decoded `AudioBuffer` with trim/fade

### DSP constraints (non-negotiable)

- **No abrupt value changes.** Always use `.setTargetAtTime(value, ctx.currentTime, 0.05)` (50 ms ramp). Never call `.setValueAtTime()` on gain/frequency params.
- **Master gain ≤ 0.7** at all times (anti-clipping headroom).
- **Binaural routing must use `ChannelMergerNode`** — left carrier → input 0, right carrier → input 1. Never use standard pan nodes for binaural entrainment (they bleed channels).
- **Carrier frequencies must not be pure sine waves** — generate 2nd and 3rd harmonics at reduced gain via `harmonizerLevel`.

### DnD / Timeline

- Always apply `activationConstraint: { distance: 5 }` on `PointerSensor` to prevent click-vs-drag conflicts.
- Blocks support bi-directional resizing (left edge + right edge) plus drag-and-drop.

### Design tokens

| Token | Value |
|---|---|
| Background (App) | `#05080F` |
| Background (Panel) | `#0A0F1A` |
| Accent 1 (Cyan) | `#00F0FF` |
| Accent 2 (Violet) | `#8A2BE2` |
| Font | Inter |

UI aesthetic: high-tech, clinical, dark. No light themes, no playful/rounded SaaS aesthetics, no generic gradients.

### API routes

- `POST /api/checkout` — creates Stripe checkout session
- `POST /api/billing` — billing portal
- `POST /api/ai/tts` — text-to-speech synthesis
- `POST /api/webhooks/stripe` — Stripe webhook (updates `subscriptions` table)

### Auth & persistence

- Supabase SSR client: `src/utils/supabase/server.ts` (API routes, Server Components)
- Supabase browser client: `src/utils/supabase/client.ts`
- `projects` table: stores `state_json` (JSONB with `tracks[]` + `blocks[]`)
- `subscriptions` table: links `user_id` → Stripe `customer_id` + `status`

### Next.js version note

This project uses a version of Next.js that may have breaking changes from older training data. Before writing any Next.js-specific code (routing, data fetching, config), check `node_modules/next/dist/docs/` for the current API.
