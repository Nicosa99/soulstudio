#include <cmath>
#include <emscripten.h>
#include <stdlib.h>

extern "C" {
    const int MAX_VOICES = 32;
    const double PI_2 = 6.28318530717958647692;
    const float RAMP_FACTOR = 0.02f;

    struct Voice {
        double phaseL;
        double phaseR;
        float curCarrier, curBeat, curVol, curHarm, curPan;
        float tgtCarrier, tgtBeat, tgtVol, tgtHarm, tgtPan;
        bool active;
    };

    static Voice voices[MAX_VOICES];

    EMSCRIPTEN_KEEPALIVE
    void* malloc_internal(int size) {
        return malloc(size);
    }

    EMSCRIPTEN_KEEPALIVE
    void free_internal(void* ptr) {
        free(ptr);
    }

    EMSCRIPTEN_KEEPALIVE
    void init_engine() {
        for (int i = 0; i < MAX_VOICES; ++i) {
            voices[i].active = false;
            voices[i].phaseL = 0.0;
            voices[i].phaseR = 0.0;
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
        v.tgtCarrier = carrier;
        v.tgtBeat = beat;
        v.tgtVol = volume;
        v.tgtHarm = harmonizer;
        v.tgtPan = pan; 
        
        if (!v.active && volume > 0.0f) {
            v.active = true;
            v.curCarrier = carrier;
            v.curBeat = beat;
            v.curHarm = harmonizer;
            v.curPan = pan;
            v.curVol = 0.0f;
            // No phase reset here to keep continuous wave
        }
    }

    EMSCRIPTEN_KEEPALIVE
    void stop_voice(int index) {
        if (index < 0 || index >= MAX_VOICES) return;
        voices[index].tgtVol = 0.0f;
    }

    EMSCRIPTEN_KEEPALIVE
    void process_binaural(float* outLeft, float* outRight, int frames, float sampleRate) {
        if (!outLeft || !outRight || frames <= 0 || sampleRate <= 0) return;

        for (int i = 0; i < frames; ++i) {
            outLeft[i] = 0.0f;
            outRight[i] = 0.0f;
        }

        for (int i = 0; i < MAX_VOICES; ++i) {
            if (!voices[i].active) continue;
            Voice& v = voices[i];

            for (int f = 0; f < frames; ++f) {
                // Smooth parameter ramping
                v.curCarrier += (v.tgtCarrier - v.curCarrier) * RAMP_FACTOR;
                v.curBeat += (v.tgtBeat - v.curBeat) * RAMP_FACTOR;
                v.curVol += (v.tgtVol - v.curVol) * RAMP_FACTOR;
                v.curHarm += (v.tgtHarm - v.curHarm) * RAMP_FACTOR;
                v.curPan += (v.tgtPan - v.curPan) * RAMP_FACTOR;

                double incL = (v.curCarrier * PI_2) / sampleRate;
                double incR = ((v.curCarrier + v.curBeat) * PI_2) / sampleRate;

                float harm = v.curHarm;
                // Richer texture with overtones
                float sL = sinf((float)v.phaseL) * 0.8f + sinf((float)v.phaseL * 2.0f) * 0.15f * harm + sinf((float)v.phaseL * 3.0f) * 0.05f * harm;
                float sR = sinf((float)v.phaseR) * 0.8f + sinf((float)v.phaseR * 2.0f) * 0.15f * harm + sinf((float)v.phaseR * 3.0f) * 0.05f * harm;

                // Constant Power Panning
                float panVal = v.curPan; // 0..1
                float gainL = cosf(panVal * 1.570796f);
                float gainR = sinf(panVal * 1.570796f);

                outLeft[f] += sL * v.curVol * gainL;
                outRight[f] += sR * v.curVol * gainR;

                v.phaseL += incL;
                if (v.phaseL >= PI_2) v.phaseL -= PI_2;
                v.phaseR += incR;
                if (v.phaseR >= PI_2) v.phaseR -= PI_2;
            }

            // Deactivate if silent and target is silent
            if (v.tgtVol < 0.0001f && v.curVol < 0.0001f) {
                v.active = false;
            }
        }
    }
}
