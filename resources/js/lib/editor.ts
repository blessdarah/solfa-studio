/**
 * Edits to a score document, as pure functions: each takes a document and
 * returns a new one. The compose screen applies them and autosaves.
 */
import { beatsInBar, onThird, partOf, VOICE_NAMES } from '@/lib/music';
import { slotKey, slurredOn } from '@/lib/slurs';
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
                notes: bar.notes.map((n) => (n === existing ? { ...n, pitch, octave, source: 'typed', tie: false } : n)),
                tacet: false,
            };
        }

        const notes = bar.notes.map((n) =>
            n.start < cursor.beat - EPS && n.start + n.length > cursor.beat + EPS
                ? { ...n, length: cursor.beat - n.start }
                : n,
        );

        // Inside a triplet a note lasts one third (f,f,f); otherwise to the next beat.
        const toNextBeat = onThird(cursor.beat) ? nextThird(cursor.beat) - cursor.beat : Math.floor(cursor.beat + EPS) + 1 - cursor.beat;
        const length = Math.min(toNextBeat, nextBoundary(notes, cursor.beat, beats) - cursor.beat);

        return {
            ...bar,
            notes: sortNotes([...notes, { pitch, octave, start: cursor.beat, length, source: 'typed' }]),
            tacet: false,
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
 * "–": hold the previous note through this beat. Inside a beat it holds
 * for one more quarter, which is how a dotted half is written: d .  –  → d.,
 */
export function hold(document: ScoreDocument, cursor: Cursor): ScoreDocument {
    const beats = beatsInBar(document.map, cursor.bar);

    // At the start of a bar, "–" carries the last note of the bar before over the bar line (d :– | – :r).
    if (cursor.beat < EPS && cursor.bar > 1) {
        const before = barOf(document, cursor.part, cursor.bar - 1)?.notes ?? [];
        const last = before.find((n) => Math.abs(n.start + n.length - beatsInBar(document.map, cursor.bar - 1)) < EPS);

        if (last && last.pitch !== 'rest' && !noteEndingAt(barOf(document, cursor.part, cursor.bar)?.notes ?? [], 0)) {
            return withBar(document, cursor.part, cursor.bar, (bar) => {
                const rest = bar.notes.filter((n) => n.start > EPS);
                const end = Math.min(1, nextBoundary(rest, 0, beats));

                return {
                    ...bar,
                    notes: sortNotes([...rest, { pitch: last.pitch, octave: last.octave, start: 0, length: end, source: 'typed', tie: true }]),
                    tacet: false,
                };
            });
        }
    }

    return withBar(document, cursor.part, cursor.bar, (bar) => {
        const previous = noteEndingAt(bar.notes, cursor.beat);

        if (!previous) {
            return bar;
        }

        const rest = bar.notes.filter((n) => Math.abs(n.start - cursor.beat) > EPS);
        const inBeat = cursor.beat - Math.floor(cursor.beat + EPS) > EPS;
        // In a triplet "–" holds for one more third (d,–,r); elsewhere inside a beat, one more quarter.
        const step = onThird(cursor.beat) ? nextThird(cursor.beat) : inBeat ? cursor.beat + 0.25 : Math.floor(cursor.beat + EPS) + 1;
        const end = Math.min(step, nextBoundary(rest, cursor.beat, beats));

        return {
            ...bar,
            notes: rest.map((n) => (n === previous ? { ...n, length: end - n.start } : n)),
        };
    });
}

/**
 * ".": split the note just typed (or the one under the cursor) so the next
 * pitch lands halfway through it — a whole beat into halves (d.r), a half
 * into quarters (d.r,m). Lengths stay on the quarter-beat grid. Returns
 * where the cursor should go.
 */
export function halfBeat(document: ScoreDocument, cursor: Cursor): { document: ScoreDocument; cursor: Cursor } {
    const bar = barOf(document, cursor.part, cursor.bar);
    const target = bar ? (noteStartingAt(bar.notes, cursor.beat) ?? noteEndingAt(bar.notes, cursor.beat)) : undefined;

    if (!target || target.length <= 0.25 + EPS || onThird(target.start) || onThird(target.start + target.length)) {
        return { document, cursor };
    }

    // Half of a beat or more stays on whole halves; below that, quarters.
    const half = target.length / 2;
    const length = half >= 0.5 - EPS ? Math.max(0.5, Math.floor(half * 2 + EPS) / 2) : Math.max(0.25, Math.floor(half * 4 + EPS) / 4);

    const next = withBar(document, cursor.part, cursor.bar, (b) => ({
        ...b,
        notes: b.notes.map((n) => (n === target ? { ...n, length } : n)),
    }));

    return { document: next, cursor: { ...cursor, beat: target.start + length } };
}

/** Make the note starting at `start` in this bar end at `end` (used to shorten a hold: "–" then "."). */
export function setNoteEnd(document: ScoreDocument, voice: Voice, barNo: number, start: number, end: number): ScoreDocument {
    return withBar(document, voice, barNo, (bar) => ({
        ...bar,
        notes: bar.notes.map((n) => (Math.abs(n.start - start) < EPS && end > n.start + EPS ? { ...n, length: end - n.start } : n)),
    }));
}

/** The next third-of-a-beat point after `at` (exact, so triplets add up to whole beats). */
function nextThird(at: number): number {
    const beat = Math.floor(at + EPS);
    const k = Math.round((at - beat) * 3);

    return k >= 2 ? beat + 1 : beat + (k + 1) / 3;
}

/**
 * "3" (or a comma between notes in a typed line): turn the note just typed
 * into the first third of its beat, so the next two pitches fill the other
 * thirds — a triplet, written f,f,f. Returns where the cursor goes.
 */
export function tripletBeat(document: ScoreDocument, cursor: Cursor): { document: ScoreDocument; cursor: Cursor } {
    const bar = barOf(document, cursor.part, cursor.bar);
    const target = bar ? (noteStartingAt(bar.notes, cursor.beat) ?? noteEndingAt(bar.notes, cursor.beat)) : undefined;

    // Only a note starting on a beat and lasting at least that beat can open a triplet.
    if (!target || Math.abs(target.start - Math.round(target.start)) > EPS || target.length < 1 - EPS) {
        return { document, cursor };
    }

    const next = withBar(document, cursor.part, cursor.bar, (b) => ({
        ...b,
        notes: b.notes.map((n) => (n === target ? { ...n, length: 1 / 3 } : n)),
    }));

    return { document: next, cursor: { ...cursor, beat: target.start + 1 / 3 } };
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

/** "," lowers and "'" raises the note one octave; press twice for two (d₂ · d₁ · d · d' · d''). */
export function shiftOctave(document: ScoreDocument, cursor: Cursor, by: -1 | 1): ScoreDocument {
    return changeTarget(document, cursor, (n) => ({
        ...n,
        octave: Math.max(-2, Math.min(2, n.octave + by)) as Octave,
    }));
}

/** "↑" sharpens f to fe; "↓" flattens t to ta (and back). */
export function chromatic(document: ScoreDocument, cursor: Cursor, direction: 'up' | 'down'): ScoreDocument {
    const map: Partial<Record<Pitch, Pitch>> =
        direction === 'up' ? { f: 'fe', ta: 't' } : { t: 'ta', fe: 'f' };

    return changeTarget(document, cursor, (n) => ({ ...n, pitch: map[n.pitch] ?? n.pitch }));
}

/**
 * → : the next place to edit — the next note inside this beat (the "t" of
 * "d.t") or the next beat, whichever comes first; then on into the next bar.
 */
export function nextSpot(document: ScoreDocument, cursor: Cursor): Cursor {
    const notes = barOf(document, cursor.part, cursor.bar)?.notes ?? [];
    const beats = beatsInBar(document.map, cursor.bar);
    const candidates = [Math.floor(cursor.beat + EPS) + 1, ...notes.map((n) => n.start).filter((at) => at > cursor.beat + EPS)];
    const beat = Math.min(...candidates);

    if (beat < beats - EPS) return { ...cursor, beat };

    return cursor.bar < document.bars ? { ...cursor, bar: cursor.bar + 1, beat: 0 } : cursor;
}

/** ← : the previous note or beat, reaching back into the bar before. */
export function previousSpot(document: ScoreDocument, cursor: Cursor): Cursor {
    const spots = (bar: number, before: number) => {
        const notes = barOf(document, cursor.part, bar)?.notes ?? [];
        const beats = Array.from({ length: beatsInBar(document.map, bar) }, (_, i) => i);

        return [...beats, ...notes.map((n) => n.start)].filter((at) => at < before - EPS);
    };

    const here = spots(cursor.bar, cursor.beat);

    if (here.length > 0) return { ...cursor, beat: Math.max(...here) };

    if (cursor.bar <= 1) return cursor;

    const back = spots(cursor.bar - 1, Infinity);

    return { ...cursor, bar: cursor.bar - 1, beat: Math.max(...back) };
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
 * Take a part out of the score completely: its notes, the words written
 * under it, and its name on any mark meant for certain parts only.
 */
export function removePart(document: ScoreDocument, voice: Voice): ScoreDocument {
    if (!partOf(document, voice) || document.parts.length <= 1) return document;

    return {
        ...document,
        parts: document.parts.filter((p) => p.id !== voice),
        verses: document.verses.map((v) => ({ ...v, syllables: v.syllables.filter((s) => s.part !== voice) })),
        marks: document.marks
            .map((m) => (m.parts ? { ...m, parts: m.parts.filter((p) => p !== voice) } : m))
            .filter((m) => m.parts === null || m.parts.length > 0),
    };
}

/** Empty every bar of a part (and the words under it), keeping the part itself. */
export function clearPart(document: ScoreDocument, voice: Voice): ScoreDocument {
    if (!partOf(document, voice)) return document;

    return {
        ...document,
        parts: document.parts.map((p) => (p.id === voice ? { ...p, bars: p.bars.map((b) => ({ ...b, notes: [], done: false, tacet: false })) } : p)),
        verses: document.verses.map((v) => ({ ...v, syllables: v.syllables.filter((s) => s.part !== voice) })),
    };
}

/** What a part holds, for confirming before it is deleted. */
export function partContents(document: ScoreDocument, voice: Voice): { bars: number; firstBar: number | null; syllables: number } {
    const bars = partOf(document, voice)?.bars ?? [];
    const written = bars.filter((b) => b.notes.some((n) => n.pitch !== 'rest'));
    const syllables = document.verses.reduce((n, v) => n + v.syllables.filter((s) => s.part === voice).length, 0);

    return { bars: written.length, firstBar: written[0]?.no ?? null, syllables };
}

/**
 * Take a part out of some bars: it rests there — notes and the words under
 * them cleared, the bars counted as written — and its line is left off the
 * sheet wherever a whole line rests.
 */
export function restPart(document: ScoreDocument, voice: Voice, bars: number[]): ScoreDocument {
    const set = new Set(bars);

    return {
        ...document,
        parts: document.parts.map((p) =>
            p.id === voice ? { ...p, bars: p.bars.map((b) => (set.has(b.no) ? { ...b, notes: [], done: true, tacet: true } : b)) } : p,
        ),
        verses: document.verses.map((v) => ({ ...v, syllables: v.syllables.filter((s) => !(s.part === voice && set.has(s.bar))) })),
    };
}

/** Put a resting part back into some bars, empty and ready to write in. */
export function bringBackPart(document: ScoreDocument, voice: Voice, bars: number[]): ScoreDocument {
    const set = new Set(bars);

    return {
        ...document,
        parts: document.parts.map((p) =>
            p.id === voice ? { ...p, bars: p.bars.map((b) => (set.has(b.no) && b.tacet ? { ...b, done: false, tacet: false } : b)) } : p,
        ),
    };
}

// ------------------------------------------------------------ adding & removing bars

/** Insert `count` empty bars before bar `at` (bars.length + 1 = at the end); everything after moves along. */
export function insertBars(document: ScoreDocument, at: number, count = 1): ScoreDocument {
    const add = Math.max(0, Math.min(count, MAX_BARS - document.bars));
    const where = Math.max(1, Math.min(at, document.bars + 1));

    if (add === 0) return document;

    const shift = (bar: number) => (bar >= where ? bar + add : bar);

    return {
        ...document,
        bars: document.bars + add,
        parts: document.parts.map((part) => ({
            ...part,
            bars: [
                ...part.bars.slice(0, where - 1),
                ...Array.from({ length: add }, (_, i) => ({ no: where + i, notes: [] as Note[], done: false })),
                ...part.bars.slice(where - 1).map((b) => ({ ...b, no: b.no + add })),
            ],
        })),
        verses: document.verses.map((v) => ({ ...v, syllables: v.syllables.map((s) => ({ ...s, bar: shift(s.bar) })) })),
        marks: document.marks.map((m) => ({
            ...m,
            at: { ...m.at, bar: shift(m.at.bar) },
            to: m.to ? { ...m.to, bar: shift(m.to.bar) } : null,
        })),
        // A section the new bars land inside grows to hold them.
        sections: document.sections.map((s) => ({ ...s, from: shift(s.from), to: s.to >= where ? s.to + add : s.to })),
        // Bar 1 always keeps the opening tempo & time; later changes move with their bars.
        map: document.map.map((e) => (e.bar === 1 ? e : { ...e, bar: shift(e.bar), until: e.until === null ? null : e.until >= where ? e.until + add : e.until })),
    };
}

/** A copy of bar `barNo` (every part's notes) straight after it. */
export function duplicateBar(document: ScoreDocument, barNo: number): ScoreDocument {
    const next = insertBars(document, barNo + 1, 1);

    if (next === document) return document;

    return {
        ...next,
        parts: next.parts.map((part) => {
            const source = part.bars[barNo - 1];

            return {
                ...part,
                bars: part.bars.map((b) => (b.no === barNo + 1 && source ? { ...b, notes: source.notes.map((n) => ({ ...n })), done: source.done, tacet: source.tacet } : b)),
            };
        }),
    };
}

/**
 * Remove bar `barNo` from every part, with the words and marks in it;
 * everything after moves back. A tempo or time change written on that bar
 * carries on from the bar that takes its place.
 */
export function deleteBar(document: ScoreDocument, barNo: number): ScoreDocument {
    if (document.bars <= 1 || barNo < 1 || barNo > document.bars) return document;

    const shift = (bar: number) => (bar > barNo ? bar - 1 : bar);

    // Tempo & time: fold an event on the deleted bar into the next bar's.
    const own = document.map.find((e) => e.bar === barNo);
    const next = document.map.find((e) => e.bar === barNo + 1);
    let map: MapEvent[] = document.map.filter((e) => e.bar !== barNo && e.bar !== barNo + 1);

    if (own && barNo < document.bars) {
        map.push({ ...own, bpm: next?.bpm ?? own.bpm, beats: next?.beats ?? own.beats, ramp: next?.ramp ?? own.ramp, until: next?.until ?? own.until });
    } else if (next) {
        map.push(next);
    }

    map = map
        .map((e) => ({ ...e, bar: e.bar === barNo ? barNo : shift(e.bar), until: e.until === null ? null : Math.max(e.bar === barNo ? barNo : shift(e.bar), shift(e.until)) }))
        .sort((a, b) => a.bar - b.bar);

    return {
        ...document,
        bars: document.bars - 1,
        parts: document.parts.map((part) => ({
            ...part,
            bars: part.bars.filter((b) => b.no !== barNo).map((b) => ({ ...b, no: shift(b.no) })),
        })),
        verses: document.verses.map((v) => ({
            ...v,
            syllables: v.syllables.filter((s) => s.bar !== barNo).map((s) => ({ ...s, bar: shift(s.bar) })),
        })),
        marks: document.marks
            .filter((m) => m.at.bar !== barNo || (m.to !== null && m.to.bar > barNo))
            .map((m) => ({
                ...m,
                at: m.at.bar === barNo ? { bar: barNo, beat: 0 } : { ...m.at, bar: shift(m.at.bar) },
                to: m.to ? (m.to.bar === barNo ? { bar: Math.max(1, barNo - 1), beat: beatsInBar(document.map, Math.max(1, barNo - 1)) } : { ...m.to, bar: shift(m.to.bar) }) : null,
            })),
        sections: document.sections
            .map((s) => ({ ...s, from: s.from > barNo ? s.from - 1 : s.from, to: s.to >= barNo ? s.to - 1 : s.to }))
            .filter((s) => s.to >= s.from),
        map,
    };
}

/** The most bars a score can have (the server's limit too). */
export const MAX_BARS = 500;

/** Add `count` empty bars at the end of every part (the time and tempo carry on). */
export function addBars(document: ScoreDocument, count: number): ScoreDocument {
    const add = Math.max(0, Math.min(count, MAX_BARS - document.bars));

    if (add === 0) return document;

    return {
        ...document,
        bars: document.bars + add,
        parts: document.parts.map((part) => ({
            ...part,
            bars: [...part.bars, ...Array.from({ length: add }, (_, i) => ({ no: document.bars + i + 1, notes: [] as Note[], done: false }))],
        })),
    };
}

/** Drop the last bar if nothing is written in it, in any part (tidying up after a typed line). */
export function dropEmptyLastBar(document: ScoreDocument): ScoreDocument {
    const last = document.bars;
    const empty = document.parts.every((p) => (p.bars[last - 1]?.notes.length ?? 0) === 0);
    const used = [...document.marks, ...document.verses.flatMap((v) => v.syllables)].some((m) => ('at' in m ? m.at.bar : m.bar) === last);

    if (last <= 1 || !empty || used || document.map.some((e) => e.bar === last)) return document;

    return {
        ...document,
        bars: last - 1,
        parts: document.parts.map((part) => ({ ...part, bars: part.bars.slice(0, last - 1) })),
        sections: document.sections.map((s) => (s.to === last ? { ...s, to: last - 1 } : s)).filter((s) => s.from <= s.to),
    };
}

/**
 * A new section from `from`, cutting short the one it starts inside.
 */
export function addSection(document: ScoreDocument, name: string, from: number): ScoreDocument {
    // 1st-time / D.S.-time brackets are not named sections; leave them be.
    const endings = document.sections.filter((s) => s.ending !== null);
    const sorted = document.sections.filter((s) => s.ending === null).sort((a, b) => a.from - b.from);
    const nextStart = sorted.find((s) => s.from > from)?.from ?? document.bars + 1;

    const sections: Section[] = sorted
        .filter((s) => s.from !== from)
        .map((s) => (s.from < from && s.to >= from ? { ...s, to: from - 1 } : s));

    sections.push({ name, from, to: nextStart - 1, ending: null, repeat: 1 }, ...endings);

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
    // A note held over the bar line carries the syllable before it, so it gets none of its own;
    // nor does a note inside a slur — it is sung on the syllable the slur starts with.
    const slurred = slurredOn(partOf(document, voice));

    return (barOf(document, voice, barNo)?.notes ?? [])
        .filter((n) => n.pitch !== 'rest' && !n.tie && !slurred.has(slotKey(barNo, n.start)))
        .map((n) => n.start);
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

/** Take every word out of one verse, keeping the verse itself. */
export function clearVerse(document: ScoreDocument, verse: number): ScoreDocument {
    if (!document.verses[verse]?.syllables.length) return document;

    return { ...document, verses: document.verses.map((v, i) => (i === verse ? { ...v, syllables: [] } : v)) };
}

/**
 * Take a verse out of the score. Verses still called "Verse 3", "Verse 4"…
 * move up a number, so the numbering keeps no gap.
 */
export function deleteVerse(document: ScoreDocument, verse: number): ScoreDocument {
    if (!document.verses[verse]) return document;

    let n = 0;
    const verses = document.verses
        .filter((_, i) => i !== verse)
        .map((v) => {
            if (!/^Verse \d+$/.test(v.label)) return v;
            n++;

            return v.label === `Verse ${n}` ? v : { ...v, label: `Verse ${n}` };
        });

    return { ...document, verses };
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

/**
 * Mark bar `barNo` to play only the first time through (1), only after the
 * D.S. jump (2), or every time (null). Neighbouring bars with the same mark
 * join into one bracket, stored as a section with `ending` 1 or 2.
 */
export function setBarPass(document: ScoreDocument, barNo: number, pass: 1 | 2 | null): ScoreDocument {
    const kept: Section[] = [];

    for (const s of document.sections) {
        if (s.ending === null || barNo < s.from || barNo > s.to) {
            kept.push(s);
            continue;
        }

        if (s.from < barNo) kept.push({ ...s, to: barNo - 1 });
        if (s.to > barNo) kept.push({ ...s, from: barNo + 1 });
    }

    if (pass === null) {
        return { ...document, sections: kept.sort((a, b) => a.from - b.from) };
    }

    const before = kept.find((s) => s.ending === pass && s.to === barNo - 1);
    const after = kept.find((s) => s.ending === pass && s.from === barNo + 1);
    const merged: Section = {
        name: pass === 1 ? '1st time' : 'D.S. time',
        from: before?.from ?? barNo,
        to: after?.to ?? barNo,
        ending: pass,
        repeat: 1,
    };

    return {
        ...document,
        sections: [...kept.filter((s) => s !== before && s !== after), merged].sort((a, b) => a.from - b.from),
    };
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
