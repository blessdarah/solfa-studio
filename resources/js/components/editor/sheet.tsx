import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { noteStarts, syllableAt, wordsPart } from '@/lib/editor';
import {
    VOICE_NAMES,
    barPass,
    beatsInBar,
    barSegments,
    emptyBar,
    formatBar,
    placeSyllables,
    partOf,
    keyLabel,
    partHasNotes,
    layoutLines,
    tempoAt,
    timeLabel,
} from '@/lib/music';
import type { BarSegment, PlayStep } from '@/lib/music';
import { useDismiss } from '@/lib/use-dismiss';
import { cn } from '@/lib/utils';
import { PlayHead } from '@/components/editor/play-head';
import type { Playback } from '@/lib/player';
import { slurAt, slurRuns } from '@/lib/slurs';
import type { SlurRun } from '@/lib/slurs';
import type { EditorMode, Mark, Note, Part, ScoreDocument, Syllable, Voice } from '@/types';

/** Column geometry from the Paper sheet: a 24px label lane, then bars at least 165px wide. */
const LANE = 24;
const PAD = 10;

export type LyricCursor = { verse: number; part: Voice; bar: number; beat: number };

type Row =
    | { kind: 'part'; part: Part }
    | { kind: 'rests'; part: Part }
    | { kind: 'words'; verse: number; part: Voice };

/**
 * The bar line that closes a line of music: a single line at the end of
 * every line, a double bar at the very end of the piece.
 */
export function closing(index: number, bars: number[], total: number): string {
    if (index !== bars.length - 1) return '';

    return bars[index] === total ? 'border-r-4 border-double' : 'border-r';
}

/** "5–8", "5, 7", "5–6, 8" */
function barList(bars: number[]): string {
    const sorted = [...bars].sort((a, b) => a - b);
    const runs: string[] = [];

    for (let i = 0; i < sorted.length; i++) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        runs.push(j > i ? `${sorted[i]}–${sorted[j]}` : `${sorted[i]}`);
        i = j;
    }

    return runs.join(', ');
}

/**
 * "Take the tenor out of…" (Paper W6): pick which bars of this line the
 * part rests in — all of them to start with; tap a bar to keep it.
 */
function RestPopover({
    part,
    bars,
    left,
    top,
    onCancel,
    onRest,
}: {
    part: Voice;
    bars: number[];
    left: number;
    top: number;
    onCancel: () => void;
    onRest: (bars: number[]) => void;
}) {
    const [picked, setPicked] = useState<number[]>(bars);
    const box = useRef<HTMLDivElement>(null);
    const name = VOICE_NAMES[part].toLowerCase();

    useDismiss(box, true, onCancel);

    return (
        <div
            ref={box}
            role="dialog"
            aria-label={`Take the ${name} out of bars`}
            className="absolute z-40 flex w-75 flex-col gap-3.5 rounded-md border border-rule bg-paper p-4 shadow-[0_20px_50px_#00000024]"
            style={{ left, top }}
        >
            <div className="flex flex-col gap-0.75">
                <div className="text-[14px] leading-4.5 font-semibold text-ink">Take the {name} out of…</div>
                <div className="text-[12px] leading-4 text-pencil">
                    In the bars you pick, the {name} rests: its notes are cleared and its line is left off. Tap a bar to keep it.
                </div>
            </div>
            <div className="flex gap-1.5">
                {bars.map((bar) => {
                    const on = picked.includes(bar);

                    return (
                        <button
                            key={bar}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setPicked(on ? picked.filter((b) => b !== bar) : [...picked, bar].sort((a, b) => a - b))}
                            className={cn(
                                'flex h-8.5 grow basis-0 items-center justify-center rounded-sm font-solfa text-[13px] leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                                on ? 'bg-ink text-paper' : 'border border-rule text-ink hover:bg-copy',
                            )}
                        >
                            {bar}
                        </button>
                    );
                })}
            </div>
            <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={onCancel} className="flex h-9 items-center rounded-full px-3 text-[13.5px] leading-4.5 font-semibold text-pencil hover:text-ink">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={picked.length === 0}
                    onClick={() => onRest(picked)}
                    className="flex h-9 items-center rounded-full bg-ink px-3.5 text-[13.5px] leading-4.5 font-semibold whitespace-nowrap text-paper disabled:bg-copy disabled:text-faint"
                >
                    {picked.length === 0 ? 'Pick a bar' : `Remove from ${barList(picked)}`}
                </button>
            </div>
        </div>
    );
}

/** Where each bar of a line starts, after the label lane. */
function offsetsOf(widths: number[]): number[] {
    return widths.map((_, i) => LANE + widths.slice(0, i).reduce((a, b) => a + b, 0));
}

export function NavLabel({ value }: { value: string }) {
    const text = value === 'DS' ? 'D.S.' : value === 'DC' ? 'D.C.' : value;

    return <span className="text-[12px] leading-4 font-bold text-ink">{text}</span>;
}

/**
 * The marks lane above the parts: dynamics (Georgia italic), words like
 * "gently", hairpin wedges drawn to length, and Fine / D.S. at bar ends.
 */
export function MarksRow({ document, bars, widths, compact = false }: { document: ScoreDocument; bars: number[]; widths: number[]; compact?: boolean }) {
    const first = bars[0];
    const last = bars[bars.length - 1];
    const items: ReactNode[] = [];
    const offsets = offsetsOf(widths);

    const inSystem = (bar: number) => bar >= first && bar <= last;
    const x = (bar: number, beat: number) =>
        offsets[bar - first] + PAD + (beat / beatsInBar(document.map, bar)) * (widths[bar - first] - PAD);

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
        let endX = to.bar <= last ? x(to.bar, to.beat) - (to.beat >= beatsInBar(document.map, to.bar) ? PAD : 0) : LANE + widths.reduce((a, b) => a + b, 0) - PAD;

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
                style={{ left: offsets[mark.at.bar - first], width: widths[mark.at.bar - first] }}
            >
                <NavLabel value={mark.value} />
            </div>,
        );
    }

    return <div className={cn('relative shrink-0', compact ? 'h-4.5' : 'h-6')}>{items}</div>;
}

export function hasMarks(document: ScoreDocument, bars: number[]): boolean {
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
/**
 * Sol-fa type size for a bar: 14px, unless even a bar the whole width of
 * the line can't hold the busiest part (bars normally widen instead). The
 * same size for every part in the bar keeps their beats lined up.
 */
export function solfaSize(document: ScoreDocument, barNo: number, width: number, chip = 22): number {
    const beats = beatsInBar(document.map, barNo);
    const longest = Math.max(
        0,
        ...document.parts.map((p) => [...formatBar(p.bars[barNo - 1]?.notes ?? [], beats)].length),
    );
    const room = width - PAD - chip; // the bar, its left padding, the cursor chip
    const charWidth = 0.6; // JetBrains Mono advance per px of font size

    return Math.max(9, Math.min(14, Math.floor((room / Math.max(1, longest) / charWidth) * 2) / 2));
}

/**
 * A bar's words, each syllable under the note it is sung on (lined up with
 * the sol-fa above, `fontSize` being that bar's sol-fa size), with a hold
 * line after a held syllable. Used on screen and on paper.
 */
export function SyllableLine({
    notes,
    beats,
    syllables,
    fontSize,
    width,
    className,
}: {
    notes: Note[];
    beats: number;
    syllables: Syllable[];
    fontSize: number;
    width: number;
    className?: string;
}) {
    const placed = placeSyllables(notes, beats, syllables, fontSize * 0.6);

    return (
        <>
            {placed.map((s, i) => {
                const next = placed[i + 1];
                const holdTo = s.join === 'hold' ? (next ? next.x - 4 : width - PAD - 6) : null;

                return (
                    <span key={`${s.beat}-${i}`} className="absolute top-1/2 -translate-y-1/2" style={{ left: PAD + s.x }}>
                        <span className={cn('text-[13px] leading-4 whitespace-pre italic', className)}>{s.text}</span>
                        {holdTo !== null && holdTo > s.x + s.width + 2 && (
                            <span className="absolute bottom-0.5 h-px bg-ink" style={{ left: s.width + 2, width: holdTo - s.x - s.width - 2 }} />
                        )}
                    </span>
                );
            })}
        </>
    );
}

export type BarToolActions = {
    onInsert: (at: number) => void;
    onDuplicate: (bar: number) => void;
    onDelete: (bar: number) => void;
};

function ToolButton({ label, onPress, children, danger = false }: { label: string; onPress: () => void; children: ReactNode; danger?: boolean }) {
    return (
        <span className="group/tool relative flex">
            <button
                type="button"
                aria-label={label}
                onClick={onPress}
                className={cn('flex size-7 items-center justify-center rounded-full outline-none hover:bg-white/12 focus-visible:bg-white/12', danger && 'bg-white/12')}
            >
                {children}
            </button>
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 hidden -translate-x-1/2 rounded-[6px] border border-rule bg-paper px-2.25 py-1.25 text-[12px] leading-4 font-medium whitespace-nowrap text-ink shadow-[0_6px_16px_#0000001A] group-hover/tool:block">
                {label}
            </span>
        </span>
    );
}

/** A "+" sitting on a bar line: add a bar there. */
function InsertHandle({ x, label, onPress }: { x: number; label: string; onPress: () => void }) {
    return (
        <span className="group/insert pointer-events-none absolute -top-2.75 z-20 flex h-[calc(100%+11px)] w-5.5 flex-col items-center" style={{ left: x - 11 }}>
            <button
                type="button"
                aria-label={label}
                onClick={onPress}
                className="peer pointer-events-auto flex size-5.5 shrink-0 items-center justify-center rounded-full bg-ink shadow-[0_0_0_3px_#FFFFFF] outline-none"
            >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M6 2.5v7M2.5 6h7" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            </button>
            <span className="hidden w-0.75 grow rounded-full bg-marker peer-hover:block peer-focus-visible:block" />
            <span className="absolute top-[-2px] left-7 hidden rounded-[6px] border border-rule bg-paper px-2.25 py-1.25 text-[12px] leading-4 font-medium whitespace-nowrap text-ink shadow-[0_6px_16px_#0000001A] peer-hover:block">
                {label}
            </span>
        </span>
    );
}

/**
 * The hovered bar (Paper W7): an outline round its column, a toolbar
 * above it — add before, add after, copy, delete — and "+" handles on its
 * bar lines, like blocks in a website builder.
 */
function BarTools({
    bar,
    left,
    width,
    canDelete,
    isLast,
    onInsert,
    onDuplicate,
    onDelete,
}: { bar: number; left: number; width: number; canDelete: boolean; isLast: boolean } & BarToolActions) {
    const icon = 'stroke-paper';

    return (
        <>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-[1.5px] z-10 h-[calc(100%+3px)] rounded-[3px] border-[1.5px] border-ink bg-marker/8"
                style={{ left, width: width + 1 }}
            />
            {/* The toolbar sits on an invisible strip down to the bar, so the pointer can travel up to it. */}
            <div className="absolute -top-11 z-30 flex h-11 items-start" style={{ left }}>
            <div className="flex h-8 items-center gap-0.5 rounded-full bg-ink pr-0.75 pl-2.5 shadow-[0_8px_24px_#00000033]">
                <span className="pr-1.5 font-solfa text-[11.5px] leading-3.5 text-paper/70">Bar {bar}</span>
                <span className="h-4 w-px bg-paper/20" />
                <ToolButton label={`Add a bar before ${bar}`} onPress={() => onInsert(bar)}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path className={icon} d="M10.5 2.5v11M3.5 8h4M5.5 6v4" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </ToolButton>
                <ToolButton label={`Add a bar after ${bar}`} onPress={() => onInsert(bar + 1)}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path className={icon} d="M5.5 2.5v11M8.5 8h4M10.5 6v4" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </ToolButton>
                <ToolButton label={`Copy bar ${bar} after it`} onPress={() => onDuplicate(bar)}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect className={icon} x="5.5" y="5.5" width="8" height="8" rx="1.5" strokeWidth="1.4" />
                        <path className={icon} d="M10.5 3.5v-.3c0-.7-.5-1.2-1.2-1.2H3.7c-.7 0-1.2.5-1.2 1.2v5.6c0 .7.5 1.2 1.2 1.2h.3" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                </ToolButton>
                {canDelete && (
                    <ToolButton label={`Delete bar ${bar}`} onPress={() => onDelete(bar)} danger>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                                d="M2.5 4.2h11M6.3 4.2V2.9c0-.4.3-.7.7-.7h2c.4 0 .7.3.7.7v1.3M4 4.2l.6 8.6c.1.7.6 1.2 1.3 1.2h4.2c.7 0 1.2-.5 1.3-1.2l.6-8.6M6.7 7v4.4M9.3 7v4.4"
                                stroke="#FF8A7A"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </ToolButton>
                )}
            </div>
            </div>
            <InsertHandle x={left} label={bar > 1 ? `Add a bar between ${bar - 1} and ${bar}` : 'Add a bar before bar 1'} onPress={() => onInsert(bar)} />
            <InsertHandle x={left + width} label={isLast ? `Add a bar after ${bar}` : `Add a bar between ${bar} and ${bar + 1}`} onPress={() => onInsert(bar + 1)} />
        </>
    );
}

type SlurPath = { d: string; ends: { x: number; y: number }[]; selected: boolean };

/**
 * The slurs of one part over one line of bars, drawn on top of its row.
 * The notes' places are measured from the row itself (the spans marked
 * data-slot inside each data-cell), so the curve sits on the notes however
 * the bar is sized, the cursor bar included. A slur running on past the
 * line leaves it open and comes back in from the start of the next line.
 */
export function SlurLayer({ part, bars, selected = null }: { part: Part | undefined; bars: number[]; selected?: SlurRun | null }) {
    const svg = useRef<SVGSVGElement>(null);
    const [paths, setPaths] = useState<{ key: string; list: SlurPath[]; clip: { left: number; right: number } }>({ key: '', list: [], clip: { left: 0, right: 0 } });
    const first = bars[0];
    const last = bars[bars.length - 1];
    const runs = slurRuns(part).filter((r) => r.to.bar >= first && r.from.bar <= last);

    useLayoutEffect(() => {
        const row = svg.current?.parentElement;

        if (!row || runs.length === 0) {
            if (paths.key !== '') setPaths({ key: '', list: [], clip: { left: 0, right: 0 } });

            return;
        }

        const box = row.getBoundingClientRect();
        const scale = box.width / (row.offsetWidth || box.width || 1);
        const local = (r: DOMRect) => ({ left: (r.left - box.left) / scale, right: (r.right - box.left) / scale, top: (r.top - box.top) / scale, bottom: (r.bottom - box.top) / scale });
        const cells = [...row.querySelectorAll<HTMLElement>('[data-cell]')];

        if (cells.length === 0) return;

        const left = local(cells[0].getBoundingClientRect()).left;
        const right = local(cells[cells.length - 1].getBoundingClientRect()).right;

        const spot = (bar: number, beat: number) => {
            const cell = row.querySelector<HTMLElement>(`[data-cell="${bar}"]`);
            const span = [...(cell?.querySelectorAll<HTMLElement>('[data-slot]') ?? [])].find((el) => Math.abs(Number(el.dataset.slot) - beat) < 1e-3);

            return span ? local(span.getBoundingClientRect()) : null;
        };

        const list: SlurPath[] = [];

        for (const run of runs) {
            const a = run.from.bar >= first ? spot(run.from.bar, run.from.beat) : null;
            const b = run.to.bar <= last ? spot(run.to.bar, run.to.beat) : null;
            const any = a ?? b;

            if (!any || (run.from.bar >= first && !a) || (run.to.bar <= last && !b)) continue;

            const under = run.place === 'under';
            const y = under ? any.bottom - 1 : any.top + 1;
            // Open ends reach past the line's edge (and are clipped there), as if the curve went on.
            const x0 = a ? (a.left + a.right) / 2 : left - 28;
            const x1 = b ? (b.left + b.right) / 2 : right + 28;
            const rise = Math.min(9, 3.5 + (x1 - x0) * 0.035) * 2 * (under ? 1 : -1);
            const ends = [a ? { x: x0, y } : null, b ? { x: x1, y } : null].filter((e): e is { x: number; y: number } => e !== null);
            const isSelected = !!selected && selected.from.bar === run.from.bar && Math.abs(selected.from.beat - run.from.beat) < 1e-6;

            list.push({ d: `M${x0.toFixed(1)} ${y.toFixed(1)} Q${((x0 + x1) / 2).toFixed(1)} ${(y + rise).toFixed(1)} ${x1.toFixed(1)} ${y.toFixed(1)}`, ends, selected: isSelected });
        }

        const key = JSON.stringify([list, left, right]);

        if (key !== paths.key) setPaths({ key, list, clip: { left, right } });
    });

    const clipId = `slurs-${part?.id ?? ''}-${first}`;

    return (
        <svg ref={svg} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
            <defs>
                <clipPath id={clipId}>
                    <rect x={paths.clip.left} y={-40} width={Math.max(0, paths.clip.right - paths.clip.left)} height={120} />
                </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
                {paths.list.map((p, i) => (
                    <path key={i} d={p.d} fill="none" stroke="#111111" strokeWidth={p.selected ? 1.8 : 1.15} strokeLinecap="round" />
                ))}
            </g>
            {paths.list
                .filter((p) => p.selected)
                .flatMap((p) => p.ends)
                .map((e, i) => (
                    <circle key={`e${i}`} cx={e.x} cy={e.y} r={3.5} fill="var(--color-marker)" stroke="#111111" strokeWidth={1.4} />
                ))}
        </svg>
    );
}

/** A bar's sol-fa as spans that know their beat, so a click lands on the exact note. */
export function Pieces({ pieces, hover = true }: { pieces: BarSegment[]; hover?: boolean }) {
    return (
        <>
            {pieces.map((p, i) => (
                <span
                    key={i}
                    data-at={p.at}
                    data-slot={p.kind === 'slot' && p.text !== '' && p.text !== '–' ? p.at : undefined}
                    className={p.kind === 'slot' && p.text !== '' && hover ? 'hover:bg-copy' : undefined}
                >
                    {p.text}
                </span>
            ))}
        </>
    );
}

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
    onRest,
    onBringBack,
    barTools,
    focusPart = null,
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
    onPlayingBar?: (step: PlayStep | null) => void;
    /** Take a part out of these bars (it rests there), or put it back. */
    onRest?: (part: Voice, bars: number[]) => void;
    onBringBack?: (part: Voice, bars: number[]) => void;
    /** Hover a bar to add a bar before / after it, copy it or delete it (Paper W7). */
    barTools?: BarToolActions;
    /** "I sing Alto" on the public page (Paper W14): that line stands out, the others step back. */
    focusPart?: Voice | null;
}) {
    const root = useRef<HTMLDivElement | null>(null);
    const cursorSlur = slurAt(document, cursor);
    const [hoverBar, setHoverBar] = useState<number | null>(null);
    // Leaving a bar hides its tools only after a moment, so a slightly wobbly pointer can still reach them.
    const leaveTimer = useRef<number | null>(null);
    const [restMenu, setRestMenu] = useState<{ part: Voice; bars: number[]; left: number; top: number } | null>(null);
    const closeRestMenu = useCallback(() => setRestMenu(null), []);

    const openRestMenu = (event: MouseEvent<HTMLElement>, part: Voice, bars: number[]) => {
        const box = root.current?.getBoundingClientRect();
        const at = event.currentTarget.getBoundingClientRect();

        if (box) setRestMenu({ part, bars, left: at.left - box.left - 10, top: at.bottom - box.top + 8 });
    };
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
            // A part resting through the whole line is left off it — unless the cursor is writing there.
            const resting = bars.every((b) => part.bars[b - 1]?.tacet);
            const writingHere = mode === 'notes' && cursor.part === part.id && bars.includes(cursor.bar);

            if (resting && !writingHere) {
                rows.push({ kind: 'rests', part });
            } else {
                rows.push({ kind: 'part', part });
            }

            if (document.words_under === 'each') {
                if (!resting || writingHere) rows.push(...wordRows(part.id));
            } else if (part.id === after) {
                rows.push(...wordRows(wordsVoice));
            }
        }

        return rows;
    };

    /** The spot clicked: the exact note (or "." / ":" position) under the pointer, else the nearest beat. */
    const clickBeat = (event: MouseEvent<HTMLElement>, beats: number) => {
        const piece = (event.target as HTMLElement).closest<HTMLElement>('[data-at]');

        if (piece && event.currentTarget.contains(piece)) {
            return Math.min(beats - 1e-6, Number(piece.dataset.at));
        }

        const box = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - box.left - PAD;

        return Math.max(0, Math.min(beats - 1, Math.floor((x / (box.width - PAD)) * beats)));
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

            {layoutLines(document).map(({ bars, widths }) => (
                <div
                    key={bars[0]}
                    data-system={bars[0]}
                    className="relative flex flex-col self-start border-y-[1.5px] border-ink"
                    onMouseMove={(event) => {
                        if (!barTools) return;
                        if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
                        leaveTimer.current = null;
                        // Which bar column the pointer is over (the label lane counts as the first bar).
                        const x = event.clientX - event.currentTarget.getBoundingClientRect().left - LANE;
                        let edge = 0;
                        const index = widths.findIndex((w) => (edge += w) > x);
                        const bar = bars[index === -1 ? bars.length - 1 : index];
                        if (bar !== hoverBar) setHoverBar(bar);
                    }}
                    onMouseLeave={() => {
                        if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
                        leaveTimer.current = window.setTimeout(() => setHoverBar(null), 350);
                    }}
                >
                    {barTools && hoverBar !== null && bars.includes(hoverBar) && (
                        <BarTools
                            bar={hoverBar}
                            left={LANE + widths.slice(0, bars.indexOf(hoverBar)).reduce((a, b) => a + b, 0)}
                            width={widths[bars.indexOf(hoverBar)]}
                            canDelete={document.bars > 1}
                            isLast={hoverBar === document.bars}
                            {...barTools}
                        />
                    )}
                    {/* Bar numbers, the $ sign and tempo / time changes */}
                    <div className="flex h-5.5 shrink-0 items-end">
                        <div className="w-6 shrink-0" />
                        {bars.map((bar, index) => {
                            const segno = document.marks.some((m) => m.kind === 'nav' && m.value === '$' && m.at.bar === bar);
                            const section = document.sections.find((s) => s.from === bar && s.ending === null);
                            const change = bar > 1 ? document.map.find((e) => e.bar === bar) : undefined;
                            const label = segno ? `${bar}  $ ${section?.name ?? ''}`.trimEnd() : `${bar}`;
                            const before = change ? tempoAt(document.map, bar - 1) : null;
                            const word =
                                change?.bpm && before ? (change.bpm < before ? 'Slower' : change.bpm > before ? 'Faster' : '') : '';
                            // "1st time" / "D.S. time" bars sit under a bracket, like a volta.
                            const only = barPass(document, bar);
                            const opens = only !== null && (bar === bars[0] || barPass(document, bar - 1) !== only);

                            return (
                                <div key={bar} data-bar={bar} style={{ width: widths[index] }} className="relative flex shrink-0 items-center gap-1.5 pl-2.5">
                                    {only !== null && (
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'pointer-events-none absolute inset-x-0 -top-0.5 bottom-0 border-t-[1.5px] border-ink',
                                                opens && 'border-l-[1.5px]',
                                            )}
                                        />
                                    )}
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
                                    {opens && (
                                        <span className="text-[11px] leading-3.5 font-semibold text-ink italic">
                                            {only === 1 ? '1st time' : 'D.S. time'}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {hasMarks(document, bars) && <MarksRow document={document} bars={bars} widths={widths} />}

                    {rowsFor(bars).map((row) =>
                        row.kind === 'part' ? (
                            <div
                                key={`p-${row.part.id}`}
                                className={cn(
                                    'group relative flex h-7 shrink-0 items-center',
                                    restMenu?.part === row.part.id && restMenu.bars[0] === bars[0] ? 'bg-copy/60' : canEdit && 'hover:bg-copy/60',
                                    focusPart !== null && (focusPart === row.part.id ? 'bg-wash font-bold' : 'opacity-45'),
                                )}
                            >
                                {canEdit && onRest && (
                                    // A strip over the page margin, part of the row, so the pointer can reach the button.
                                    <span className="absolute top-0 -left-9 flex h-full w-9 items-center pl-1">
                                        <button
                                            type="button"
                                            onClick={(event) => openRestMenu(event, row.part.id, bars)}
                                            aria-label={`Take the ${VOICE_NAMES[row.part.id].toLowerCase()} out of bars ${barList(bars)}`}
                                            title={`Take the ${VOICE_NAMES[row.part.id].toLowerCase()} out of these bars`}
                                            className={cn(
                                                'size-5 items-center justify-center rounded-full bg-ink shadow-[0_0_0_3px_#FFFFFF] outline-none focus-visible:flex',
                                                restMenu?.part === row.part.id && restMenu.bars[0] === bars[0] ? 'flex' : 'hidden group-hover:flex',
                                            )}
                                        >
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                                <path d="M2 5h6" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
                                            </svg>
                                        </button>
                                    </span>
                                )}
                                <div
                                    className={cn(
                                        'w-6 shrink-0 font-display text-[12px] leading-4 font-extrabold',
                                        partHasNotes(row.part) ? 'text-ink' : 'text-ghost',
                                    )}
                                >
                                    {row.part.id}
                                </div>
                                <SlurLayer part={row.part} bars={bars} selected={mode === 'notes' && cursor.part === row.part.id ? cursorSlur : null} />
                                {bars.map((barNo, index) => {
                                    const beats = beatsInBar(document.map, barNo);
                                    const notes = row.part.bars[barNo - 1]?.notes ?? [];
                                    const width = widths[index];
                                    const fit = { fontSize: solfaSize(document, barNo, width) };
                                    const active = mode === 'notes' && cursor.part === row.part.id && cursor.bar === barNo;

                                    if (active) {
                                        const pieces = barSegments(notes, beats, cursor.beat);
                                        const chip = pieces.findIndex((p) => p.kind === 'slot' && Math.abs(p.at - cursor.beat) < 1e-6);
                                        const before = pieces.slice(0, Math.max(0, chip));
                                        const after = chip < 0 ? [] : pieces.slice(chip + 1);
                                        const at = chip < 0 ? '' : pieces[chip].text;

                                        return (
                                            <div
                                                key={barNo}
                                                data-cell={barNo}
                                                onClick={(e) => onCell(row.part.id, barNo, clickBeat(e, beats))}
                                                style={{ width }}
                                                className={cn(
                                                    'flex h-7 shrink-0 cursor-text items-center gap-1.5 border-l border-ink bg-wash pl-2.5',
                                                    closing(index, bars, document.bars),
                                                )}
                                            >
                                                {before.length > 0 && (
                                                    <span style={fit} className="w-max font-solfa text-[14px] leading-4.5 whitespace-pre text-ink">
                                                        <Pieces pieces={before} />
                                                    </span>
                                                )}
                                                <span className="flex h-5.5 items-center gap-px rounded-[4px] bg-marker px-1.5 outline-2 outline-ink outline-solid">
                                                    {at !== '' && (
                                                        <span style={fit} data-slot={at !== '–' ? cursor.beat : undefined} className="font-solfa text-[14px] leading-4.5 text-ink">
                                                            {at}
                                                        </span>
                                                    )}
                                                    <span className="h-3.75 w-0.5 shrink-0 animate-pulse bg-ink" />
                                                </span>
                                                {after.some((p) => p.text.trim() !== '') && (
                                                    <span style={fit} className="w-max font-solfa text-[14px] leading-4.5 whitespace-pre text-ink">
                                                        <Pieces pieces={after} />
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={barNo}
                                            data-cell={barNo}
                                            onClick={(e) => mode === 'notes' && onCell(row.part.id, barNo, clickBeat(e, beats))}
                                            style={{ width }}
                                            className={cn(
                                                'flex h-7 shrink-0 items-center border-l border-ink pl-2.5',
                                                closing(index, bars, document.bars),
                                                mode === 'notes' && 'cursor-text',
                                            )}
                                        >
                                            <span
                                                style={fit}
                                                className={cn(
                                                    'w-max font-solfa text-[14px] leading-4.5 whitespace-pre',
                                                    notes.length > 0 ? 'text-ink' : 'text-dot',
                                                )}
                                            >
                                                {notes.length > 0 ? (
                                                    <Pieces pieces={barSegments(notes, beats)} />
                                                ) : row.part.bars[barNo - 1]?.tacet ? (
                                                    <span className="font-sans text-[11.5px] text-pencil italic">rests</span>
                                                ) : (
                                                    emptyBar(beats)
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : row.kind === 'rests' ? (
                            <div key={`r-${row.part.id}`} className="relative flex h-5 shrink-0 items-center">
                                <div className="w-6 shrink-0 font-display text-[12px] leading-4 font-extrabold text-dot">{row.part.id}</div>
                                {bars.map((barNo, index) => (
                                    <div key={barNo} style={{ width: widths[index] }} className={cn('h-5 shrink-0 border-l border-ink', closing(index, bars, document.bars))} />
                                ))}
                                <div className="absolute top-0.5 left-8.5 flex h-4 items-center gap-2 rounded-[4px] bg-paper px-2">
                                    <span className="text-[11.5px] leading-3.75 text-pencil italic">
                                        {VOICE_NAMES[row.part.id]} rests in bar{bars.length > 1 ? 's' : ''} {barList(bars)}
                                    </span>
                                    {canEdit && onBringBack && (
                                        <button
                                            type="button"
                                            onClick={() => onBringBack(row.part.id, bars)}
                                            className="text-[11.5px] leading-3.75 font-semibold text-ink underline hover:no-underline"
                                        >
                                            Bring back
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <WordsRow
                                key={`w-${row.verse}-${row.part}`}
                                document={document}
                                verse={row.verse}
                                part={row.part}
                                bars={bars}
                                widths={widths}
                                mode={mode}
                                cursor={lyricCursor}
                                onWords={onWords}
                            />
                        ),
                    )}
                </div>
            ))}

            {barTools && (
                <button
                    type="button"
                    onClick={() => barTools.onInsert(document.bars + 1)}
                    className="-mt-2.5 flex h-10 shrink-0 items-center justify-center gap-2 rounded-sm border-[1.5px] border-dashed border-dot text-pencil outline-none hover:border-ink hover:text-ink focus-visible:border-ink"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    <span className="text-[13px] leading-4 font-medium">Add a bar at the end</span>
                    <span className="font-solfa text-[11px] leading-3.5 text-faint">bar {document.bars + 1}</span>
                </button>
            )}

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

            <PlayHead playback={playback} root={root} onBar={(step) => onPlayingBar?.(step)} />

            {restMenu && onRest && (
                <RestPopover
                    key={`${restMenu.part}-${restMenu.bars[0]}`}
                    part={restMenu.part}
                    bars={restMenu.bars}
                    left={restMenu.left}
                    top={restMenu.top}
                    onCancel={closeRestMenu}
                    onRest={(picked) => {
                        onRest(restMenu.part, picked);
                        setRestMenu(null);
                    }}
                />
            )}

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
    widths,
    mode,
    cursor,
    onWords,
}: {
    document: ScoreDocument;
    verse: number;
    part: Voice;
    bars: number[];
    widths: number[];
    mode: EditorMode;
    cursor: LyricCursor;
    onWords: (verse: number, part: Voice, bar: number, beat: number) => void;
}) {
    const syllables: Syllable[] = document.verses[verse]?.syllables.filter((s) => s.part === part) ?? [];
    const extra = verse > 0;

    return (
        <div className="flex h-6.5 shrink-0 items-center">
            <div className="w-6 shrink-0 text-[10px] leading-3 font-bold text-pencil">{extra ? `v${verse + 1}` : ''}</div>
            {bars.map((barNo, index) => {
                const width = widths[index];
                const inBar = syllables.filter((s) => s.bar === barNo).sort((a, b) => a.beat - b.beat);
                const active = mode === 'lyrics' && cursor.verse === verse && cursor.part === part && cursor.bar === barNo;
                const pick = (event: MouseEvent<HTMLElement>) => {
                    if (mode !== 'lyrics') return;

                    const starts = noteStarts(document, part, barNo);
                    const beats = beatsInBar(document.map, barNo);
                    const box = event.currentTarget.getBoundingClientRect();
                    const at = ((event.clientX - box.left - PAD) / (box.width - PAD)) * beats;
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
                            style={{ width }}
                            className={cn(
                                'flex h-6.5 shrink-0 cursor-text items-center gap-0.75 overflow-hidden border-l border-ink bg-wash pl-1.5',
                                closing(index, bars, document.bars),
                            )}
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
                        style={{ width }}
                        className={cn('relative flex h-6.5 shrink-0 items-center border-l border-ink pl-2.5', closing(index, bars, document.bars), mode === 'lyrics' && 'cursor-text')}
                    >
                        {inBar.length > 0 ? (
                            <SyllableLine
                                notes={partOf(document, part)?.bars[barNo - 1]?.notes ?? []}
                                beats={beatsInBar(document.map, barNo)}
                                syllables={inBar}
                                fontSize={solfaSize(document, barNo, width)}
                                width={width}
                                className={extra ? 'text-pencil' : 'text-ink'}
                            />
                        ) : extra && mode === 'lyrics' ? (
                            <span className="text-[12px] leading-4 text-ghost">+ verse {verse + 1}</span>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

