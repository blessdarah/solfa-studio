import { Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LyricsInspector, NotesInspector, TempoInspector } from '@/components/editor/inspectors';
import { NotePalette, TextPalette } from '@/components/editor/palettes';
import type { NoteAction, TextAction } from '@/components/editor/palettes';
import { ScoreRail } from '@/components/editor/score-rail';
import { Sheet } from '@/components/editor/sheet';
import type { BarToolActions, LyricCursor } from '@/components/editor/sheet';
import { DeletePartDialog } from '@/components/editor/delete-part-dialog';
import { PrintView } from '@/components/editor/print-view';
import { EditorTopBar } from '@/components/editor/editor-top-bar';
import { TempoPopover } from '@/components/editor/tempo-popover';
import { Toast } from '@/components/toast';
import { useAutosave, useSavedLabel } from '@/lib/autosave';
import {
    addMark,
    addPart,
    clearPart,
    partContents,
    removePart,
    insertBars,
    duplicateBar,
    deleteBar,
    restPart,
    bringBackPart,
    addSection,
    addVerse,
    applyBars,
    applyMapChange,
    clearAt,
    copyRhythm,
    cycleDynamic,
    nextSlot,
    nextSpot,
    noteCovering,
    noteStarts,
    previousBeat,
    previousSlot,
    previousSpot,
    repeatBars,
    setBarPass,
    setSyllable,
    syllableAt,
    toggleNav,
    wordsPart,
} from '@/lib/editor';
import type { Cursor, MapChange } from '@/lib/editor';
import { VOICE_NAMES, beatsInBar, layoutLines, lineOf, noteAt, partOf, performanceOrder, tempoAt, VOICES } from '@/lib/music';
import type { PlayStep } from '@/lib/music';
import { audio } from '@/lib/tone';
import { play } from '@/lib/player';
import { placeWords, wordsStart } from '@/lib/lyrics';
import { press, typeLine } from '@/lib/typing';
import type { Typed, TypingAction } from '@/lib/typing';
import type { Playback } from '@/lib/player';
import type { Bar, ComposeProps, EditorMode, Pitch, ScoreDocument, SyllableJoin, Voice, WordsUnder } from '@/types';

function xsrf(): string {
    const match = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.slice('XSRF-TOKEN='.length)) : '';
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { message?: string } }> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrf(),
        },
        body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as T & { message?: string };

    return { ok: response.ok, status: response.status, data };
}

const PITCH_KEYS: Record<string, Pitch> = { d: 'd', r: 'r', m: 'm', f: 'f', s: 's', l: 'l', t: 't' };

function isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Where to put the cursor when the page opens: the first unfinished bar of the part. */
function startCursor(document: ScoreDocument, part: Voice): Cursor {
    const bars = partOf(document, part)?.bars ?? [];
    const open = bars.find((b) => !b.done) ?? bars[bars.length - 1];
    const bar = open?.no ?? 1;
    const beats = beatsInBar(document.map, bar);
    const notes = open?.notes ?? [];
    const end = notes.reduce((max, n) => Math.max(max, n.start + n.length), 0);

    return { part, bar, beat: Math.min(beats - 1, Math.ceil(end - 1e-6)) };
}

/**
 * The compose screen (Paper W1 Notes, W2 Lyrics & text, W3 Change tempo &
 * time). Edits happen here in the browser and autosave a moment later.
 */
export default function ScoreShow(props: ComposeProps) {
    const { auth } = usePage().props;
    const user = auth.user!;
    const { score, can_edit: canEdit } = props;
    const doh = score.doh;

    const [doc, setDoc] = useState<ScoreDocument>(props.document);
    const past = useRef<ScoreDocument[]>([]);
    const future = useRef<ScoreDocument[]>([]);

    const firstPart = props.start_part ?? props.document.parts[0]?.id ?? 'S';
    const [mode, setMode] = useState<EditorMode>('notes');
    const [cursor, setCursor] = useState<Cursor>(() => startCursor(props.document, firstPart));
    const [lyric, setLyric] = useState<LyricCursor>(() => {
        const part = wordsPart(props.document, firstPart);
        const bar = cursor.bar;

        return { verse: 0, part, bar, beat: noteStarts(props.document, part, bar)[0] ?? 0 };
    });
    const [mapBar, setMapBar] = useState<number | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [deletingPart, setDeletingPart] = useState<Voice | null>(null);
    const [printing, setPrinting] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [playback, setPlayback] = useState<Playback | null>(null);
    const [playingStep, setPlayingStep] = useState<PlayStep | null>(null);
    const [heardChoice, setHeardChoice] = useState<Voice[]>(VOICES);
    const scroller = useRef<HTMLDivElement>(null);

    const { save, state } = useAutosave(score.id, score.version, score.saved_at, canEdit);
    const saved = useSavedLabel(state);
    const savedLabel = canEdit ? saved : 'View only';

    useEffect(() => {
        if (state.kind === 'conflict') {
            setToast('This score was changed in another tab or device. Reloading the latest…');
            window.setTimeout(() => window.location.reload(), 1600);
        } else if (state.kind === 'error') {
            setToast(state.message);
        }
    }, [state]);

    /** Every edit goes through here: undo history, then autosave. */
    const commit = useCallback(
        (next: ScoreDocument) => {
            if (!canEdit || next === doc) return;

            past.current = [...past.current.slice(-99), doc];
            future.current = [];
            setDoc(next);
            save(next);
        },
        [canEdit, doc, save],
    );

    const undo = () => {
        const previous = past.current.pop();
        if (!previous) return;
        future.current.push(doc);
        setDoc(previous);
        save(previous);
    };

    const redo = () => {
        const next = future.current.pop();
        if (!next) return;
        past.current.push(doc);
        setDoc(next);
        save(next);
    };

    // ------------------------------------------------------------ notes

    /** The note just typed (see lib/typing): ".", the octave and fe/ta keys act on it after the cursor moves on. */
    const typed = useRef<Typed>(null);

    const onNote = (action: NoteAction) => {
        if (!canEdit && action.type !== 'next') return;

        const state = press({ document: doc, cursor, typed: typed.current }, action);
        const beats = beatsInBar(state.document.map, state.cursor.bar);

        commit(state.document);

        // At the very end of the score, stay on the last note written.
        if (state.cursor.beat >= beats - 1e-6) {
            typed.current = null;
            setCursor(state.typed?.note ?? cursor);
        } else {
            typed.current = state.typed;
            setCursor(state.cursor);
        }
    };

    /** "Type a line": write a whole phrase into the cursor's part from the cursor on. */
    const onLine = (actions: TypingAction[]) => {
        if (!canEdit) return;

        const result = typeLine(doc, cursor, actions);
        commit(result.document);
        typed.current = null;

        const beats = beatsInBar(result.document.map, result.cursor.bar);
        setCursor(result.cursor.beat >= beats - 1e-6 ? { ...result.cursor, beat: beats - 1 } : result.cursor);
    };

    /** Hovering a bar on the sheet: add, copy or delete bars (Paper W7). The cursors follow their bars. */
    const barTools: BarToolActions = {
        onInsert: (at) => {
            const next = insertBars(doc, at, 1);
            if (next === doc) return;
            commit(next);
            setMapBar(null);
            if (cursor.bar >= at) setCursor({ ...cursor, bar: cursor.bar + 1 });
            if (lyric.bar >= at) setLyric({ ...lyric, bar: lyric.bar + 1 });
        },
        onDuplicate: (bar) => {
            const next = duplicateBar(doc, bar);
            if (next === doc) return;
            commit(next);
            setMapBar(null);
            if (cursor.bar > bar) setCursor({ ...cursor, bar: cursor.bar + 1 });
            if (lyric.bar > bar) setLyric({ ...lyric, bar: lyric.bar + 1 });
        },
        onDelete: (bar) => {
            const next = deleteBar(doc, bar);
            if (next === doc) return;
            commit(next);
            setMapBar(null);
            typed.current = null;
            const moved = (b: number) => Math.min(next.bars, b > bar ? b - 1 : b);
            setCursor({ ...cursor, bar: moved(cursor.bar), beat: cursor.bar === bar ? 0 : cursor.beat });
            setLyric({ ...lyric, bar: moved(lyric.bar), beat: lyric.bar === bar ? (noteStarts(next, lyric.part, moved(lyric.bar))[0] ?? 0) : lyric.beat });
            setToast(`Bar ${bar} deleted. ⌘Z brings it back.`);
        },
    };

    const closePrint = useCallback(() => setPrinting(false), []);
    const closeDeleting = useCallback(() => setDeletingPart(null), []);

    /** Take a part out; if the cursor was in it, move to the first part left. */
    const deletePart = (voice: Voice) => {
        const next = removePart(doc, voice);
        if (next === doc) return;

        commit(next);
        setDeletingPart(null);
        typed.current = null;

        const fallback = next.parts[0]?.id ?? 'S';
        if (cursor.part === voice) setCursor({ ...cursor, part: fallback });
        if (lyric.part === voice) setLyric({ ...lyric, part: wordsPart(next, fallback) });
        setToast(`${VOICE_NAMES[voice]} part deleted. ⌘Z brings it back.`);
    };

    const rhythmFrom: Voice = cursor.part === 'S' ? 'A' : 'S';
    // Lines hold as many bars as fit, so find them from the layout rather than counting fours.
    const lines = useMemo(() => layoutLines(doc), [doc]);
    const lineIndex = Math.max(0, lines.findIndex((l) => l.bars.includes(cursor.bar)));
    const systemStart = lines[lineIndex]?.bars[0] ?? 1;
    const previousLine = lineIndex > 0 ? lines[lineIndex - 1].bars : null;
    const lineStartOf = (bar: number) => lineOf(lines, bar)?.bars[0] ?? 1;

    const copyRhythmHere = () => {
        if (!partOf(doc, rhythmFrom)) return;
        commit(copyRhythm(doc, rhythmFrom, cursor.part, cursor.bar));
    };

    const repeatHere = () => {
        if (!previousLine) return;
        commit(repeatBars(doc, cursor.part, previousLine[0], previousLine.length, systemStart));
    };

    const suggest = async () => {
        if (!props.suggestions) {
            setToast('Suggestions need an Anthropic API key on the server (ANTHROPIC_API_KEY).');

            return;
        }

        setSuggesting(true);

        try {
            const { ok, data } = await postJson<{ bars?: Bar[] }>(`/scores/${score.id}/suggest`, {
                part: cursor.part,
                from: cursor.bar,
                to: Math.min(doc.bars, cursor.bar + 2),
            });

            if (ok && data.bars) {
                commit(applyBars(doc, cursor.part, data.bars));
                setToast('Suggestion added. Keep it, change it, or undo with ⌘Z.');
            } else {
                setToast(data.message ?? 'No suggestion this time. Try again.');
            }
        } catch {
            setToast('Could not reach the server.');
        } finally {
            setSuggesting(false);
        }
    };

    // ------------------------------------------------------------ words

    const ensureVerse = (document: ScoreDocument): ScoreDocument =>
        document.verses.length > 0 ? document : addVerse(document, 'en', 'Verse 1');

    const currentSyllable = () => syllableAt(doc, lyric.verse, lyric.part, lyric.bar, lyric.beat);

    const typeText = (change: (text: string) => string, join?: SyllableJoin) => {
        if (!canEdit) return;

        const base = ensureVerse(doc);
        const text = change(currentSyllable()?.text ?? '');

        commit(setSyllable(base, lyric.verse, lyric.part, lyric.bar, lyric.beat, text, join));
    };

    const moveLyric = (direction: 1 | -1) => {
        const slot =
            direction === 1
                ? nextSlot(doc, lyric.part, lyric.bar, lyric.beat)
                : previousSlot(doc, lyric.part, lyric.bar, lyric.beat);

        if (slot) setLyric({ ...lyric, ...slot });
    };

    const joinAndMove = (join: SyllableJoin) => {
        const s = currentSyllable();

        if (s) commit(setSyllable(doc, lyric.verse, lyric.part, lyric.bar, lyric.beat, s.text, join));

        moveLyric(1);
    };

    const onText = (action: TextAction) => {
        if (!canEdit && action.type !== 'next' && action.type !== 'verse') return;

        switch (action.type) {
            case 'verse':
                if (doc.verses.length > 1) setLyric({ ...lyric, verse: (lyric.verse + 1) % doc.verses.length });
                break;
            case 'add-verse': {
                const base = ensureVerse(doc);
                const next = addVerse(base, base.verses[0]?.lang ?? 'tw', `Verse ${base.verses.length + 1}`);
                commit(next);
                setLyric({ ...lyric, verse: next.verses.length - 1 });
                break;
            }
            case 'split':
                joinAndMove('split');
                break;
            case 'hold':
                joinAndMove('hold');
                break;
            case 'letter':
                typeText((t) => t + action.letter);
                break;
            case 'dynamic':
                commit(cycleDynamic(doc, lyric.bar, lyric.beat));
                break;
            case 'rit': {
                const existing = doc.marks.find((m) => m.kind === 'text' && m.value === 'rit.' && m.at.bar === lyric.bar);
                commit(
                    existing
                        ? { ...doc, marks: doc.marks.filter((m) => m !== existing) }
                        : addMark(doc, { kind: 'text', value: 'rit.', at: { bar: lyric.bar, beat: lyric.beat }, to: null, parts: null }),
                );
                break;
            }
            case 'ds':
                commit(toggleNav(doc, lyric.bar, 'DS'));
                break;
            case 'text': {
                const value = window.prompt('Words to print above the music (e.g. “joyfully”)')?.trim();
                if (value) commit(addMark(doc, { kind: 'text', value, at: { bar: lyric.bar, beat: lyric.beat }, to: null, parts: null }));
                break;
            }
            case 'footnote': {
                const value = window.prompt('Footnote under the score')?.trim();
                if (value) commit({ ...doc, footnotes: [...doc.footnotes, value] });
                break;
            }
            case 'next':
                moveLyric(1);
                break;
        }
    };

    // ------------------------------------------------------------ tempo & time

    const applyChange = (change: MapChange) => {
        const result = applyMapChange(doc, change);
        commit(result.document);
        setMapBar(null);
        setCursor((c) => ({ ...c, bar: Math.min(c.bar, result.document.bars) }));
    };

    const removeChange = (bar: number) => {
        const event = doc.map.find((e) => e.bar === bar);
        const result = applyMapChange(doc, {
            bar,
            bpm: tempoAt(doc.map, bar - 1),
            beats: beatsInBar(doc.map, bar - 1),
            ramp: 'at_once',
            until: event?.until ?? null,
        });

        commit({ ...result.document, map: result.document.map.filter((e) => e.bar !== bar) });
        setMapBar(null);
    };

    const addRit = () => {
        const bar = doc.bars;
        const result = applyMapChange(doc, {
            bar,
            bpm: Math.round(tempoAt(doc.map, bar) * 0.8),
            beats: beatsInBar(doc.map, bar),
            ramp: 'rit',
            until: null,
        });
        commit(result.document);
    };

    // ------------------------------------------------------------ playback

    const partIds = VOICES.filter((v) => doc.parts.some((p) => p.id === v));
    const heard = heardChoice.filter((v) => partIds.includes(v));

    // The parts this viewer last chose to hear, remembered per score.
    useEffect(() => {
        try {
            const saved: unknown = JSON.parse(window.localStorage.getItem(`solfa.heard.${score.id}`) ?? 'null');

            if (Array.isArray(saved)) setHeardChoice(VOICES.filter((v) => saved.includes(v)));
        } catch {
            // Nothing remembered; every part plays.
        }
    }, [score.id]);

    const stop = useCallback(() => {
        playback?.stop();
        setPlayback(null);
    }, [playback]);

    const start = (document: ScoreDocument, fromBar: number, toBar?: number) => {
        playback?.stop();

        // A preview plays straight through; Play follows D.S., Fine and the 1st / D.S.-time bars.
        const steps: PlayStep[] =
            toBar === undefined
                ? performanceOrder(document, fromBar)
                : Array.from({ length: Math.max(0, Math.min(toBar, document.bars) - fromBar + 1) }, (_, i) => ({ bar: fromBar + i, pass: 1 }));
        const p = play(document, doh, steps, heard);
        setPlayback(p);

        const ms = Math.max(0, (p.endsAt - audio().currentTime) * 1000);
        window.setTimeout(() => setPlayback((current) => (current === p ? null : current)), Math.min(ms + 400, 60 * 60 * 1000));
    };

    const playFrom = mapBar !== null ? Math.max(1, mapBar - 1) : mode === 'lyrics' ? lineStartOf(lyric.bar) : systemStart;
    const playLabel = mode === 'lyrics' && mapBar === null ? 'Play with words' : `Play from bar ${playFrom}`;

    useEffect(() => () => playback?.stop(), [playback]);

    const changeHeard = (voices: Voice[]) => {
        setHeardChoice(voices);
        playback?.hear(voices);

        try {
            window.localStorage.setItem(`solfa.heard.${score.id}`, JSON.stringify(voices));
        } catch {
            // Remembering the choice is only a convenience.
        }
    };

    // ------------------------------------------------------------ share

    const share = async () => {
        try {
            const { ok, data } = await postJson<{ url?: string }>(`/scores/${score.id}/shares`, { can: 'practise' });

            if (!ok || !data.url) {
                setToast(data.message ?? 'Could not make a link.');

                return;
            }

            await navigator.clipboard?.writeText(data.url).catch(() => undefined);
            setToast('Link copied. Anyone with it can open and practise this score.');
        } catch {
            setToast('Could not reach the server.');
        }
    };

    // ------------------------------------------------------------ keyboard

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (isTyping(event.target) || deletingPart || printing) return;

            const meta = event.metaKey || event.ctrlKey;
            const key = event.key;

            // ⌘P opens our print view (pages laid out for paper) instead of printing the editor.
            if (meta && key.toLowerCase() === 'p') {
                event.preventDefault();
                setPrinting(true);
                return;
            }

            if (meta && key.toLowerCase() === 'z') {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();

                return;
            }

            if (key === 'Escape' && mapBar !== null) {
                setMapBar(null);

                return;
            }

            if (meta && key.toLowerCase() === 't') {
                event.preventDefault();
                if (canEdit) setMapBar(mode === 'lyrics' ? lyric.bar : cursor.bar);

                return;
            }

            if (mapBar !== null) return;

            if (mode === 'notes') {
                if (meta && key.toLowerCase() === 'r') {
                    event.preventDefault();
                    copyRhythmHere();
                } else if (meta && key.toLowerCase() === 'd') {
                    event.preventDefault();
                    repeatHere();
                } else if (meta) {
                    return;
                } else if (PITCH_KEYS[key.toLowerCase()]) {
                    event.preventDefault();
                    onNote({ type: 'pitch', pitch: PITCH_KEYS[key.toLowerCase()] });
                } else if (key === ',') {
                    onNote({ type: 'octave', by: -1 });
                } else if (key === "'") {
                    onNote({ type: 'octave', by: 1 });
                } else if (key === 'ArrowUp') {
                    event.preventDefault();
                    onNote({ type: 'chromatic', direction: 'up' });
                } else if (key === 'ArrowDown') {
                    event.preventDefault();
                    onNote({ type: 'chromatic', direction: 'down' });
                } else if (key === '-') {
                    onNote({ type: 'hold' });
                } else if (key === '.') {
                    onNote({ type: 'half' });
                } else if (key === '3') {
                    onNote({ type: 'triplet' });
                } else if (key.toLowerCase() === 'x' || key === ' ') {
                    event.preventDefault();
                    onNote({ type: 'rest' });
                } else if (key === 'Tab') {
                    event.preventDefault();
                    typed.current = null;
                    if (event.shiftKey) setCursor(previousBeat(doc, cursor));
                    else onNote({ type: 'next' });
                } else if (key === 'ArrowRight') {
                    // Arrows step note by note, into halves and quarters (the "t" of "d.t").
                    event.preventDefault();
                    typed.current = null;
                    setCursor(nextSpot(doc, cursor));
                } else if (key === 'ArrowLeft') {
                    event.preventDefault();
                    typed.current = null;
                    setCursor(previousSpot(doc, cursor));
                } else if (key === 'Backspace') {
                    // Like text: remove the note just behind the cursor, wherever in the beat it
                    // starts (".s" included), and put the cursor where it was.
                    event.preventDefault();
                    const part = partOf(doc, cursor.part);
                    let target: Cursor | null = null;

                    for (let b = cursor.bar; b >= 1 && target === null; b--) {
                        const before = (part?.bars[b - 1]?.notes ?? []).filter((n) => b < cursor.bar || n.start < cursor.beat - 1e-6);
                        const last = before.reduce<(typeof before)[number] | undefined>((a, n) => (!a || n.start > a.start ? n : a), undefined);
                        if (last) target = { ...cursor, bar: b, beat: last.start };
                    }

                    if (target === null) {
                        setCursor(previousBeat(doc, cursor));
                    } else {
                        if (canEdit) commit(clearAt(doc, target));
                        setCursor(target);
                    }
                } else if (key === 'Delete') {
                    // Remove the note under the cursor (or the one held over it) and stay put.
                    event.preventDefault();
                    const covering = noteCovering(partOf(doc, cursor.part)?.bars[cursor.bar - 1]?.notes ?? [], cursor.beat);
                    if (canEdit && covering) commit(clearAt(doc, { ...cursor, beat: covering.start }));
                }

                return;
            }

            // Words mode
            if (meta) return;

            if (key === ' ' || key === 'Tab' || key === 'ArrowRight') {
                event.preventDefault();
                if (event.shiftKey && key === 'Tab') moveLyric(-1);
                else moveLyric(1);
            } else if (key === 'ArrowLeft') {
                event.preventDefault();
                moveLyric(-1);
            } else if (key === '-') {
                event.preventDefault();
                joinAndMove('split');
            } else if (key === '_') {
                event.preventDefault();
                joinAndMove('hold');
            } else if (key === 'Backspace') {
                event.preventDefault();
                const text = currentSyllable()?.text ?? '';
                if (text === '') moveLyric(-1);
                else typeText((t) => t.slice(0, -1));
            } else if (key.length === 1) {
                event.preventDefault();
                typeText((t) => t + key);
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    // Keep the line being written in view.
    const activeSystem = mode === 'lyrics' ? lineStartOf(lyric.bar) : systemStart;
    useEffect(() => {
        scroller.current?.querySelector(`[data-system="${activeSystem}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [activeSystem]);

    const currentPitch = useMemo(() => {
        const n = noteAt(partOf(doc, cursor.part), cursor.bar, cursor.beat);

        return n && Math.abs(n.start - cursor.beat) < 1e-6 && n.pitch !== 'rest' ? n.pitch : null;
    }, [doc, cursor]);

    const verseLabel = doc.verses[lyric.verse]?.label ?? 'Verse 1';

    const switchMode = (next: EditorMode) => {
        setMapBar(null);

        if (next === 'lyrics' && mode !== 'lyrics') {
            const part = wordsPart(doc, cursor.part);
            const starts = noteStarts(doc, part, cursor.bar);
            setLyric({ ...lyric, part, bar: cursor.bar, beat: starts[0] ?? 0 });
        }

        setMode(next);
    };

    const missing = VOICES.filter((v) => !doc.parts.some((p) => p.id === v));

    return (
        <>
            <Head title={score.title} />

            <div className="flex h-screen min-h-[640px] flex-col bg-copy">
                <EditorTopBar
                    user={user}
                    title={score.title}
                    savedLabel={savedLabel}
                    mode={mode}
                    onMode={switchMode}
                    playLabel={playLabel}
                    stopLabel={playingStep ? `Stop · bar ${playingStep.bar}${playingStep.pass === 2 ? ' · D.S.' : ''}` : 'Stop'}
                    playing={playback !== null}
                    onPlay={() => (playback ? stop() : start(doc, playFrom))}
                    parts={partIds}
                    heard={heard}
                    onHeard={changeHeard}
                    activePart={mode === 'lyrics' ? lyric.part : cursor.part}
                    onShare={share}
                    onPrint={() => setPrinting(true)}
                    canShare={props.is_owner}
                />

                <div className="flex min-h-0 grow basis-0">
                    <ScoreRail
                        document={doc}
                        doh={doh}
                        activePart={mode === 'lyrics' ? lyric.part : cursor.part}
                        cursorBar={mode === 'lyrics' ? lyric.bar : cursor.bar}
                        writing={mode === 'notes' && canEdit}
                        canEdit={canEdit}
                        onPart={(voice) => {
                            if (mode === 'lyrics') {
                                if (doc.words_under === 'each') setLyric({ ...lyric, part: voice });
                            } else {
                                setCursor(startCursor(doc, voice));
                            }
                        }}
                        onAddPart={() => missing[0] && commit(addPart(doc, missing[0]))}
                        onClearPart={(voice) => {
                            commit(clearPart(doc, voice));
                            setToast(`${VOICE_NAMES[voice]} notes cleared. ⌘Z brings them back.`);
                        }}
                        onDeletePart={(voice) => {
                            // A part with nothing in it goes straight away; otherwise confirm first.
                            const { bars, syllables } = partContents(doc, voice);
                            if (bars === 0 && syllables === 0) deletePart(voice);
                            else setDeletingPart(voice);
                        }}
                        onSection={(bar) => {
                            setCursor({ ...cursor, bar, beat: 0 });
                            setLyric({ ...lyric, bar, beat: noteStarts(doc, lyric.part, bar)[0] ?? 0 });
                        }}
                        onAddSection={() => {
                            const name = window.prompt(`Name the section starting at bar ${cursor.bar}`)?.trim();
                            if (name) commit(addSection(doc, name, mode === 'lyrics' ? lyric.bar : cursor.bar));
                        }}
                        onMapChip={() => setMapBar(1)}
                    />

                    <div className="relative flex min-w-0 grow basis-0 flex-col">
                        <div ref={scroller} className="flex grow basis-0 flex-col items-center overflow-auto px-8 pt-7 pb-8">
                            <Sheet
                                document={doc}
                                title={score.title}
                                composer={score.composer}
                                arranger={score.arranger}
                                doh={doh}
                                mode={mode}
                                cursor={cursor}
                                lyricCursor={lyric}
                                canEdit={canEdit}
                                onCell={(part, bar, beat) => {
                                    // A click picks that exact note; the octave keys then act on it.
                                    typed.current = null;
                                    setMapBar(null);
                                    setCursor({ part, bar, beat });
                                }}
                                onWords={(verse, part, bar, beat) => setLyric({ verse, part, bar, beat })}
                                onBarNumber={(bar) => canEdit && setMapBar(bar)}
                                popoverBar={mapBar}
                                playback={playback}
                                onPlayingBar={setPlayingStep}
                                onRest={(part, bars) => {
                                    commit(restPart(doc, part, bars));
                                    setToast(`${VOICE_NAMES[part]} rests in bar${bars.length > 1 ? 's' : ''} ${bars.join(', ')}. ⌘Z brings it back.`);
                                }}
                                onBringBack={(part, bars) => commit(bringBackPart(doc, part, bars))}
                                barTools={canEdit ? barTools : undefined}
                                popover={
                                    mapBar !== null ? (
                                        <TempoPopover
                                            key={mapBar}
                                            document={doc}
                                            bar={mapBar}
                                            onClose={() => setMapBar(null)}
                                            onApply={applyChange}
                                            onPreview={(preview, from) => start(preview, from, from + 5)}
                                            onRemove={removeChange}
                                        />
                                    ) : null
                                }
                            />
                        </div>

                        {canEdit && mapBar === null && (
                            <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
                                <div className="pointer-events-auto">
                                    {mode === 'notes' ? (
                                        <NotePalette current={currentPitch} onAction={onNote} />
                                    ) : (
                                        <TextPalette verseLabel={verseLabel} onAction={onText} />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {mapBar !== null ? (
                        <TempoInspector document={doc} editingBar={mapBar} canEdit={canEdit} onEdit={setMapBar} onAddRit={addRit} />
                    ) : mode === 'notes' ? (
                        <NotesInspector
                            document={doc}
                            doh={doh}
                            cursor={cursor}
                            canEdit={canEdit}
                            suggesting={suggesting}
                            onSuggest={suggest}
                            onCopyRhythm={copyRhythmHere}
                            onRepeat={repeatHere}
                            previousLine={previousLine}
                            onNav={(value) => {
                                // One $ sign, one D.S. and one Fine per score: setting it here moves it.
                                const here = doc.marks.some((m) => m.kind === 'nav' && m.value === value && m.at.bar === cursor.bar);
                                const others = { ...doc, marks: doc.marks.filter((m) => !(m.kind === 'nav' && m.value === value && m.at.bar !== cursor.bar)) };
                                commit(here ? toggleNav(doc, cursor.bar, value) : toggleNav(others, cursor.bar, value));
                            }}
                            onPass={(pass) => commit(setBarPass(doc, cursor.bar, pass))}
                            onLine={onLine}
                        />
                    ) : (
                        <LyricsInspector
                            document={doc}
                            cursor={lyric}
                            canEdit={canEdit}
                            onWordsUnder={(value: WordsUnder) => {
                                const next = { ...doc, words_under: value };
                                commit(next);
                                const part = wordsPart(next, cursor.part);
                                setLyric({ ...lyric, part, beat: noteStarts(next, part, lyric.bar)[0] ?? 0 });
                            }}
                            onVerse={(index) => setLyric({ ...lyric, verse: index })}
                            onAddTranslation={() => {
                                const next = addVerse(ensureVerse(doc), 'en', 'English');
                                commit(next);
                                setLyric({ ...lyric, verse: next.verses.length - 1 });
                            }}
                            onWords={(tokens) => {
                                const base = ensureVerse(doc);
                                const start = wordsStart(base, lyric.verse, lyric.part, lyric);
                                if (!start) return;
                                const result = placeWords(base, lyric.verse, lyric.part, start, tokens);
                                commit(result.document);

                                // Carry on from the note after the last syllable placed.
                                const end = result.end;
                                const after = end ? nextSlot(result.document, lyric.part, end.bar, end.beat) : null;
                                if (end) setLyric({ ...lyric, ...(after ?? end) });
                            }}
                        />
                    )}
                </div>
            </div>

            {printing && (
                <PrintView
                    document={doc}
                    title={score.title}
                    composer={score.composer}
                    arranger={score.arranger}
                    doh={doh}
                    onClose={closePrint}
                />
            )}

            {deletingPart && (
                <DeletePartDialog
                    document={doc}
                    voice={deletingPart}
                    title={score.title}
                    onCancel={closeDeleting}
                    onDelete={() => deletePart(deletingPart)}
                />
            )}

            <Toast message={toast} onClose={() => setToast(null)} />
        </>
    );
}

