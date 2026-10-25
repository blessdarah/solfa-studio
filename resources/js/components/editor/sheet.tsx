import { useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { noteStarts, syllableAt, wordsPart } from '@/lib/editor';
import {
    beatsInBar,
    emptyBar,
    formatBar,
    formatWords,
    keyLabel,
    partHasNotes,
    splitBarAt,
    systemsOf,
    tempoAt,
    timeLabel,
} from '@/lib/music';
import { cn } from '@/lib/utils';
import { PlayHead } from '@/components/editor/play-head';
import type { Playback } from '@/lib/player';
import type { EditorMode, Mark, Part, ScoreDocument, Syllable, Voice } from '@/types';

/** Column geometry from the Paper sheet: a 24px label lane and 165px bars. */
const LANE = 24;
const BAR = 165;
const PAD = 10;
const INNER = BAR - PAD;

export type LyricCursor = { verse: number; part: Voice; bar: number; beat: number };

type Row =
    | { kind: 'part'; part: Part }
    | { kind: 'words'; verse: number; part: Voice };

function beatX(barIndex: number, beat: number, beats: number): number {
    return LANE + barIndex * BAR + PAD + (beat / beats) * INNER;
}

function NavLabel({ value }: { value: string }) {
    const text = value === 'DS' ? 'D.S.' : value === 'DC' ? 'D.C.' : value;

    return <span className="text-[12px] leading-4 font-bold text-ink">{text}</span>;
}

/**
 * The marks lane above the parts: dynamics (Georgia italic), words like
 * "gently", hairpin wedges drawn to length, and Fine / D.S. at bar ends.
 */
function MarksRow({ document, bars }: { document: ScoreDocument; bars: number[] }) {
    const first = bars[0];
    const last = bars[bars.length - 1];
    const items: ReactNode[] = [];

    const inSystem = (bar: number) => bar >= first && bar <= last;
    const x = (bar: number, beat: number) => beatX(bar - first, beat, beatsInBar(document.map, bar));

    const dynamics = document.marks.filter((m) => m.kind === 'dyn' && inSystem(m.at.bar));
    const texts = document.marks.filter((m) => m.kind === 'text' && inSystem(m.at.bar));

    // Dynamics, each with any words written at the same spot.
    for (const mark of dynamics) {
        const words = texts.filter((t) => t.at.bar === mark.at.bar && Math.abs(t.at.beat - mark.at.beat) < 1e-6);

        items.push(
            <div
                key={`d-${mark.at.bar}-${mark.at.beat}`}
                className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5"
                style={{ left: x(mark.at.bar, mark.at.beat) }}
            >
                <span className="font-dynamic text-[15px] leading-4.5 font-bold text-ink italic">{mark.value}</span>
                {words.map((w) => (
                    <span key={w.value} className="text-[11px] leading-3.5 text-pencil italic">
                        {w.value}
                    </span>
                ))}
            </div>,
        );
    }

    // Words on their own.
    for (const mark of texts) {
        if (dynamics.some((d) => d.at.bar === mark.at.bar && Math.abs(d.at.beat - mark.at.beat) < 1e-6)) continue;

        items.push(
            <span
                key={`t-${mark.at.bar}-${mark.at.beat}-${mark.value}`}
                className="absolute top-1/2 -translate-y-1/2 text-[11px] leading-3.5 whitespace-nowrap text-pencil italic"
                style={{ left: x(mark.at.bar, mark.at.beat) }}
            >
                {mark.value}
            </span>,
        );
    }

    // Hairpins, clipped to this line and stopping short of a dynamic.
    for (const mark of document.marks.filter((m) => m.kind === 'hairpin' && m.to)) {
        const to = mark.to!;

        if (to.bar < first || mark.at.bar > last) continue;

        const startX = mark.at.bar >= first ? x(mark.at.bar, mark.at.beat) : LANE + PAD;
        let endX = to.bar <= last ? x(to.bar, to.beat) - (to.beat >= beatsInBar(document.map, to.bar) ? PAD : 0) : LANE + bars.length * BAR - PAD;

        const blocking = dynamics
            .map((d) => x(d.at.bar, d.at.beat))
            .filter((dx) => dx > startX + 8 && dx <= endX + 12);

        if (blocking.length > 0) {
            endX = Math.min(...blocking) - 8;
        }

        const width = Math.max(16, endX - startX);
        const path = mark.value === 'cresc' ? `M2 7 L${width - 2} 1.5 M2 7 L${width - 2} 12.5` : `M2 1.5 L${width - 2} 7 M2 12.5 L${width - 2} 7`;

        items.push(
            <svg
                key={`h-${mark.at.bar}-${mark.at.beat}`}
                width={width}
                height={14}
                viewBox={`0 0 ${width} 14`}
                aria-label={mark.value === 'cresc' ? 'crescendo' : 'diminuendo'}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: startX }}
            >
                <path d={path} fill="none" stroke="#111111" strokeWidth={1.3} strokeLinecap="round" />
            </svg>,
        );
    }

    // Fine, D.S., D.C. sit at the right of their bar.
    for (const mark of document.marks.filter((m) => m.kind === 'nav' && m.value !== '$' && inSystem(m.at.bar))) {
        items.push(
            <div
                key={`n-${mark.at.bar}-${mark.value}`}
                className="absolute top-1/2 flex -translate-y-1/2 justify-end pr-2"
                style={{ left: LANE + (mark.at.bar - first) * BAR, width: BAR }}
            >
                <NavLabel value={mark.value} />
            </div>,
        );
    }

    return <div className="relative h-6 shrink-0">{items}</div>;
}

function hasMarks(document: ScoreDocument, bars: number[]): boolean {
    const first = bars[0];
    const last = bars[bars.length - 1];

    return document.marks.some(
        (m: Mark) =>
            (m.kind !== 'nav' || m.value !== '$') &&
            ((m.at.bar >= first && m.at.bar <= last) || (m.to !== null && m.at.bar < first && m.to.bar >= first)),
    );
}

/**
 * The printed score (Paper W1/W2/W3 "Sheet"), built from the document.
 */
export function Sheet({
    document,
    title,
    composer,
    arranger,
    doh,
    mode,
    cursor,
    lyricCursor,
    canEdit,
    onCell,
    onWords,
    onBarNumber,
    popoverBar,
    popover,
    sheetRef,
    playback = null,
    onPlayingBar,
}: {
    document: ScoreDocument;
    title: string;
    composer: string | null;
    arranger: string | null;
    doh: string;
    mode: EditorMode;
    cursor: { part: Voice; bar: number; beat: number };
    lyricCursor: LyricCursor;
    canEdit: boolean;
    onCell: (part: Voice, bar: number, beat: number) => void;
    onWords: (verse: number, part: Voice, bar: number, beat: number) => void;
    onBarNumber: (bar: number) => void;
    popoverBar: number | null;
    popover: ReactNode;
    sheetRef?: (element: HTMLDivElement | null) => void;
    playback?: Playback | null;
    onPlayingBar?: (bar: number | null) => void;
}) {
    const root = useRef<HTMLDivElement | null>(null);
    const numbers = useRef(new Map<number, HTMLElement>());
    const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);

    useLayoutEffect(() => {
        if (popoverBar === null) {
            setAnchor(null);

            return;
        }

        const el = numbers.current.get(popoverBar);
        const box = root.current;

        if (!el || !box) return;

        const a = el.getBoundingClientRect();
        const b = box.getBoundingClientRect();

        setAnchor({ left: a.left - b.left - 67 + 6, top: a.bottom - b.top + 10 });
    }, [popoverBar, document]);

    const first = document.map[0];
    const voices = document.parts.map((p) => p.id).join('');
    const style = document.style ? `${document.style.charAt(0).toUpperCase()}${document.style.slice(1)} · ` : '';
    const wordsVoice = wordsPart(document, cursor.part);
    const verseOneUsed = (document.verses[0]?.syllables.length ?? 0) > 0;

    const rowsFor = (bars: number[]): Row[] => {
        const rows: Row[] = [];
        const wordRows = (part: Voice) => {
            const out: Row[] = [];

            if (mode === 'lyrics' || verseOneUsed) {
                out.push({ kind: 'words', verse: 0, part });
            }

            if (mode === 'lyrics') {
                document.verses.forEach((verse, index) => {
                    if (index === 0) return;

                    const here = verse.syllables.some((s) => s.part === part && bars.includes(s.bar));
                    const cursorHere = lyricCursor.verse === index && bars.includes(lyricCursor.bar);

                    if (here || cursorHere) out.push({ kind: 'words', verse: index, part });
                });
            }

            return out;
        };

        const ids = document.parts.map((p) => p.id);
        const after: Voice | null =
            document.words_under === 'each'
                ? null
                : document.words_under === 'TB'
                  ? (ids.includes('B') ? 'B' : ids[ids.length - 1])
                  : (ids.includes('A') ? 'A' : ids[0]);

        for (const part of document.parts) {
            rows.push({ kind: 'part', part });

            if (document.words_under === 'each') {
                rows.push(...wordRows(part.id));
            } else if (part.id === after) {
                rows.push(...wordRows(wordsVoice));
            }
        }

        return rows;
    };

    const clickBeat = (event: MouseEvent<HTMLElement>, beats: number) => {
        const box = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - box.left - PAD;

        return Math.max(0, Math.min(beats - 1, Math.floor((x / INNER) * beats)));
    };

    return (
        <div
            ref={(el) => {
                root.current = el;
                sheetRef?.(el);
            }}
            className="relative flex w-195 shrink-0 flex-col gap-6.5 rounded-[4px] bg-paper px-12 pt-9 pb-35 shadow-[0_1px_3px_#0000000F,0_12px_40px_#0000000D]"
        >
            <div className="flex items-end justify-between">
                <div className="flex w-35 shrink-0 flex-col gap-0.5">
                    <div className="font-solfa text-[13px] leading-4 text-ink">Doh is {keyLabel(doh)}</div>
                    <div className="font-solfa text-[13px] leading-4 text-ink">
                        {timeLabel(first.beats ?? 4)} ♩ = {first.bpm}
                    </div>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1">
                    <div className="text-center font-display text-[30px] leading-9 font-extrabold tracking-[0.01em] text-ink uppercase">
                        {title}
                    </div>
                    <div className="text-[13px] leading-4 text-pencil italic">
                        {style}
                        {voices}
                    </div>
                </div>
                <div className="flex w-35 shrink-0 flex-col items-end gap-0.5 text-right">
                    <div className="text-[13px] leading-4 font-semibold text-ink">{composer ?? ''}</div>
                    <div className="text-[12px] leading-4 text-pencil">{arranger ? `arr. ${arranger}` : 'Words & music'}</div>
                </div>
            </div>

            {systemsOf(document.bars).map((bars) => (
                <div key={bars[0]} data-system={bars[0]} className="flex flex-col border-y-[1.5px] border-ink">
                    {/* Bar numbers, the $ sign and tempo / time changes */}
                    <div className="flex h-5.5 shrink-0 items-end">
                        <div className="w-6 shrink-0" />
                        {bars.map((bar) => {
                            const segno = document.marks.some((m) => m.kind === 'nav' && m.value === '$' && m.at.bar === bar);
                            const section = document.sections.find((s) => s.from === bar && s.ending === null);
                            const change = bar > 1 ? document.map.find((e) => e.bar === bar) : undefined;
                            const label = segno ? `${bar}  $ ${section?.name ?? ''}`.trimEnd() : `${bar}`;
                            const before = change ? tempoAt(document.map, bar - 1) : null;
                            const word =
                                change?.bpm && before ? (change.bpm < before ? 'Slower' : change.bpm > before ? 'Faster' : '') : '';

                            return (
                                <div key={bar} className="flex w-41.25 shrink-0 items-center gap-1.5 pl-2.5">
                                    <button
                                        type="button"
                                        ref={(el) => {
                                            if (el) numbers.current.set(bar, el);
                                            else numbers.current.delete(bar);
                                        }}
                                        disabled={!canEdit}
                                        onClick={() => onBarNumber(bar)}
                                        onContextMenu={(event) => {
                                            if (!canEdit) return;
                                            event.preventDefault();
                                            onBarNumber(bar);
                                        }}
                                        title={canEdit ? 'Change tempo or time from here' : undefined}
                                        className={cn(
                                            'font-solfa text-[11px] leading-3.5 whitespace-pre',
                                            segno || change ? 'text-ink' : 'text-pencil',
                                            canEdit && 'hover:text-ink hover:underline',
                                        )}
                                    >
                                        {label}
                                    </button>
                                    {change && (
                                        <button
                                            type="button"
                                            disabled={!canEdit}
                                            onClick={() => onBarNumber(bar)}
                                            className="flex h-5 items-center gap-1.5 rounded-[4px] bg-marker px-2 outline-[1.5px] outline-ink outline-solid"
                                        >
                                            {change.bpm !== null && (
                                                <span className="font-solfa text-[11px] leading-3.5 text-ink">♩ = {change.bpm}</span>
                                            )}
                                            {change.bpm !== null && change.beats !== null && <span className="h-2.5 w-px shrink-0 bg-ink" />}
                                            {change.beats !== null && (
                                                <span className="font-solfa text-[11px] leading-3.5 text-ink">{timeLabel(change.beats)}</span>
                                            )}
                                            {word && <span className="text-[11px] leading-3.5 text-ink italic">{word}</span>}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {hasMarks(document, bars) && <MarksRow document={document} bars={bars} />}

                    {rowsFor(bars).map((row) =>
                        row.kind === 'part' ? (
                            <div key={`p-${row.part.id}`} className="flex h-7 shrink-0 items-center">
                                <div
                                    className={cn(
                                        'w-6 shrink-0 font-display text-[12px] leading-4 font-extrabold',
                                        partHasNotes(row.part) ? 'text-ink' : 'text-ghost',
                                    )}
                                >
                                    {row.part.id}
                                </div>
                                {bars.map((barNo) => {
                                    const beats = beatsInBar(document.map, barNo);
                                    const notes = row.part.bars[barNo - 1]?.notes ?? [];
                                    const active = mode === 'notes' && cursor.part === row.part.id && cursor.bar === barNo;

                                    if (active) {
                                        const { before, at, after } = splitBarAt(notes, beats, cursor.beat);

                                        return (
                                            <div
                                                key={barNo}
                                                onClick={(e) => onCell(row.part.id, barNo, clickBeat(e, beats))}
                                                className="flex h-7 w-41.25 shrink-0 cursor-text items-center gap-1.5 border-l border-ink bg-wash pl-2.5"
                                            >
                                                {before !== '' && (
                                                    <span className="w-max font-solfa text-[14px] leading-4.5 whitespace-pre text-ink">{before}</span>
                                                )}
                                                <span className="flex h-5.5 items-center gap-px rounded-[4px] bg-marker px-1.5 outline-2 outline-ink outline-solid">
                                                    {at !== '' && <span className="font-solfa text-[14px] leading-4.5 text-ink">{at}</span>}
                                                    <span className="h-3.75 w-0.5 shrink-0 animate-pulse bg-ink" />
                                                </span>
                                                {after.trim() !== '' && (
                                                    <span className="w-max font-solfa text-[14px] leading-4.5 whitespace-pre text-ink">{after}</span>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={barNo}
                                            onClick={(e) => mode === 'notes' && onCell(row.part.id, barNo, clickBeat(e, beats))}
                                            className={cn(
                                                'flex h-7 w-41.25 shrink-0 items-center border-l border-ink pl-2.5',
                                                mode === 'notes' && 'cursor-text',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'w-max font-solfa text-[14px] leading-4.5 whitespace-pre',
                                                    notes.length > 0 ? 'text-ink' : 'text-dot',
                                                )}
                                            >
                                                {notes.length > 0 ? formatBar(notes, beats) : emptyBar(beats)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <WordsRow
                                key={`w-${row.verse}-${row.part}`}
                                document={document}
                                verse={row.verse}
                                part={row.part}
                                bars={bars}
                                mode={mode}
                                cursor={lyricCursor}
                                onWords={onWords}
                            />
                        ),
                    )}
                </div>
            ))}

            {mode === 'lyrics' && document.footnotes.length > 0 && (
                <div className="relative flex flex-col gap-1.5 rounded-[4px] px-3.5 py-3 outline-[1.5px] outline-ink outline-dashed">
                    {document.footnotes.map((note, i) => (
                        <div key={i} className="text-[13px] leading-4.75 text-ink">
                            {note}
                        </div>
                    ))}
                    <div className="absolute -top-2.5 -right-2 flex h-5 items-center rounded-[4px] bg-ink px-2">
                        <span className="text-[11px] leading-3.5 font-semibold text-paper">Footnote</span>
                    </div>
                </div>
            )}

            <PlayHead playback={playback} root={root} onBar={(bar) => onPlayingBar?.(bar)} />

            {anchor && popover && (
                <>
                    {/* Room below the last line so the popover never hangs off the page. */}
                    <div aria-hidden="true" style={{ height: Math.max(0, anchor.top + 600 - (root.current?.scrollHeight ?? 0)) }} />
                    <div
                        ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
                        className="absolute z-30"
                        style={{ left: anchor.left, top: anchor.top }}
                    >
                        {popover}
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * One line of words under the parts. In lyrics mode the bar being typed
 * shows each syllable as a chip on its note, with the cursor chip in
 * yellow and a hold line for a held vowel.
 */
function WordsRow({
    document,
    verse,
    part,
    bars,
    mode,
    cursor,
    onWords,
}: {
    document: ScoreDocument;
    verse: number;
    part: Voice;
    bars: number[];
    mode: EditorMode;
    cursor: LyricCursor;
    onWords: (verse: number, part: Voice, bar: number, beat: number) => void;
}) {
    const syllables: Syllable[] = document.verses[verse]?.syllables.filter((s) => s.part === part) ?? [];
    const extra = verse > 0;

    return (
        <div className="flex h-6.5 shrink-0 items-center">
            <div className="w-6 shrink-0 text-[10px] leading-3 font-bold text-pencil">{extra ? `v${verse + 1}` : ''}</div>
            {bars.map((barNo) => {
                const inBar = syllables.filter((s) => s.bar === barNo).sort((a, b) => a.beat - b.beat);
                const active = mode === 'lyrics' && cursor.verse === verse && cursor.part === part && cursor.bar === barNo;
                const pick = (event: MouseEvent<HTMLElement>) => {
                    if (mode !== 'lyrics') return;

                    const starts = noteStarts(document, part, barNo);
                    const beats = beatsInBar(document.map, barNo);
                    const box = event.currentTarget.getBoundingClientRect();
                    const at = ((event.clientX - box.left - PAD) / INNER) * beats;
                    const beat = [...starts].reverse().find((s) => s <= at + 0.25) ?? starts[0] ?? 0;

                    onWords(verse, part, barNo, beat);
                };

                if (active) {
                    const starts = noteStarts(document, part, barNo);
                    const slots = Array.from(new Set([...starts, cursor.beat])).sort((a, b) => a - b);
                    const lastSyllable = inBar[inBar.length - 1];

                    return (
                        <div
                            key={barNo}
                            onClick={pick}
                            className="flex h-6.5 w-41.25 shrink-0 cursor-text items-center gap-0.75 overflow-hidden border-l border-ink bg-wash pl-1.5"
                        >
                            {slots.map((beat) => {
                                const s = syllableAt(document, verse, part, barNo, beat);
                                const here = Math.abs(beat - cursor.beat) < 1e-6;

                                if (!s && !here) return null;

                                const text = s ? `${s.text}${s.join === 'split' ? '–' : ''}` : '';

                                return here ? (
                                    <span
                                        key={beat}
                                        className="flex h-5 items-center gap-px rounded-[3px] bg-marker px-1 outline-2 outline-ink outline-solid"
                                    >
                                        <span className="inline-block text-[13px] leading-4 text-ink italic">{text}</span>
                                        <span className="h-3.5 w-[1.5px] shrink-0 animate-pulse bg-ink" />
                                    </span>
                                ) : (
                                    <span key={beat} className="flex h-5 items-center rounded-[3px] border border-rule bg-paper px-1">
                                        <span className="text-[13px] leading-4 text-ink italic">{text}</span>
                                    </span>
                                );
                            })}
                            {lastSyllable?.join === 'hold' && <span className="mt-2 h-px grow basis-0 bg-ink" />}
                        </div>
                    );
                }

                return (
                    <div
                        key={barNo}
                        onClick={pick}
                        className={cn('flex h-6.5 w-41.25 shrink-0 items-center border-l border-ink pl-2.5', mode === 'lyrics' && 'cursor-text')}
                    >
                        {inBar.length > 0 ? (
                            <span className={cn('w-max text-[13px] leading-4 whitespace-pre italic', extra ? 'text-pencil' : 'text-ink')}>
                                {formatWords(inBar)}
                            </span>
                        ) : extra && mode === 'lyrics' ? (
                            <span className="text-[12px] leading-4 text-ghost">+ verse {verse + 1}</span>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

