/**
 * Reading and writing tonic sol-fa for the screen.
 *
 * Bars print the way choirs write them by hand: beats separated by ":",
 * the middle of a 4-beat bar marked "¦", a held beat as "–", and a
 * half-beat note joined with "." — e.g. `s :–.l¦ s :m`.
 */
import type {
    DohKey,
    MapEvent,
    Note,
    Part,
    Pitch,
    ScoreDocument,
    Syllable,
    Voice,
} from '@/types/score';

export const VOICES: Voice[] = ['S', 'A', 'T', 'B'];

export const VOICE_NAMES: Record<Voice, string> = {
    S: 'Soprano',
    A: 'Alto',
    T: 'Tenor',
    B: 'Bass',
};

export const DOH_KEYS: DohKey[] = [
    'C',
    'C#',
    'Db',
    'D',
    'Eb',
    'E',
    'F',
    'F#',
    'Gb',
    'G',
    'Ab',
    'A',
    'Bb',
    'B',
];

/** "Eb" → "E♭", "F#" → "F♯". */
export function keyLabel(doh: string): string {
    return doh.replace('b', '♭').replace('#', '♯');
}

const KEY_SEMITONES: Record<DohKey, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    Ab: 8,
    A: 9,
    Bb: 10,
    B: 11,
};

const PITCH_SEMITONES: Record<Exclude<Pitch, 'rest'>, number> = {
    d: 0,
    r: 2,
    m: 4,
    f: 5,
    fe: 6,
    s: 7,
    l: 9,
    ta: 10,
    t: 11,
};

export function dohSemitone(doh: string): number {
    return KEY_SEMITONES[doh as DohKey] ?? 0;
}

/** MIDI number of a note once the key is known (middle doh in octave 4). */
export function midiOf(note: Pick<Note, 'pitch' | 'octave'>, doh: string): number | null {
    if (note.pitch === 'rest') {
        return null;
    }

    return 60 + dohSemitone(doh) + PITCH_SEMITONES[note.pitch] + 12 * note.octave;
}

const NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** "m" in E♭ → "G". */
export function soundsLike(note: Pick<Note, 'pitch' | 'octave'>, doh: string): string {
    const midi = midiOf(note, doh);

    if (midi === null) {
        return 'Rest';
    }

    const names = doh.includes('#') ? NOTE_NAMES_SHARP : NOTE_NAMES_FLAT;

    return names[((midi % 12) + 12) % 12];
}

/** "s" + low octave → "s₁"; high → "s'". */
export function noteLabel(note: Pick<Note, 'pitch' | 'octave'>): string {
    if (note.pitch === 'rest') {
        return '';
    }

    if (note.octave === -1) {
        return `${note.pitch}₁`;
    }

    if (note.octave === 1) {
        return `${note.pitch}'`;
    }

    return note.pitch;
}

const EPS = 1e-6;

/** Where the "¦" falls: after beat 2 of 4, after beat 3 of 6. */
export function halfBarAt(beats: number): number | null {
    if (beats === 4) {
        return 2;
    }

    if (beats === 6) {
        return 3;
    }

    return null;
}

/**
 * What happens inside one beat: e.g. "m", "–", "–.l", "m.r", "d,r.m,f".
 */
function beatToken(notes: Note[], beat: number): string {
    let token = '';

    for (const offset of [0, 0.25, 0.5, 0.75]) {
        const at = beat + offset;
        const starting = notes.find((n) => Math.abs(n.start - at) < EPS);

        if (starting) {
            const sep = offset === 0 ? '' : offset === 0.5 ? '.' : ',';
            token += sep + noteLabel(starting);
            continue;
        }

        if (offset === 0) {
            const held = notes.find((n) => n.start < at - EPS && n.start + n.length > at + EPS);

            if (held && held.pitch !== 'rest') {
                token += '–';
            }
        }
    }

    return token;
}

/**
 * Each beat as "separator + token + padding", so the four parts' columns
 * line up: `d :d  ¦ r :m`, `s₁:t₁ ¦ d :r`, `s :–.l¦ s :m`, `s :f :m`.
 */
function pieces(tokens: string[], beats: number, padTo: number): { sep: string; token: string; pad: string }[] {
    const half = halfBarAt(beats);

    return tokens.map((token, i) => {
        const sep = i === 0 ? '' : half !== null && i === half ? '¦ ' : ':';
        const isLast = i === tokens.length - 1;
        const width = half !== null && i + 1 === half ? Math.max(padTo, 3) : padTo;
        const length = [...token].length;

        return { sep, token, pad: isLast || length >= width ? '' : ' '.repeat(width - length) };
    });
}

function tokensOf(notes: Note[], beats: number): string[] {
    return Array.from({ length: beats }, (_, beat) => beatToken(notes, beat));
}

/** One bar of one part as sol-fa text. */
export function formatBar(notes: Note[], beats: number): string {
    return pieces(tokensOf(notes, beats), beats, 2)
        .map((p) => p.sep + p.token + p.pad)
        .join('');
}

/** The faint dotted placeholder for an empty bar: `·  :·  ¦ ·  :·`. */
export function emptyBar(beats: number): string {
    const tokens = Array.from({ length: beats }, () => '·');

    return pieces(tokens, beats, halfBarAt(beats) === null ? 2 : 3)
        .map((p) => p.sep + p.token + p.pad)
        .join('');
}

/**
 * The bar's text split around beat `beat`, for drawing the cursor chip:
 * `m :–.f¦ m :` + [m] + ``.
 */
export function splitBarAt(
    notes: Note[],
    beats: number,
    beat: number,
): { before: string; at: string; after: string } {
    const index = Math.min(beats - 1, Math.max(0, Math.floor(beat + EPS)));
    const all = pieces(tokensOf(notes, beats), beats, 2);

    const before = all.slice(0, index).map((p) => p.sep + p.token + p.pad).join('') + all[index].sep;
    const after = all[index].pad + all.slice(index + 1).map((p) => p.sep + p.token + p.pad).join('');

    return { before, at: all[index].token, after };
}

/** How many beats bar `bar` has, following the tempo & time map. */
export function beatsInBar(map: MapEvent[], bar: number): number {
    return mapValueAt(map, bar, (e) => e.beats);
}

/** Beats per minute in force at the start of bar `bar`. */
export function tempoAt(map: MapEvent[], bar: number): number {
    return mapValueAt(map, bar, (e) => e.bpm);
}

function mapValueAt(map: MapEvent[], bar: number, pick: (e: MapEvent) => number | null): number {
    let value = 0;

    for (const event of map) {
        if (event.bar > bar) {
            break;
        }

        const v = pick(event);

        if (v !== null && (event.until === null || bar <= event.until)) {
            value = v;
        }
    }

    return value;
}

/** "4/4", "3/4", "6/8". */
export function timeLabel(beats: number): string {
    return beats === 6 ? '6/8' : `${beats}/4`;
}

export function tempoName(bpm: number): string {
    if (bpm < 60) return 'Largo · very slow';
    if (bpm < 76) return 'Adagio · slow';
    if (bpm < 96) return 'Andante · walking';
    if (bpm < 120) return 'Moderato · steady';
    if (bpm < 156) return 'Allegro · fast';

    return 'Presto · very fast';
}

/** The note sounding in `part` at `bar`/`beat` (starting there or held over it). */
export function noteAt(part: Part | undefined, bar: number, beat: number): Note | undefined {
    const notes = part?.bars[bar - 1]?.notes ?? [];

    return notes.find((n) => n.start <= beat + EPS && n.start + n.length > beat + EPS);
}

export function partOf(document: ScoreDocument, voice: Voice): Part | undefined {
    return document.parts.find((p) => p.id === voice);
}

export function partHasNotes(part: Part | undefined): boolean {
    return part?.bars.some((bar) => bar.notes.length > 0) ?? false;
}

/**
 * Words in one bar as they print: `O–nya–me  ye` — a split joins with "–",
 * separate words get two spaces.
 */
export function formatWords(syllables: Syllable[]): string {
    let out = '';

    syllables.forEach((s, i) => {
        out += s.text;

        if (s.join === 'split') {
            out += '–';
        } else if (i < syllables.length - 1) {
            out += '  ';
        }
    });

    return out;
}

export function langLabel(lang: string): string {
    const names: Record<string, string> = {
        tw: 'Twi',
        en: 'English',
        ee: 'Ewe',
        ga: 'Ga',
        fr: 'French',
    };

    return names[lang] ?? lang.toUpperCase();
}

const CHORDS: { numeral: string; name: string; tones: Pitch[] }[] = [
    { numeral: 'I', name: 'Home chord', tones: ['d', 'm', 's'] },
    { numeral: 'IV', name: 'IV chord', tones: ['f', 'l', 'd'] },
    { numeral: 'V', name: 'V chord', tones: ['s', 't', 'r'] },
    { numeral: 'ii', name: 'ii chord', tones: ['r', 'f', 'l'] },
    { numeral: 'vi', name: 'vi chord', tones: ['l', 'd', 'm'] },
];

/**
 * Names the chord the sounding parts make, and what the empty parts could
 * sing to complete it: "Home chord so far (d · m · s). Tenor on d, bass
 * on d₁ would complete it."
 */
export function chordHint(
    sounding: { voice: Voice; note: Note | undefined }[],
): { numeral: string; text: string } | null {
    const pitches = sounding
        .map((s) => s.note?.pitch)
        .filter((p): p is Pitch => p !== undefined && p !== 'rest');

    if (pitches.length < 2) {
        return null;
    }

    const chord = CHORDS.find((c) => pitches.every((p) => c.tones.includes(p)));

    if (!chord) {
        return null;
    }

    const root = chord.tones[0];
    const missing = sounding.filter((s) => s.note === undefined || s.note.pitch === 'rest');
    const fill = missing
        .filter((s) => s.voice === 'T' || s.voice === 'B')
        .map((s) => `${VOICE_NAMES[s.voice].toLowerCase()} on ${s.voice === 'B' ? `${root}₁` : root}`);

    let text = `${chord.name} so far (${chord.tones.join(' · ')}).`;

    if (fill.length > 0) {
        const joined = fill.join(', ');
        text += ` ${joined.charAt(0).toUpperCase()}${joined.slice(1)} would complete it.`;
    }

    return { numeral: chord.numeral, text };
}

/** Bars grouped four to a line, as on the printed sheet. */
export function systemsOf(bars: number, perSystem = 4): number[][] {
    const systems: number[][] = [];

    for (let start = 1; start <= bars; start += perSystem) {
        systems.push(
            Array.from({ length: Math.min(perSystem, bars - start + 1) }, (_, i) => start + i),
        );
    }

    return systems;
}
