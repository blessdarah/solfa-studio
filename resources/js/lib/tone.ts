/**
 * A tiny shared audio context, so "Tap to play E♭" and score playback
 * use one engine. Browsers only allow sound after a tap, so it is created
 * on first use.
 */
let context: AudioContext | null = null;

export function audio(): AudioContext {
    if (context === null) {
        context = new AudioContext();
    }

    if (context.state === 'suspended') {
        void context.resume();
    }

    return context;
}

export function midiToHz(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * A soft, organ-like tone: a triangle wave with a short fade in and out.
 * `glide` moves it to new pitches on the way (a slur) without a new attack.
 */
export function playTone(
    midi: number,
    at: number,
    seconds: number,
    volume = 0.18,
    destination?: AudioNode,
    glide: { midi: number; at: number }[] = [],
): OscillatorNode {
    const ctx = audio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = midiToHz(midi);

    // Slurred notes: one sound that glides to each new pitch instead of starting again.
    if (glide.length > 0) osc.frequency.setValueAtTime(midiToHz(midi), at);

    for (const step of glide) {
        osc.frequency.setTargetAtTime(midiToHz(step.midi), Math.max(at, step.at - 0.01), 0.012);
    }

    const end = at + Math.max(0.08, seconds * 0.94);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.02);
    gain.gain.setValueAtTime(volume, Math.max(at + 0.02, end - 0.06));
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain).connect(destination ?? ctx.destination);
    osc.start(at);
    osc.stop(end + 0.02);

    return osc;
}
