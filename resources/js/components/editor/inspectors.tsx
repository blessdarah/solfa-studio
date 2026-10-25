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
} from '@/lib/music';
import { cn } from '@/lib/utils';
import type { MapEvent, ScoreDocument, Voice, WordsUnder } from '@/types';

function Label({ children }: { children: string }) {
    return <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">{children}</div>;
}

function Panel({ children }: { children: ReactNode }) {
    return <aside className="flex w-75 shrink-0 flex-col gap-6 overflow-y-auto border-l border-rule bg-paper px-5 py-6">{children}</aside>;
}

function beatText(beat: number): string {
    const whole = Math.floor(beat) + 1;
    const frac = beat - Math.floor(beat);

    return frac === 0.5 ? `${whole}½` : frac === 0.25 ? `${whole}¼` : frac === 0.75 ? `${whole}¾` : `${whole}`;
}

function lengthText(length: number): string {
    const whole = Math.floor(length);
    const frac = length - whole;
    const fracText = frac === 0.5 ? '½' : frac === 0.25 ? '¼' : frac === 0.75 ? '¾' : '';
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
}: {
    document: ScoreDocument;
    doh: string;
    cursor: Cursor;
    canEdit: boolean;
    suggesting: boolean;
    onSuggest: () => void;
    onCopyRhythm: () => void;
    onRepeat: () => void;
}) {
    const part = partOf(document, cursor.part);
    const note = noteAt(part, cursor.bar, cursor.beat);
    const starts = note !== undefined && Math.abs(note.start - cursor.beat) < 1e-6;

    const sounding = document.parts.map((p) => ({ voice: p.id, note: noteAt(p, cursor.bar, cursor.beat) }));
    const hint = chordHint(sounding);

    const rhythmFrom: Voice = cursor.part === 'S' ? (partOf(document, 'A') ? 'A' : 'S') : 'S';
    const suggestTo = Math.min(document.bars, cursor.bar + 2);
    const systemStart = Math.floor((cursor.bar - 1) / 4) * 4 + 1;
    const repeatFrom = systemStart - 4;

    return (
        <Panel>
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
                    {repeatFrom >= 1 && (
                        <button
                            type="button"
                            onClick={onRepeat}
                            className="flex h-10 shrink-0 items-center justify-between rounded-full border border-rule px-3.5 hover:bg-copy"
                        >
                            <span className="text-[14px] leading-4.5 font-medium text-ink">
                                Repeat bars {repeatFrom}–{repeatFrom + 3} here
                            </span>
                            <span className="text-[11px] leading-3.5 text-pencil">⌘ D</span>
                        </button>
                    )}
                </div>
            )}
        </Panel>
    );
}

const UNDER: { value: WordsUnder; label: string }[] = [
    { value: 'SA', label: 'S + A' },
    { value: 'TB', label: 'T + B' },
    { value: 'each', label: 'Each part' },
];

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
}: {
    document: ScoreDocument;
    cursor: LyricCursor;
    canEdit: boolean;
    onWordsUnder: (value: WordsUnder) => void;
    onVerse: (index: number) => void;
    onAddTranslation: () => void;
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
                {document.verses.map((v, index) => {
                    const filled = new Set(v.syllables.map((s) => s.bar)).size;
                    const active = index === cursor.verse;

                    return (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => onVerse(index)}
                            className={cn('flex h-9 shrink-0 items-center justify-between rounded-sm px-2.5 text-left', active ? 'bg-copy' : 'hover:bg-copy/60')}
                        >
                            <span className={cn('text-[14px] leading-4.5 text-ink', active && 'font-semibold')}>
                                {v.label} · {langLabel(v.lang)}
                            </span>
                            <span className="font-solfa text-[12px] leading-4 text-pencil">
                                {filled}/{document.bars}
                            </span>
                        </button>
                    );
                })}
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

