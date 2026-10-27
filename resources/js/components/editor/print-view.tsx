import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MarksRow, closing, hasMarks, solfaSize } from '@/components/editor/sheet';
import { wordsPart } from '@/lib/editor';
import { barPass, beatsInBar, formatBar, formatWords, keyLabel, layoutLines, tempoAt, timeLabel, VOICE_NAMES, VOICES } from '@/lib/music';
import type { SheetLine } from '@/lib/music';
import { cn } from '@/lib/utils';
import type { ScoreDocument, Voice } from '@/types';

type Paper = 'A4' | 'Letter';
type Size = 'compact' | 'normal' | 'large';

/** Pages at 96 dpi. */
const PAPER: Record<Paper, { width: number; height: number; css: string }> = {
    A4: { width: 794, height: 1122, css: 'A4' },
    Letter: { width: 816, height: 1055, css: 'letter' },
};

/** How big the music prints, relative to the editor's sheet. */
const SCALE: Record<Size, number> = { compact: 0.74, normal: 0.88, large: 1.1 };

const MARGIN = 40; // ~10.5 mm
const FOOTER = 20;
const LANE = 24;

/** Heights in sheet units, for splitting the lines into pages. */
// Paper rows are tighter than the editor's: no room kept for the cursor or hover tools.
const H = { title: 60, header: 24, numbers: 16, marks: 18, part: 20, words: 18, lineGap: 0, footnoteHead: 24, footnote: 19 };

/** Bars on paper only need room for their music, not the editor's 165px minimum or the cursor chip. */
const PAPER_BARS = { min: 92, chip: 0 };

type Prepared = { doc: ScoreDocument; verses: number[] };

/** Words rows under a line, as the sheet prints them. */
function wordRows(doc: ScoreDocument, verses: number[], bars: number[]): { part: Voice; verse: number; after: Voice }[] {
    const ids = doc.parts.map((p) => p.id);
    const used = verses.filter((v) => (doc.verses[v]?.syllables.length ?? 0) > 0);

    if (doc.words_under === 'each') {
        return doc.parts.flatMap((p) =>
            used.filter((v) => doc.verses[v].syllables.some((s) => s.part === p.id && bars.includes(s.bar))).map((v) => ({ part: p.id, verse: v, after: p.id })),
        );
    }

    const after = doc.words_under === 'TB' ? (ids.includes('B') ? 'B' : ids[ids.length - 1]) : ids.includes('A') ? 'A' : ids[0];
    const follows = wordsPart(doc, ids[0] ?? 'S');

    return used.map((v) => ({ part: follows, verse: v, after }));
}

function lineHeight(doc: ScoreDocument, verses: number[], line: SheetLine): number {
    const parts = doc.parts.filter((p) => !line.bars.every((b) => p.bars[b - 1]?.tacet)).length;

    return H.numbers + (hasMarks(doc, line.bars) ? H.marks : 0) + parts * H.part + wordRows(doc, verses, line.bars).length * H.words + 1.5;
}

/** One printed line: bar numbers, marks, the parts and the words under them, closed by a bar line. */
/**
 * Lines stack straight onto each other on paper — no gap, and one shared
 * rule between them (each line draws only its bottom rule; the first on a
 * page also draws its top).
 */
function PrintLine({ doc, verses, line, first }: { doc: ScoreDocument; verses: number[]; line: SheetLine; first: boolean }) {
    const { bars, widths } = line;
    const rows = wordRows(doc, verses, bars);

    const cells = (render: (bar: number, index: number) => ReactNode, height: string) =>
        bars.map((bar, index) => (
            <div key={bar} style={{ width: widths[index] }} className={cn('flex shrink-0 items-center border-l border-ink pl-2.5', height, closing(index, bars, doc.bars))}>
                {render(bar, index)}
            </div>
        ));

    return (
        <div className={cn('flex flex-col self-start border-b-[1.5px] border-ink', first && 'border-t-[1.5px]')}>
            <div className="flex h-4 shrink-0 items-end">
                <div className="w-6 shrink-0" />
                {bars.map((bar, index) => {
                    const segno = doc.marks.some((m) => m.kind === 'nav' && m.value === '$' && m.at.bar === bar);
                    const section = doc.sections.find((s) => s.from === bar && s.ending === null);
                    const change = bar > 1 ? doc.map.find((e) => e.bar === bar) : undefined;
                    const only = barPass(doc, bar);
                    const opens = only !== null && (index === 0 || barPass(doc, bar - 1) !== only);

                    return (
                        <div key={bar} style={{ width: widths[index] }} className="relative flex shrink-0 items-center gap-1.5 pl-2.5">
                            {only !== null && <span className={cn('absolute inset-x-0 -top-0.5 bottom-0 border-t-[1.5px] border-ink', opens && 'border-l-[1.5px]')} />}
                            <span className="font-solfa text-[11px] leading-3.5 whitespace-pre text-pencil">
                                {segno ? `${bar}  $ ${section?.name ?? ''}`.trimEnd() : bar}
                            </span>
                            {change && (
                                <span className="font-solfa text-[11px] leading-3.5 text-ink">
                                    {[change.bpm !== null ? `♩ = ${change.bpm}` : null, change.beats !== null ? timeLabel(change.beats) : null].filter(Boolean).join(' · ')}
                                </span>
                            )}
                            {opens && <span className="text-[11px] leading-3.5 font-semibold text-ink italic">{only === 1 ? '1st time' : 'D.S. time'}</span>}
                        </div>
                    );
                })}
            </div>

            {hasMarks(doc, bars) && <MarksRow document={doc} bars={bars} widths={widths} compact />}

            {doc.parts.map((part) => {
                if (bars.every((b) => part.bars[b - 1]?.tacet)) return null;

                return (
                    <div key={part.id} className="contents">
                        <div className="flex h-5 shrink-0 items-center">
                            <div className="w-6 shrink-0 font-display text-[12px] leading-4 font-extrabold text-ink">{part.id}</div>
                            {cells((bar, index) => {
                                const notes = part.bars[bar - 1]?.notes ?? [];

                                return (
                                    <span style={{ fontSize: solfaSize(doc, bar, widths[index], 4) }} className="w-max font-solfa text-[14px] leading-4.5 whitespace-pre text-ink">
                                        {notes.length > 0 ? formatBar(notes, beatsInBar(doc.map, bar)) : ''}
                                    </span>
                                );
                            }, 'h-5')}
                        </div>
                        {rows
                            .filter((r) => r.after === part.id)
                            .map((r) => (
                                <div key={`${r.part}-${r.verse}`} className="flex h-4.5 shrink-0 items-center">
                                    <div className="w-6 shrink-0 text-[10px] leading-3 font-bold text-pencil">{r.verse > 0 ? `v${r.verse + 1}` : ''}</div>
                                    {cells((bar) => {
                                        const inBar = doc.verses[r.verse].syllables.filter((s) => s.part === r.part && s.bar === bar).sort((a, b) => a.beat - b.beat);

                                        return <span className="w-max text-[13px] leading-4 whitespace-pre text-ink italic">{formatWords(inBar)}</span>;
                                    }, 'h-4.5')}
                                </div>
                            ))}
                    </div>
                );
            })}
        </div>
    );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
    return (
        <div className="flex gap-1 rounded-full bg-copy p-1">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cn(
                        'flex h-7.5 grow basis-0 items-center justify-center rounded-full text-[13px] leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                        value === o.value ? 'bg-paper font-semibold text-ink' : 'text-pencil hover:text-ink',
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
    return (
        <label className="flex h-8.5 cursor-pointer items-center justify-between">
            <span className="text-[14px] leading-4.5 text-ink">{label}</span>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-5 items-center justify-center rounded-[5px] peer-focus-visible:ring-2 peer-focus-visible:ring-ink/20',
                    checked ? 'bg-ink' : 'border-[1.5px] border-rule',
                )}
            >
                {checked && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.2 5 8.5l4.5-5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </span>
        </label>
    );
}

function Label({ children, aside }: { children: string; aside?: string }) {
    return (
        <div className="flex justify-between">
            <span className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">{children}</span>
            {aside && <span className="text-[12px] leading-3.5 text-pencil">{aside}</span>}
        </div>
    );
}

/**
 * Print (Paper W8): the score laid out on real pages — paper, which parts,
 * type size, words, footnotes and page numbers — then the browser's print
 * window, where "Save as PDF" makes a file.
 */
export function PrintView({
    document: full,
    title,
    composer,
    arranger,
    doh,
    onClose,
}: {
    document: ScoreDocument;
    title: string;
    composer: string | null;
    arranger: string | null;
    doh: string;
    onClose: () => void;
}) {
    const [paper, setPaper] = useState<Paper>('A4');
    const [size, setSize] = useState<Size>('normal');
    const [parts, setParts] = useState<Voice[]>(full.parts.map((p) => p.id));
    const [verses, setVerses] = useState<number[]>(full.verses.map((_, i) => i));
    const [footnotes, setFootnotes] = useState(true);
    const [pageNumbers, setPageNumbers] = useState(true);
    const pagesBox = useRef<HTMLDivElement>(null);
    const [previewZoom, setPreviewZoom] = useState(0.6);

    const page = PAPER[paper];
    const scale = SCALE[size];

    const prepared: Prepared = useMemo(() => {
        const keep = parts.length > 0 ? parts : [full.parts[0].id];

        return {
            doc: { ...full, parts: full.parts.filter((p) => keep.includes(p.id)), footnotes: footnotes ? full.footnotes : [] },
            verses,
        };
    }, [full, parts, verses, footnotes]);

    // Lines as wide as the page allows at this size, then split into pages.
    const pages = useMemo(() => {
        const { doc } = prepared;
        const lines = layoutLines(doc, Math.floor((page.width - 2 * MARGIN) / scale) - LANE, PAPER_BARS);
        const room = (page.height - 2 * MARGIN - FOOTER) / scale;
        const out: SheetLine[][] = [[]];
        let used = H.title;

        for (const line of lines) {
            const height = lineHeight(doc, prepared.verses, line) + H.lineGap;

            if (used + height > room && out[out.length - 1].length > 0) {
                out.push([]);
                used = H.header;
            }

            out[out.length - 1].push(line);
            used += height;
        }

        return out;
    }, [prepared, page, scale]);

    const notes = prepared.doc.footnotes;
    const first = full.map[0];
    const voices = prepared.doc.parts.map((p) => p.id).join('');
    const style = full.style ? `${full.style.charAt(0).toUpperCase()}${full.style.slice(1)} · ` : '';

    // Fit the preview pages into the space beside the settings.
    useEffect(() => {
        const fit = () => {
            const width = pagesBox.current?.clientWidth ?? 900;
            setPreviewZoom(Math.max(0.3, Math.min(0.75, (width - 80) / (2 * page.width + 32))));
        };

        fit();
        window.addEventListener('resize', fit);

        return () => window.removeEventListener('resize', fit);
    }, [page.width]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
                event.preventDefault();
                window.print();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

    return createPortal(
        <div className="print-root fixed inset-0 z-50 flex flex-col bg-[#E9E9E6]">
            <style>{`@page { size: ${page.css} portrait; margin: 0; }`}</style>

            <header className="print-chrome flex h-15 shrink-0 items-center justify-between border-b border-rule bg-paper px-5">
                <div className="flex items-center gap-3.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 items-center gap-2 rounded-full bg-copy pr-3 pl-2.5 text-[14px] leading-4.5 font-semibold text-ink outline-none hover:bg-rule focus-visible:ring-2 focus-visible:ring-ink/20"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M8.5 3 4.5 7l4 4" stroke="#111111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back to the score
                    </button>
                    <span className="text-[14px] leading-4.5 text-pencil">Print · {title}</span>
                </div>
                <span className="font-solfa text-[12px] leading-4 text-pencil">
                    {pages.length} page{pages.length === 1 ? '' : 's'} · {paper} portrait
                </span>
            </header>

            <div className="print-body flex min-h-0 grow">
                <div ref={pagesBox} className="print-scroll min-w-0 grow overflow-auto">
                    <div className="print-pages flex flex-wrap items-start justify-center gap-8 p-10" style={{ zoom: previewZoom }}>
                        {pages.map((lines, index) => (
                            <div
                                key={index}
                                className="print-page relative flex shrink-0 flex-col bg-white shadow-[0_1px_3px_#0000001A,0_14px_40px_#00000014]"
                                style={{ width: page.width, height: page.height, padding: MARGIN }}
                            >
                                <div className="flex grow flex-col" style={{ zoom: scale }}>
                                    {index === 0 ? (
                                        <div className="flex items-end justify-between pb-3">
                                            <div className="flex w-35 shrink-0 flex-col gap-0.5">
                                                <div className="font-solfa text-[13px] leading-4 text-ink">Doh is {keyLabel(doh)}</div>
                                                <div className="font-solfa text-[13px] leading-4 text-ink">
                                                    {timeLabel(first?.beats ?? 4)} ♩ = {tempoAt(full.map, 1)}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="text-center font-display text-[26px] leading-8 font-extrabold tracking-[0.01em] text-ink uppercase">{title}</div>
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
                                    ) : (
                                        <div className="flex justify-between pb-2 text-[12px] leading-4">
                                            <span className="font-semibold text-ink">{title}</span>
                                            <span className="font-solfa text-pencil">Doh is {keyLabel(doh)}</span>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2.5">
                                        <div className="flex flex-col">
                                            {lines.map((line, i) => (
                                                <PrintLine key={line.bars[0]} doc={prepared.doc} verses={prepared.verses} line={line} first={i === 0} />
                                            ))}
                                        </div>

                                        {index === pages.length - 1 && notes.length > 0 && (
                                            <div className="flex flex-col gap-1.5 rounded-[4px] px-3.5 py-3 outline-[1.5px] outline-ink outline-dashed">
                                                {notes.map((note, i) => (
                                                    <div key={i} className="text-[13px] leading-4.75 text-ink">
                                                        {note}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-end justify-between pt-3 text-[11px] leading-3.5 text-faint" style={{ height: FOOTER }}>
                                    <span>
                                        {title}
                                        {composer ? ` · ${composer}` : ''}
                                    </span>
                                    {pageNumbers && (
                                        <span className="font-solfa">
                                            {index + 1} / {pages.length}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <aside className="print-chrome flex w-85 shrink-0 flex-col gap-5.5 overflow-y-auto border-l border-rule bg-paper px-5.5 py-6">
                    <div className="flex flex-col gap-2.5">
                        <Label>PAPER</Label>
                        <Segmented
                            value={paper}
                            onChange={setPaper}
                            options={[
                                { value: 'A4', label: 'A4' },
                                { value: 'Letter', label: 'Letter' },
                            ]}
                        />
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <Label aside={parts.length === full.parts.length ? `All ${full.parts.length}` : parts.map((v) => VOICE_NAMES[v]).join(', ')}>
                            PARTS ON THE PAGE
                        </Label>
                        <div className="flex gap-1.5">
                            {VOICES.filter((v) => full.parts.some((p) => p.id === v)).map((v) => {
                                const on = parts.includes(v);

                                return (
                                    <button
                                        key={v}
                                        type="button"
                                        aria-pressed={on}
                                        aria-label={VOICE_NAMES[v]}
                                        disabled={on && parts.length === 1}
                                        onClick={() => setParts(VOICES.filter((x) => toggle(parts, v).includes(x)))}
                                        className={cn(
                                            'flex h-9 grow basis-0 items-center justify-center rounded-sm font-display text-[14px] leading-4.5 font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                                            on ? 'bg-ink text-paper' : 'border border-rule text-ink hover:bg-copy',
                                        )}
                                    >
                                        {v}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[12px] leading-4 text-pencil">Print one part on its own for a section rehearsal.</p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <Label>TYPE SIZE</Label>
                        <Segmented
                            value={size}
                            onChange={setSize}
                            options={[
                                { value: 'compact', label: 'Compact' },
                                { value: 'normal', label: 'Normal' },
                                { value: 'large', label: 'Large' },
                            ]}
                        />
                        <p className="text-[12px] leading-4 text-pencil">Large is easier to read on a music stand; it takes more pages.</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="pb-1.5">
                            <Label>ON THE PAGE</Label>
                        </div>
                        {full.verses.map((v, i) => (
                            <Check key={v.id} label={`${v.label} words`} checked={verses.includes(i)} onChange={() => setVerses(toggle(verses, i).sort((a, b) => a - b))} />
                        ))}
                        {full.footnotes.length > 0 && <Check label="Footnotes" checked={footnotes} onChange={setFootnotes} />}
                        <Check label="Page numbers" checked={pageNumbers} onChange={setPageNumbers} />
                    </div>

                    <div className="mt-auto flex flex-col gap-2 border-t border-rule pt-4">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-[15px] leading-4.5 font-semibold text-paper outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path
                                    d="M4.5 6V2.5h7V6M4.5 11.5h-1A1.5 1.5 0 0 1 2 10V7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V10a1.5 1.5 0 0 1-1.5 1.5h-1M4.5 9.5h7v4h-7z"
                                    stroke="#FFFFFF"
                                    strokeWidth="1.4"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            Print {pages.length} page{pages.length === 1 ? '' : 's'}
                            <span className="pl-1 text-[11px] leading-3.5 text-paper/60">⌘ P</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            title="In the print window, choose “Save as PDF” as the printer"
                            className="flex h-11 items-center justify-center gap-2 rounded-full border border-rule text-[15px] leading-4.5 font-semibold text-ink outline-none hover:bg-copy focus-visible:ring-2 focus-visible:ring-ink/20"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M8 2.5v8M5 7.5l3 3 3-3M3 13.5h10" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Save as PDF
                        </button>
                        <p className="text-center text-[11.5px] leading-4 text-pencil">For a PDF, pick “Save as PDF” as the printer.</p>
                    </div>
                </aside>
            </div>
        </div>,
        window.document.body,
    );
}
