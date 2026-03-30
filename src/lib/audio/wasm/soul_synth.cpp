#include <stdint.h>
#include <cmath>
#include <emscripten.h>

extern "C" {
    const int MAX_VOICES = 32;
    const int MAX_FRAMES = 1024;
    const float PI_2 = 6.28318530717958647692f;

    struct Voice {
        float phaseL;
        float phaseR;
        float curCarrier, curBeat, curVol, curHarm, curPan;
        float tgtCarrier, tgtBeat, tgtVol, tgtHarm, tgtPan;
        bool active;
    };

    static Voice voices[MAX_VOICES];
    static float bufferL[MAX_FRAMES] __attribute__((aligned(16)));
    static float bufferR[MAX_FRAMES] __attribute__((aligned(16)));

    EMSCRIPTEN_KEEPALIVE
    float* get_buffer_l() { return &bufferL[0]; }
    
    EMSCRIPTEN_KEEPALIVE
    float* get_buffer_r() { return &bufferR[0]; }

    EMSCRIPTEN_KEEPALIVE
    void init_engine() {
        for (int i = 0; i < MAX_VOICES; ++i) {
            voices[i].active = false;
            voices[i].phaseL = 0.0f;
            voices[i].phaseR = 0.0f;
            voices[i].curVol = 0.0f;
            voices[i].tgtVol = 0.0f;
            voices[i].curPan = 0.5f;
            voices[i].tgtPan = 0.5f;
        }
    }

    EMSCRIPTEN_KEEPALIVE
    void set_voice(int index, float carrier, float beat, float volume, float harmonizer, float pan) {
        if (index < 0 || index >= MAX_VOICES) return;
        
        Voice& v = voices[index];
        v.tgtCarrier = (carrier < 20.0f) ? 20.0f : (carrier > 10000.0f ? 10000.0f : carrier);
        v.tgtBeat = (beat < -100.0f) ? -100.0f : (beat > 100.0f ? 100.0f : beat);
        v.tgtVol = (volume < 0.0f) ? 0.0f : (volume > 1.0f ? 1.0f : volume);
        v.tgtHarm = (harmonizer < 0.0f) ? 0.0f : (harmonizer > 1.0f ? 1.0f : harmonizer);
        v.tgtPan = (pan < 0.0f) ? 0.0f : (pan > 1.0f ? 1.0f : pan);
        
        if (!v.active && v.tgtVol > 0.0001f) {
            v.active = true;
            v.curCarrier = v.tgtCarrier;
            v.curBeat = v.tgtBeat;
            v.curHarm = v.tgtHarm;
            v.curPan = v.tgtPan;
            v.curVol = 0.0f; 
        }
    }

    EMSCRIPTEN_KEEPALIVE
    void stop_voice(int index) {
        if (index < 0 || index >= MAX_VOICES) return;
        voices[index].tgtVol = 0.0f;
    }

    EMSCRIPTEN_KEEPALIVE
    void process_binaural(int frames, float sampleRate) {
        if (sampleRate < 1.0f) sampleRate = 48000.0f;
        int actualFrames = (frames > MAX_FRAMES) ? MAX_FRAMES : frames;

        for (int i = 0; i < actualFrames; ++i) {
            bufferL[i] = 0.0f;
            bufferR[i] = 0.0f;
        }

        const float RAMP = 0.05f;

        for (int i = 0; i < MAX_VOICES; ++i) {
            if (!voices[i].active) continue;
            Voice& v = voices[i];

            for (int f = 0; f < actualFrames; ++f) {
                v.curCarrier += (v.tgtCarrier - v.curCarrier) * RAMP;
                v.curBeat += (v.tgtBeat - v.curBeat) * RAMP;
                v.curVol += (v.tgtVol - v.curVol) * RAMP;
                v.curPan += (v.tgtPan - v.curPan) * RAMP;
                v.curHarm += (v.tgtHarm - v.curHarm) * RAMP;

                float stepL = (v.curCarrier * PI_2) / sampleRate;
                float stepR = ((v.curCarrier + v.curBeat) * PI_2) / sampleRate;

                float sL = sinf(v.phaseL);
                float sR = sinf(v.phaseR);

                if (v.curHarm > 0.01f) {
                    sL += sinf(v.phaseL * 2.0f) * 0.15f * v.curHarm;
                    sR += sinf(v.phaseR * 2.0f) * 0.15f * v.curHarm;
                }

                bufferL[f] += sL * v.curVol * (1.0f - v.curPan);
                bufferR[f] += sR * v.curVol * v.curPan;

                v.phaseL = fmodf(v.phaseL + stepL, PI_2);
                v.phaseR = fmodf(v.phaseR + stepR, PI_2);
            }

            if (v.tgtVol < 0.0001f && v.curVol < 0.0001f) v.active = false;
        }
    }
}
