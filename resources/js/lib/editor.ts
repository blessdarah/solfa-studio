/**
 * Edits to a score document, as pure functions: each takes a document and
 * returns a new one. The compose screen applies them and autosaves.
 */
import { beatsInBar, partOf, VOICE_NAMES } from '@/lib/music';
import type {
    Bar,
    MapEvent,
    Mark,
    Note,
    Octave,
    Part,
    Pitch,
    Ramp,
    ScoreDocument,
    Section,
    Syllable,
    SyllableJoin,
    Voice,
} from '@/types/score';

const EPS = 1e-6;

export type Cursor = { part: Voice; bar: number; beat: number };

// ---------------------------------------------------------------- helpers

function sortNotes(notes: Note[]): Note[] {
    return [...notes].sort((a, b) => a.start - b.start);
}

function withBar(document: ScoreDocument, voice: Voice, barNo: number, change: (bar: Bar) => Bar): ScoreDocument {
    return {
        ...document,
        parts: document.parts.map((part) =>
            part.id !== voice
                ? part
                : { ...part, bars: part.bars.map((bar) => (bar.no === barNo ? change(bar) : bar)) },
        ),
    };
}

function barOf(document: ScoreDocument, voice: Voice, barNo: number): Bar | undefined {
    return partOf(document, voice)?.bars[barNo - 1];
}

/** The note starting exactly at `beat`. */
export function noteStartingAt(notes: Note[], beat: number): Note | undefined {
    return notes.find((n) => Math.abs(n.start - beat) < EPS);
}

/** The note that ends exactly where `beat` begins (the one just typed). */
export function noteEndingAt(notes: Note[], beat: number): Note | undefined {
    return notes.find((n) => Math.abs(n.start + n.length - beat) < EPS);
}

/** The note sounding at `beat`, whether it starts there or is held over it. */
export function noteCovering(notes: Note[], beat: number): Note | undefined {
    return notes.find((n) => n.start <= beat + EPS && n.start + n.length > beat + EPS);
}

/** Where the next note (or the bar line) is after `beat`. */
function nextBoundary(notes: Note[], beat: number, beats: number): number {
    const later = notes.filter((n) => n.start > beat + EPS).map((n) => n.start);

    return Math.min(beats, ...later);
}

// ------------------------------------------------------------ notes mode

/**
 * Type a pitch at the cursor. Replaces a note starting there; cuts a held
 * note short; otherwise the new note lasts to the next beat.
 */
export function setNote(document: ScoreDocument, cursor: Cursor, pitch: Pitch, octave: Octave): ScoreDocument {
    const beats = beatsInBar(document.map, cursor.bar);

    return withBar(document, cursor.part, cursor.bar, (bar) => {
        const existing = noteStartingAt(bar.notes, cursor.beat);

        if (existing) {
            return {
                ...bar,
                notes: bar.notes.map((n) => (n === existing ? { ...n, pitch, octave, source: 'typed' } : n)),
            };
        }

        const notes = bar.notes.map((n) =>
            n.start < cursor.beat - EPS && n.start + n.length > cursor.beat + EPS
                ? { ...n, length: cursor.beat - n.start }
                : n,
        );

        const toNextBeat = Math.floor(cursor.beat + EPS) + 1 - cursor.beat;
        const length = Math.min(toNextBeat, nextBoundary(notes, cursor.beat, beats) - cursor.beat);

        return {
            ...bar,
            notes: sortNotes([...notes, { pitch, octave, start: cursor.beat, length, source: 'typed' }]),
        };
    });
}

/** Silence at the cursor ("Rest"): the note there goes, a held note stops. */
export function clearAt(document: ScoreDocument, cursor: Cursor): ScoreDocument {
    return withBar(document, cursor.part, cursor.bar, (bar) => ({
        ...bar,
        notes: bar.notes
            .filter((n) => Math.abs(n.start - cursor.beat) > EPS)
            .map((n) =>
                n.start < cursor.beat - EPS && n.start + n.length > cursor.beat + EPS
                    ? { ...n, length: cursor.beat - n.start }
                    : n,
            ),
    }));
}

/**
 * "–": hold the previous note through this beat.
 */
export function hold(document: ScoreDocument, cursor: Cursor): ScoreDocument {
    const beats = beatsInBar(document.map, cursor.bar);

    return withBar(document, cursor.part, cursor.bar, (bar) => {
        const previous = noteEndingAt(bar.notes, cursor.beat);

        if (!previous) {
            return bar;
        }

        const rest = bar.notes.filter((n) => Math.abs(n.start - cursor.beat) > EPS);
        const end = Math.min(Math.floor(cursor.beat + EPS) + 1, nextBoundary(rest, cursor.beat, beats));

        return {
            ...bar,
            notes: rest.map((n) => (n === previous ? { ...n, length: end - n.start } : n)),
        };
    });
}

/**
 * ".": halve the note just typed (or the one under the cursor) so the next
 * pitch lands on the half beat. Returns where the cursor should go.
 */
export function halfBeat(document: ScoreDocument, cursor: Cursor): { document: ScoreDocument; cursor: Cursor } {
    const bar = barOf(document, cursor.part, cursor.bar);
    const target = bar ? (noteStartingAt(bar.notes, cursor.beat) ?? noteEndingAt(bar.notes, cursor.beat)) : undefined;

    if (!target || target.length <= 0.5 + EPS) {
        return { document, cursor };
    }

    const next = withBar(document, cursor.part, cursor.bar, (b) => ({
        ...b,
        notes: b.notes.map((n) => (n === target ? { ...n, length: 0.5 } : n)),
    }));

    return { document: next, cursor: { ...cursor, beat: target.start + 0.5 } };
}

/** The note the octave and chromatic keys act on. */
function targetNote(document: ScoreDocument, cursor: Cursor): Note | undefined {
    const bar = barOf(document, cursor.part, cursor.bar);

    return bar ? (noteStartingAt(bar.notes, cursor.beat) ?? noteEndingAt(bar.notes, cursor.beat)) : undefined;
}

function changeTarget(document: ScoreDocument, cursor: Cursor, change: (note: Note) => Note): ScoreDocument {
    const target = targetNote(document, cursor);

    if (!target) {
        return document;
    }

    return withBar(document, cursor.part, cursor.bar, (bar) => ({
        ...bar,
        notes: bar.notes.map((n) => (n === target ? change(n) : n)),
    }));
}

/** "," lowers and "'" raises the note one octave (d₁ · d · d'). */
export function shiftOctave(document: ScoreDocument, cursor: Cursor, by: -1 | 1): ScoreDocument {
    return changeTarget(document, cursor, (n) => ({
        ...n,
        octave: Math.max(-1, Math.min(1, n.octave + by)) as Octave,
    }));
}

/** "↑" sharpens f to fe; "↓" flattens t to ta (and back). */
export function chromatic(document: ScoreDocument, cursor: Cursor, direction: 'up' | 'down'): ScoreDocument {
    const map: Partial<Record<Pitch, Pitch>> =
        direction === 'up' ? { f: 'fe', ta: 't' } : { t: 'ta', fe: 'f' };

    return changeTarget(document, cursor, (n) => ({ ...n, pitch: map[n.pitch] ?? n.pitch }));
}

/** The beat after the cursor, wrapping into the next bar. */
export function nextBeat(document: ScoreDocument, cursor: Cursor): Cursor {
    const beats = beatsInBar(document.map, cursor.bar);
    const beat = Math.floor(cursor.beat + EPS) + 1;

    if (beat < beats) {
        return { ...cursor, beat };
    }

    return cursor.bar < document.bars ? { ...cursor, bar: cursor.bar + 1, beat: 0 } : cursor;
}

export function previousBeat(document: ScoreDocument, cursor: Cursor): Cursor {
    if (cursor.beat > EPS) {
        return { ...cursor, beat: Math.ceil(cursor.beat - EPS) - 1 };
    }

    return cursor.bar > 1
        ? { ...cursor, bar: cursor.bar - 1, beat: beatsInBar(document.map, cursor.bar - 1) - 1 }
        : cursor;
}

/** A bar counts as written once the composer moves on from it with notes in it. */
export function markDone(document: ScoreDocument, voice: Voice, barNo: number): ScoreDocument {
    const bar = barOf(document, voice, barNo);

    if (!bar || bar.done || bar.notes.length === 0) {
        return document;
    }

    return withBar(document, voice, barNo, (b) => ({ ...b, done: true }));
}

/**
 * "Copy rhythm from soprano": the target bar takes the source bar's note
 * lengths, keeping its own pitches where it has them.
 */
export function copyRhythm(document: ScoreDocument, from: Voice, to: Voice, barNo: number): ScoreDocument {
    const source = barOf(document, from, barNo);

    if (!source || source.notes.length === 0) {
        return document;
    }

    const target = barOf(document, to, barNo);
    const fallback: Note =
        target?.notes[target.notes.length - 1] ??
        ({ pitch: 'd', octave: to === 'B' ? -1 : 0, start: 0, length: 1, source: 'typed' } as Note);

    let last = fallback;

    const notes = source.notes.map((n) => {
        const own = target ? noteCovering(target.notes, n.start) : undefined;
        const pick = own ?? last;
        last = pick;

        return { pitch: pick.pitch, octave: pick.octave, start: n.start, length: n.length, source: 'typed' as const };
    });

    return withBar(document, to, barNo, (bar) => ({ ...bar, notes }));
}

/**
 * "Repeat bars 5–8 here": copy a run of bars of one part to start at `to`.
 */
export function repeatBars(document: ScoreDocument, voice: Voice, from: number, count: number, to: number): ScoreDocument {
    let next = document;

    for (let i = 0; i < count; i++) {
        const source = barOf(document, voice, from + i);
        const target = to + i;

        if (!source || target > document.bars) {
            break;
        }

        if (beatsInBar(document.map, from + i) !== beatsInBar(document.map, target)) {
            continue;
        }

        next = withBar(next, voice, target, (bar) => ({
            ...bar,
            notes: source.notes.map((n) => ({ ...n, source: 'typed' as const })),
        }));
    }

    return next;
}

/** Drop in the bars a suggestion came back with. */
export function applyBars(document: ScoreDocument, voice: Voice, bars: Bar[]): ScoreDocument {
    return bars.reduce(
        (doc, incoming) => withBar(doc, voice, incoming.no, (bar) => ({ ...bar, notes: sortNotes(incoming.notes) })),
        document,
    );
}

export function addPart(document: ScoreDocument, voice: Voice): ScoreDocument {
    if (partOf(document, voice)) {
        return document;
    }

    const part: Part = {
        id: voice,
        name: VOICE_NAMES[voice],
        bars: Array.from({ length: document.bars }, (_, i) => ({ no: i + 1, notes: [], done: false })),
    };

    const order: Voice[] = ['S', 'A', 'T', 'B'];

    return {
        ...document,
        parts: [...document.parts, part].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
    };
}

/**
 * A new section from `from`, cutting short the one it starts inside.
 */
export function addSection(document: ScoreDocument, name: string, from: number): ScoreDocument {
    const sorted = [...document.sections].sort((a, b) => a.from - b.from);
    const nextStart = sorted.find((s) => s.from > from)?.from ?? document.bars + 1;

    const sections: Section[] = sorted
        .filter((s) => s.from !== from)
        .map((s) => (s.from < from && s.to >= from ? { ...s, to: from - 1 } : s));

    sections.push({ name, from, to: nextStart - 1, ending: null, repeat: 1 });

    return { ...document, sections: sections.sort((a, b) => a.from - b.from) };
}

// ------------------------------------------------------------ words mode

/** The voice whose notes the words follow. */
export function wordsPart(document: ScoreDocument, preferred: Voice): Voice {
    if (document.words_under === 'TB') {
        return partOf(document, 'T') ? 'T' : (document.parts[0]?.id ?? 'S');
    }

    if (document.words_under === 'each') {
        return preferred;
    }

    return partOf(document, 'S') ? 'S' : (document.parts[0]?.id ?? 'S');
}

/** Note starts in a bar of `voice`, in order — the slots words go on. */
export function noteStarts(document: ScoreDocument, voice: Voice, barNo: number): number[] {
    return (barOf(document, voice, barNo)?.notes ?? []).filter((n) => n.pitch !== 'rest').map((n) => n.start);
}

/** The next note start after `beat`, crossing into later bars. */
export function nextSlot(document: ScoreDocument, voice: Voice, barNo: number, beat: number): { bar: number; beat: number } | null {
    for (let b = barNo; b <= document.bars; b++) {
        const starts = noteStarts(document, voice, b).filter((s) => b > barNo || s > beat + EPS);

        if (starts.length > 0) {
            return { bar: b, beat: starts[0] };
        }
    }

    return null;
}

export function previousSlot(document: ScoreDocument, voice: Voice, barNo: number, beat: number): { bar: number; beat: number } | null {
    for (let b = barNo; b >= 1; b--) {
        const starts = noteStarts(document, voice, b).filter((s) => b < barNo || s < beat - EPS);

        if (starts.length > 0) {
            return { bar: b, beat: starts[starts.length - 1] };
        }
    }

    return null;
}

export function syllableAt(document: ScoreDocument, verse: number, voice: Voice, barNo: number, beat: number): Syllable | undefined {
    return document.verses[verse]?.syllables.find(
        (s) => s.part === voice && s.bar === barNo && Math.abs(s.beat - beat) < EPS,
    );
}

/** Set (or with empty text, remove) the syllable on one note. */
export function setSyllable(
    document: ScoreDocument,
    verse: number,
    voice: Voice,
    barNo: number,
    beat: number,
    text: string,
    join?: SyllableJoin,
): ScoreDocument {
    return {
        ...document,
        verses: document.verses.map((v, i) => {
            if (i !== verse) {
                return v;
            }

            const others = v.syllables.filter(
                (s) => !(s.part === voice && s.bar === barNo && Math.abs(s.beat - beat) < EPS),
            );
            const current = v.syllables.find((s) => s.part === voice && s.bar === barNo && Math.abs(s.beat - beat) < EPS);

            if (text.trim() === '') {
                return { ...v, syllables: others };
            }

            const syllable: Syllable = { part: voice, bar: barNo, beat, text, join: join ?? current?.join ?? 'none' };

            return {
                ...v,
                syllables: [...others, syllable].sort((a, b) => a.bar - b.bar || a.beat - b.beat),
            };
        }),
    };
}

export function addVerse(document: ScoreDocument, lang: string, label: string): ScoreDocument {
    const id = `v${Date.now().toString(36)}`;

    return { ...document, verses: [...document.verses, { id, label, lang, syllables: [] }] };
}

// ------------------------------------------------------------ marks

const DYNAMICS = ['mp', 'mf', 'f', 'ff', 'p', 'pp'];

/** "f" on the text palette cycles the dynamic at the cursor: mp → mf → f → ff → p → pp → none. */
export function cycleDynamic(document: ScoreDocument, barNo: number, beat: number): ScoreDocument {
    const existing = document.marks.find(
        (m) => m.kind === 'dyn' && m.at.bar === barNo && Math.abs(m.at.beat - beat) < EPS,
    );
    const others = document.marks.filter((m) => m !== existing);

    if (!existing) {
        return { ...document, marks: [...others, { kind: 'dyn', value: 'mp', at: { bar: barNo, beat }, to: null, parts: null }] };
    }

    const next = DYNAMICS[DYNAMICS.indexOf(existing.value) + 1];

    return {
        ...document,
        marks: next ? [...others, { ...existing, value: next }] : others,
    };
}

export function addMark(document: ScoreDocument, mark: Mark): ScoreDocument {
    return { ...document, marks: [...document.marks, mark] };
}

/** D.S. sits at the end of the bar the choir turns back from. */
export function toggleNav(document: ScoreDocument, barNo: number, value: '$' | 'DS' | 'DC' | 'Fine'): ScoreDocument {
    const beat = value === '$' ? 0 : beatsInBar(document.map, barNo) - 1;
    const existing = document.marks.find((m) => m.kind === 'nav' && m.value === value && m.at.bar === barNo);

    return existing
        ? { ...document, marks: document.marks.filter((m) => m !== existing) }
        : addMark(document, { kind: 'nav', value, at: { bar: barNo, beat }, to: null, parts: null });
}

// ------------------------------------------------------------ tempo & time

export type MapChange = {
    bar: number;
    bpm: number;
    beats: number;
    ramp: Ramp;
    /** Last bar the change lasts for; null = to the end. */
    until: number | null;
};

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

/**
 * Apply a tempo / time change from `change.bar`. When the beats in each bar
 * change, the music in the affected bars is re-barred: notes keep their
 * place in time and flow into new bars (a note crossing a new bar line is
 * split in two). Everything after shifts along.
 */
export function applyMapChange(document: ScoreDocument, change: MapChange): { document: ScoreDocument; message: string | null } {
    const first = change.bar;
    const last = change.until ?? document.bars;
    const oldBeats = Array.from({ length: last - first + 1 }, (_, i) => beatsInBar(document.map, first + i));
    const total = oldBeats.reduce((a, b) => a + b, 0);
    const sameTime = oldBeats.every((b) => b === change.beats);

    const newCount = sameTime ? oldBeats.length : Math.max(1, Math.ceil(total / change.beats - EPS));
    const delta = newCount - oldBeats.length;
    const newLast = first + newCount - 1;

    // Where an old (bar, beat) lands after re-barring.
    const offsets: number[] = [];
    oldBeats.reduce((sum, b, i) => ((offsets[i] = sum), sum + b), 0);

    const move = (barNo: number, beat: number): { bar: number; beat: number } => {
        if (barNo < first) return { bar: barNo, beat };
        if (barNo > last) return { bar: barNo + delta, beat };
        if (sameTime) return { bar: barNo, beat };

        const at = offsets[barNo - first] + beat;

        return { bar: first + Math.floor(at / change.beats + EPS), beat: at - Math.floor(at / change.beats + EPS) * change.beats };
    };

    const parts = document.parts.map((part) => {
        const before = part.bars.slice(0, first - 1);
        const after = part.bars.slice(last).map((bar) => ({ ...bar, no: bar.no + delta }));

        let middle: Bar[];

        if (sameTime) {
            middle = part.bars.slice(first - 1, last);
        } else {
            middle = Array.from({ length: newCount }, (_, i) => ({ no: first + i, notes: [] as Note[], done: false }));

            part.bars.slice(first - 1, last).forEach((bar, i) => {
                for (const note of bar.notes) {
                    let start = offsets[i] + note.start;
                    let remaining = note.length;

                    while (remaining > EPS) {
                        const index = Math.floor(start / change.beats + EPS);
                        const inBar = start - index * change.beats;
                        const room = change.beats - inBar;
                        const length = Math.min(room, remaining);

                        middle[index]?.notes.push({ ...note, start: inBar, length });
                        start += length;
                        remaining -= length;
                    }
                }
            });

            const wasDone = part.bars.slice(first - 1, last).every((b) => b.done);

            middle = middle.map((bar) => ({
                ...bar,
                notes: sortNotes(bar.notes),
                done: wasDone && bar.notes.length > 0,
            }));
        }

        return { ...part, bars: [...before, ...middle, ...after] };
    });

    const verses = document.verses.map((verse) => ({
        ...verse,
        syllables: verse.syllables.map((s) => ({ ...s, ...move(s.bar, s.beat) })),
    }));

    const marks = document.marks.map((mark) => ({
        ...mark,
        at: move(mark.at.bar, mark.at.beat),
        to: mark.to ? endPoint(mark.to, move, change.beats, first, last) : null,
    }));

    const sections = document.sections.map((s) => ({
        ...s,
        from: s.from > last ? s.from + delta : s.from > first ? move(s.from, 0).bar : s.from,
        to: s.to >= last ? s.to + delta : s.to >= first ? move(s.to, 0).bar : s.to,
    }));

    // The new event replaces any change inside the range; later ones shift.
    const map: MapEvent[] = [
        ...document.map.filter((e) => e.bar < first),
        {
            bar: first,
            bpm: change.bpm,
            beats: change.beats,
            ramp: change.ramp,
            until: change.until === null ? null : newLast,
        },
        ...document.map.filter((e) => e.bar > last).map((e) => ({ ...e, bar: e.bar + delta, until: e.until === null ? null : e.until + delta })),
    ];

    // Bar 1 always carries both values.
    if (map[0].bar === 1) {
        map[0] = { ...map[0], bpm: map[0].bpm ?? change.bpm, beats: map[0].beats ?? change.beats };
    }

    let message: string | null = null;
    const oldOne = oldBeats[0];

    if (!sameTime) {
        const range = `Bars ${first}–${last} had ${oldOne} beats.`;

        if (delta > 0) {
            const what = oldOne - change.beats === 1 ? `Each ${ORDINAL[oldOne] ?? `${oldOne}th`} beat moves` : 'The extra beats move';
            message = `${range} ${what} into new bars ${last + 1}–${last + delta}.`;
        } else if (delta < 0) {
            message = `${range} They join up into ${newCount} bars of ${change.beats}.`;
        } else {
            message = `${range} Notes move across the new bar lines.`;
        }
    }

    return {
        document: { ...document, bars: document.bars + delta, parts, verses, marks, sections, map },
        message,
    };
}

/** A hairpin's end may sit on a closing bar line; keep it there. */
function endPoint(
    to: { bar: number; beat: number },
    move: (bar: number, beat: number) => { bar: number; beat: number },
    beats: number,
    first: number,
    last: number,
): { bar: number; beat: number } {
    const moved = move(to.bar, to.beat);

    if (to.bar >= first && to.bar <= last && moved.beat < 1e-6 && moved.bar > first) {
        return { bar: moved.bar - 1, beat: beats };
    }

    return moved;
}

/** Remove a change (not the opening one); bars keep their notes. */
export function removeMapEvent(document: ScoreDocument, bar: number): ScoreDocument {
    if (bar === 1) {
        return document;
    }

    return { ...document, map: document.map.filter((e) => e.bar !== bar) };
}
