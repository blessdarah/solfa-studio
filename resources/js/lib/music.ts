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

/** "s" + low octave → "s₁", two below → "s₂"; high → "s'", two above → "s''". */
export function noteLabel(note: Pick<Note, 'pitch' | 'octave'> & { tie?: boolean }): string {
    // A note held over from the bar before is written as a hold.
    if (note.tie) {
        return '–';
    }

    if (note.pitch === 'rest') {
        return '';
    }

    if (note.octave < 0) {
        return `${note.pitch}${note.octave === -2 ? '₂' : '₁'}`;
    }

    return note.pitch + "'".repeat(note.octave);
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
/** A third of a beat, for triplets. */
export const THIRD = 1 / 3;

/** Is `at` a third or two-thirds of the way through its beat? */
export function onThird(at: number): boolean {
    const frac = at - Math.floor(at + EPS);

    return Math.abs(frac - THIRD) < 1e-4 || Math.abs(frac - 2 * THIRD) < 1e-4;
}

/** A beat split into three (a triplet: f,f,f) — some note starts on a third of it. */
function isTriplet(notes: Note[], beat: number, cursorAt?: number): boolean {
    const third = (at: number) => at > beat + EPS && at < beat + 1 - EPS && onThird(at);

    return notes.some((n) => third(n.start)) || (cursorAt !== undefined && third(cursorAt));
}

/** What sits at `at` inside a triplet: the note starting there, "–" for one held over it, or nothing. */
function thirdText(notes: Note[], at: number): string {
    const starting = notes.find((n) => Math.abs(n.start - at) < 1e-4);

    if (starting) return noteLabel(starting);

    const held = notes.find((n) => n.start < at - 1e-4 && n.start + n.length > at + 1e-4);

    return held && held.pitch !== 'rest' ? '–' : '';
}

function beatToken(notes: Note[], beat: number): string {
    // Thirds: "f,f,f", "d,–,r".
    if (isTriplet(notes, beat)) {
        return [0, THIRD, 2 * THIRD].map((o) => thirdText(notes, beat + o)).join(',');
    }

    let token = '';

    for (const offset of [0, 0.25, 0.5, 0.75]) {
        const at = beat + offset;
        const starting = notes.find((n) => Math.abs(n.start - at) < EPS);

        if (starting) {
            // ".," marks the last quarter after a note held through the half: d.,r
            const afterHeldHalf = offset === 0.75 && !notes.some((n) => Math.abs(n.start - (beat + 0.5)) < EPS);
            const sep = offset === 0 ? '' : offset === 0.5 ? '.' : afterHeldHalf ? '.,' : ',';
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

/**
 * One piece of a bar's sol-fa text. `slot` pieces are places the cursor can
 * sit (a note, a "–" hold, or an empty beat) and carry the beat they are at;
 * `sep` and `pad` are the ":" "¦" "." "," marks and alignment spaces.
 */
export type BarSegment = { kind: 'slot' | 'sep' | 'pad'; text: string; at: number };

const INNER_SEP = (offset: number, halfTaken: boolean) => (offset === 0.5 ? '.' : offset === 0.75 && !halfTaken ? '.,' : ',');

/**
 * The bar as clickable pieces, so a note inside a beat (the "t" of "d.t")
 * can be clicked and given the cursor. Joined, the text is exactly
 * formatBar's. With `cursorAt` on an empty spot inside a beat (just after
 * "."), an empty slot is added there so the cursor has somewhere to show.
 */
export function barSegments(notes: Note[], beats: number, cursorAt?: number): BarSegment[] {
    const half = halfBarAt(beats);
    const out: BarSegment[] = [];

    for (let beat = 0; beat < beats; beat++) {
        if (beat > 0) out.push({ kind: 'sep', text: half !== null && beat === half ? '¦ ' : ':', at: beat });

        const startOfBeat = out.length;

        if (isTriplet(notes, beat, cursorAt)) {
            [0, THIRD, 2 * THIRD].forEach((o, i) => {
                if (i > 0) out.push({ kind: 'sep', text: ',', at: beat + o });
                out.push({ kind: 'slot', text: thirdText(notes, beat + o), at: beat + o });
            });
        }

        for (const offset of isTriplet(notes, beat, cursorAt) ? [] : [0, 0.25, 0.5, 0.75]) {
            const at = beat + offset;
            const starting = notes.find((n) => Math.abs(n.start - at) < EPS);
            const halfTaken = notes.some((n) => Math.abs(n.start - (beat + 0.5)) < EPS);

            if (offset === 0) {
                const held = notes.find((n) => n.start < at - EPS && n.start + n.length > at + EPS);
                const text = starting ? noteLabel(starting) : held && held.pitch !== 'rest' ? '–' : '';
                out.push({ kind: 'slot', text, at });
                continue;
            }

            if (starting || (cursorAt !== undefined && Math.abs(cursorAt - at) < EPS)) {
                out.push({ kind: 'sep', text: INNER_SEP(offset, halfTaken), at });
                out.push({ kind: 'slot', text: starting ? noteLabel(starting) : '', at });
            }
        }

        const length = out.slice(startOfBeat).reduce((n, seg) => n + [...seg.text].length, 0);
        const isLast = beat === beats - 1;
        const width = half !== null && beat + 1 === half ? 3 : 2;

        if (!isLast && length < width) out.push({ kind: 'pad', text: ' '.repeat(width - length), at: beat });
    }

    return out;
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

// ------------------------------------------------------------ jumps & passes

/** 1 = first time through, 2 = after going back with D.S. (or D.C.). */
export type Pass = 1 | 2;

export type PlayStep = { bar: number; pass: Pass };

/** The pass a bar is limited to ("1st time" or "D.S. time"), or null if it always plays. */
export function barPass(document: ScoreDocument, bar: number): Pass | null {
    const section = document.sections.find((s) => s.ending !== null && bar >= s.from && bar <= s.to);

    return section ? (section.ending === 1 ? 1 : 2) : null;
}

function navAt(document: ScoreDocument, bar: number, value: string): boolean {
    return document.marks.some((m) => m.kind === 'nav' && m.value === value && m.at.bar === bar);
}

/**
 * The bars in the order they are sung, from `fromBar`: at a D.S. go back
 * to the $ sign (D.C.: to the start), skip "1st time" bars on the way
 * back and play the "D.S. time" bars instead, and stop at Fine.
 */
export function performanceOrder(document: ScoreDocument, fromBar: number): PlayStep[] {
    const steps: PlayStep[] = [];
    const segno = document.marks.find((m) => m.kind === 'nav' && m.value === '$')?.at.bar ?? 1;
    let pass: Pass = barPass(document, fromBar) === 2 ? 2 : 1;
    let bar = fromBar;

    while (bar <= document.bars && steps.length < document.bars * 3) {
        const only = barPass(document, bar);

        if (only !== null && only !== pass) {
            bar++;
            continue;
        }

        steps.push({ bar, pass });

        if (pass === 1 && (navAt(document, bar, 'DS') || navAt(document, bar, 'DC'))) {
            pass = 2;
            bar = navAt(document, bar, 'DS') ? segno : 1;
            continue;
        }

        if (pass === 2 && navAt(document, bar, 'Fine')) {
            break;
        }

        bar++;
    }

    return steps;
}

// ------------------------------------------------------------ line layout

/** The sheet's measures: a bar is at least 165px; a line holds 660px of bars. */
export const BAR_MIN_WIDTH = 165;
export const LINE_WIDTH = 660;

const BAR_PAD = 10; // left padding inside a bar
const CHIP_ROOM = 22; // the cursor chip's outline and caret
const SOLFA_CHAR = 14 * 0.6; // JetBrains Mono at 14px
const WORD_CHAR = 6.6; // Inter italic at 13px, roughly

/** How wide bar `barNo` must be for its busiest part (or line of words) to fit at full size. */
/** Bar sizing: the narrowest a bar may be, and room kept for the cursor chip (none on paper). */
export type BarSizing = { min?: number; chip?: number };

export function barWidth(document: ScoreDocument, barNo: number, sizing: BarSizing = {}): number {
    const beats = beatsInBar(document.map, barNo);
    const notes = Math.max(0, ...document.parts.map((p) => [...formatBar(p.bars[barNo - 1]?.notes ?? [], beats)].length));
    const words = Math.max(
        0,
        ...document.verses.flatMap((v) =>
            VOICES.map((voice) => formatWords(v.syllables.filter((s) => s.part === voice && s.bar === barNo).sort((a, b) => a.beat - b.beat)).length),
        ),
    );
    const needed = BAR_PAD + Math.max(notes * SOLFA_CHAR + (sizing.chip ?? CHIP_ROOM), words * WORD_CHAR + 12) + 6;

    return Math.max(sizing.min ?? BAR_MIN_WIDTH, Math.ceil(needed));
}

export type SheetLine = { bars: number[]; widths: number[] };

/**
 * Bars laid out in lines like a printed score: each bar as wide as its
 * music needs (never under 165px); when the next bar won't fit, the line
 * ends and that bar starts the next one. A line that ends early is spread
 * to the full width; the last line keeps its natural widths.
 */
export function layoutLines(document: ScoreDocument, lineWidth = LINE_WIDTH, sizing: BarSizing = {}): SheetLine[] {
    const lines: SheetLine[] = [];
    let line: SheetLine = { bars: [], widths: [] };
    let used = 0;

    for (let bar = 1; bar <= document.bars; bar++) {
        const width = Math.min(lineWidth, barWidth(document, bar, sizing));

        if (line.bars.length > 0 && used + width > lineWidth) {
            lines.push(line);
            line = { bars: [], widths: [] };
            used = 0;
        }

        line.bars.push(bar);
        line.widths.push(width);
        used += width;
    }

    if (line.bars.length > 0) lines.push(line);

    return lines.map((l, i) => {
        const total = l.widths.reduce((a, b) => a + b, 0);
        const last = i === lines.length - 1;

        if (last || total >= lineWidth) return l;

        const extra = lineWidth - total;
        const widths = l.widths.map((w) => Math.floor(w + (extra * w) / total));
        widths[widths.length - 1] += lineWidth - widths.reduce((a, b) => a + b, 0);

        return { ...l, widths };
    });
}

/** The line that bar `bar` is printed on. */
export function lineOf(lines: SheetLine[], bar: number): SheetLine | undefined {
    return lines.find((l) => l.bars.includes(bar));
}
