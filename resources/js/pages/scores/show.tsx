import { Head, Link, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type {
    Bar as ScoreBar,
    ComposeProps,
    Mark,
    Note,
    Part,
    Pitch,
    Section,
    Syllable,
    SyllableJoin,
    Voice,
} from '@/types';

const PALETTE: Array<{ label: string; key: string; pitch?: Pitch; alt?: boolean }> = [
    { label: 'd', key: 'D', pitch: 'd' },
    { label: 'r', key: 'R', pitch: 'r' },
    { label: 'm', key: 'M', pitch: 'm' },
    { label: 'f', key: 'F', pitch: 'f' },
    { label: 's', key: 'S', pitch: 's' },
    { label: 'l', key: 'L', pitch: 'l' },
    { label: 't', key: 'T', pitch: 't' },
];

const OCTAVES: Array<{ label: string; key: string }> = [
    { label: "x₁", key: ',' },
    { label: "x'", key: "'" },
];

const ALTER: Array<{ label: string; key: string; pitch: Pitch }> = [
    { label: 'fe', key: '↑', pitch: 'fe' },
    { label: 'ta', key: '↓', pitch: 'ta' },
];

const REST: Array<{ label: string; key: string }> = [
    { label: '–', key: '-' },
    { label: '.', key: '.' },
];

function partName(voice: Voice): string {
    switch (voice) {
        case 'S':
            return 'Soprano';
        case 'A':
            return 'Alto';
        case 'T':
            return 'Tenor';
        case 'B':
            return 'Bass';
    }
}

function voiceDone(score: ComposeProps['score'], voice: Voice): number {
    return (
        score.voice_progress.find(
            (v: { voice: Voice; done: number }) => v.voice === voice,
        )?.done ?? 0
    );
}

function getPart(document: ComposeProps['document'], voice: Voice): Part | undefined {
    return document.parts.find((p) => p.id === voice);
}

function partHasNotes(part: Part | undefined): boolean {
    if (!part) return false;

    return part.bars.some((bar) => bar.notes.length > 0);
}

function partProgress(document: ComposeProps['document'], voice: Voice): number {
    const part = getPart(document, voice);
    if (!part) return 0;

    const done = part.bars.filter((bar) => bar.done).length;

    return Math.max(0, Math.min(1, done / document.bars));
}

function hairpinAtBar(
    marks: Mark[],
    bar: number,
): { mark: Mark; isStart: boolean } | null {
    for (const mark of marks) {
        if (mark.kind !== 'hairpin') continue;
        if (mark.at.bar === bar) return { mark, isStart: true };
        if (mark.to && mark.to.bar === bar && mark.to.beat === 0) {
            return { mark, isStart: false };
        }
    }

    return null;
}

function noteLabel(note: Note): string {
    if (note.pitch === 'rest') return '·';

    if (note.octave === -1) return `${note.pitch}₁`;
    if (note.octave === 1) return `${note.pitch}'`;

    return note.pitch;
}

function barNotesFor(part: Part | undefined, barNo: number): ScoreBar | undefined {
    if (!part) return undefined;

    return part.bars.find((bar) => bar.no === barNo);
}

function syllablesFor(
    syllables: Syllable[],
    bar: number,
): Syllable[] {
    return syllables.filter((s) => s.bar === bar).sort((a, b) => a.beat - b.beat);
}

function formatSyllableText(text: string, join: SyllableJoin): string {
    if (join === 'split') {
        return `${text}–`;
    }

    return text;
}

function beatNotesFor(
    part: Part | undefined,
    barNo: number,
    beat: number,
): Note[] {
    const bar = barNotesFor(part, barNo);
    if (!bar) return [];

    return bar.notes.filter((note) => note.start === beat);
}

function systemRange(from: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => from + i);
}

type Tab = 'notes' | 'lyrics' | 'check';

export default function ScoreShow({ score, document, saved_label }: ComposeProps) {
    const { auth } = usePage().props;
    const user = auth.user!;

    const [tab, setTab] = useState<Tab>('notes');
    const [cursor, setCursor] = useState({ part: 'A' as Voice, bar: 11, beat: 3 });
    const [activePart, setActivePart] = useState<Voice>('S');

    const partsOrder: Voice[] = ['S', 'A', 'T', 'B'];
    const systems = useMemo(() => [systemRange(5, 4), systemRange(9, 4)], []);
    const marks = document.marks;
    const syllables = document.verses.flatMap((verse) => verse.syllables);
    const chorus = document.sections.find((s) => s.name === 'Chorus');
    const verse1 = document.verses[0];

    const cursorNote = beatNotesFor(
        getPart(document, cursor.part),
        cursor.bar,
        cursor.beat,
    )[0];

    const cursorSounds = cursorNote
        ? `${cursorNote.pitch === 'rest' ? 'Rest' : cursorNote.pitch.toUpperCase()}${cursorNote.octave === 1 ? "'" : cursorNote.octave === -1 ? '₁' : ''} (Doh is ${score.doh})`
        : '— (Doh is ' + score.doh + ')';

    const bar10Beat3 = useMemo(
        () =>
            partsOrder.map((voice) => {
                const part = getPart(document, voice);
                const notes = beatNotesFor(part, 10, 3);
                const note = notes[0];

                return {
                    voice,
                    label: partName(voice),
                    note: note ? noteLabel(note) : 'empty',
                    empty: !note,
                    active: voice === cursor.part,
                };
            }),
        [document, cursor.part],
    );

    return (
        <>
            <Head title={score.title} />

            <div className="flex h-screen flex-col bg-[var(--color-copy)] text-ink">
                <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-rule bg-paper px-5">
                    <div className="flex items-center gap-5">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
                        >
                            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-marker font-solfa text-sm">
                                d
                            </div>
                            <div className="font-display text-[17px] font-extrabold tracking-[-0.02em]">
                                Sol-fa Studio
                            </div>
                        </Link>
                        <div className="hidden items-center gap-2 text-sm text-pencil sm:flex">
                            <span className="text-rule">/</span>
                            <span>Scores / {score.title}</span>
                            <span className="text-rule">/</span>
                            <span>{saved_label}</span>
                        </div>
                    </div>

                    <nav className="flex items-center gap-1 rounded-full bg-copy p-1">
                        <button
                            onClick={() => setTab('notes')}
                            className={cn(
                                'rounded-full px-[18px] py-1.5 text-sm',
                                tab === 'notes'
                                    ? 'bg-ink font-semibold text-paper'
                                    : 'font-medium text-pencil',
                            )}
                        >
                            Notes
                        </button>
                        <button
                            onClick={() => setTab('lyrics')}
                            className={cn(
                                'rounded-full px-[18px] py-1.5 text-sm',
                                tab === 'lyrics'
                                    ? 'bg-ink font-semibold text-paper'
                                    : 'font-medium text-pencil',
                            )}
                        >
                            Lyrics & text
                        </button>
                        <button
                            onClick={() => setTab('check')}
                            className={cn(
                                'rounded-full px-[18px] py-1.5 text-sm',
                                tab === 'check'
                                    ? 'bg-ink font-semibold text-paper'
                                    : 'font-medium text-pencil',
                            )}
                        >
                            Check
                        </button>
                    </nav>

                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 rounded-full bg-copy px-3.5 py-2 text-sm font-semibold">
                            <svg width="14" height="14" viewBox="0 0 24 24">
                                <path d="M7 4l13 8-13 8z" fill="currentColor" />
                            </svg>
                            {tab === 'lyrics' ? 'Play with words' : 'Play from bar 9'}
                        </button>
                        <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                            Share
                        </button>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-copy text-sm font-semibold">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <div className="flex min-h-0 flex-1">
                    <aside className="flex w-[248px] shrink-0 flex-col gap-7 border-r border-rule bg-paper px-5 py-6">
                        <section>
                            <div className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                SCORE
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    `Doh is ${score.doh}`,
                                    `${score.beats}/4`,
                                    `♩ = ${score.bpm}`,
                                    `${score.bars} bars`,
                                ].map((item) => (
                                    <span
                                        key={item}
                                        className="rounded-[6px] bg-copy px-2.5 py-1 font-solfa text-xs"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </section>

                        <section>
                            <div className="mb-1.5 flex items-center justify-between">
                                <div className="text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                    PARTS
                                </div>
                                <button className="text-sm font-medium">+ Add</button>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                {partsOrder.map((voice) => {
                                    const isActivePart = activePart === voice;
                                    const progress = partProgress(document, voice);
                                    const done = voiceDone(score, voice);

                                    return (
                                        <button
                                            key={voice}
                                            onClick={() => setActivePart(voice)}
                                            className={cn(
                                                'flex items-center gap-2.5 rounded-[6px] px-2 py-2 text-left transition',
                                                isActivePart
                                                    ? 'bg-ink text-paper'
                                                    : 'hover:bg-copy',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'w-5 font-display text-[15px] font-extrabold',
                                                    isActivePart
                                                        ? 'text-paper'
                                                        : 'text-ink',
                                                )}
                                            >
                                                {voice}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div
                                                    className={cn(
                                                        'text-sm',
                                                        isActivePart
                                                            ? 'font-semibold'
                                                            : 'text-ink',
                                                    )}
                                                >
                                                    {partName(voice)}
                                                    {isActivePart && voice === 'A'
                                                        ? ' · writing'
                                                        : ''}
                                                </div>
                                                <div
                                                    className={cn(
                                                        'mt-1 h-[3px] overflow-hidden rounded-full',
                                                        isActivePart
                                                            ? 'bg-white/20'
                                                            : 'bg-rule',
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            'h-full rounded-full',
                                                            isActivePart
                                                                ? 'bg-marker'
                                                                : 'bg-ink',
                                                        )}
                                                        style={{
                                                            width: `${progress * 100}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <span
                                                className={cn(
                                                    'font-solfa text-xs',
                                                    isActivePart
                                                        ? 'text-white/75'
                                                        : 'text-pencil',
                                                )}
                                            >
                                                {done}/{document.bars}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section>
                            <div className="mb-1.5 flex items-center justify-between">
                                <div className="text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                    SECTIONS
                                </div>
                                <button className="text-sm font-medium">+ Add</button>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                {(document.sections as Section[]).map((section) => {
                                    const activeSection =
                                        chorus &&
                                        section.name === chorus.name &&
                                        section.from === chorus.from;

                                    return (
                                        <div
                                            key={`${section.name}-${section.from}`}
                                            className={cn(
                                                'flex items-center justify-between rounded-[6px] px-2 py-2',
                                                activeSection
                                                    ? 'bg-copy font-semibold'
                                                    : '',
                                            )}
                                        >
                                            <span className="text-sm">
                                                {section.name}
                                                {section.name === 'Chorus'
                                                    ? ' $'
                                                    : ''}
                                            </span>
                                            <span className="font-solfa text-xs text-pencil">
                                                {section.from}–{section.to}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div className="px-2 pt-2 text-sm text-pencil">
                                    Ends: D.S. al Fine
                                </div>
                            </div>
                        </section>
                    </aside>

                    <main className="relative flex min-h-0 flex-1 flex-col items-center overflow-auto px-8 pt-7">
                        <div className="mb-7 flex w-[780px] items-end justify-between">
                            <div className="w-[140px]">
                                <div className="font-solfa text-[13px]">
                                    Doh is {score.doh}
                                </div>
                                <div className="font-solfa text-[13px]">
                                    {score.beats}/4 ♩ = {score.bpm}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="font-display text-[30px] font-extrabold tracking-[0.01em] uppercase">
                                    {score.title}
                                </div>
                                <div className="text-[13px] italic text-pencil">
                                    {document.style
                                        ? document.style.charAt(0).toUpperCase() +
                                          document.style.slice(1)
                                        : 'Highlife'}{' '}
                                    · SATB
                                </div>
                            </div>
                            <div className="w-[140px] text-right">
                                <div className="text-[13px] font-semibold">
                                    {score.composer || user.name}
                                </div>
                                <div className="text-xs text-pencil">
                                    Words & music
                                </div>
                            </div>
                        </div>

                        <div className="flex w-[780px] flex-col gap-7 pb-40">
                            {systems.map((bars, systemIdx) => (
                                <section
                                    key={systemIdx}
                                    className="overflow-hidden rounded-[4px] bg-paper shadow-[0_1px_3px_rgba(0,0,0,0.06),0_12px_40px_rgba(0,0,0,0.05)]"
                                >
                                    <div className="border-y-[1.5px] border-ink">
                                        <div className="flex h-[22px] items-end">
                                            <div className="w-6" />
                                            {bars.map((bar) => (
                                                <div
                                                    key={bar}
                                                    className="w-[165px] pl-2.5 font-solfa text-xs text-pencil"
                                                >
                                                    {bar === 9 ? (
                                                        <span className="flex items-center gap-2 text-ink">
                                                            9{' '}$ Chorus
                                                            <span className="font-['Georgia'] text-[14px] font-bold italic">
                                                                f
                                                            </span>
                                                            <span className="text-xs italic">
                                                                joyfully
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        bar
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex h-6 items-center">
                                            <div className="w-6" />
                                            {bars.map((bar) => {
                                                const hairpin = hairpinAtBar(
                                                    marks,
                                                    bar,
                                                );

                                                return (
                                                    <div
                                                        key={`m-${bar}`}
                                                        className="flex w-[165px] items-center gap-2 pl-2.5"
                                                    >
                                                        {bar === 7 && hairpin?.isStart ? (
                                                            <svg
                                                                width="280"
                                                                height="14"
                                                                viewBox="0 0 280 14"
                                                                className="ml-[-2px] w-[280px]"
                                                            >
                                                                <path
                                                                    d="M2 7 L278 1.5 M2 7 L278 12.5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.3"
                                                                    strokeLinecap="round"
                                                                    fill="none"
                                                                />
                                                            </svg>
                                                        ) : null}
                                                        {bar === 11 && hairpin && !hairpin.isStart ? (
                                                            <svg
                                                                width="140"
                                                                height="14"
                                                                viewBox="0 0 140 14"
                                                                className="ml-[-2px] w-[140px]"
                                                            >
                                                                <path
                                                                    d="M2 1.5 L138 7 M2 12.5 L138 7"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.3"
                                                                    strokeLinecap="round"
                                                                    fill="none"
                                                                />
                                                            </svg>
                                                        ) : null}
                                                        {bar === 12 ? (
                                                            <div className="flex w-full items-center justify-between pr-2">
                                                                <span className="font-['Georgia'] text-[15px] font-bold italic">
                                                                    mp
                                                                </span>
                                                                <span className="text-xs font-bold">
                                                                    Fine
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {partsOrder.map((voice) => (
                                            <div
                                                key={voice}
                                                className="flex h-7 items-center"
                                            >
                                                <div
                                                    className={cn(
                                                        'w-6 text-center font-display text-xs font-extrabold',
                                                        partHasNotes(
                                                            getPart(
                                                                document,
                                                                voice,
                                                            ),
                                                        )
                                                            ? 'text-ink'
                                                            : 'text-[#BDBDB7]',
                                                    )}
                                                >
                                                    {voice}
                                                </div>
                                                {bars.map((barNo) => {
                                                    const part = getPart(
                                                        document,
                                                        voice,
                                                    );
                                                    const bar = barNotesFor(
                                                        part,
                                                        barNo,
                                                    );
                                                    const notes =
                                                        bar?.notes ?? [];

                                                    return (
                                                        <button
                                                            key={`${voice}-${barNo}`}
                                                            onClick={() => {
                                                                if (tab === 'notes') {
                                                                    setCursor({
                                                                        part: voice,
                                                                        bar: barNo,
                                                                        beat: 3,
                                                                    });
                                                                } else {
                                                                    setCursor({
                                                                        part: 'S',
                                                                        bar: barNo,
                                                                        beat: 3,
                                                                    });
                                                                }
                                                            }}
                                                            className="relative flex h-7 w-[165px] items-center border-l border-ink pl-2.5 text-left"
                                                        >
                                                            {notes.length === 0 ? (
                                                                <span className="font-solfa text-sm text-[#CFCFC9]">
                                                                    · :· ¦ · :·
                                                                </span>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 font-solfa text-sm">
                                                                    <span className="whitespace-pre">
                                                                        {(() => {
                                                                            const displayNotes = notes.slice(0, 4);
                                                                            const parts: string[] = [];
                                                                            
                                                                            if (displayNotes[0]) parts.push(noteLabel(displayNotes[0]));
                                                                            if (displayNotes[1]) parts.push(':' + noteLabel(displayNotes[1]));
                                                                            if (displayNotes[2]) parts.push('  ¦ ' + noteLabel(displayNotes[2]));
                                                                            if (displayNotes[3]) {
                                                                                if (displayNotes[2]) parts.push(':' + noteLabel(displayNotes[3]));
                                                                                else parts.push('¦ ' + noteLabel(displayNotes[3]));
                                                                            }
                                                                            
                                                                            return parts.join('');
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}

                                        <div className="flex h-[26px] items-center">
                                            <div className="w-6" />
                                            {bars.map((barNo) => {
                                                const line = syllablesFor(
                                                    syllables,
                                                    barNo,
                                                );
                                                const isActiveLyricCell =
                                                    tab === 'lyrics' && barNo === 11;

                                                return (
                                                    <div
                                                        key={`ly-${barNo}`}
                                                        className={cn(
                                                            'flex h-[26px] w-[165px] items-center border-l border-ink pl-2.5',
                                                            isActiveLyricCell &&
                                                                'bg-[#FBF6C9]',
                                                        )}
                                                    >
                                                        {line.length > 0 ? (
                                                            <span className="text-[13px] italic whitespace-nowrap">
                                                                {line
                                                                    .map((s) =>
                                                                        formatSyllableText(
                                                                            s.text,
                                                                            s.join,
                                                                        ),
                                                                    )
                                                                    .join('  ')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {tab === 'lyrics' && (
                                            <div className="flex h-[26px] items-center">
                                                <div className="w-6 text-center font-sans text-[10px] font-bold text-[#6B6B6B]">
                                                    v2
                                                </div>
                                                {bars.map((barNo) => (
                                                    <div
                                                        key={`ly2-${barNo}`}
                                                        className="flex h-[26px] w-[165px] items-center border-l border-ink pl-2.5"
                                                    >
                                                        {barNo === 9 ? (
                                                            <span className="text-[13px] italic text-[#6B6B6B] whitespace-nowrap">
                                                                A–yɛ–yi  nwom
                                                            </span>
                                                        ) : barNo === 10 ? (
                                                            <span className="text-[13px] italic text-[#6B6B6B] whitespace-nowrap">
                                                                ma  no  daa
                                                            </span>
                                                        ) : barNo === 11 || barNo === 12 ? (
                                                            <span className="text-xs text-[#BDBDB7]">
                                                                + verse 2
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            ))}

                            {tab === 'lyrics' && (
                                <div className="relative rounded-[4px] border-[1.5px] border-dashed border-ink p-3.5">
                                    <div className="flex flex-col gap-1 text-[13px] leading-[19px]">
                                        <p>Verse 2: sing “Ayɛyi nwom” in bar 9 in place of “Onyame ye”.</p>
                                        <p>
                                            NB: Written for highlife band. You may perform it as an
                                            anthem with your own orchestration.
                                        </p>
                                    </div>
                                    <div className="absolute -top-2.5 right-2 rounded-[4px] bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper">
                                        Footnote
                                    </div>
                                </div>
                            )}
                        </div>

                        {tab === 'notes' && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                                <div className="flex items-center gap-3.5 rounded-2xl bg-ink px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
                                    <div className="flex gap-1">
                                        {PALETTE.map((item) => (
                                            <button
                                                key={item.label}
                                                className={cn(
                                                    'flex h-11 w-10 flex-col items-center justify-center rounded-lg',
                                                    item.label === 'm'
                                                        ? 'bg-marker text-ink'
                                                        : 'bg-white/10 text-paper',
                                                )}
                                            >
                                                <span className="font-solfa text-base">
                                                    {item.label}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'text-[10px]',
                                                        item.label === 'm'
                                                            ? 'text-black/55'
                                                            : 'text-white/50',
                                                    )}
                                                >
                                                    {item.key}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="h-8 w-px bg-white/15" />
                                    <div className="flex gap-1">
                                        {OCTAVES.map((item) => (
                                            <button
                                                key={item.label}
                                                className="flex h-11 w-10 flex-col items-center justify-center rounded-lg bg-white/10 text-paper"
                                            >
                                                <span className="font-solfa text-base">
                                                    {item.label}
                                                </span>
                                                <span className="text-[10px] text-white/50">
                                                    {item.key}
                                                </span>
                                            </button>
                                        ))}
                                        {ALTER.map((item) => (
                                            <button
                                                key={item.label}
                                                className="flex h-11 w-10 flex-col items-center justify-center rounded-lg bg-white/10 text-paper"
                                            >
                                                <span className="font-solfa text-base">
                                                    {item.label}
                                                </span>
                                                <span className="text-[10px] text-white/50">
                                                    {item.key}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="h-8 w-px bg-white/15" />
                                    <div className="flex gap-1">
                                        {REST.map((item) => (
                                            <button
                                                key={item.label}
                                                className="flex h-11 w-10 flex-col items-center justify-center rounded-lg bg-white/10 text-paper"
                                            >
                                                <span className="font-solfa text-base">
                                                    {item.label}
                                                </span>
                                                <span className="text-[10px] text-white/50">
                                                    {item.key}
                                                </span>
                                            </button>
                                        ))}
                                        <button className="flex h-11 w-[52px] flex-col items-center justify-center rounded-lg bg-white/10 text-paper">
                                            <span className="text-xs font-semibold">
                                                Rest
                                            </span>
                                            <span className="text-[10px] text-white/50">
                                                X
                                            </span>
                                        </button>
                                    </div>
                                    <button className="flex h-11 items-center gap-2 rounded-[10px] bg-paper px-3.5 text-sm font-semibold text-ink">
                                        Next beat
                                        <span className="rounded-[4px] border border-rule px-1.5 py-0.5 text-[11px] text-pencil">
                                            Tab
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {tab === 'lyrics' && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                                <div className="flex items-center gap-3 rounded-2xl bg-ink px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
                                    <div className="flex gap-1">
                                        <button className="flex h-11 flex-col items-start justify-center rounded-lg bg-marker px-3">
                                            <span className="text-[13px] font-semibold text-ink">
                                                Lyric
                                            </span>
                                            <span className="text-[10px] text-black/55">
                                                Verse 1
                                            </span>
                                        </button>
                                        <button className="flex h-11 flex-col items-start justify-center rounded-lg bg-white/10 px-3 text-paper">
                                            <span className="text-[13px] font-semibold">
                                                + Verse
                                            </span>
                                            <span className="text-[10px] text-white/50">
                                                new line
                                            </span>
                                        </button>
                                    </div>
                                    <div className="h-8 w-px bg-white/15" />
                                    <div className="flex gap-1">
                                        <button className="flex h-11 w-10 items-center justify-center rounded-lg bg-white/10 text-paper">
                                            <span className="text-lg">–</span>
                                        </button>
                                        <button className="flex h-11 w-10 items-center justify-center rounded-lg bg-white/10 text-paper">
                                            <span className="text-lg tracking-[-0.2em]">__</span>
                                        </button>
                                        <button className="flex h-11 w-10 items-center justify-center rounded-lg bg-white/10 font-sans text-lg text-paper">
                                            ɛ
                                        </button>
                                        <button className="flex h-11 w-10 items-center justify-center rounded-lg bg-white/10 font-sans text-lg text-paper">
                                            ɔ
                                        </button>
                                        <button className="flex h-11 w-10 items-center justify-center rounded-lg bg-white/10 font-sans text-lg text-paper">
                                            ŋ
                                        </button>
                                    </div>
                                    <div className="h-8 w-px bg-white/15" />
                                    <div className="flex gap-1">
                                        <button className="flex h-11 w-10 items-center justify-center rounded-lg bg-white/10 font-['Georgia'] text-lg font-bold italic text-paper">
                                            f
                                        </button>
                                        <button className="flex h-11 items-center justify-center rounded-lg bg-white/10 px-3 text-sm italic text-paper">
                                            rit.
                                        </button>
                                        <button className="flex h-11 items-center justify-center rounded-lg bg-white/10 px-3 font-solfa text-[13px] text-paper">
                                            D.S.
                                        </button>
                                        <button className="flex h-11 items-center justify-center rounded-lg bg-white/10 px-3 text-sm font-semibold text-paper">
                                            Text
                                        </button>
                                        <button className="flex h-11 items-center justify-center rounded-lg bg-white/10 px-3 text-sm font-semibold text-paper">
                                            Footnote
                                        </button>
                                    </div>
                                    <button className="flex h-11 items-center gap-2 rounded-[10px] bg-paper px-3.5 text-sm font-semibold text-ink">
                                        Next note
                                        <span className="rounded-[4px] border border-rule px-1.5 py-0.5 text-[11px] text-pencil">
                                            Space
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </main>

                    <aside className="flex w-[300px] shrink-0 flex-col gap-6 border-l border-rule bg-paper px-5 py-6">
                        {tab === 'notes' && (
                            <>
                                <section>
                                    <div className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                        SELECTED
                                    </div>
                                    <div className="flex items-end gap-3.5">
                                        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[12px] bg-marker">
                                            <span className="font-solfa text-4xl">
                                                {cursorNote
                                                    ? cursorNote.pitch === 'rest'
                                                        ? '–'
                                                        : cursorNote.pitch
                                                    : 'm'}
                                            </span>
                                        </div>
                                        <div className="pb-1">
                                            <div className="text-base font-semibold">
                                                {partName(cursor.part)} · bar {cursor.bar}
                                            </div>
                                            <div className="text-[13px] text-pencil">
                                                Beat {cursor.beat} · 1 beat long
                                            </div>
                                            <div className="text-[13px] text-pencil">
                                                Sounds {cursorSounds}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="border-t border-rule pt-5">
                                    <div className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                        BAR {cursor.bar} · BEAT {cursor.beat}, ALL PARTS
                                    </div>
                                    <div className="flex flex-col">
                                        {bar10Beat3.map((row) => (
                                            <div
                                                key={row.voice}
                                                className={cn(
                                                    'flex items-center justify-between rounded-[6px] px-2 py-1.5',
                                                    row.active && 'bg-copy',
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'text-[13px]',
                                                        row.empty
                                                            ? 'text-pencil'
                                                            : 'text-ink',
                                                        row.active && 'font-semibold',
                                                    )}
                                                >
                                                    {row.label}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'font-solfa',
                                                        row.empty
                                                            ? 'text-pencil'
                                                            : 'text-ink',
                                                    )}
                                                >
                                                    {row.note}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex items-start gap-2.5 rounded-[12px] bg-copy p-3">
                                        <span className="font-display text-[22px] font-extrabold">
                                            I
                                        </span>
                                        <p className="text-[13px] leading-[18px]">
                                            Home chord so far (d · m · s). Tenor on d,
                                            bass on d₁ would complete it.
                                        </p>
                                    </div>
                                </section>

                                <section className="border-t border-rule pt-5">
                                    <div className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                        FILL FASTER
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button className="flex items-center gap-2.5 rounded-full bg-ink px-3.5 py-2.5 text-sm font-semibold text-paper">
                                            <svg
                                                width="15"
                                                height="15"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"
                                                    fill="var(--color-marker)"
                                                />
                                            </svg>
                                            Suggest alto for bars 10–12
                                        </button>
                                        <button className="flex items-center justify-between rounded-full border border-rule px-3.5 py-2 text-sm">
                                            <span>Copy rhythm from soprano</span>
                                            <span className="text-[11px] text-pencil">
                                                ⌘ R
                                            </span>
                                        </button>
                                        <button className="flex items-center justify-between rounded-full border border-rule px-3.5 py-2 text-sm">
                                            <span>Repeat bars 5–8 here</span>
                                            <span className="text-[11px] text-pencil">
                                                ⌘ D
                                            </span>
                                        </button>
                                    </div>
                                </section>
                            </>
                        )}

                        {tab === 'lyrics' && (
                            <>
                                <section>
                                    <div className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                        TYPING
                                    </div>
                                    <div className="mb-3">
                                        <div className="text-base font-semibold">
                                            Verse 1 · bar 11
                                        </div>
                                        <div className="text-[13px] text-pencil">
                                            Following the soprano's notes
                                        </div>
                                    </div>
                                    <div className="flex flex-col rounded-[12px] bg-copy">
                                        <div className="flex items-center justify-between px-3 py-1.5">
                                            <span className="font-solfa text-sm">r</span>
                                            <span className="text-sm italic">ɔ–</span>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-1.5">
                                            <span className="font-solfa text-sm">m</span>
                                            <span className="text-sm italic">dɔ</span>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-1.5">
                                            <span className="font-solfa text-sm">.r</span>
                                            <span className="text-sm italic">me</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-[6px] bg-marker px-3 py-1.5">
                                            <span className="font-solfa text-sm">d :–</span>
                                            <span className="text-sm italic">daa ___</span>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-xs leading-[18px] text-pencil">
                                        Type a syllable, then Space to move to the next note. Type “-” to split a word across notes.
                                    </p>
                                </section>

                                <section className="border-t border-rule pt-5">
                                    <div className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                        WORDS SHOW UNDER
                                    </div>
                                    <div className="mb-2 flex rounded-full bg-copy p-1">
                                        <div className="flex flex-1 items-center justify-center rounded-full bg-paper py-1.5 text-[13px] font-semibold">
                                            S + A
                                        </div>
                                        <div className="flex flex-1 items-center justify-center py-1.5 text-[13px] text-pencil">
                                            T + B
                                        </div>
                                        <div className="flex flex-1 items-center justify-center py-1.5 text-[13px] text-pencil">
                                            Each part
                                        </div>
                                    </div>
                                    <p className="text-xs leading-[18px] text-pencil">
                                        Use “Each part” when the men sing different words, like a call and response.
                                    </p>
                                </section>

                                <section className="border-t border-rule pt-5">
                                    <div className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-pencil uppercase">
                                        VERSES
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <button className="flex items-center justify-between rounded-[6px] bg-copy px-2 py-2">
                                            <span className="text-sm font-semibold">
                                                Verse 1 · Twi
                                            </span>
                                            <span className="font-solfa text-xs text-pencil">
                                                11/16
                                            </span>
                                        </button>
                                        <button className="flex items-center justify-between rounded-[6px] px-2 py-2">
                                            <span className="text-sm">Verse 2 · Twi</span>
                                            <span className="font-solfa text-xs text-pencil">
                                                2/16
                                            </span>
                                        </button>
                                        <button className="flex items-center justify-between rounded-[6px] px-2 py-2">
                                            <span className="text-sm text-pencil">
                                                + English translation
                                            </span>
                                        </button>
                                    </div>
                                </section>
                            </>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}
