import { Link } from '@inertiajs/react';
import { AvatarMenu } from '@/components/avatar-menu';
import { PlayButton } from '@/components/editor/play-button';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import type { EditorMode, User } from '@/types';
import type { Voice } from '@/types/score';

const MODES: { mode: EditorMode | 'check'; label: string }[] = [
    { mode: 'notes', label: 'Notes' },
    { mode: 'lyrics', label: 'Lyrics & text' },
    { mode: 'check', label: 'Check' },
];

/**
 * The compose screen's top bar (Paper W1): logo, "Scores / Onyame Ye",
 * the save state, the mode switch, Play, Share and the account initial.
 */
export function EditorTopBar({
    user,
    title,
    savedLabel,
    mode,
    onMode,
    playLabel,
    stopLabel,
    playing,
    onPlay,
    parts,
    heard,
    onHeard,
    activePart,
    onShare,
    canShare,
    onPrint,
}: {
    user: User;
    title: string;
    savedLabel: string;
    mode: EditorMode;
    onMode: (mode: EditorMode) => void;
    playLabel: string;
    stopLabel?: string;
    playing: boolean;
    onPlay: () => void;
    parts: Voice[];
    heard: Voice[];
    onHeard: (voices: Voice[]) => void;
    activePart: Voice;
    onShare: () => void;
    canShare: boolean;
    onPrint: () => void;
}) {
    return (
        <header className="flex h-15 shrink-0 items-center justify-between border-b border-rule bg-paper px-5">
            <div className="flex items-center gap-5">
                <Link href="/dashboard" className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ink/20">
                    <Logo />
                </Link>
                <div className="text-[14px] leading-4.5 text-pencil">
                    <Link href="/dashboard" className="hover:text-ink">
                        Scores
                    </Link>{' '}
                    / {title}
                </div>
                <div className="text-[13px] leading-4 text-pencil" aria-live="polite">
                    {savedLabel}
                </div>
            </div>

            <div className="flex gap-1 rounded-full bg-copy p-1" role="tablist" aria-label="Mode">
                {MODES.map((item) => {
                    const active = item.mode === mode;
                    const available = item.mode !== 'check';

                    return (
                        <button
                            key={item.mode}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            disabled={!available}
                            title={available ? undefined : 'Check mode is on its way'}
                            onClick={() => available && onMode(item.mode as EditorMode)}
                            className={cn(
                                'flex h-8 items-center rounded-full px-4.5 text-[14px] leading-4.5 outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                                active ? 'bg-ink font-semibold text-paper' : 'font-medium text-pencil',
                                available && !active && 'hover:text-ink',
                            )}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center gap-2">
                <PlayButton
                    label={playLabel}
                    stopLabel={stopLabel}
                    playing={playing}
                    onPlay={onPlay}
                    parts={parts}
                    heard={heard}
                    onHeard={onHeard}
                    activePart={activePart}
                />
                <button
                    type="button"
                    onClick={onPrint}
                    aria-label="Print"
                    title="Print (⌘ P)"
                    className="flex size-9 items-center justify-center rounded-full bg-copy text-ink outline-none hover:bg-rule focus-visible:ring-2 focus-visible:ring-ink/20"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                            d="M4.5 6V2.5h7V6M4.5 11.5h-1A1.5 1.5 0 0 1 2 10V7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V10a1.5 1.5 0 0 1-1.5 1.5h-1M4.5 9.5h7v4h-7z"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
                {canShare && (
                    <button
                        type="button"
                        onClick={onShare}
                        className="flex h-9 items-center rounded-full bg-ink px-4 text-paper outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2"
                    >
                        <span className="text-[14px] leading-4.5 font-semibold">Share</span>
                    </button>
                )}
                <AvatarMenu user={user} size="lg" />
            </div>
        </header>
    );
}
