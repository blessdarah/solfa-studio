/**
 * Slurs: different notes sung on one breath and one syllable, gliding from
 * one pitch to the next. A note carries `slur` when it is slurred into the
 * next note of its part, so a slur over three notes marks the first two —
 * it moves with the notes when bars are added or removed, and it can run
 * over a bar line like the notes do.
 *
 * (A "slur" between two of the same note is really a hold, d :–, and is
 * written that way.)
 */
import { partOf } from '@/lib/music';
import type { Cursor } from '@/lib/editor';
import type { Note, Part, ScoreDocument, SlurPlace, Syllable, Voice } from '@/types/score';

const EPS = 1e-6;

/** A note in its part, in singing order. */
export type Placed = { bar: number; note: Note };

/** One slur: its first and last note, how many notes it covers, where it is drawn. */
export type SlurRun = { from: { bar: number; beat: number }; to: { bar: number; beat: number }; notes: number; place: SlurPlace };

/** Every note that is struck, in order — a tied note just carries on the one before, so it isn't one. */
export function noteSequence(part: Part | undefined): Placed[] {
    if (!part) return [];

    return part.bars.flatMap((bar, i) =>
        [...bar.notes]
            .filter((n) => !n.tie)
            .sort((a, b) => a.start - b.start)
            .map((note) => ({ bar: i + 1, note })),
    );
}

const sounds = (p: Placed | undefined): p is Placed => !!p && p.note.pitch !== 'rest';

/** Index in `seq` of the note at (bar, beat): starting there, or sounding over it. */
function indexAt(seq: Placed[], bar: number, beat: number): number {
    const exact = seq.findIndex((p) => p.bar === bar && Math.abs(p.note.start - beat) < EPS);

    if (exact >= 0) return exact;

    // The note just typed ends where the cursor is.
    const ending = seq.findIndex((p) => p.bar === bar && Math.abs(p.note.start + p.note.length - beat) < EPS);

    if (ending >= 0) return ending;

    const covering = seq.findIndex((p) => p.bar === bar && p.note.start < beat && p.note.start + p.note.length > beat);

    if (covering >= 0 || beat > EPS) return covering;

    // At the start of a bar, the note just written is the last of the bar before.
    return seq.reduce((found, p, i) => (p.bar === bar - 1 ? i : found), -1);
}

/** The slur through note `i`: indexes of its first and last notes, or null when the note isn't slurred. */
function runThrough(seq: Placed[], i: number): { first: number; last: number } | null {
    if (!sounds(seq[i])) return null;

    let first = i;
    while (first > 0 && seq[first - 1].note.slur && sounds(seq[first - 1])) first--;

    let last = i;
    while (seq[last].note.slur && sounds(seq[last + 1])) last++;

    // A note marked to slur on, with nothing written after it yet, is a slur waiting for its next note.
    if (first === last && !seq[i].note.slur) return null;

    return { first, last };
}

/** All the slurs in a part that join two notes or more, in order. */
export function slurRuns(part: Part | undefined): SlurRun[] {
    const seq = noteSequence(part);
    const runs: SlurRun[] = [];

    for (let i = 0; i < seq.length; i++) {
        if (!seq[i].note.slur || !sounds(seq[i]) || !sounds(seq[i + 1])) continue;

        let last = i;
        while (seq[last].note.slur && sounds(seq[last + 1])) last++;

        runs.push({
            from: { bar: seq[i].bar, beat: seq[i].note.start },
            to: { bar: seq[last].bar, beat: seq[last].note.start },
            notes: last - i + 1,
            place: seq[i].note.slur ?? 'over',
        });
        i = last;
    }

    return runs;
}

/** The slur the note at the cursor belongs to, if any. */
export function slurAt(document: ScoreDocument, cursor: Cursor): SlurRun | null {
    const seq = noteSequence(partOf(document, cursor.part));
    const run = runThrough(seq, indexAt(seq, cursor.bar, cursor.beat));

    if (!run || run.last === run.first) return null;

    const first = seq[run.first];
    const last = seq[run.last];

    return {
        from: { bar: first.bar, beat: first.note.start },
        to: { bar: last.bar, beat: last.note.start },
        notes: run.last - run.first + 1,
        place: first.note.slur ?? 'over',
    };
}

/** Notes sung on the syllable of a note before them (inside a slur, after its first note): `bar:beat` keys. */
export function slurredOn(part: Part | undefined): Set<string> {
    const keys = new Set<string>();
    const seq = noteSequence(part);

    for (const run of slurRuns(part)) {
        const start = seq.findIndex((p) => p.bar === run.from.bar && Math.abs(p.note.start - run.from.beat) < EPS);

        for (let i = start + 1; i < start + run.notes; i++) keys.add(slotKey(seq[i].bar, seq[i].note.start));
    }

    return keys;
}

/** Notes that open a slur (their syllable is held over it): `bar:beat` keys. */
export function slurStarts(part: Part | undefined): Set<string> {
    return new Set(slurRuns(part).map((r) => slotKey(r.from.bar, r.from.beat)));
}

export const slotKey = (bar: number, beat: number) => `${bar}:${Math.round(beat * 1e4) / 1e4}`;

// ------------------------------------------------------------------ edits

/** Change the given notes (by place in the sequence) of one part. */
function changeNotes(document: ScoreDocument, voice: Voice, targets: Placed[], change: (note: Note) => Note): ScoreDocument {
    if (targets.length === 0) return document;

    const set = new Set(targets.map((t) => t.note));

    return {
        ...document,
        parts: document.parts.map((part) =>
            part.id !== voice
                ? part
                : { ...part, bars: part.bars.map((bar) => (bar.notes.some((n) => set.has(n)) ? { ...bar, notes: bar.notes.map((n) => (set.has(n) ? change(n) : n)) } : bar)) },
        ),
    };
}

/**
 * "(": slur the note at the cursor into the next one — or, if it is already
 * in a slur, stretch that slur over one more note. Right after typing a
 * note, the slur waits for the next note you type: s ( l ( s.
 */
export function extendSlur(document: ScoreDocument, cursor: Cursor): ScoreDocument {
    const seq = noteSequence(partOf(document, cursor.part));
    const i = indexAt(seq, cursor.bar, cursor.beat);

    if (!sounds(seq[i])) return document;

    const run = runThrough(seq, i);
    const place = run ? (seq[run.first].note.slur ?? 'over') : 'over';
    const last = run ? run.last : i;

    // Already waiting for the next note: nothing more to do until it is written.
    if (seq[last].note.slur && !sounds(seq[last + 1])) return document;

    // Over the same note again it would be a hold, not a slur.
    const next = seq[last + 1];
    if (sounds(next) && samePitch(seq[last].note, next.note)) return document;

    return changeNotes(document, cursor.part, [seq[last]], (n) => ({ ...n, slur: place }));
}

/** ")": take the last note off the slur at the cursor (a two-note slur goes). */
export function shortenSlur(document: ScoreDocument, cursor: Cursor): ScoreDocument {
    const seq = noteSequence(partOf(document, cursor.part));
    const run = runThrough(seq, indexAt(seq, cursor.bar, cursor.beat));

    if (!run) return document;

    // A slur still waiting for its next note just stops waiting.
    const target = seq[run.last].note.slur ? seq[run.last] : seq[run.last - 1];

    return changeNotes(document, cursor.part, target ? [target] : [], ({ slur: _slur, ...n }) => n);
}

/** Take the slur at the cursor away completely. */
export function removeSlur(document: ScoreDocument, cursor: Cursor): ScoreDocument {
    const seq = noteSequence(partOf(document, cursor.part));
    const run = runThrough(seq, indexAt(seq, cursor.bar, cursor.beat));

    if (!run) return document;

    return changeNotes(document, cursor.part, seq.slice(run.first, run.last + 1), ({ slur: _slur, ...n }) => n);
}

/** Draw the slur at the cursor over or under its notes. */
export function placeSlur(document: ScoreDocument, cursor: Cursor, place: SlurPlace): ScoreDocument {
    const seq = noteSequence(partOf(document, cursor.part));
    const run = runThrough(seq, indexAt(seq, cursor.bar, cursor.beat));

    if (!run) return document;

    return changeNotes(
        document,
        cursor.part,
        seq.slice(run.first, run.last + 1).filter((p) => p.note.slur),
        (n) => ({ ...n, slur: place }),
    );
}

const samePitch = (a: Note, b: Note) => a.pitch === b.pitch && a.octave === b.octave;

/**
 * The note just before the cursor, when it is waiting to be slurred on and
 * sounds right up to the cursor — so typing the same pitch next can become
 * a hold (d ( d is d :–).
 */
export function waitingSlur(document: ScoreDocument, cursor: Cursor): Note | null {
    const seq = noteSequence(partOf(document, cursor.part));
    const before = [...seq].reverse().find((p) => p.bar < cursor.bar || (p.bar === cursor.bar && p.note.start < cursor.beat - EPS));

    if (!before?.note.slur || !sounds(before)) return null;

    const sameBar = before.bar === cursor.bar && Math.abs(before.note.start + before.note.length - cursor.beat) < EPS;
    const overBarLine = before.bar === cursor.bar - 1 && cursor.beat < EPS;

    return sameBar || overBarLine ? before.note : null;
}

/** Stop the note before the cursor waiting for a slur. */
export function dropWaitingSlur(document: ScoreDocument, cursor: Cursor): ScoreDocument {
    const note = waitingSlur(document, cursor);

    if (!note) return document;

    const seq = noteSequence(partOf(document, cursor.part));

    return changeNotes(document, cursor.part, seq.filter((p) => p.note === note), ({ slur: _slur, ...n }) => n);
}

/**
 * After a slur is added, words sitting on notes now inside it move on to
 * the next free note, pushing the words after them along only as far as
 * they must. The syllable on the slur's first note is held over it.
 */
export function followSlurs(document: ScoreDocument, voice: Voice): ScoreDocument {
    const part = partOf(document, voice);
    const inside = slurredOn(part);
    const starts = slurStarts(part);
    const slots = noteSequence(part)
        .filter((p) => p.note.pitch !== 'rest' && !inside.has(slotKey(p.bar, p.note.start)))
        .map((p) => ({ bar: p.bar, beat: p.note.start }));

    const order = (a: { bar: number; beat: number }, b: { bar: number; beat: number }) => a.bar - b.bar || a.beat - b.beat;
    let changed = false;

    const verses = document.verses.map((verse): typeof verse | null => {
        const mine = verse.syllables.filter((s) => s.part === voice).sort(order);
        const others = verse.syllables.filter((s) => s.part !== voice);

        if (mine.length === 0) return verse;

        const placed: Syllable[] = [];
        let next = 0;

        for (const s of mine) {
            // The first free note at or after where the syllable was, and after the one before it.
            let k = next;
            while (k < slots.length && order(slots[k], s) < 0) k++;

            // Run out of notes: rather than pile two syllables on one note, leave this verse as it was.
            if (k >= slots.length) return null;

            const slot = slots[k];
            const join = starts.has(slotKey(slot.bar, slot.beat)) ? 'hold' : s.join;
            const moved = slot.bar !== s.bar || Math.abs(slot.beat - s.beat) > EPS || join !== s.join;

            if (moved) changed = true;

            placed.push(moved ? { ...s, bar: slot.bar, beat: slot.beat, join } : s);
            next = k + 1;
        }

        return { ...verse, syllables: [...others, ...placed].sort(order) };
    });

    if (!changed) return document;

    return { ...document, verses: verses.map((v, i) => v ?? document.verses[i]) };
}

/** The notes a slur covers, in order. */
export function slurNotes(document: ScoreDocument, voice: Voice, run: SlurRun): Note[] {
    const seq = noteSequence(partOf(document, voice));
    const start = seq.findIndex((p) => p.bar === run.from.bar && Math.abs(p.note.start - run.from.beat) < EPS);

    return start < 0 ? [] : seq.slice(start, start + run.notes).map((p) => p.note);
}
