#include <cmath>
#include <emscripten.h>

extern "C" {
    double phaseLeft = 0.0;
    double phaseRight = 0.0;
    const double PI_2 = 6.283185307179586;

    // State for smooth parameter ramping
    float currentCarrier = 0.0f;
    float currentBeat = 0.0f;
    float currentVolume = 0.0f;
    bool isInitialized = false;

    // Low-pass filter factor for smooth interpolation (approx 100ms fade at 48kHz)
    const float RAMP_FACTOR = 0.0002f;

    EMSCRIPTEN_KEEPALIVE
    void process_binaural(float* outLeft, float* outRight, int frames, float sampleRate, float targetCarrier, float targetBeat, float targetVolume) {
        if (!isInitialized) {
            // First run: snap frequencies to avoid pitch-glides, but fade volume in from 0
            currentCarrier = targetCarrier;
            currentBeat = targetBeat;
            currentVolume = 0.0f; 
            isInitialized = true;
        }

        for (int i = 0; i < frames; ++i) {
            // Smoothly interpolate parameters towards targets
            currentCarrier += (targetCarrier - currentCarrier) * RAMP_FACTOR;
            currentBeat += (targetBeat - currentBeat) * RAMP_FACTOR;
            currentVolume += (targetVolume - currentVolume) * RAMP_FACTOR;

            double phaseIncL = (currentCarrier * PI_2) / sampleRate;
            double phaseIncR = ((currentCarrier + currentBeat) * PI_2) / sampleRate;

            outLeft[i] = sin(phaseLeft) * currentVolume;
            outRight[i] = sin(phaseRight) * currentVolume;

            // Phase accumulation with precise wraparound
            phaseLeft += phaseIncL;
            if (phaseLeft >= PI_2) phaseLeft -= PI_2;

            phaseRight += phaseIncR;
            if (phaseRight >= PI_2) phaseRight -= PI_2;
        }
    }
}
