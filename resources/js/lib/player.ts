/**
 * Plays the score through the browser: every part, following the tempo
 * map (including rit. and accel.), from a chosen bar. Notes are counted in
 * beats; this is the one place they become seconds.
 */
import { beatsInBar, midiOf, tempoAt } from '@/lib/music';
import { audio, playTone } from '@/lib/tone';
import type { ScoreDocument, Voice } from '@/types/score';

/** Sol-fa tenor lines are written an octave above where men sing them. */
const OCTAVE_SHIFT: Record<Voice, number> = { S: 0, A: 0, T: -12, B: 0 };

/**
 * Seconds per beat at each beat of a bar. A rit. or accel. event at bar n
 * bends the tempo across bar n − 1 towards its new speed.
 */
function beatSeconds(document: ScoreDocument, bar: number): number[] {
    const beats = beatsInBar(document.map, bar);
    const bpm = tempoAt(document.map, bar);
    const next = document.map.find((e) => e.bar === bar + 1 && e.bpm !== null && e.ramp !== 'at_once');

    return Array.from({ length: beats }, (_, i) => {
        const target = next?.bpm ?? bpm;
        const t = beats > 1 ? i / (beats - 1) : 1;
        const current = next ? bpm + (target - bpm) * t : bpm;

        return 60 / Math.max(20, current);
    });
}

/** When one bar sounds, in audio-clock seconds. */
export type BarTime = { bar: number; at: number; beats: number[]; end: number };

export type Playback = {
    stop: () => void;
    endsAt: number;
    /** Each bar's start, beat starts and end, for following along on the sheet. */
    timeline: BarTime[];
    /** Change which parts sound while playback runs. */
    hear: (voices: Voice[]) => void;
};

const NOTE_VOLUME = 0.16;

/**
 * Start playing from `fromBar` (to `toBar`, default the end), sounding only
 * the parts in `heard`. Each part runs through its own gain, so parts can be
 * muted or brought back mid-play.
 */
export function play(document: ScoreDocument, doh: string, fromBar: number, toBar: number | undefined, heard: Voice[]): Playback {
    const ctx = audio();
    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);

    const gains = new Map<Voice, GainNode>();

    for (const part of document.parts) {
        const gain = ctx.createGain();
        gain.gain.value = heard.includes(part.id) ? 1 : 0;
        gain.connect(master);
        gains.set(part.id, gain);
    }

    const oscillators: OscillatorNode[] = [];
    const timeline: BarTime[] = [];
    let time = ctx.currentTime + 0.08;
    const last = Math.min(toBar ?? document.bars, document.bars);

    for (let bar = fromBar; bar <= last; bar++) {
        const lengths = beatSeconds(document, bar);
        const startOf = (beat: number) => {
            let seconds = 0;

            for (let b = 0; b < Math.floor(beat); b++) seconds += lengths[b] ?? lengths[lengths.length - 1];

            return seconds + (beat - Math.floor(beat)) * (lengths[Math.floor(beat)] ?? lengths[lengths.length - 1]);
        };

        for (const part of document.parts) {
            const gain = gains.get(part.id);

            if (!gain) continue;

            for (const note of part.bars[bar - 1]?.notes ?? []) {
                const midi = midiOf(note, doh);

                if (midi === null) continue;

                const start = time + startOf(note.start);
                const seconds = startOf(note.start + note.length) - startOf(note.start);

                oscillators.push(playTone(midi + OCTAVE_SHIFT[part.id], start, seconds, NOTE_VOLUME, gain));
            }
        }

        const total = lengths.reduce((a, b) => a + b, 0);
        timeline.push({ bar, at: time, beats: lengths.map((_, i) => time + startOf(i)), end: time + total });
        time += total;
    }

    return {
        endsAt: time,
        timeline,
        hear: (voices) => {
            gains.forEach((gain, voice) => {
                gain.gain.setTargetAtTime(voices.includes(voice) ? 1 : 0, ctx.currentTime, 0.02);
            });
        },
        stop: () => {
            master.gain.cancelScheduledValues(ctx.currentTime);
            master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
            master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
            window.setTimeout(() => {
                oscillators.forEach((o) => {
                    try {
                        o.stop();
                    } catch {
                        // already stopped
                    }
                });
                master.disconnect();
            }, 80);
        },
    };
}
