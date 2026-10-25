import { useCallback, useRef, useState } from 'react';
import { ChevronDownIcon, PlayIcon, StopIcon } from '@/components/icons';
import { VOICE_NAMES } from '@/lib/music';
import { useDismiss } from '@/lib/use-dismiss';
import { cn } from '@/lib/utils';
import type { Voice } from '@/types/score';

/** "All", "S", "S + A" — what the parts half of the button says. */
function heardLabel(parts: Voice[], heard: Voice[]): string {
    const on = parts.filter((v) => heard.includes(v));

    if (on.length === parts.length) return 'All';
    if (on.length === 0) return 'None';

    return on.join(' + ');
}

/**
 * Play / Stop with a parts menu beside it: hear every part, one part, or
 * any mix. Changing the parts while playing takes effect straight away.
 */
export function PlayButton({
    label,
    stopLabel = 'Stop',
    playing,
    onPlay,
    parts,
    heard,
    onHeard,
    activePart,
}: {
    label: string;
    stopLabel?: string;
    playing: boolean;
    onPlay: () => void;
    parts: Voice[];
    heard: Voice[];
    onHeard: (voices: Voice[]) => void;
    activePart: Voice;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const close = useCallback(() => setOpen(false), []);

    useDismiss(ref, open, close);

    const toggle = (voice: Voice) =>
        onHeard(heard.includes(voice) ? heard.filter((v) => v !== voice) : parts.filter((v) => v === voice || heard.includes(v)));

    const all = parts.every((v) => heard.includes(v));
    const only = (voice: Voice) => heard.length === 1 && heard[0] === voice;

    return (
        <div ref={ref} className="relative flex h-9 items-center rounded-full bg-copy">
            <button
                type="button"
                onClick={onPlay}
                disabled={heard.length === 0 && !playing}
                className="flex h-9 items-center gap-2 rounded-l-full pr-3 pl-3.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:text-faint"
            >
                {playing ? <StopIcon /> : <PlayIcon />}
                <span className="text-[14px] leading-4.5 font-semibold tabular-nums">{playing ? stopLabel : label}</span>
            </button>
            <div className="h-4.5 w-px bg-rule" />
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Choose parts to hear"
                className="flex h-9 items-center gap-1 rounded-r-full pr-3 pl-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
            >
                <span className="font-display text-[13px] leading-4 font-bold">{heardLabel(parts, heard)}</span>
                <ChevronDownIcon size={13} className="text-pencil" />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute top-[calc(100%+8px)] right-0 z-50 w-64 rounded-md border border-rule bg-paper p-1.5 shadow-[0_20px_50px_#00000024]"
                >
                    <p className="px-2.5 pt-1.5 pb-2 text-[11px] leading-3.5 font-semibold tracking-[0.06em] text-pencil uppercase">
                        Parts to hear
                    </p>

                    {parts.map((voice) => {
                        const on = heard.includes(voice);

                        return (
                            <div key={voice} className="flex items-center rounded-[8px] hover:bg-copy">
                                <button
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={on}
                                    onClick={() => toggle(voice)}
                                    className="flex h-9 grow items-center gap-2.5 px-2.5 text-left outline-none focus-visible:bg-copy"
                                >
                                    <span
                                        className={cn(
                                            'flex size-6 items-center justify-center rounded-[6px] font-display text-[12px] leading-4 font-extrabold',
                                            on ? 'bg-ink text-paper' : 'border border-rule text-faint',
                                        )}
                                    >
                                        {voice}
                                    </span>
                                    <span className={cn('text-[13.5px] leading-4.5 font-medium', on ? 'text-ink' : 'text-pencil')}>
                                        {VOICE_NAMES[voice]}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => onHeard([voice])}
                                    disabled={only(voice)}
                                    className="mr-1.5 h-7 rounded-full px-2.5 text-[12px] leading-4 font-semibold text-pencil outline-none hover:bg-paper hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/20 disabled:text-faint disabled:hover:bg-transparent"
                                >
                                    Only
                                </button>
                            </div>
                        );
                    })}

                    <div className="my-1 h-px bg-rule" />

                    <div className="flex gap-1 p-1">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => onHeard(parts)}
                            disabled={all}
                            className="h-8 grow rounded-full bg-copy text-[12.5px] leading-4 font-semibold text-ink outline-none hover:bg-rule focus-visible:ring-2 focus-visible:ring-ink/20 disabled:text-faint disabled:hover:bg-copy"
                        >
                            All parts
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => onHeard([activePart])}
                            disabled={only(activePart)}
                            className="h-8 grow rounded-full bg-copy text-[12.5px] leading-4 font-semibold text-ink outline-none hover:bg-rule focus-visible:ring-2 focus-visible:ring-ink/20 disabled:text-faint disabled:hover:bg-copy"
                        >
                            Only {VOICE_NAMES[activePart].toLowerCase()}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
