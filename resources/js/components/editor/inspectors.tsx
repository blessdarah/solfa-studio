import { useCallback, useRef, useState } from 'react';
import { useDismiss } from '@/lib/use-dismiss';
import { SparkleIcon } from '@/components/icons';
import type { ReactNode } from 'react';
import { syllableAt } from '@/lib/editor';
import type { Cursor } from '@/lib/editor';
import type { LyricCursor } from '@/components/editor/sheet';
import {
    beatsInBar,
    chordHint,
    keyLabel,
    langLabel,
    noteAt,
    noteLabel,
    partOf,
    soundsLike,
    tempoName,
    timeLabel,
    VOICE_NAMES,
    barPass,
    formatBar,
} from '@/lib/music';
import { cn } from '@/lib/utils';
import { slurNotes } from '@/lib/slurs';
import type { SlurRun } from '@/lib/slurs';
import type { Pass } from '@/lib/music';
import { lyricTokens, placeWords, wordsStart } from '@/lib/lyrics';
import type { LyricToken } from '@/lib/lyrics';
import { parseLine, typeLine } from '@/lib/typing';
import type { TypingAction } from '@/lib/typing';
import type { MapEvent, ScoreDocument, SlurPlace, Voice, WordsUnder } from '@/types';

function Label({ children }: { children: string }) {
    return <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">{children}</div>;
}

function Panel({ children }: { children: ReactNode }) {
    return <aside className="flex w-75 shrink-0 flex-col gap-6 overflow-y-auto border-l border-rule bg-paper px-5 py-6">{children}</aside>;
}

/** ½ ¼ ¾ for halves and quarters, ⅓ ⅔ for triplets. */
function fraction(frac: number): string {
    const near = (x: number) => Math.abs(frac - x) < 1e-4;

    return near(0.5) ? '½' : near(0.25) ? '¼' : near(0.75) ? '¾' : near(1 / 3) ? '⅓' : near(2 / 3) ? '⅔' : '';
}

function beatText(beat: number): string {
    const whole = Math.floor(beat) + 1;
    const frac = beat - Math.floor(beat);

    return `${whole}${fraction(frac)}`;
}

function lengthText(length: number): string {
    const whole = Math.floor(length + 1e-6);
    const frac = length - whole;
    const fracText = fraction(frac);
    const number = whole === 0 ? fracText : `${whole}${fracText}`;

    return `${number} beat${length > 1 ? 's' : ''} long`;
}

/**
 * Notes mode (Paper W1): the selected note, every part on this beat with
 * a chord hint, and the "Fill faster" shortcuts.
 */
export function NotesInspector({
    document,
    doh,
    cursor,
    canEdit,
    suggesting,
    onSuggest,
    onCopyRhythm,
    onRepeat,
    previousLine,
    onNav,
    onPass,
    onLine,
    slur,
    onSlur,
}: {
    document: ScoreDocument;
    doh: string;
    cursor: Cursor;
    canEdit: boolean;
    suggesting: boolean;
    onSuggest: () => void;
    onCopyRhythm: () => void;
    onRepeat: () => void;
    /** The bars of the line above the cursor's, for "Repeat bars 1–4 here". */
    previousLine: number[] | null;
    onNav: (value: '$' | 'DS' | 'Fine') => void;
    onPass: (pass: Pass | null) => void;
    onLine: (actions: TypingAction[]) => void;
    /** The slur the cursor's note is in, and what to do to it. */
    slur: SlurRun | null;
    onSlur: (change: 'longer' | 'shorter' | 'remove' | SlurPlace) => void;
}) {
    const part = partOf(document, cursor.part);
    const note = noteAt(part, cursor.bar, cursor.beat);
    const starts = note !== undefined && Math.abs(note.start - cursor.beat) < 1e-6;

    const sounding = document.parts.map((p) => ({ voice: p.id, note: noteAt(p, cursor.bar, cursor.beat) }));
    const hint = chordHint(sounding);

    const rhythmFrom: Voice = cursor.part === 'S' ? (partOf(document, 'A') ? 'A' : 'S') : 'S';
    const suggestTo = Math.min(document.bars, cursor.bar + 2);

    return (
        <Panel>
            {slur ? (
                <SlurPanel document={document} cursor={cursor} slur={slur} canEdit={canEdit} onSlur={onSlur} />
            ) : (
            <div className="flex flex-col gap-3">
                <Label>SELECTED</Label>
                <div className="flex items-end gap-3.5">
                    <div
                        className={cn(
                            'flex size-18 shrink-0 items-center justify-center rounded-md',
                            note && note.pitch !== 'rest' ? 'bg-marker' : 'bg-copy',
                        )}
                    >
                        <span className="font-solfa text-[36px] leading-11 text-ink">
                            {note && note.pitch !== 'rest' ? (starts ? noteLabel(note) : '–') : '·'}
                        </span>
                    </div>
                    <div className="flex flex-col gap-0.75 pb-1">
                        <div className="text-[16px] leading-5 font-semibold text-ink">
                            {VOICE_NAMES[cursor.part]} · bar {cursor.bar}
                        </div>
                        <div className="w-max text-[13px] leading-4 text-pencil">
                            Beat {beatText(cursor.beat)}
                            {note ? ` · ${starts ? lengthText(note.length) : `held from beat ${beatText(note.start)}`}` : ' · empty'}
                        </div>
                        <div className="text-[13px] leading-4 text-pencil">
                            {note && note.pitch !== 'rest'
                                ? `Sounds ${soundsLike(note, doh)} (Doh is ${keyLabel(doh)})`
                                : `Doh is ${keyLabel(doh)}`}
                        </div>
                    </div>
                </div>
            </div>
            )}

            {canEdit && <TypeLine document={document} cursor={cursor} onLine={onLine} />}

            <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
                <Label>{`BAR ${cursor.bar} · BEAT ${beatText(cursor.beat)}, ALL PARTS`}</Label>
                <div className="flex flex-col gap-1.5">
                    {sounding.map(({ voice, note: n }) => {
                        const active = voice === cursor.part;
                        const empty = n === undefined || n.pitch === 'rest';

                        return (
                            <div
                                key={voice}
                                className={cn('flex h-7 shrink-0 items-center justify-between', active && '-mx-2 rounded-sm bg-copy px-2')}
                            >
                                <span className={cn('text-[13px] leading-4', active ? 'font-semibold text-ink' : empty ? 'text-pencil' : 'text-ink')}>
                                    {VOICE_NAMES[voice]}
                                </span>
                                {empty ? (
                                    <span className="text-[13px] leading-4 text-pencil">empty</span>
                                ) : (
                                    <span className="font-solfa text-[15px] leading-4.5 text-ink">{noteLabel(n!)}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
                {hint && (
                    <div className="flex items-center gap-2.5 rounded-md bg-copy p-3">
                        <div className="font-display text-[22px] leading-7 font-extrabold text-ink">{hint.numeral}</div>
                        <div className="text-[13px] leading-4.5 text-ink">{hint.text}</div>
                    </div>
                )}
            </div>

            {canEdit && (
                <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
                    <Label>FILL FASTER</Label>
                    <button
                        type="button"
                        onClick={onSuggest}
                        disabled={suggesting}
                        className="flex h-11 shrink-0 items-center gap-2.5 rounded-full bg-ink px-3.5 text-left text-paper disabled:opacity-70"
                    >
                        <SparkleIcon className="text-marker" />
                        <span className="text-[14px] leading-4.5 font-semibold">
                            {suggesting
                                ? 'Thinking…'
                                : `Suggest ${VOICE_NAMES[cursor.part].toLowerCase()} for bars ${cursor.bar}${suggestTo > cursor.bar ? `–${suggestTo}` : ''}`}
                        </span>
                    </button>
                    {rhythmFrom !== cursor.part && (
                        <button
                            type="button"
                            onClick={onCopyRhythm}
                            className="flex h-10 shrink-0 items-center justify-between rounded-full border border-rule px-3.5 hover:bg-copy"
                        >
                            <span className="text-[14px] leading-4.5 font-medium text-ink">
                                Copy rhythm from {VOICE_NAMES[rhythmFrom].toLowerCase()}
                            </span>
                            <span className="text-[11px] leading-3.5 text-pencil">⌘ R</span>
                        </button>
                    )}
                    {previousLine && (
                        <button
                            type="button"
                            onClick={onRepeat}
                            className="flex h-10 shrink-0 items-center justify-between rounded-full border border-rule px-3.5 hover:bg-copy"
                        >
                            <span className="text-[14px] leading-4.5 font-medium text-ink">
                                Repeat bars {previousLine[0]}–{previousLine[previousLine.length - 1]} here
                            </span>
                            <span className="text-[11px] leading-3.5 text-pencil">⌘ D</span>
                        </button>
                    )}
                </div>
            )}

            {canEdit && <JumpsPanel document={document} bar={cursor.bar} onNav={onNav} onPass={onPass} />}
        </Panel>
    );
}

/**
 * "Type a line": write a phrase in one go with the keypad's keys —
 * `m-m m-m msfmmr- r-r` — into the cursor's part from the cursor on, with a
 * preview of the bars it will fill before anything changes.
 */
function TypeLine({ document, cursor, onLine }: { document: ScoreDocument; cursor: Cursor; onLine: (actions: TypingAction[]) => void }) {
    const [text, setText] = useState('');
    const parsed = parseLine(text);
    const actions = 'actions' in parsed ? parsed.actions : [];
    const preview = actions.length > 0 ? typeLine(document, cursor, actions) : null;
    const part = partOf(preview?.document ?? document, cursor.part);
    const lastBar = preview ? Math.min(preview.document.bars, preview.cursor.bar - (preview.cursor.beat < 1e-6 ? 1 : 0)) : cursor.bar;
    const added = preview ? preview.document.bars - document.bars : 0;
    const bars = preview ? Array.from({ length: Math.max(0, lastBar - cursor.bar + 1) }, (_, i) => cursor.bar + i) : [];
    const shown = bars.slice(0, 6);
    const name = VOICE_NAMES[cursor.part].toLowerCase();

    const write = () => {
        if (actions.length === 0) return;
        onLine(actions);
        setText('');
    };

    return (
        <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
            <Label>{`TYPE A LINE · ${VOICE_NAMES[cursor.part].toUpperCase()}`}</Label>
            <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        write();
                    } else if (event.key === 'Escape') {
                        setText('');
                        event.currentTarget.blur();
                    }
                }}
                placeholder="m-m m-m msfmmr- r-r"
                spellCheck={false}
                autoComplete="off"
                aria-label={`Type a line of sol-fa for the ${name}`}
                className="h-10 rounded-md border border-rule bg-copy px-3 font-solfa text-[14px] leading-4.5 text-ink outline-none placeholder:text-faint focus:border-ink focus:bg-paper"
            />
            {'error' in parsed ? (
                <p className="text-[12px] leading-4 text-danger">{parsed.error}</p>
            ) : shown.length > 0 ? (
                <div className="flex flex-col gap-1 rounded-md bg-copy px-3 py-2.5">
                    {shown.map((bar) => (
                        <div key={bar} className="flex items-baseline gap-2.5">
                            <span className="w-5 shrink-0 text-right font-solfa text-[11px] leading-3.5 text-pencil">{bar}</span>
                            <span className="font-solfa text-[13px] leading-4.5 whitespace-pre text-ink">
                                {formatBar(part?.bars[bar - 1]?.notes ?? [], beatsInBar((preview?.document ?? document).map, bar))}
                            </span>
                        </div>
                    ))}
                    {bars.length > shown.length && <span className="pl-7.5 text-[12px] leading-4 text-pencil">… to bar {bars[bars.length - 1]}</span>}
                    {added > 0 && (
                        <span className="pl-7.5 text-[12px] leading-4 text-pencil">
                            Adds {added} bar{added > 1 ? 's' : ''} at the end to fit it all
                        </span>
                    )}
                </div>
            ) : (
                <p className="text-[12px] leading-4.5 text-pencil">
                    Notes as on the keypad: <span className="font-solfa text-ink">' ,</span> octave, <span className="font-solfa text-ink">-</span> hold,{' '}
                    <span className="font-solfa text-ink">.</span> split, <span className="font-solfa text-ink">f,f,f</span> triplet,{' '}
                    <span className="font-solfa text-ink">x</span> rest, <span className="font-solfa text-ink">(s l s)</span> slur,{' '}
                    <span className="font-solfa text-ink">|</span> next bar. Spaces are ignored.
                </p>
            )}
            <button
                type="button"
                onClick={write}
                disabled={actions.length === 0}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[14px] leading-4.5 font-semibold text-paper disabled:bg-copy disabled:text-faint"
            >
                Write into {name} from bar {cursor.bar}
                <span className="text-[11px] leading-3.5 opacity-60">⏎</span>
            </button>
        </div>
    );
}

/**
 * "Type the words": paste or type a verse; it is split into syllables and
 * one goes on each note of the part the words follow, from the cursor on.
 * The preview shows where every syllable lands before anything changes.
 */
function TypeWords({ document, cursor, onWords }: { document: ScoreDocument; cursor: LyricCursor; onWords: (tokens: LyricToken[]) => void }) {
    const [text, setText] = useState('');
    const tokens = lyricTokens(text);
    const withVerse: ScoreDocument =
        document.verses.length > 0 ? document : { ...document, verses: [{ id: 'preview', label: 'Verse 1', lang: 'en', syllables: [] }] };
    const start = wordsStart(withVerse, cursor.verse, cursor.part, cursor);
    const preview = tokens.length > 0 && start ? placeWords(withVerse, cursor.verse, cursor.part, start, tokens) : null;
    const name = VOICE_NAMES[cursor.part].toLowerCase();

    const byBar = new Map<number, NonNullable<typeof preview>['placed']>();
    for (const s of preview?.placed ?? []) byBar.set(s.bar, [...(byBar.get(s.bar) ?? []), s]);
    const bars = [...byBar.keys()];
    const shown = bars.slice(0, 6);
    const notesUsed = preview ? tokens.length - preview.leftOver : 0;

    const put = () => {
        if (tokens.length === 0) return;
        onWords(tokens);
        setText('');
    };

    return (
        <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
            <Label>{`TYPE THE WORDS · ${(document.verses[cursor.verse]?.label ?? 'Verse 1').toUpperCase()}`}</Label>
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        put();
                    } else if (event.key === 'Escape') {
                        setText('');
                        event.currentTarget.blur();
                    }
                }}
                rows={3}
                placeholder="Glory to God in the highest"
                spellCheck={false}
                aria-label={`Type the words for the ${name}'s notes`}
                className="resize-none rounded-md border border-rule bg-copy px-3 py-2.5 text-[14px] leading-5 text-ink italic outline-none placeholder:text-faint focus:border-ink focus:bg-paper"
            />
            {preview && preview.placed.length > 0 ? (
                <div className="flex flex-col gap-1 rounded-md bg-copy px-3 py-2.5">
                    {shown.map((bar) => (
                        <div key={bar} className="flex items-baseline gap-2.5">
                            <span className="w-5 shrink-0 text-right font-solfa text-[11px] leading-3.5 text-pencil">{bar}</span>
                            <span className="text-[13px] leading-4.5 text-ink italic">
                                {byBar
                                    .get(bar)!
                                    .map((s) => `${s.text}${s.join === 'split' ? '–' : s.join === 'hold' ? ' __' : ''}`)
                                    .join('  ')}
                            </span>
                        </div>
                    ))}
                    {bars.length > shown.length && <span className="pl-7.5 text-[12px] leading-4 text-pencil">… to bar {bars[bars.length - 1]}</span>}
                    <span className="pt-1 text-[12px] leading-4 text-pencil">
                        {notesUsed} note{notesUsed === 1 ? '' : 's'} in the {name}
                        {preview.leftOver > 0 ? '' : `, bars ${bars[0]}–${bars[bars.length - 1]}`}
                    </span>
                    {preview.leftOver > 0 && (
                        <span className="text-[12px] leading-4 text-danger">
                            {preview.leftOver} syllable{preview.leftOver === 1 ? '' : 's'} left over — the {name} has no more notes. Write the notes first.
                        </span>
                    )}
                </div>
            ) : tokens.length > 0 ? (
                <p className="text-[12px] leading-4 text-danger">The {name} has no notes to put words on yet. Write the notes first.</p>
            ) : (
                <p className="text-[12px] leading-4.5 text-pencil">
                    Words are split into syllables for you, one per note. Fix a split with hyphens: <span className="italic text-ink">Hal-le-lu-jah</span>. Hold a
                    syllable over the next note with <span className="font-solfa text-ink">_</span>: <span className="italic text-ink">Glo_ ry</span>.
                </p>
            )}
            <button
                type="button"
                onClick={put}
                disabled={!preview || preview.placed.length === 0}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[13.5px] whitespace-nowrap leading-4.5 font-semibold text-paper disabled:bg-copy disabled:text-faint"
            >
                Put under {name}{start ? ` from bar ${start.bar}` : ''}
                <span className="text-[11px] leading-3.5 opacity-60">⏎</span>
            </button>
        </div>
    );
}

const NAV: { value: '$' | 'DS' | 'Fine'; label: string; title: string }[] = [
    { value: '$', label: '$ sign', title: 'D.S. comes back to this bar' },
    { value: 'DS', label: 'D.S.', title: 'After this bar, go back to the $ sign' },
    { value: 'Fine', label: 'Fine', title: 'The second time through, stop after this bar' },
];

const PASSES: { value: Pass | null; label: string }[] = [
    { value: null, label: 'Every time' },
    { value: 1, label: '1st time' },
    { value: 2, label: 'D.S. time' },
];

/**
 * Where the music jumps (the $ sign, D.S., Fine) and when the bar under
 * the cursor plays: every time, only the first time through, or only
 * after going back with D.S. Play follows all of it.
 */
function JumpsPanel({
    document,
    bar,
    onNav,
    onPass,
}: {
    document: ScoreDocument;
    bar: number;
    onNav: (value: '$' | 'DS' | 'Fine') => void;
    onPass: (pass: Pass | null) => void;
}) {
    const has = (value: string) => document.marks.some((m) => m.kind === 'nav' && m.value === value && m.at.bar === bar);
    const pass = barPass(document, bar);

    return (
        <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
            <Label>{`BAR ${bar} · JUMPS`}</Label>
            <div className="flex gap-1.5">
                {NAV.map((item) => {
                    const on = has(item.value);

                    return (
                        <button
                            key={item.value}
                            type="button"
                            title={item.title}
                            aria-pressed={on}
                            onClick={() => onNav(item.value)}
                            className={cn(
                                'flex h-8 grow items-center justify-center rounded-full font-solfa text-[13px] leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                                on ? 'bg-ink text-paper' : 'border border-rule text-ink hover:bg-copy',
                            )}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
            <div className="text-[12px] leading-4 text-pencil">This bar plays</div>
            <div className="flex gap-1 rounded-full bg-copy p-1">
                {PASSES.map((item) => {
                    const on = item.value === pass;

                    return (
                        <button
                            key={item.label}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onPass(item.value)}
                            className={cn(
                                'flex h-7 grow items-center justify-center rounded-full text-[12.5px] leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                                on ? 'bg-ink font-semibold text-paper' : 'font-medium text-pencil hover:text-ink',
                            )}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
            <p className="text-[12px] leading-4.5 text-pencil">
                At D.S. the music goes back to the $ sign. The second time through, 1st-time bars are skipped, D.S.-time bars play, and Fine
                ends the piece.
            </p>
        </div>
    );
}

const UNDER: { value: WordsUnder; label: string }[] = [
    { value: 'SA', label: 'S + A' },
    { value: 'TB', label: 'T + B' },
    { value: 'each', label: 'Each part' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * One verse in the words panel: pick it to type into it; on hover a "⋯"
 * opens its menu — clear its words, or delete the verse (asks once more).
 */
function VerseRow({
    document,
    index,
    active,
    canEdit,
    onPick,
    onClear,
    onDelete,
}: {
    document: ScoreDocument;
    index: number;
    active: boolean;
    canEdit: boolean;
    onPick: () => void;
    onClear: () => void;
    onDelete: () => void;
}) {
    const verse = document.verses[index];
    const [menu, setMenu] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
    const [confirming, setConfirming] = useState(false);
    const row = useRef<HTMLDivElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const close = useCallback(() => {
        setMenu(null);
        setConfirming(false);
    }, []);

    useDismiss(box, menu !== null, close);

    const filled = new Set(verse.syllables.map((s) => s.bar)).size;
    const count = verse.syllables.length;

    const open = () => {
        const rect = row.current?.getBoundingClientRect();
        if (!rect) return;

        const left = Math.max(8, rect.right - 252);
        // Near the foot of the window the menu opens upwards instead.
        setMenu(rect.bottom + 200 > window.innerHeight ? { left, bottom: window.innerHeight - rect.top + 4 } : { left, top: rect.bottom + 4 });
    };

    return (
        <div ref={box}>
            <div ref={row} className={cn('group flex h-9 shrink-0 items-center rounded-sm pr-1', active || menu ? 'bg-copy' : 'hover:bg-copy/60')}>
                <button type="button" onClick={onPick} className="flex h-full grow basis-0 items-center justify-between gap-2 pl-2.5 text-left outline-none">
                    <span className={cn('truncate text-[14px] leading-4.5 text-ink', active && 'font-semibold')}>
                        {verse.label} · {langLabel(verse.lang)}
                    </span>
                    <span className={cn('pr-1.5 font-solfa text-[12px] leading-4 text-pencil', canEdit && (menu ? 'hidden' : 'group-focus-within:hidden group-hover:hidden'))}>
                        {filled}/{document.bars}
                    </span>
                </button>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => (menu ? close() : open())}
                        aria-haspopup="menu"
                        aria-expanded={menu !== null}
                        aria-label={`${verse.label} options`}
                        className={cn(
                            'size-7 shrink-0 items-center justify-center rounded-sm border border-rule bg-paper text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                            menu ? 'flex' : 'hidden group-focus-within:flex group-hover:flex',
                        )}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                            <circle cx="3" cy="7" r="1.3" />
                            <circle cx="7" cy="7" r="1.3" />
                            <circle cx="11" cy="7" r="1.3" />
                        </svg>
                    </button>
                )}
            </div>

            {menu && (
                <div
                    role="menu"
                    className="fixed z-50 flex w-63 flex-col gap-1 rounded-md border border-rule bg-paper p-1.5 shadow-[0_20px_50px_#00000024]"
                    style={{ left: menu.left, top: menu.top, bottom: menu.bottom }}
                >
                    <div className="flex flex-col gap-0.5 px-2.5 pt-2 pb-2.5">
                        <div className="text-[13px] leading-4.25 font-semibold text-ink">{verse.label}</div>
                        <div className="text-[11.5px] leading-3.75 text-pencil">
                            {count === 0 ? 'No words yet' : `${plural(count, 'syllable')} in ${filled} of ${document.bars} bars`}
                        </div>
                    </div>
                    <div className="h-px bg-rule" />
                    <button
                        type="button"
                        role="menuitem"
                        disabled={count === 0}
                        onClick={() => {
                            close();
                            onClear();
                        }}
                        className="flex h-11 items-center gap-2.5 rounded-[8px] px-2.5 text-left hover:bg-copy disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                                d="M6.2 13.5h7.3M2.9 9.6l5.6-5.6a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-5.1 5.1a1.4 1.4 0 0 1-1 .4H5a1.4 1.4 0 0 1-1-.4L2.9 12a1.7 1.7 0 0 1 0-2.4Z"
                                stroke="#6B6B6B"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span className="flex flex-col gap-px">
                            <span className="text-[13.5px] leading-4.5 font-medium text-ink">Clear its words</span>
                            <span className="text-[11.5px] leading-3.75 text-pencil">Keeps the verse, empty</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            if (count > 0 && !confirming) {
                                setConfirming(true);

                                return;
                            }

                            close();
                            onDelete();
                        }}
                        className={cn('flex h-11 items-center gap-2.5 rounded-[8px] px-2.5 text-left hover:bg-danger/6', confirming && 'bg-danger/8')}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                                d="M2.5 4.2h11M6.3 4.2V2.9c0-.4.3-.7.7-.7h2c.4 0 .7.3.7.7v1.3M4 4.2l.6 8.6c.1.7.6 1.2 1.3 1.2h4.2c.7 0 1.2-.5 1.3-1.2l.6-8.6M6.7 7v4.4M9.3 7v4.4"
                                stroke="#B42318"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span className="flex flex-col gap-px">
                            <span className="text-[13.5px] leading-4.5 font-semibold text-danger">{confirming ? 'Click again to delete' : `Delete ${verse.label.toLowerCase()}`}</span>
                            <span className="text-[11.5px] leading-3.75 text-pencil">
                                {confirming ? `Loses ${plural(count, 'syllable')} · ⌘ Z undoes` : 'Takes it out of the score'}
                            </span>
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

/** A small slur curve, for the slur panel. */
function SlurCurve({ width, height, stroke = 1.8 }: { width: number; height: number; stroke?: number }) {
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <path d={`M3 ${height - 2} Q${width / 2} ${-height + 4} ${width - 3} ${height - 2}`} fill="none" stroke="#111111" strokeWidth={stroke} strokeLinecap="round" />
        </svg>
    );
}

/**
 * A slur selected (Paper W9): which notes it covers, a −/+ for how many,
 * how the words fall on it, over or under, and Remove — plus the
 * difference between a hold and a slur.
 */
function SlurPanel({
    document,
    cursor,
    slur,
    canEdit,
    onSlur,
}: {
    document: ScoreDocument;
    cursor: Cursor;
    slur: SlurRun;
    canEdit: boolean;
    onSlur: (change: 'longer' | 'shorter' | 'remove' | SlurPlace) => void;
}) {
    const notes = slurNotes(document, cursor.part, slur);
    const labels = notes.map((n) => noteLabel(n)).join(' ');
    const bars = slur.from.bar === slur.to.bar ? `bar ${slur.from.bar}` : `bars ${slur.from.bar}–${slur.to.bar}`;
    const verse = document.verses.findIndex((v) => v.syllables.some((s) => s.part === cursor.part && s.bar === slur.from.bar && Math.abs(s.beat - slur.from.beat) < 1e-6));
    const syllable = verse >= 0 ? syllableAt(document, verse, cursor.part, slur.from.bar, slur.from.beat) : undefined;

    return (
        <>
            <div className="flex flex-col gap-3">
                <Label>SELECTED</Label>
                <div className="flex items-end gap-3.5">
                    <div className="flex size-18 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md bg-marker px-1.5">
                        <SlurCurve width={46} height={12} />
                        <span className="max-w-full truncate font-solfa text-[17px] leading-5 whitespace-pre text-ink">{notes.length <= 3 ? labels : `${noteLabel(notes[0])} … ${noteLabel(notes[notes.length - 1])}`}</span>
                    </div>
                    <div className="flex flex-col gap-0.75 pb-1">
                        <div className="text-[16px] leading-5 font-semibold text-ink">
                            Slur · {VOICE_NAMES[cursor.part]} · {bars}
                        </div>
                        <div className="text-[13px] leading-4 text-pencil">{notes.length} notes</div>
                        <div className="text-[13px] leading-4 text-pencil">Sung on one syllable, smoothly</div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-3.5 border-t border-rule pt-5">
                <Label>THE SLUR</Label>
                <div className="flex h-9 items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[13.5px] leading-4.25 text-ink">Notes under it</span>
                        <span className="text-[11.5px] leading-3.75 text-pencil">( longer · ) shorter</span>
                    </div>
                    <div className="flex items-center gap-0.5 rounded-full bg-copy p-0.75">
                        <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => onSlur('shorter')}
                            aria-label="One note fewer"
                            className="flex size-7.5 items-center justify-center rounded-full bg-paper text-[16px] leading-4.5 text-ink hover:bg-paper/70 disabled:opacity-40"
                        >
                            −
                        </button>
                        <span className="w-7.5 text-center font-solfa text-[14px] leading-4.5 text-ink">{notes.length}</span>
                        <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => onSlur('longer')}
                            aria-label="One note more"
                            className="flex size-7.5 items-center justify-center rounded-full bg-paper text-[16px] leading-4.5 text-ink hover:bg-paper/70 disabled:opacity-40"
                        >
                            +
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 rounded-md bg-copy px-3 py-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] leading-4 font-semibold text-pencil">Words</span>
                        {verse >= 0 && <span className="text-[12px] leading-4 text-pencil">{document.verses[verse].label}</span>}
                    </div>
                    <div className="flex items-baseline gap-2.5">
                        <span className="font-solfa text-[14px] leading-4.5 whitespace-pre text-ink">{labels}</span>
                        {syllable && <span className="text-[14px] leading-4.5 text-ink italic">{syllable.text}______</span>}
                    </div>
                    <div className="text-[12px] leading-4 text-pencil">
                        {syllable
                            ? `“${syllable.text}” is held over all ${notes.length} notes. Typed words skip the slurred notes.`
                            : 'The syllable on the first note is held over the rest. Typed words skip the slurred notes.'}
                    </div>
                </div>

                <div className="flex h-9 items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[13.5px] leading-4.25 whitespace-nowrap text-ink">Draw it</span>
                        <span className="text-[11.5px] leading-3.75 whitespace-nowrap text-pencil">Over or under</span>
                    </div>
                    <div className="flex shrink-0 gap-0.5 rounded-full bg-copy p-0.75">
                        {(['over', 'under'] as const).map((place) => (
                            <button
                                key={place}
                                type="button"
                                disabled={!canEdit}
                                aria-pressed={slur.place === place}
                                onClick={() => onSlur(place)}
                                className={cn(
                                    'flex h-7 items-center rounded-full px-3 text-[12.5px] leading-4',
                                    slur.place === place ? 'bg-paper font-semibold text-ink' : 'text-pencil hover:text-ink',
                                )}
                            >
                                {place === 'over' ? 'Above' : 'Below'}
                            </button>
                        ))}
                    </div>
                </div>

                {canEdit && (
                    <button
                        type="button"
                        onClick={() => onSlur('remove')}
                        className="flex h-10 items-center justify-between rounded-full border border-rule px-3.5 hover:bg-danger/6"
                    >
                        <span className="text-[14px] leading-4.5 font-semibold text-danger">Remove slur</span>
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
                <Label>TIE OR SLUR?</Label>
                <div className="flex gap-2.5">
                    <div className="flex grow basis-0 flex-col gap-1.5 rounded-sm border border-rule p-2.5">
                        <span className="font-solfa text-[14px] leading-4.5 whitespace-pre text-ink">d :–</span>
                        <span className="text-[12px] leading-4 font-semibold text-ink">Hold · “–”</span>
                        <span className="text-[11.5px] leading-3.75 text-pencil">Same note, kept sounding</span>
                    </div>
                    <div className="flex grow basis-0 flex-col gap-1.5 rounded-sm border-[1.5px] border-ink p-2.5">
                        <span className="relative font-solfa text-[14px] leading-4.5 whitespace-pre text-ink">
                            <span className="absolute -top-2 left-0">
                                <SlurCurve width={30} height={8} stroke={1.3} />
                            </span>
                            s :l
                        </span>
                        <span className="text-[12px] leading-4 font-semibold text-ink">Slur · “(”</span>
                        <span className="text-[11.5px] leading-3.75 text-pencil">Different notes, one breath</span>
                    </div>
                </div>
            </div>
        </>
    );
}

/**
 * Words mode (Paper W2): the syllable on each note of the bar being typed,
 * where the words print, and the verses.
 */
export function LyricsInspector({
    document,
    cursor,
    canEdit,
    onWordsUnder,
    onVerse,
    onAddTranslation,
    onWords,
    onClearVerse,
    onDeleteVerse,
}: {
    document: ScoreDocument;
    cursor: LyricCursor;
    canEdit: boolean;
    onWordsUnder: (value: WordsUnder) => void;
    onVerse: (index: number) => void;
    onAddTranslation: () => void;
    onWords: (tokens: LyricToken[]) => void;
    onClearVerse: (index: number) => void;
    onDeleteVerse: (index: number) => void;
}) {
    const verse = document.verses[cursor.verse];
    const beats = beatsInBar(document.map, cursor.bar);
    const notes = partOf(document, cursor.part)?.bars[cursor.bar - 1]?.notes.filter((n) => n.pitch !== 'rest') ?? [];
    const following = VOICE_NAMES[cursor.part].toLowerCase();

    const noteText = (start: number, length: number, label: string) => {
        const prefix = start % 1 !== 0 ? '.' : '';
        const holds = Math.max(0, Math.ceil(start + length - 1e-6) - Math.floor(start) - 1);

        return `${prefix}${label}${' :–'.repeat(Math.min(holds, beats))}`;
    };

    const hasEnglish = document.verses.some((v) => v.lang === 'en');

    return (
        <Panel>
            <div className="flex flex-col gap-3">
                <Label>TYPING</Label>
                <div className="flex flex-col gap-1">
                    <div className="text-[16px] leading-5 font-semibold text-ink">
                        {verse?.label ?? 'Verse 1'} · bar {cursor.bar}
                    </div>
                    <div className="text-[13px] leading-4 text-pencil">Following the {following}&apos;s notes</div>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-copy px-3 py-2.5">
                    {notes.length === 0 && <div className="text-[13px] leading-4 text-pencil">No notes in this bar yet.</div>}
                    {notes.map((n) => {
                        const s = syllableAt(document, cursor.verse, cursor.part, cursor.bar, n.start);
                        const active = Math.abs(n.start - cursor.beat) < 1e-6;
                        const words = s ? `${s.text}${s.join === 'split' ? '–' : s.join === 'hold' ? ' ___' : ''}` : '';

                        return (
                            <div
                                key={n.start}
                                className={cn('flex h-6.5 shrink-0 items-center justify-between', active && '-mx-1.5 rounded-[4px] bg-marker px-1.5')}
                            >
                                <span className="font-solfa text-[14px] leading-4.5 text-ink">{noteText(n.start, n.length, noteLabel(n))}</span>
                                <span className="text-[14px] leading-4.5 text-ink italic">{words}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="text-[12px] leading-4.5 text-pencil">
                    Type a syllable, then Space to move to the next note. Type “-” to split a word across notes.
                </div>
            </div>

            {canEdit && <TypeWords document={document} cursor={cursor} onWords={onWords} />}

            <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
                <Label>WORDS SHOW UNDER</Label>
                <div className="flex gap-1 rounded-full bg-copy p-1">
                    {UNDER.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => onWordsUnder(option.value)}
                            aria-pressed={document.words_under === option.value}
                            className={cn(
                                'flex h-7.5 grow basis-0 items-center justify-center rounded-full text-[13px] leading-4',
                                document.words_under === option.value ? 'bg-paper font-semibold text-ink' : 'text-pencil',
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <div className="text-[12px] leading-4.5 text-pencil">
                    Use “Each part” when the men sing different words, like a call and response.
                </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-rule pt-5">
                <div className="pb-1.5">
                    <Label>VERSES</Label>
                </div>
                {document.verses.map((v, index) => (
                    <VerseRow
                        key={v.id}
                        document={document}
                        index={index}
                        active={index === cursor.verse}
                        canEdit={canEdit}
                        onPick={() => onVerse(index)}
                        onClear={() => onClearVerse(index)}
                        onDelete={() => onDeleteVerse(index)}
                    />
                ))}
                {canEdit && !hasEnglish && (
                    <button type="button" onClick={onAddTranslation} className="flex h-9 shrink-0 items-center px-2.5 text-left">
                        <span className="text-[14px] leading-4.5 text-pencil hover:text-ink">+ English translation</span>
                    </button>
                )}
            </div>
        </Panel>
    );
}

type Segment = { from: number; to: number; bpm: number; beats: number; bar: number };

function segments(document: ScoreDocument): Segment[] {
    const changes = [...new Set([1, ...document.map.map((e) => e.bar), ...document.map.filter((e) => e.until !== null).map((e) => (e.until ?? 0) + 1)])]
        .filter((b) => b >= 1 && b <= document.bars)
        .sort((a, b) => a - b);

    return changes.map((bar, i) => {
        let bpm = 0;
        let beats = 0;

        for (const e of document.map) {
            if (e.bar > bar) break;
            if (e.until !== null && bar > e.until) continue;
            if (e.bpm !== null) bpm = e.bpm;
            if (e.beats !== null) beats = e.beats;
        }

        return { from: bar, to: (changes[i + 1] ?? document.bars + 1) - 1, bpm, beats, bar };
    });
}

function rampText(event: MapEvent): string {
    const how = event.ramp === 'rit' ? 'gradually · rit.' : event.ramp === 'accel' ? 'speed up · accel.' : 'at once';
    const until = event.until === null ? 'to end' : `until bar ${event.until}`;

    return `${how} · ${until}`;
}

/**
 * Tempo & time (Paper W3): a strip of the whole score's tempo and time,
 * the list of changes, a suggested rit. ending, and the shortcut.
 */
export function TempoInspector({
    document,
    editingBar,
    canEdit,
    onEdit,
    onAddRit,
}: {
    document: ScoreDocument;
    editingBar: number | null;
    canEdit: boolean;
    onEdit: (bar: number) => void;
    onAddRit: () => void;
}) {
    const segs = segments(document);
    const first = document.map[0];
    const hasRit = document.map.some((e) => e.ramp === 'rit' && e.bar >= document.bars - 1);

    return (
        <Panel>
            <div className="flex flex-col gap-3.5">
                <div className="flex items-baseline justify-between">
                    <Label>TEMPO &amp; TIME MAP</Label>
                    {canEdit && (
                        <button type="button" onClick={() => onEdit(Math.min(document.bars, (editingBar ?? 1) + 1))} className="text-[13px] leading-4 font-medium text-ink hover:underline">
                            + Add change
                        </button>
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                    <div className="flex h-10 shrink-0 overflow-clip rounded-[8px]">
                        {segs.map((seg, i) => {
                            const bars = seg.to - seg.from + 1;
                            const active = editingBar !== null && seg.from === editingBar;

                            return (
                                <div key={seg.from} className="flex" style={{ flexGrow: bars, flexBasis: 0 }}>
                                    {i > 0 && <div className="w-0.5 shrink-0 bg-ink" />}
                                    <button
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() => onEdit(seg.from)}
                                        className={cn(
                                            'flex min-w-0 grow items-center overflow-hidden font-solfa text-[11px] leading-3.5 whitespace-nowrap text-ink',
                                            bars >= 6 ? 'px-2.5' : 'px-1.5',
                                            active ? 'bg-marker' : 'bg-copy',
                                        )}
                                    >
                                        ♩{seg.bpm}
                                        {bars >= 6 ? ' · ' : ' '}
                                        {timeLabel(seg.beats)}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <div className="relative h-3.5 font-solfa text-[11px] leading-3.5 text-pencil">
                        <span className="absolute left-0">bar 1</span>
                        {segs.slice(1).map((seg) => (
                            <span key={seg.from} className="absolute -translate-x-1/2" style={{ left: `${((seg.from - 1) / document.bars) * 100}%` }}>
                                {seg.from}
                            </span>
                        ))}
                        <span className="absolute right-0">{document.bars}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-rule pt-5">
                <div className="pb-1.5">
                    <Label>CHANGES IN THIS SCORE</Label>
                </div>
                {document.map.map((event) => {
                    const active = event.bar === editingBar;
                    const isStart = event.bar === 1;

                    return (
                        <button
                            key={event.bar}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => onEdit(event.bar)}
                            className={cn(
                                'flex h-13 shrink-0 items-center gap-3 rounded-sm px-2.5 text-left',
                                active ? 'bg-copy outline-[1.5px] outline-ink outline-solid' : 'hover:bg-copy/60',
                            )}
                        >
                            <span className={cn('w-8.5 shrink-0 font-solfa text-[12px] leading-4', active ? 'text-ink' : 'text-pencil')}>
                                {event.bar}
                            </span>
                            <span className="flex grow basis-0 flex-col gap-0.5">
                                <span className="text-[14px] leading-4.5 font-semibold text-ink">
                                    {isStart ? 'Start · ' : ''}
                                    {[event.bpm !== null ? `♩ = ${event.bpm}` : null, event.beats !== null ? timeLabel(event.beats) : null]
                                        .filter(Boolean)
                                        .join(', ')}
                                </span>
                                <span className="text-[12px] leading-4 text-pencil">
                                    {isStart
                                        ? `${tempoName(first.bpm ?? 96).split(' · ')[0]}${document.style ? `, ${document.style} groove` : ''}`
                                        : `${active ? 'Editing · ' : ''}${rampText(event)}`}
                                </span>
                            </span>
                        </button>
                    );
                })}
                {canEdit && !hasRit && document.bars > 2 && (
                    <button
                        type="button"
                        onClick={onAddRit}
                        className="flex h-13 shrink-0 items-center gap-3 rounded-sm border-[1.5px] border-dashed border-[#DCDCD6] px-2.5 text-left hover:bg-copy/60"
                    >
                        <span className="w-8.5 shrink-0 font-solfa text-[12px] leading-4 text-pencil">{document.bars - 1}</span>
                        <span className="flex grow basis-0 flex-col gap-0.5">
                            <span className="text-[14px] leading-4.5 text-pencil">rit. into the last bar?</span>
                            <span className="text-[12px] leading-4 text-pencil">Common ending · tap to add</span>
                        </span>
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-2 border-t border-rule pt-5">
                <Label>QUICK WAY</Label>
                <div className="text-[13px] leading-4.75 text-ink">
                    Right-click any bar number, or select a bar and press ⌘ T. Playback and every part follow the map.
                </div>
            </div>
        </Panel>
    );
}

