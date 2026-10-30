import { Head, Link } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PrintView } from '@/components/editor/print-view';
import { Sheet } from '@/components/editor/sheet';
import { LoopIcon, PrintIcon, RepeatIcon } from '@/components/icons';
import { PublicTopBar } from '@/components/public/public-chrome';
import { wordsPart } from '@/lib/editor';
import { requestJson } from '@/lib/http';
import { beatsInBar, formatBar, keyLabel, partOf, performanceOrder, timeLabel, tempoAt, VOICE_NAMES } from '@/lib/music';
import type { PlayStep } from '@/lib/music';
import { play } from '@/lib/player';
import type { Playback } from '@/lib/player';
import { audio } from '@/lib/tone';
import { cn } from '@/lib/utils';
import type { PublicScoreProps, Voice } from '@/types';

type Mix = 'everyone' | 'mine' | 'without';
type Passage = { from: number; to: number };

const SPEEDS = [0.5, 0.75, 1] as const;
const MIXES: { mix: Mix; label: string }[] = [
    { mix: 'everyone', label: 'Everyone' },
    { mix: 'mine', label: 'Just mine' },
    { mix: 'without', label: 'Without me' },
];

/** How loud each part plays: your part loud and the others soft, yours alone, or everyone but you. */
function levelsFor(voices: Voice[], mine: Voice | null, mix: Mix): Partial<Record<Voice, number>> {
    return Object.fromEntries(
        voices.map((voice) => {
            if (mine === null) return [voice, 1];
            if (mix === 'mine') return [voice, voice === mine ? 1 : 0];
            if (mix === 'without') return [voice, voice === mine ? 0 : 1];

            return [voice, voice === mine ? 1 : 0.35];
        }),
    );
}

function clock(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));

    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function remember(key: string, value: string | null) {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch {
        // Only a convenience.
    }
}

function recall(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * A published song (Paper W14, W15): read the score, choose your part,
 * play it with the others soft (or alone, or without you), slow it down,
 * repeat a passage, and print it. No account needed.
 */
export default function PublicScore({ song, document, doh, can, signed_in }: PublicScoreProps) {
    const voices = useMemo(() => document.parts.map((p) => p.id).filter((v) => song.voices.includes(v)), [document, song.voices]);
    const [mine, setMine] = useState<Voice | null>(null);
    const [mix, setMix] = useState<Mix>('everyone');
    const [speed, setSpeed] = useState<number>(1);
    const [passage, setPassage] = useState<Passage | null>(null);
    const [view, setView] = useState<'mine' | 'all'>('mine');
    const [playback, setPlayback] = useState<Playback | null>(null);
    const [step, setStep] = useState<PlayStep | null>(null);
    const [progress, setProgress] = useState({ at: 0, total: 0 });
    const [printing, setPrinting] = useState(false);
    const [copied, setCopied] = useState(false);
    const counted = useRef(false);
    const loop = useRef<Passage | null>(null);
    const timer = useRef<number | null>(null);
    // A repeating passage starts again from the timer, so it reads the latest choices from here.
    const live = useRef({ mine, mix });

    useEffect(() => {
        live.current = { mine, mix };
    }, [mine, mix]);

    // Remember which part this singer sings, per song.
    useEffect(() => {
        const saved = recall(`solfa.sing.${song.slug}`) as Voice | null;
        if (saved && voices.includes(saved)) setMine(saved);
    }, [song.slug, voices]);

    const choose = (voice: Voice) => {
        const next = mine === voice ? null : voice;
        setMine(next);
        remember(`solfa.sing.${song.slug}`, next);
        playback?.mix(levelsFor(voices, next, mix));
    };

    const changeMix = (next: Mix) => {
        setMix(next);
        playback?.mix(levelsFor(voices, mine, next));
    };

    const stop = useCallback(() => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
        playback?.stop();
        setPlayback(null);
        setStep(null);
    }, [playback]);

    const start = (atSpeed = speed, range: Passage | null = loop.current) => {
        if (!can.play) return;

        playback?.stop();
        if (timer.current !== null) window.clearTimeout(timer.current);

        const steps: PlayStep[] = range
            ? Array.from({ length: range.to - range.from + 1 }, (_, i) => ({ bar: range.from + i, pass: 1 }))
            : performanceOrder(document, 1);
        const begin = audio().currentTime;
        const p = play(document, doh, steps, voices, { levels: levelsFor(voices, live.current.mine, live.current.mix), speed: atSpeed });
        setPlayback(p);
        setProgress({ at: 0, total: p.endsAt - begin });

        if (!counted.current) {
            counted.current = true;
            void requestJson('POST', `/p/${song.slug}/played`).catch(() => undefined);
        }

        // At the end: go round the passage again, or stop.
        const ms = Math.max(0, (p.endsAt - audio().currentTime) * 1000);
        timer.current = window.setTimeout(() => {
            if (loop.current) start(atSpeed, loop.current);
            else {
                setPlayback((current) => (current === p ? null : current));
                setStep(null);
            }
        }, ms + 120);
    };

    // The time line under the player.
    useEffect(() => {
        if (!playback) return;

        const begin = playback.timeline[0]?.at ?? audio().currentTime;
        const id = window.setInterval(() => setProgress({ at: audio().currentTime - begin, total: playback.endsAt - begin }), 250);

        return () => window.clearInterval(id);
    }, [playback]);

    useEffect(() => () => playback?.stop(), [playback]);

    const changeSpeed = (next: number) => {
        setSpeed(next);
        if (playback) start(next);
    };

    const changePassage = (next: Passage | null) => {
        setPassage(next);
        loop.current = next;
        if (playback) start(speed, next);
    };

    const copyLink = async () => {
        await navigator.clipboard?.writeText(song.url).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    const bpm = tempoAt(document.map, 1);
    const playing = playback !== null;
    const barNow = step?.bar ?? null;
    const lyricsPart = mine ? wordsPart(document, mine) : wordsPart(document, voices[0] ?? 'S');
    const words = (bar: number) =>
        (document.verses[0]?.syllables ?? [])
            .filter((s) => s.part === lyricsPart && s.bar === bar)
            .sort((a, b) => a.beat - b.beat)
            .map((s) => s.text + (s.join === 'split' ? '–' : ''))
            .join(' ')
            .replace(/– /g, '–');

    // "Bar 10 of 16 · Chorus" and what the singer hears, for the player bar (Paper W14, W15).
    const shownBar = barNow ?? passage?.from ?? 1;
    const sectionOf = (bar: number) => document.sections.find((s) => s.ending === null && bar >= s.from && bar <= s.to)?.name ?? null;
    const hearing = !mine
        ? 'All parts'
        : mix === 'mine'
          ? `Only the ${VOICE_NAMES[mine].toLowerCase()}`
          : mix === 'without'
            ? `Everyone but the ${VOICE_NAMES[mine].toLowerCase()}`
            : `${VOICE_NAMES[mine]} louder · others soft`;

    const by = [song.composer, song.arranger ? `arr. ${song.arranger}` : null, song.style].filter(Boolean).join(' · ');

    return (
        <>
            <Head title={song.title} />

            <div className="flex h-dvh flex-col bg-copy">
                <PublicTopBar signedIn={signed_in}>
                    <span className="hidden text-[13.5px] leading-4.5 text-pencil lg:block">
                        Shared by <span className="font-semibold text-ink">{song.owner}</span>
                    </span>
                    {song.is_owner && song.score_id && (
                        <Link href={`/scores/${song.score_id}`} className="hidden h-9.5 items-center rounded-full border border-rule bg-paper px-3.5 text-[13.5px] leading-4.5 font-semibold text-ink hover:border-ink sm:flex">
                            Edit
                        </Link>
                    )}
                    {can.print && (
                        <button
                            type="button"
                            onClick={() => setPrinting(true)}
                            className="hidden h-9.5 items-center gap-2 rounded-full border border-rule bg-paper px-3.5 text-[13.5px] leading-4.5 font-semibold text-ink hover:border-ink sm:flex"
                        >
                            <PrintIcon size={15} /> Print or PDF
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={copyLink}
                        className="hidden h-9.5 items-center rounded-full border border-rule bg-paper px-3.5 text-[13.5px] leading-4.5 font-semibold text-ink hover:border-ink md:flex"
                    >
                        {copied ? 'Copied' : 'Copy link'}
                    </button>
                </PublicTopBar>

                <div className="flex min-h-0 grow">
                    {/* Practise panel (Paper W14) */}
                    <aside className="hidden w-75 shrink-0 flex-col gap-6 overflow-y-auto border-r border-rule bg-paper px-5 py-6 lg:flex">
                        <div className="flex flex-col gap-1">
                            <h1 className="font-display text-[24px] leading-7 font-extrabold tracking-[-0.02em] text-ink">{song.title}</h1>
                            <div className="text-[13px] leading-4.5 text-pencil">{by}</div>
                            <div className="font-solfa text-[12px] leading-4 text-ink">
                                Doh is {keyLabel(doh)} · {timeLabel(beatsInBar(document.map, 1))} · ♩ {bpm}
                            </div>
                        </div>

                        <PartPicker voices={voices} mine={mine} onChoose={choose} />

                        {can.play && (
                            <>
                                <div className="flex flex-col gap-2 border-t border-rule pt-5">
                                    <div className="pb-0.5 text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">WHAT YOU HEAR</div>
                                    {voices.map((voice) => {
                                        const level = levelsFor(voices, mine, mix)[voice] ?? 1;

                                        return (
                                            <div key={voice} className="flex h-7 items-center gap-2.5">
                                                <span className={cn('w-16 text-[13px] leading-4', voice === mine ? 'font-semibold text-ink' : level === 0 ? 'text-pencil' : 'text-ink')}>
                                                    {VOICE_NAMES[voice]}
                                                </span>
                                                <span className="flex h-1 grow rounded-full bg-rule">
                                                    <span className={cn('h-1 rounded-full', voice === mine ? 'bg-ink' : 'bg-[#9A9A94]')} style={{ width: `${level * 90}%` }} />
                                                </span>
                                                <span className={cn('w-10 text-right text-[11.5px] leading-3.5', voice === mine ? 'font-semibold text-ink' : 'text-pencil')}>
                                                    {voice === mine ? 'Mine' : level === 0 ? 'Off' : level < 1 ? 'Soft' : 'Full'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex gap-1.5 pt-1">
                                        {MIXES.map((item) => (
                                            <button
                                                key={item.mix}
                                                type="button"
                                                disabled={mine === null}
                                                onClick={() => changeMix(item.mix)}
                                                className={cn(
                                                    'flex h-7.5 items-center rounded-full px-2.5 text-[12px] leading-4 whitespace-nowrap disabled:opacity-40',
                                                    mix === item.mix ? 'bg-ink font-semibold text-paper' : 'border border-rule font-medium text-ink hover:border-ink',
                                                )}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                    {mine === null && <p className="text-[12px] leading-4 text-pencil">Pick your part above to make it stand out.</p>}
                                </div>

                                <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
                                    <div className="flex justify-between">
                                        <span className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">SPEED</span>
                                        <span className="font-solfa text-[11.5px] leading-3.5 text-pencil">
                                            ♩ {Math.round(bpm * speed)}
                                            {speed !== 1 ? ` · written ${bpm}` : ''}
                                        </span>
                                    </div>
                                    <SpeedSwitch speed={speed} onChange={changeSpeed} />
                                </div>

                                <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
                                    <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">PRACTISE A PASSAGE</div>
                                    <PassagePicker bars={document.bars} passage={passage} onChange={changePassage} />
                                </div>
                            </>
                        )}
                    </aside>

                    <main className="flex min-w-0 grow flex-col">
                        {/* Phone header (Paper W15) */}
                        <div className="flex flex-col gap-3 border-b border-rule bg-paper px-4 pt-4 pb-3.5 lg:hidden">
                            <div className="flex flex-col gap-0.5">
                                <h1 className="font-display text-[26px] leading-7.5 font-extrabold tracking-[-0.02em] text-ink">{song.title}</h1>
                                <div className="text-[13px] leading-4.25 text-pencil">
                                    {by} · <span className="font-solfa text-ink">Doh is {keyLabel(doh)}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <div className="flex gap-0.75 rounded-full bg-copy p-0.75">
                                    {voices.map((voice) => (
                                        <button
                                            key={voice}
                                            type="button"
                                            onClick={() => choose(voice)}
                                            aria-pressed={mine === voice}
                                            className={cn(
                                                'flex h-7 w-8.5 items-center justify-center rounded-full font-display text-[12.5px] leading-3.5 font-extrabold',
                                                mine === voice ? 'bg-marker text-ink' : 'text-pencil',
                                            )}
                                        >
                                            {voice}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex grow gap-0.5 rounded-full bg-copy p-0.75">
                                    {(['mine', 'all'] as const).map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => setView(v)}
                                            className={cn(
                                                'flex h-7 grow items-center justify-center rounded-full px-3 text-[12px] leading-4',
                                                view === v ? 'bg-paper font-semibold text-ink' : 'text-pencil',
                                            )}
                                        >
                                            {v === 'mine' ? (mine ? 'My line' : 'Melody') : 'All parts'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex min-h-0 grow flex-col overflow-auto pb-32">
                            {/* My line, big, two bars a row (phones) */}
                            <div className={cn('flex-col gap-1.5 bg-paper px-4 pt-3.5 lg:hidden', view === 'mine' ? 'flex' : 'hidden')}>
                                <MyLine
                                    document={document}
                                    voice={mine ?? voices[0] ?? 'S'}
                                    words={words}
                                    playing={barNow}
                                    passage={passage}
                                    onBar={(bar) => changePassage(passage && passage.from === bar && passage.to === bar ? null : { from: bar, to: Math.min(document.bars, bar + 3) })}
                                />
                            </div>

                            {/* The full score */}
                            <div className={cn('grow flex-col items-center px-4 pt-6 sm:px-8 lg:flex', view === 'all' ? 'flex' : 'hidden')}>
                                <div className="max-w-full overflow-x-auto">
                                    <Sheet
                                        document={document}
                                        title={song.title}
                                        composer={song.composer}
                                        arranger={song.arranger}
                                        doh={doh}
                                        mode="notes"
                                        cursor={{ part: 'S', bar: 0, beat: 0 }}
                                        lyricCursor={{ verse: -1, part: 'S', bar: 0, beat: 0 }}
                                        canEdit={false}
                                        onCell={() => undefined}
                                        onWords={() => undefined}
                                        onBarNumber={() => undefined}
                                        popoverBar={null}
                                        popover={null}
                                        playback={playback}
                                        onPlayingBar={setStep}
                                        focusPart={mine}
                                    />
                                </div>
                            </div>
                        </div>
                    </main>
                </div>

                {can.play && (
                    <div className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center sm:bottom-6 sm:px-4 lg:pl-75">
                        <PlayerBar
                            playing={playing}
                            onPlay={() => (playing ? stop() : start())}
                            bar={shownBar}
                            bars={document.bars}
                            section={sectionOf(shownBar)}
                            hearing={hearing}
                            progress={progress}
                            voices={voices}
                            mine={mine}
                            levels={levelsFor(voices, mine, mix)}
                            onChoose={choose}
                            speed={speed}
                            onSpeed={() => changeSpeed(SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])}
                            passage={passage}
                            onClearPassage={() => changePassage(null)}
                        />
                    </div>
                )}
            </div>

            {printing && (
                <PrintView document={document} title={song.title} composer={song.composer} arranger={song.arranger} doh={doh} onClose={() => setPrinting(false)} />
            )}
        </>
    );
}

/**
 * The practice player (Paper W14 on a computer, W15 on a phone): play,
 * where you are ("Bar 10 of 16 · Chorus"), the time line, the parts with
 * yours in yellow, the speed, and the passage being repeated.
 */
function PlayerBar({
    playing,
    onPlay,
    bar,
    bars,
    section,
    hearing,
    progress,
    voices,
    mine,
    levels,
    onChoose,
    speed,
    onSpeed,
    passage,
    onClearPassage,
}: {
    playing: boolean;
    onPlay: () => void;
    bar: number;
    bars: number;
    section: string | null;
    hearing: string;
    progress: { at: number; total: number };
    voices: Voice[];
    mine: Voice | null;
    levels: Partial<Record<Voice, number>>;
    onChoose: (voice: Voice) => void;
    speed: number;
    onSpeed: () => void;
    passage: Passage | null;
    onClearPassage: () => void;
}) {
    const done = `${progress.total > 0 ? Math.min(100, (progress.at / progress.total) * 100) : 0}%`;

    return (
        <div className="pointer-events-auto flex w-full max-w-196 flex-col gap-3 rounded-t-[20px] bg-ink px-4 pt-3.5 pb-7.5 shadow-[0_-10px_30px_#00000030] sm:h-18 sm:flex-row sm:items-center sm:gap-4 sm:rounded-[18px] sm:py-0 sm:pr-3.5 sm:pl-3 sm:shadow-[0_16px_40px_#00000040]">
            {/* On a phone the time line runs along the top. */}
            <div className="flex h-1 shrink-0 rounded-full bg-paper/15 sm:hidden">
                <div className="h-1 rounded-full bg-marker" style={{ width: done }} />
            </div>

            <div className="flex min-w-0 grow items-center gap-3 sm:gap-4">
                <button
                    type="button"
                    onClick={onPlay}
                    aria-label={playing ? 'Stop' : 'Play'}
                    className="flex size-13 shrink-0 items-center justify-center rounded-full bg-marker outline-none hover:bg-[#EADF12] focus-visible:ring-2 focus-visible:ring-paper/60 sm:size-12"
                >
                    {playing ? (
                        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                            <rect x="3.5" y="3" width="3" height="10" rx="1" fill="#111111" />
                            <rect x="9.5" y="3" width="3" height="10" rx="1" fill="#111111" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M5 3 13 8l-8 5z" fill="#111111" />
                        </svg>
                    )}
                </button>

                {/* Phone: "Bar 10 · Chorus" over what you hear. */}
                <div className="flex min-w-0 grow flex-col gap-0.5 sm:hidden">
                    <span className="truncate text-[14px] leading-4.5 font-semibold text-paper">
                        Bar {bar}
                        {section ? ` · ${section}` : ''}
                    </span>
                    <span className="truncate text-[12px] leading-4 text-paper/60">{hearing}</span>
                </div>

                {/* Computer: "Bar 10 of 16 · Chorus", the time, and the time line. */}
                <div className="hidden min-w-0 grow flex-col gap-2 sm:flex">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[14px] leading-4.5 font-semibold text-paper">
                            Bar {bar}
                            <span className="font-normal text-paper/50">
                                {' '}
                                of {bars}
                                {section ? ` · ${section}` : ''}
                            </span>
                        </span>
                        <span className="shrink-0 font-solfa text-[12px] leading-4 text-paper/60">
                            {clock(progress.at)} / {clock(progress.total)}
                        </span>
                    </div>
                    <div className="flex h-1 rounded-full bg-paper/15">
                        <div className="h-1 rounded-full bg-marker" style={{ width: done }} />
                    </div>
                </div>

                <span className="hidden h-8 w-px shrink-0 bg-paper/15 sm:block" />

                {/* The parts: yours in yellow, the others grey, a part you don't hear dashed. Tap to choose yours. */}
                <div className="hidden shrink-0 items-center gap-1 sm:flex">
                    {voices.map((voice) => {
                        const level = levels[voice] ?? 1;

                        return (
                            <button
                                key={voice}
                                type="button"
                                onClick={() => onChoose(voice)}
                                aria-pressed={mine === voice}
                                title={mine === voice ? `You sing ${VOICE_NAMES[voice].toLowerCase()}` : `I sing ${VOICE_NAMES[voice].toLowerCase()}`}
                                className={cn(
                                    'flex h-7 w-7.5 items-center justify-center rounded-[7px] font-display text-[12px] leading-3.5 font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-paper/50',
                                    mine === voice
                                        ? 'bg-marker text-ink'
                                        : level === 0
                                          ? 'border border-dashed border-paper/25 text-paper/25'
                                          : 'bg-paper/8 text-paper/50 hover:text-paper',
                                )}
                            >
                                {voice}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={onSpeed}
                    title="Speed — tap to change"
                    className="flex h-8 shrink-0 items-center rounded-full bg-paper/10 px-2.5 text-[12.5px] leading-4 font-semibold text-paper outline-none hover:bg-paper/20 focus-visible:ring-2 focus-visible:ring-paper/50"
                >
                    {Math.round(speed * 100)}%
                </button>

                {passage && (
                    <button
                        type="button"
                        onClick={onClearPassage}
                        title="Stop repeating"
                        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-marker px-2.5 text-[12.5px] leading-4 font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-paper/50"
                    >
                        <RepeatIcon size={13} strokeWidth={1.8} />
                        {passage.from}–{passage.to}
                    </button>
                )}
            </div>
        </div>
    );
}

function PartPicker({ voices, mine, onChoose }: { voices: Voice[]; mine: Voice | null; onChoose: (voice: Voice) => void }) {
    return (
        <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
            <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">I SING</div>
            <div className="flex gap-1 rounded-md bg-copy p-1">
                {voices.map((voice) => (
                    <button
                        key={voice}
                        type="button"
                        onClick={() => onChoose(voice)}
                        aria-pressed={mine === voice}
                        className={cn(
                            'flex h-11.5 grow basis-0 flex-col items-center justify-center rounded-[9px] outline-none focus-visible:ring-2 focus-visible:ring-ink/25',
                            mine === voice ? 'bg-marker shadow-[0_0_0_1.5px_#111111]' : 'hover:bg-paper/60',
                        )}
                    >
                        <span className="font-display text-[15px] leading-4.5 font-extrabold text-ink">{voice}</span>
                        <span className={cn('text-[10.5px] leading-3.25', mine === voice ? 'text-ink' : 'text-pencil')}>{VOICE_NAMES[voice]}</span>
                    </button>
                ))}
            </div>
            <p className="text-[12px] leading-4.25 text-pencil">Your line stands out on the page and plays louder than the others.</p>
        </div>
    );
}

function SpeedSwitch({ speed, onChange }: { speed: number; onChange: (speed: number) => void }) {
    return (
        <div className="flex gap-0.5 rounded-full bg-copy p-0.75">
            {SPEEDS.map((s) => (
                <button
                    key={s}
                    type="button"
                    onClick={() => onChange(s)}
                    aria-pressed={speed === s}
                    className={cn('flex h-7 grow basis-0 items-center justify-center rounded-full text-[12.5px] leading-4', speed === s ? 'bg-paper font-semibold text-ink' : 'text-pencil')}
                >
                    {Math.round(s * 100)}%
                </button>
            ))}
        </div>
    );
}

function PassagePicker({ bars, passage, onChange }: { bars: number; passage: Passage | null; onChange: (passage: Passage | null) => void }) {
    const options = Array.from({ length: bars }, (_, i) => i + 1);
    const from = passage?.from ?? 1;
    const to = passage?.to ?? Math.min(bars, 4);

    return (
        <div className="flex flex-col gap-2">
            <div className={cn('flex items-center gap-2 rounded-[10px] px-3 py-2', passage ? 'bg-wash' : 'bg-copy')}>
                <LoopIcon className="text-ink" />
                <span className="text-[13px] leading-4 text-ink">Bars</span>
                <select
                    value={from}
                    onChange={(event) => {
                        const f = Number(event.target.value);
                        onChange({ from: f, to: Math.max(f, to) });
                    }}
                    aria-label="From bar"
                    className="h-7 rounded-[6px] border border-rule bg-paper px-1.5 font-solfa text-[12.5px]"
                >
                    {options.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
                <span className="text-[13px] leading-4 text-ink">to</span>
                <select
                    value={to}
                    onChange={(event) => {
                        const t = Number(event.target.value);
                        onChange({ from: Math.min(from, t), to: t });
                    }}
                    aria-label="To bar"
                    className="h-7 rounded-[6px] border border-rule bg-paper px-1.5 font-solfa text-[12.5px]"
                >
                    {options.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
                {passage && (
                    <button type="button" onClick={() => onChange(null)} aria-label="Stop repeating" className="ml-auto text-[14px] leading-4 text-[#5C4A00] hover:text-ink">
                        ×
                    </button>
                )}
            </div>
            <p className="text-[12px] leading-4.25 text-pencil">{passage ? 'Plays these bars over and over.' : 'Pick bars to repeat them over and over.'}</p>
        </div>
    );
}

/** One part, large, two bars to a row, with its words (Paper W15) — easy to read on a phone. */
function MyLine({
    document,
    voice,
    words,
    playing,
    passage,
    onBar,
}: {
    document: PublicScoreProps['document'];
    voice: Voice;
    words: (bar: number) => string;
    playing: number | null;
    passage: Passage | null;
    onBar: (bar: number) => void;
}) {
    const part = partOf(document, voice);
    const bars = Array.from({ length: document.bars }, (_, i) => i + 1);
    const rows: number[][] = [];

    for (let i = 0; i < bars.length; i += 2) rows.push(bars.slice(i, i + 2));

    return (
        <>
            <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">{VOICE_NAMES[voice].toUpperCase()}</div>
            {rows.map((row) => (
                <div key={row[0]} className="flex border-y-[1.5px] border-ink">
                    {row.map((bar) => {
                        const notes = part?.bars[bar - 1]?.notes ?? [];
                        const inPassage = passage !== null && bar >= passage.from && bar <= passage.to;

                        return (
                            <button
                                key={bar}
                                type="button"
                                onClick={() => onBar(bar)}
                                className={cn(
                                    'flex min-w-0 grow basis-0 flex-col gap-1 border-l border-ink px-2 pt-1.5 pb-2 text-left last:border-r',
                                    playing === bar ? 'bg-marker/45 outline-2 outline-ink' : inPassage && 'bg-wash',
                                )}
                            >
                                <span className="font-solfa text-[10px] leading-3 text-pencil">{bar}</span>
                                <span className="truncate font-solfa text-[17px] leading-5.5 font-bold whitespace-pre text-ink">
                                    {notes.length > 0 ? formatBar(notes, beatsInBar(document.map, bar)) : '–'}
                                </span>
                                <span className="truncate text-[13px] leading-4 text-ink italic">{words(bar)}</span>
                            </button>
                        );
                    })}
                    {row.length === 1 && <span className="grow basis-0" />}
                </div>
            ))}
            <p className="pt-2 text-[12px] leading-4 text-pencil">Tap a bar to repeat it and the three after it.</p>
        </>
    );
}
