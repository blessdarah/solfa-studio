/**
 * Writing notes key by key — the keypad, the keyboard and the "Type a
 * line" box all go through `press`, so `d . r . m` means the same thing
 * wherever it is typed.
 */
import { beatsInBar, onThird, partOf } from '@/lib/music';
import {
    addBars,
    chromatic,
    dropEmptyLastBar,
    clearAt,
    halfBeat,
    tripletBeat,
    hold,
    markDone,
    nextBeat,
    noteEndingAt,
    setNote,
    setNoteEnd,
    shiftOctave,
} from '@/lib/editor';
import type { Cursor } from '@/lib/editor';
import { dropWaitingSlur, extendSlur, followSlurs, shortenSlur, waitingSlur } from '@/lib/slurs';
import type { Octave, Pitch, ScoreDocument } from '@/types/score';

const EPS = 1e-6;

export type TypingAction =
    /** Every new note starts in the middle octave; only ' and , move it — the composer's call, never a guess. */
    | { type: 'pitch'; pitch: Pitch; octave?: Octave }
    | { type: 'octave'; by: -1 | 1 }
    | { type: 'chromatic'; direction: 'up' | 'down' }
    | { type: 'hold' }
    | { type: 'half' }
    /** Make the note just typed the first of three in its beat (f,f,f). */
    | { type: 'triplet' }
    | { type: 'rest' }
    /** "(": slur the note just typed (or under the cursor) into the next one, or stretch its slur. */
    | { type: 'slur' }
    /** ")": take the last note off the slur. */
    | { type: 'unslur' }
    | { type: 'next' }
    | { type: 'bar' };

/**
 * The note just typed while the cursor still sits right after it, so ".",
 * the octave and the chromatic keys act on it: d . r . m → d.r,m. After a
 * "–", `holdFrom` is where the hold began, so "." halves the hold: s – . d → s :–.d
 */
export type Typed = { note: Cursor; after: Cursor; holdFrom?: Cursor } | null;

export type TypingState = { document: ScoreDocument; cursor: Cursor; typed: Typed };

const sameSpot = (a: Cursor, b: Cursor) => a.part === b.part && a.bar === b.bar && Math.abs(a.beat - b.beat) < EPS;

/**
 * Go to `beat` in the cursor's bar, or on to the next bar once this one is
 * full (marking it written). Past the last bar a new empty bar is added, so
 * there is always room to keep writing.
 */
function moveTo(from: Cursor, beat: number, document: ScoreDocument): { cursor: Cursor; document: ScoreDocument } {
    if (beat < beatsInBar(document.map, from.bar) - EPS) return { cursor: { ...from, beat }, document };

    const done = markDone(document, from.part, from.bar);
    const grown = from.bar >= done.bars ? addBars(done, 1) : done;

    if (from.bar >= grown.bars) return { cursor: { ...from, beat: beatsInBar(document.map, from.bar) }, document: done };

    return { cursor: { ...from, bar: from.bar + 1, beat: 0 }, document: grown };
}

function endOf(document: ScoreDocument, at: Cursor, start: number): number | null {
    const note = partOf(document, at.part)?.bars[at.bar - 1]?.notes.find((n) => Math.abs(n.start - start) < EPS);

    return note ? note.start + note.length : null;
}

/** One key: write, split, hold, raise… and move the cursor the way typing does. */
export function press(state: TypingState, action: TypingAction): TypingState {
    const { document: doc, cursor } = state;
    const typed = state.typed && sameSpot(state.typed.after, cursor) ? state.typed : null;
    const target = typed?.note ?? cursor;

    // Past the last beat of the score there is nowhere left to write.
    const onTyped = ['octave', 'chromatic', 'half', 'slur', 'unslur'].includes(action.type);

    if (cursor.beat >= beatsInBar(doc.map, cursor.bar) - EPS && !onTyped) {
        return { ...state, typed };
    }

    switch (action.type) {
        case 'pitch':
        case 'rest': {
            // Write the note (or a rest), then move to where it ends — "." can still split it.
            const pitch: Pitch = action.type === 'rest' ? 'rest' : action.pitch;
            const octave = action.type === 'rest' ? 0 : (action.octave ?? 0);
            const waiting = waitingSlur(doc, cursor);

            // d ( d: a slur onto the same note is a hold, so it is written d :–.
            if (waiting && waiting.pitch === pitch && waiting.octave === octave) {
                return press({ ...state, document: dropWaitingSlur(doc, cursor), typed }, { type: 'hold' });
            }

            const written = setNote(doc, cursor, pitch, octave);
            const moved = moveTo(cursor, endOf(written, cursor, cursor.beat) ?? Math.floor(cursor.beat + EPS) + 1, written);
            // A slur waiting for this note now joins it: the words move on past it.
            const document = waiting && pitch !== 'rest' ? followSlurs(moved.document, cursor.part) : moved.document;

            return { document, cursor: moved.cursor, typed: { note: cursor, after: moved.cursor } };
        }
        case 'octave':
            return { ...state, document: shiftOctave(doc, target, action.by), typed };
        case 'chromatic':
            return { ...state, document: chromatic(doc, target, action.direction), typed };
        case 'hold': {
            // Through the next beat (d :–), or inside a beat one more quarter (d.,).
            const held = noteEndingAt(partOf(doc, cursor.part)?.bars[cursor.bar - 1]?.notes ?? [], cursor.beat);
            const grown = hold(doc, cursor);

            if (!held) {
                // Over a bar line the hold becomes a tied note at the start of this bar.
                const tiedEnd = grown !== doc ? endOf(grown, cursor, cursor.beat) : null;

                if (tiedEnd === null) return { ...state, document: grown, typed: null };

                const moved = moveTo(cursor, tiedEnd, grown);

                return { document: moved.document, cursor: moved.cursor, typed: { note: cursor, after: moved.cursor, holdFrom: cursor } };
            }

            const moved = moveTo(cursor, endOf(grown, cursor, held.start) ?? cursor.beat, grown);

            return { document: moved.document, cursor: moved.cursor, typed: { note: { ...cursor, beat: held.start }, after: moved.cursor, holdFrom: cursor } };
        }
        case 'half': {
            if (typed?.holdFrom) {
                // "–" then ".": hold for only half of that beat and land on its second half.
                const from = typed.holdFrom;
                const end = endOf(doc, from, target.beat) ?? from.beat + 1;
                const middle = from.beat + Math.max(0.25, Math.floor(((end - from.beat) / 2) * 4 + EPS) / 4);

                if (middle >= end - EPS) return { ...state, typed };

                const after = { ...from, beat: middle };

                return { document: setNoteEnd(doc, from.part, from.bar, target.beat, middle), cursor: after, typed: { note: target, after } };
            }

            // Split the note just typed; the cursor goes to its second half.
            const result = halfBeat(doc, target);

            if (result.document === doc) return { ...state, typed };

            return { document: result.document, cursor: result.cursor, typed: typed ? { note: target, after: result.cursor } : null };
        }
        case 'triplet': {
            // Already inside a triplet, a comma just separates its notes.
            if (onThird(cursor.beat)) return { ...state, typed };

            const result = tripletBeat(doc, target);

            if (result.document === doc) return { ...state, typed };

            return { document: result.document, cursor: result.cursor, typed: { note: target, after: result.cursor } };
        }
        case 'slur':
            return { ...state, document: followSlurs(extendSlur(doc, target), target.part), typed };
        case 'unslur':
            return { ...state, document: shortenSlur(doc, target), typed };
        case 'next': {
            const next = nextBeat(doc, cursor);
            const document = next.bar !== cursor.bar ? markDone(doc, cursor.part, cursor.bar) : doc;

            return { document, cursor: next, typed: null };
        }
        case 'bar': {
            if (cursor.beat < EPS) return { ...state, typed: null };

            const moved = moveTo(cursor, Infinity, doc);

            return { document: moved.document, cursor: moved.cursor, typed: null };
        }
    }
}

// ------------------------------------------------------------ type a line

export type ParsedLine = { actions: TypingAction[] } | { error: string };

/**
 * Read a line of quick sol-fa: the same keys as the keypad, so
 *   d r m f s l t  a note on the next beat (fe and ta too), middle octave
 *   '  ,           on the note before: an octave up / down — l' l'' s, s,,
 *   –  or -        hold through the next beat
 *   .              split the last note: d.r, and again for quarters d.r.m → d.r,m
 *   ,  between     three notes in one beat — a triplet: f,f,f  d,–,r
 *   3              the same, as a key: f 3 f f → f,f,f
 *   x              a rest
 *   ( )            a slur round the notes inside: (s-.l s) m
 *   |              start the next bar
 * Spaces are only for reading and are skipped.
 */
export function parseLine(text: string): ParsedLine {
    const actions: TypingAction[] = [];
    const chars = [...text];
    // Inside ( ): each note after the first is slurred on from the one before.
    let slur: 'off' | 'opening' | 'on' = 'off';
    const note = (action: TypingAction) => {
        if (slur === 'on' && action.type === 'pitch') actions.push({ type: 'slur' });
        if (slur === 'opening' && action.type === 'pitch') slur = 'on';
        actions.push(action);
    };

    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const lower = c.toLowerCase();

        if (/\s/.test(c)) continue;

        if (c === '(') {
            slur = 'opening';
            continue;
        }

        if (c === ')') {
            slur = 'off';
            continue;
        }

        if (lower === 'f' && chars[i + 1]?.toLowerCase() === 'e') {
            note({ type: 'pitch', pitch: 'fe', octave: 0 });
            i++;
        } else if (lower === 't' && chars[i + 1]?.toLowerCase() === 'a') {
            note({ type: 'pitch', pitch: 'ta', octave: 0 });
            i++;
        } else if ('drmfslt'.includes(lower)) {
            note({ type: 'pitch', pitch: lower as Pitch, octave: 0 });
        } else if (c === "'" || c === '’' || c === '¹') {
            actions.push({ type: 'octave', by: 1 });
        } else if (c === ',' && /^[drmfsltx\-–—]$/i.test(chars[i + 1] ?? '')) {
            // A comma straight between two notes splits the beat in three (f,f,f), as written in sol-fa.
            actions.push({ type: 'triplet' });
        } else if (c === '3') {
            actions.push({ type: 'triplet' });
        } else if (c === ',' || c === '₁') {
            actions.push({ type: 'octave', by: -1 });
        } else if (c === '₂') {
            actions.push({ type: 'octave', by: -1 }, { type: 'octave', by: -1 });
        } else if (c === '-' || c === '–' || c === '—') {
            actions.push({ type: 'hold' });
        } else if (c === '.') {
            actions.push({ type: 'half' });
        } else if (lower === 'x') {
            actions.push({ type: 'rest' });
        } else if (c === '|') {
            actions.push({ type: 'bar' });
        } else {
            return { error: `“${c}” isn't a sol-fa key (character ${i + 1}).` };
        }
    }

    return { actions };
}

/** Is `a` before `b` in the part? */
const before = (a: { bar: number; beat: number }, b: { bar: number; beat: number }) => a.bar < b.bar || (a.bar === b.bar && a.beat < b.beat - EPS);

/** Remove what was written in [from, to) of one part, cutting short a note held into `from`. */
function clearSpan(document: ScoreDocument, from: Cursor, to: Cursor): ScoreDocument {
    let next = document;

    for (let bar = from.bar; bar <= Math.min(to.bar, document.bars); bar++) {
        const notes = partOf(next, from.part)?.bars[bar - 1]?.notes ?? [];

        for (const n of notes) {
            const at = { bar, beat: n.start };
            if (!before(at, from) && before(at, to)) next = clearAt(next, { ...from, bar, beat: n.start });
        }
    }

    return clearAt(next, from);
}

export type LineResult = { document: ScoreDocument; cursor: Cursor; notes: number };

/**
 * Write a parsed line into the cursor's part from the cursor on, replacing
 * what was there, and say where it ended. Runs twice: once to see how far
 * it reaches, then again on a cleared stretch so nothing old is left behind.
 */
export function typeLine(document: ScoreDocument, start: Cursor, actions: TypingAction[]): LineResult {
    const run = (doc: ScoreDocument) =>
        actions.reduce<TypingState>((state, action) => press(state, action), { document: doc, cursor: start, typed: null });

    const trial = run(document);
    const cleared = clearSpan(document, start, trial.cursor);
    const result = run(cleared);

    // Bars are added as the line runs past the end; don't leave an empty one behind it.
    let written = result.document;
    let cursor = result.cursor;

    if (written.bars > document.bars && cursor.bar === written.bars && cursor.beat < EPS) {
        const trimmed = dropEmptyLastBar(written);

        if (trimmed !== written) {
            written = trimmed;
            cursor = { ...cursor, bar: written.bars, beat: beatsInBar(written.map, written.bars) };
        }
    }

    return { document: written, cursor, notes: actions.filter((a) => a.type === 'pitch' || a.type === 'rest').length };
}
