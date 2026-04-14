// ═══════════════════════════════════════════════════════════════════════════
// SoulCore DSP Engine — Implementation
//
// Phase-accumulator synthesis with Neuro-Aesthetic harmonic chord,
// per-sample frequency sweeps, lock-free parameter control,
// and integrated panning LFO.
//
// AUDIO THREAD CONTRACT:
//   soulcore_process_buffer performs ZERO allocations, ZERO locks, ZERO I/O.
//   All cross-thread communication uses std::atomic with generation counters.
//
// Copyright (c) 2026 SoulTune. All rights reserved.
// ═══════════════════════════════════════════════════════════════════════════

#include "soulcore_dsp.h"

#include <atomic>
#include <cmath>
#include <cstring>
#include <new>

#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"

// ─────────────────────────────────────────────────────────────────────────────
// PSYCHOACOUSTIC CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

namespace {

constexpr double SC_TWO_PI   = 6.283185307179586476925286766559;
constexpr double SC_PI       = 3.14159265358979323846;
constexpr double SC_PHI      = 1.6180339887498948482;   // Golden Ratio
constexpr double SC_SCHUMANN = 7.83;                     // Schumann Resonance (Hz)
constexpr double SC_DELTA_DT = 1.5;                      // Delta Detune (Hz)
constexpr double SC_THETA_OT = 4.0;                      // Theta Offset (Hz)

// Harmonic chord levels (relative to carrier amplitude)
constexpr double SC_SUB_VOL = 0.30;   // Sub-Octave: somatische Resonanz
constexpr double SC_OCT_VOL = 0.15;   // Octave: brightness
constexpr double SC_PHI_VOL = 0.10;   // Phi: Zirbeldrüsen-Textur

// Anti-click ramp durations
constexpr double SC_VOL_RAMP_S  = 0.010;  // 10 ms volume smoothing
constexpr double SC_PAN_RAMP_S  = 0.020;  // 20 ms pan smoothing
constexpr double SC_DEACT_S     = 0.050;  // 50 ms deactivation fade

// ─────────────────────────────────────────────────────────────────────────────
// WAVETABLE SINE (Pre-computed at Compile Time or Init)
// ─────────────────────────────────────────────────────────────────────────────
constexpr int32_t SC_LUT_SIZE = 65536; // Absolute Studio-Fidelity
float sineLUT[SC_LUT_SIZE];

void initSineLUT() {
    static bool initialized = false;
    if (initialized) return;
    for (int i = 0; i < SC_LUT_SIZE; ++i) {
        sineLUT[i] = std::sin((static_cast<double>(i) / SC_LUT_SIZE) * SC_TWO_PI);
    }
    initialized = true;
}

inline double fastSine(double phase) {
    double index = phase * SC_LUT_SIZE;
    int32_t idx0 = static_cast<int32_t>(index) % SC_LUT_SIZE;
    int32_t idx1 = (idx0 + 1) % SC_LUT_SIZE;
    double frac = index - static_cast<int32_t>(index);
    return sineLUT[idx0] + frac * (sineLUT[idx1] - sineLUT[idx0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPONENTIAL SMOOTHING CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
constexpr double SC_SMOOTH_VOL  = 0.001;
constexpr double SC_SMOOTH_FREQ = 0.0005;
constexpr double SC_SMOOTH_PAN  = 0.001;

// ─────────────────────────────────────────────────────────────────────────────
// INLINE DSP HELPERS — Compiled hot, must be inlineable.
// ─────────────────────────────────────────────────────────────────────────────

/// S-Kurve für organisches Frequenz-Shifting (Hermite Interpolation)
/// Startet weich, beschleunigt, bremst weich ab. Zero-Trig.
inline double smoothstep(double t) {
    // clamp t to [0.0, 1.0] just in case
    if (t <= 0.0) return 0.0;
    if (t >= 1.0) return 1.0;
    return t * t * (3.0 - 2.0 * t);
}

/// HF roll-off for carrier: prevents excitable high-frequency energy.
inline double carrierAtten(double freq) {
    double a = 1.0;
    if (freq > 400.0) a = 0.4;
    if (freq > 800.0) a = 0.05;
    return a;
}

/// HF roll-off for harmonics (Octave, Phi): cortisol-spike prevention.
inline double harmonicAtten(double freq) {
    double a = 1.0;
    if (freq > 300.0) a = 0.5;
    if (freq > 500.0) a = 0.2;
    if (freq > 800.0) a = 0.05;
    return a;
}

/// Bandlimited waveform generation from normalised phase [0, 1).
inline double waveformSample(double phase, int32_t wf) {
    switch (wf) {
        case SOULCORE_TRIANGLE:
            return 2.0 * std::abs(2.0 * phase - 1.0) - 1.0;
        case SOULCORE_SQUARE:
            // Soft band-limited square via tanh shaping (no aliased harmonics)
            return std::tanh(fastSine(phase) * 4.0);
        case SOULCORE_SAW:
            return 2.0 * phase - 1.0;
        default: // SOULCORE_SINE
            return fastSine(phase);
    }
}

/// Rational Soft-Clipper (Analog Tape Curve)
/// Unendlicher Headroom, kein Hard-Clipping möglich. Branchless.
inline float softLimit(float x) {
    const float drive = 0.5f; // Steuert den analogen "Glue"
    x *= drive;
    // Mathematisch garantiert, dass das Ergebnis immer zwischen -1.0 und 1.0 bleibt.
    return x / (1.0f + std::abs(x));
}

/// Advance phase accumulator, wrapping to [0, 1).
/// Branchless / Single-Branch Phase Advance
inline double advancePhase(double phase, double inc) {
    phase += inc;
    // Da inc < 1.0 garantiert ist (Frequenz < SampleRate), reicht ein if.
    if (phase >= 1.0) phase -= 1.0;
    if (phase < 0.0) phase += 1.0;
    return phase;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/// Oscillator parameters — written by UI thread, read by audio thread.
/// Cache-line aligned to prevent false sharing between adjacent oscillators.
struct alignas(64) OscParams {
    std::atomic<double>   targetFreq{0.0};
    std::atomic<double>   targetVolume{0.0};
    std::atomic<double>   targetPan{0.0};
    std::atomic<double>   glideSeconds{0.0};
    std::atomic<double>   harmonicRichness{0.0};
    std::atomic<int32_t>  waveform{SOULCORE_SINE};
    std::atomic<uint32_t> generation{0};     // Incremented on every set_glide
    std::atomic<bool>     active{false};
    std::atomic<bool>     deactivating{false};
};

/// Oscillator audio state — audio thread only, no atomics needed.
struct OscState {
    // Phase accumulators ∈ [0, 1)
    double carrierPhase = 0.0;
    double subPhase     = 0.0;
    double octPhase     = 0.0;
    double phiPhase     = 0.0;

    // Aktuelle Werte
    double currentFreq   = 0.0;
    double currentVolume = 0.0;
    double currentPan    = 0.0;
    double richness      = 0.0;
    int32_t waveform     = SOULCORE_SINE;

    // ── QUANTUM GLIDE PARAMS (S-Curve) ──
    double startFreq     = 0.0;
    double targetFreq    = 0.0;
    double freqRampPhase = 1.0; // 0.0 = Start, 1.0 = Ziel erreicht
    double freqRampInc   = 0.0; // Schrittweite pro Sample

    // Einfache Targets für Volume/Pan (bleiben beim Kondensator-Smoothing)
    double targetVolume = 0.0;
    double targetPan    = 0.0;

    // Caching für Panning
    double cachedGainL  = 0.7071067811865475;
    double cachedGainR  = 0.7071067811865475;

    uint32_t lastGen    = 0;
    bool active         = false;
};

/// Panning LFO parameters — written by UI thread.
struct alignas(64) PanLfoParams {
    std::atomic<bool>     enabled{false};
    std::atomic<double>   cycleSeconds{15.0};
    std::atomic<double>   depth{0.35};
    std::atomic<int32_t>  mode{SOULCORE_PAN_LINEAR};
    std::atomic<uint32_t> generation{0};
};

/// Panning LFO state — audio thread only.
struct PanLfoState {
    double phase    = 0.0;
    double leftMul  = 1.0;
    double rightMul = 1.0;
    bool enabled    = false;
    double cycleSec = 15.0;
    double depth    = 0.35;
    int32_t mode    = SOULCORE_PAN_LINEAR;
    uint32_t lastGen = 0;
};

} // anonymous namespace

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE STRUCTURE — Single pre-allocation at init, never reallocated.
// ═══════════════════════════════════════════════════════════════════════════

struct SoulCoreEngine {
    double sampleRate;
    double invSampleRate;   // 1.0 / sampleRate (pre-computed)
    int32_t maxOsc;

    std::atomic<double> masterVolume{1.0};

    OscParams*   params;    // [maxOsc] — UI writable
    OscState*    states;    // [maxOsc] — audio only
    PanLfoParams panParams;
    PanLfoState  panState;

    int32_t volRampN;       // samples for 10 ms
    int32_t panRampN;       // samples for 20 ms
    int32_t deactRampN;     // samples for 50 ms

    ma_device device;
    bool deviceInitialized{false};
};

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

extern "C" {

// Forward declaration of the C API process buffer
void soulcore_process_buffer(SoulCoreEngine* e, float* buf, int32_t numFrames);

// Miniaudio callback wrapper
static void data_callback(ma_device* pDevice, void* pOutput, const void* pInput, ma_uint32 frameCount)
{
    SoulCoreEngine* engine = static_cast<SoulCoreEngine*>(pDevice->pUserData);
    if (engine) {
        soulcore_process_buffer(engine, static_cast<float*>(pOutput), static_cast<int32_t>(frameCount));
    }
}

SOULCORE_EXPORT SoulCoreEngine* soulcore_init(double sampleRate, int32_t maxOscillators) {
    if (sampleRate <= 0.0 || maxOscillators <= 0) return nullptr;

    initSineLUT();

    auto* e = new(std::nothrow) SoulCoreEngine();
    if (!e) return nullptr;

    e->sampleRate    = sampleRate;
    e->invSampleRate = 1.0 / sampleRate;
    e->maxOsc        = maxOscillators;
    e->masterVolume.store(1.0, std::memory_order_relaxed);

    e->params = new(std::nothrow) OscParams[maxOscillators]();
    e->states = new(std::nothrow) OscState[maxOscillators]();

    if (!e->params || !e->states) {
        delete[] e->params;
        delete[] e->states;
        delete e;
        return nullptr;
    }
    ma_device_config config = ma_device_config_init(ma_device_type_playback);
    config.playback.format   = ma_format_f32;
    config.playback.channels = 2;
    config.sampleRate        = static_cast<ma_uint32>(sampleRate);
    config.dataCallback      = data_callback;
    config.pUserData         = e;
    if (ma_device_init(NULL, &config, &e->device) != MA_SUCCESS) {
        delete[] e->params;
        delete[] e->states;
        delete e;
        return nullptr;
    }
    e->deviceInitialized = true;
    ma_device_start(&e->device);

    // Pre-compute ramp lengths (clamped to ≥1 to avoid division by zero)
    auto safeSamples = [&](double sec) -> int32_t {
        return static_cast<int32_t>(sampleRate * sec) | 1; // ensures ≥1
    };
    e->volRampN  = safeSamples(SC_VOL_RAMP_S);
    e->panRampN  = safeSamples(SC_PAN_RAMP_S);
    e->deactRampN = safeSamples(SC_DEACT_S);

    return e;
}

SOULCORE_EXPORT void soulcore_free(SoulCoreEngine* e) {
    if (!e) return;
    if (e->deviceInitialized) {
        ma_device_uninit(&e->device);
    }
    delete[] e->params;
    delete[] e->states;
    delete e;
}

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETER CONTROL — Called from UI/main thread only.
// Uses atomic stores + generation counter for lock-free handoff.
// ═══════════════════════════════════════════════════════════════════════════

SOULCORE_EXPORT void soulcore_set_glide(
    SoulCoreEngine* e, int32_t idx,
    double targetFreqHz, double glideDurationSec,
    double targetVolume, double pan,
    double harmonicRichness, int32_t waveform)
{
    if (!e || idx < 0 || idx >= e->maxOsc) return;

    auto& p = e->params[idx];
    p.targetFreq.store(targetFreqHz, std::memory_order_relaxed);
    p.glideSeconds.store(glideDurationSec, std::memory_order_relaxed);
    p.targetVolume.store(targetVolume, std::memory_order_relaxed);
    p.targetPan.store(pan, std::memory_order_relaxed);
    p.harmonicRichness.store(harmonicRichness, std::memory_order_relaxed);
    p.waveform.store(waveform, std::memory_order_relaxed);
    p.active.store(true, std::memory_order_relaxed);
    p.deactivating.store(false, std::memory_order_relaxed);

    // Release: guarantees all stores above are visible before gen increment
    p.generation.fetch_add(1, std::memory_order_release);
}

SOULCORE_EXPORT void soulcore_set_binaural(
    SoulCoreEngine* e, int32_t base,
    double carrierHz, double beatHz,
    double glideSec, double volume, double richness)
{
    if (!e || base < 0 || base + 1 >= e->maxOsc) return;

    // Left channel: carrier at pan = -1
    soulcore_set_glide(e, base,
        carrierHz, glideSec, volume, -1.0, richness, SOULCORE_SINE);

    // Right channel: carrier + beat at pan = +1
    soulcore_set_glide(e, base + 1,
        carrierHz + beatHz, glideSec, volume, 1.0, richness, SOULCORE_SINE);
}

SOULCORE_EXPORT void soulcore_deactivate(SoulCoreEngine* e, int32_t idx) {
    if (!e || idx < 0 || idx >= e->maxOsc) return;

    auto& p = e->params[idx];
    p.targetVolume.store(0.0, std::memory_order_relaxed);
    p.deactivating.store(true, std::memory_order_relaxed);
    p.generation.fetch_add(1, std::memory_order_release);
}

SOULCORE_EXPORT void soulcore_deactivate_all(SoulCoreEngine* e) {
    if (!e) return;
    for (int32_t i = 0; i < e->maxOsc; ++i)
        soulcore_deactivate(e, i);
}

SOULCORE_EXPORT void soulcore_set_master_volume(SoulCoreEngine* e, double volume) {
    if (!e) return;
    e->masterVolume.store(volume, std::memory_order_relaxed);
}

SOULCORE_EXPORT void soulcore_set_panning(
    SoulCoreEngine* e, int32_t enabled,
    double cycleSeconds, double depth, int32_t mode)
{
    if (!e) return;
    auto& pp = e->panParams;
    pp.enabled.store(enabled != 0, std::memory_order_relaxed);
    pp.cycleSeconds.store(cycleSeconds, std::memory_order_relaxed);
    pp.depth.store(depth, std::memory_order_relaxed);
    pp.mode.store(mode, std::memory_order_relaxed);
    pp.generation.fetch_add(1, std::memory_order_release);
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE DSP — THE HOT PATH
//
// Contract: ZERO malloc. ZERO mutex. ZERO printf. ZERO exceptions.
// All state lives in pre-allocated structs. Cross-thread reads use
// std::atomic with acquire semantics on generation counters.
// ═══════════════════════════════════════════════════════════════════════════

void soulcore_process_buffer(
    SoulCoreEngine* e, float* buf, int32_t numFrames)
{
    if (!e || !buf || numFrames <= 0) return;

    const double invSr     = e->invSampleRate;
    const double masterVol = e->masterVolume.load(std::memory_order_relaxed);
    const int32_t numOsc   = e->maxOsc;

    // ── Zero output buffer ───────────────────────────────────────────────
    std::memset(buf, 0, static_cast<size_t>(numFrames) * 2 * sizeof(float));

    // ── Sync panning LFO params ──────────────────────────────────────────
    {
        auto& pp = e->panParams;
        auto& ps = e->panState;
        const uint32_t gen = pp.generation.load(std::memory_order_acquire);
        if (gen != ps.lastGen) {
            ps.lastGen  = gen;
            ps.enabled  = pp.enabled.load(std::memory_order_relaxed);
            ps.cycleSec = pp.cycleSeconds.load(std::memory_order_relaxed);
            ps.depth    = pp.depth.load(std::memory_order_relaxed);
            ps.mode     = pp.mode.load(std::memory_order_relaxed);
            if (!ps.enabled) {
                ps.leftMul  = 1.0;
                ps.rightMul = 1.0;
            }
        }
    }

    // ── Sync oscillator params (once per buffer, not per sample) ─────────
    for (int32_t o = 0; o < numOsc; ++o) {
        auto& p = e->params[o];
        auto& s = e->states[o];

        const uint32_t gen = p.generation.load(std::memory_order_acquire);
        if (gen == s.lastGen) continue;
        s.lastGen = gen;

        const double newFreq  = p.targetFreq.load(std::memory_order_relaxed);
        const double glideSec = p.glideSeconds.load(std::memory_order_relaxed);
        const double newVol   = p.targetVolume.load(std::memory_order_relaxed);
        const double newPan   = p.targetPan.load(std::memory_order_relaxed);
        const double newRich  = p.harmonicRichness.load(std::memory_order_relaxed);
        const int32_t newWf   = p.waveform.load(std::memory_order_relaxed);
        const bool isActive   = p.active.load(std::memory_order_relaxed);
        const bool isDeact    = p.deactivating.load(std::memory_order_relaxed);

        // ── Sync oscillator params ─────────
        s.targetVolume = newVol;
        s.targetPan    = newPan;
        s.richness     = newRich;
        s.waveform     = newWf;

        if (isDeact) {
            s.targetVolume = 0.0;
        }

        // ── GLIDE LOGIK ──
        if (!s.active && isActive) {
            // Oszillator wacht gerade erst auf: Sofortiger Snap
            s.currentFreq = newFreq;
            s.startFreq = newFreq;
            s.targetFreq = newFreq;
            s.freqRampPhase = 1.0;
            s.currentPan  = newPan;

            // Golden Ratio Phase Spreading
            s.carrierPhase = 0.0;
            s.subPhase = fmod(s.carrierPhase + (SC_PHI * 0.2), 1.0);
            s.octPhase = fmod(s.carrierPhase + (SC_PHI * 0.4), 1.0);
            s.phiPhase = fmod(s.carrierPhase + (SC_PHI * 0.6), 1.0);
        } else if (s.targetFreq != newFreq) {
            // Ein Frequenz-Shift wurde aus dem JSON-Playbook angefordert!
            s.startFreq = s.currentFreq;
            s.targetFreq = newFreq;

            if (glideSec > 0.001) {
                // Berechne den Phasen-Zuwachs pro Sample für exakt 'glideSec' Sekunden
                s.freqRampInc = 1.0 / (glideSec * e->sampleRate);
                s.freqRampPhase = 0.0; // Feuer frei!
            } else {
                // Sofortiger Sprung (Fallback, falls glideSec = 0)
                s.currentFreq = newFreq;
                s.freqRampPhase = 1.0;
            }
        }

        s.active = isActive;
    }

    // ── Per-sample rendering ─────────────────────────────────────────────
    auto& ps = e->panState;

    for (int32_t i = 0; i < numFrames; ++i) {

        // ── Advance Panning LFO (once per sample, before oscillators) ────
        if (ps.enabled) {
            const double phaseInc = invSr / (ps.cycleSec > 0.01 ? ps.cycleSec : 0.01);
            ps.phase = advancePhase(ps.phase, phaseInc);

            const double s_val = fastSine(ps.phase);
            // Modulationskurve als "exponentieller Sinus" (s * |s|),
            // damit die Puls-Pausen weicher ausklingen und das LFO-Stepping reduziert wird.
            const double panMod = ps.depth * s_val * std::abs(s_val);

            if (ps.mode == SOULCORE_PAN_CIRCULAR) {
                // 8D: front/back depth via cosine distance modulation
                const double dist = 0.75 + 0.25 * fastSine(ps.phase + 0.25);
                ps.leftMul  = (1.0 - panMod) * dist;
                ps.rightMul = (1.0 + panMod) * dist;
            } else {
                ps.leftMul  = 1.0 - panMod;
                ps.rightMul = 1.0 + panMod;
            }
        }

        // ── Accumulate all oscillators into this frame ────────────────────
        double frameL = 0.0;
        double frameR = 0.0;

        for (int32_t o = 0; o < numOsc; ++o) {
            auto& s = e->states[o];

            // Guard: Komplett lautlos und inaktiv? Überspringen.
            if (!s.active && s.currentVolume < 0.0001) continue;

            // ── 1. FREQUENCY SMOOTHSTEP GLIDE (Die Acoustic Geometry) ──
            if (s.freqRampPhase < 1.0) {
                s.freqRampPhase += s.freqRampInc;
                if (s.freqRampPhase >= 1.0) {
                    s.freqRampPhase = 1.0;
                    s.currentFreq = s.targetFreq;
                } else {
                    // Magie: Interpoliere den Weg mit der S-Kurve
                    double t = smoothstep(s.freqRampPhase);
                    s.currentFreq = s.startFreq + t * (s.targetFreq - s.startFreq);
                }
            }

            // ── 2. Volume & Panning Kondensator-Glättung (Wie gehabt) ──
            s.currentVolume += (s.targetVolume - s.currentVolume) * SC_SMOOTH_VOL;
            s.currentPan    += (s.targetPan - s.currentPan) * SC_SMOOTH_PAN;

            // Deaktivierung abfangen
            if (e->params[o].deactivating.load(std::memory_order_relaxed) && s.currentVolume < 0.0001) {
                s.active = false;
                e->params[o].active.store(false, std::memory_order_relaxed);
                continue;
            }

            if (s.currentFreq <= 0.0 || s.currentVolume < 0.0001) continue;

            // ── 3. Ableitungen & HF Attenuation (wie gehabt) ──
            const double freq    = s.currentFreq;
            const double subFreq = (freq * 0.5) - SC_DELTA_DT;
            const double octFreq = (freq * 2.0) + SC_THETA_OT;
            const double phiFreq = (freq * SC_PHI) - SC_SCHUMANN;

            const double cAtt = carrierAtten(freq);
            const double hAtt = harmonicAtten(freq);

            const double cInc   = freq * invSr;
            const double subInc = subFreq > 0.0 ? subFreq * invSr : 0.0;
            const double octInc = octFreq * invSr;
            const double phiInc = phiFreq > 0.0 ? phiFreq * invSr : 0.0;

            // ── 3.1 High-Fidelity Synthese (Wavetable Turbo!) ──
            double sample = 0.0;
            if (s.waveform == SOULCORE_SINE) {
                sample = fastSine(s.carrierPhase) * cAtt;
            } else {
                sample = waveformSample(s.carrierPhase, s.waveform) * cAtt; // Fallback für Saw/Square
            }

            const double r = s.richness;
            if (r > 0.0) {
                if (subFreq > 0.0 && freq > 60.0) {
                    sample += fastSine(s.subPhase) * SC_SUB_VOL * r;
                }
                sample += fastSine(s.octPhase) * SC_OCT_VOL * r * hAtt;
                if (phiFreq > 0.0) {
                    sample += fastSine(s.phiPhase) * SC_PHI_VOL * r * hAtt;
                }
            }

            // ── 4. Phase Advance ──
            s.carrierPhase = advancePhase(s.carrierPhase, cInc);
            if (subInc > 0.0) s.subPhase = advancePhase(s.subPhase, subInc);
            s.octPhase = advancePhase(s.octPhase, octInc);
            if (phiInc > 0.0) s.phiPhase = advancePhase(s.phiPhase, phiInc);

            // ── 5. Volume & Panning ──
            double effVol = s.currentVolume * masterVol;

            // Panning LFO
            if (ps.enabled) {
                const double absPan = std::abs(s.currentPan);
                if (s.currentPan < 0.0) {
                    effVol *= 1.0 + absPan * (ps.leftMul - 1.0);
                } else if (s.currentPan > 0.0) {
                    effVol *= 1.0 + absPan * (ps.rightMul - 1.0);
                }
            }

            sample *= effVol;

            // ── 5. Constant-power stereo pan law (ULTRA FAST) ──
            // s.currentPan ∈ [-1, +1].
            // Wir mappen das auf eine Phase von [0.0, 0.25] (entspricht 0 bis PI/2)
            const double panPhase = (s.currentPan + 1.0) * 0.125;

            // cos(x) ist sin(x + 90°). 90° = 0.25 in unserer normierten Phase
            const double gainL = fastSine(panPhase + 0.25);
            const double gainR = fastSine(panPhase);

            frameL += sample * gainL;
            frameR += sample * gainR;
        }

        // ── Write stereo frame to output ─────────────────────────────────
        const int32_t idx = i * 2;
        buf[idx]     = static_cast<float>(frameL);
        buf[idx + 1] = static_cast<float>(frameR);
    }

    // ── Final safety limiter pass ────────────────────────────────────────
    // Separate pass to avoid branch overhead in the hot inner loop.
    const int32_t totalSamples = numFrames * 2;
    for (int32_t i = 0; i < totalSamples; ++i) {
        buf[i] = softLimit(buf[i]);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTICS — Safe to call from any thread (reads audio-thread state).
// Values may be 1 buffer behind; acceptable for UI display.
// ═══════════════════════════════════════════════════════════════════════════

SOULCORE_EXPORT double soulcore_get_current_freq(const SoulCoreEngine* e, int32_t idx) {
    if (!e || idx < 0 || idx >= e->maxOsc) return 0.0;
    return e->states[idx].currentFreq;
}

SOULCORE_EXPORT double soulcore_get_current_volume(const SoulCoreEngine* e, int32_t idx) {
    if (!e || idx < 0 || idx >= e->maxOsc) return 0.0;
    return e->states[idx].currentVolume;
}

SOULCORE_EXPORT double soulcore_get_pan_position(const SoulCoreEngine* e) {
    if (!e) return 0.0;
    return std::sin(e->panState.phase * SC_TWO_PI);
}

SOULCORE_EXPORT int32_t soulcore_get_active_count(const SoulCoreEngine* e) {
    if (!e) return 0;
    int32_t n = 0;
    for (int32_t i = 0; i < e->maxOsc; ++i) {
        if (e->states[i].active || e->states[i].currentVolume > 0.0001) ++n;
    }
    return n;
}

} // extern "C"
