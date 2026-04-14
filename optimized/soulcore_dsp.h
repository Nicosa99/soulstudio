/**
 * SoulCore DSP Engine
 *
 * Proprietary phase-accumulator audio synthesis for psychoacoustic
 * frequency generation. Sample-accurate Neuro-Glides, lock-free
 * parameter control, and per-sample panning modulation.
 *
 * Thread Safety:
 *   soulcore_process_buffer  → AUDIO THREAD ONLY (zero-alloc, zero-lock)
 *   All other functions      → UI/MAIN THREAD (lock-free writes via atomics)
 *
 * Copyright (c) 2026 SoulTune. All rights reserved.
 */

#ifndef SOULCORE_DSP_H
#define SOULCORE_DSP_H

#include <stdint.h>

#if defined(_WIN32)
  #define SOULCORE_EXPORT __declspec(dllexport)
#else
  #define SOULCORE_EXPORT __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

/* ── Opaque Handle ─────────────────────────────────────────────────── */

typedef struct SoulCoreEngine SoulCoreEngine;

/* ── Enumerations ──────────────────────────────────────────────────── */

typedef enum {
    SOULCORE_SINE     = 0,
    SOULCORE_TRIANGLE = 1,
    SOULCORE_SQUARE   = 2,  /* tanh-shaped soft square */
    SOULCORE_SAW      = 3,
} SoulCoreWaveform;

typedef enum {
    SOULCORE_PAN_LINEAR   = 0,  /* L→R→L sinusoidal sweep          */
    SOULCORE_PAN_CIRCULAR = 1,  /* 8D: adds front/back depth       */
} SoulCorePanningMode;

/* ── Lifecycle ─────────────────────────────────────────────────────── */

/**
 * Allocate engine. All buffers pre-allocated here; no further mallocs.
 * @param sampleRate     Host sample rate (44100 / 48000).
 * @param maxOscillators Slot count (typ. 16–32).
 */
SOULCORE_EXPORT SoulCoreEngine* soulcore_init(double sampleRate, int32_t maxOscillators);

/** Free all resources. NULL-safe. */
SOULCORE_EXPORT void soulcore_free(SoulCoreEngine* engine);

/* ── Oscillator Control (UI Thread) ────────────────────────────────── */

/**
 * Set a frequency glide on one oscillator.
 *
 * The carrier frequency is swept sample-by-sample from current → target
 * over glideDurationSec. Harmonics (Sub-Octave, Octave, Phi) track the
 * carrier automatically with Neuro-Aesthetic detuning constants.
 *
 * @param oscIndex         0-based slot.
 * @param targetFreqHz     Carrier target (Hz). 0 = silence.
 * @param glideDurationSec Sweep time (0 = instant).
 * @param targetVolume     Amplitude 0.0–1.0.
 * @param pan              -1.0 (L) … 0.0 (C) … +1.0 (R).
 * @param harmonicRichness 0.0 pure carrier, 1.0 full chord.
 * @param waveform         Carrier waveform (harmonics always sine).
 */
SOULCORE_EXPORT void soulcore_set_glide(
    SoulCoreEngine* engine,
    int32_t         oscIndex,
    double          targetFreqHz,
    double          glideDurationSec,
    double          targetVolume,
    double          pan,
    double          harmonicRichness,
    int32_t         waveform
);

/**
 * Convenience: binaural pair on oscPairBase (L) and oscPairBase+1 (R).
 * Left = carrierHz, Right = carrierHz + beatHz.
 */
SOULCORE_EXPORT void soulcore_set_binaural(
    SoulCoreEngine* engine,
    int32_t         oscPairBase,
    double          carrierFreqHz,
    double          beatFreqHz,
    double          glideDurationSec,
    double          volume,
    double          harmonicRichness
);

/** Fade-out and deactivate one oscillator (~50 ms). */
SOULCORE_EXPORT void soulcore_deactivate(SoulCoreEngine* engine, int32_t oscIndex);

/** Deactivate all oscillators. */
SOULCORE_EXPORT void soulcore_deactivate_all(SoulCoreEngine* engine);

/** Master output gain (0.0–1.0). */
SOULCORE_EXPORT void soulcore_set_master_volume(SoulCoreEngine* engine, double volume);

/* ── Panning LFO (UI Thread) ──────────────────────────────────────── */

/**
 * Configure the global panning modulation LFO.
 *
 * When enabled, a per-sample sine LFO modulates volume of L/R
 * oscillators to create hemispheric panning. Oscillators at pan=-1
 * receive the left multiplier, pan=+1 the right, pan=0 unaffected.
 *
 * @param enabled      1 = on, 0 = off (resets multipliers to 1.0).
 * @param cycleSeconds Full L→R→L cycle duration (research: 15s).
 * @param depth        Modulation depth 0.0–1.0 (research: 0.35).
 * @param mode         SOULCORE_PAN_LINEAR or SOULCORE_PAN_CIRCULAR.
 */
SOULCORE_EXPORT void soulcore_set_panning(
    SoulCoreEngine* engine,
    int32_t         enabled,
    double          cycleSeconds,
    double          depth,
    int32_t         mode
);


/* ── Diagnostics (UI Thread) ───────────────────────────────────────── */

SOULCORE_EXPORT double  soulcore_get_current_freq(const SoulCoreEngine* engine, int32_t oscIndex);
SOULCORE_EXPORT double  soulcore_get_current_volume(const SoulCoreEngine* engine, int32_t oscIndex);
SOULCORE_EXPORT double  soulcore_get_pan_position(const SoulCoreEngine* engine);
SOULCORE_EXPORT int32_t soulcore_get_active_count(const SoulCoreEngine* engine);

#ifdef __cplusplus
}
#endif

#endif /* SOULCORE_DSP_H */
