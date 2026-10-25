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
