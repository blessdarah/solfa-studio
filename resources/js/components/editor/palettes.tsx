import { cn } from '@/lib/utils';
import type { Pitch } from '@/types';

function Key({
    label,
    hint,
    active = false,
    wide = false,
    labelClass,
    onPress,
    title,
}: {
    label: string;
    hint?: string;
    active?: boolean;
    wide?: boolean;
    labelClass?: string;
    onPress: () => void;
    title?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onPress}
            className={cn(
                'flex h-11 shrink-0 flex-col items-center justify-center gap-px rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-marker',
                wide ? 'w-13' : 'w-10',
                active ? 'bg-marker' : 'bg-white/8 hover:bg-white/14',
            )}
        >
            <span className={cn(labelClass ?? 'font-solfa text-[16px] leading-5', active ? 'text-ink' : 'text-paper')}>{label}</span>
            {hint !== undefined && (
                <span className={cn('text-[10px] leading-3', active ? 'text-black/55' : 'text-white/50')}>{hint}</span>
            )}
        </button>
    );
}

function Divider() {
    return <div className="h-8 w-px shrink-0 bg-white/15" />;
}

function NextKey({ label, kbd, onPress }: { label: string; kbd: string; onPress: () => void }) {
    return (
        <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onPress}
            className="flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-paper px-3.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-marker"
        >
            <span className="text-[13px] leading-4 font-semibold text-ink">{label}</span>
            <span className="rounded-[4px] border border-rule px-1.5 py-0.5 text-[11px] leading-3.5 text-pencil">{kbd}</span>
        </button>
    );
}

const PITCHES: { pitch: Pitch; label: string; key: string }[] = [
    { pitch: 'd', label: 'd', key: 'D' },
    { pitch: 'r', label: 'r', key: 'R' },
    { pitch: 'm', label: 'm', key: 'M' },
    { pitch: 'f', label: 'f', key: 'F' },
    { pitch: 's', label: 's', key: 'S' },
    { pitch: 'l', label: 'l', key: 'L' },
    { pitch: 't', label: 't', key: 'T' },
];

export type NoteAction =
    | { type: 'pitch'; pitch: Pitch }
    | { type: 'octave'; by: -1 | 1 }
    | { type: 'chromatic'; direction: 'up' | 'down' }
    | { type: 'hold' }
    | { type: 'half' }
    | { type: 'triplet' }
    | { type: 'slur' }
    | { type: 'unslur' }
    | { type: 'rest' }
    | { type: 'next' };

/**
 * The floating note keypad (Paper W1): pitches, octave and chromatic
 * keys, hold / half-beat / rest, and Next beat. Each key shows its
 * keyboard shortcut.
 */
export function NotePalette({ current, slurred = false, onAction }: { current: Pitch | null; slurred?: boolean; onAction: (action: NoteAction) => void }) {
    return (
        <div className="flex w-max items-center gap-3.5 rounded-[16px] bg-ink px-3 py-2.5 shadow-[0_16px_40px_#00000040]">
            <div className="flex gap-1">
                {PITCHES.map((p) => (
                    <Key
                        key={p.pitch}
                        label={p.label}
                        hint={p.key}
                        active={current === p.pitch || (p.pitch === 'f' && current === 'fe') || (p.pitch === 't' && current === 'ta')}
                        onPress={() => onAction({ type: 'pitch', pitch: p.pitch })}
                    />
                ))}
            </div>
            <Divider />
            <div className="flex gap-1">
                <Key label="x₁" hint="," title="Lower octave (press twice for two: d₂)" onPress={() => onAction({ type: 'octave', by: -1 })} />
                <Key label="x'" hint="'" title="Higher octave (press twice for two: d'')" onPress={() => onAction({ type: 'octave', by: 1 })} />
                <Key label="fe" hint="↑" title="Sharpen fah" onPress={() => onAction({ type: 'chromatic', direction: 'up' })} />
                <Key label="ta" hint="↓" title="Flatten te" onPress={() => onAction({ type: 'chromatic', direction: 'down' })} />
            </div>
            <Divider />
            <div className="flex gap-1">
                <Key label="–" hint="–" title="Hold the note (inside a beat: one more quarter, d.,r)" onPress={() => onAction({ type: 'hold' })} />
                <Key label="." hint="." title="Split the note: d.r, then again for quarters d.r,m" onPress={() => onAction({ type: 'half' })} />
                <Key
                    label="⅓"
                    hint="3"
                    title="Triplet: three notes in one beat — f 3 f f gives f,f,f"
                    onPress={() => onAction({ type: 'triplet' })}
                />
                <Key
                    label="⌒"
                    hint="("
                    title="Slur into the next note — sung on one syllable. Press again to cover one more; ) takes one off"
                    active={slurred}
                    onPress={() => onAction({ type: 'slur' })}
                />
                <Key
                    label="Rest"
                    hint="Space"
                    title="Rest (Space, or X)"
                    wide
                    labelClass="text-[12px] leading-4 font-semibold"
                    onPress={() => onAction({ type: 'rest' })}
                />
            </div>
            <NextKey label="Next beat" kbd="Tab" onPress={() => onAction({ type: 'next' })} />
        </div>
    );
}

export type TextAction =
    | { type: 'verse' }
    | { type: 'add-verse' }
    | { type: 'split' }
    | { type: 'hold' }
    | { type: 'letter'; letter: string }
    | { type: 'dynamic' }
    | { type: 'rit' }
    | { type: 'ds' }
    | { type: 'text' }
    | { type: 'footnote' }
    | { type: 'next' };

function WideKey({ title, sub, active = false, onPress }: { title: string; sub: string; active?: boolean; onPress: () => void }) {
    return (
        <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onPress}
            className={cn(
                'flex h-11 flex-col items-start justify-center gap-px rounded-[8px] px-3 outline-none',
                active ? 'bg-marker' : 'bg-white/8 hover:bg-white/14',
            )}
        >
            <span className={cn('text-[13px] leading-4 font-semibold', active ? 'text-ink' : 'text-paper')}>{title}</span>
            <span className={cn('text-[10px] leading-3', active ? 'text-black/55' : 'text-white/50')}>{sub}</span>
        </button>
    );
}

function TextKey({ children, onPress, className }: { children: string; onPress: () => void; className: string }) {
    return (
        <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onPress}
            className={cn('flex h-11 items-center rounded-[8px] bg-white/8 px-3 text-paper hover:bg-white/14', className)}
        >
            {children}
        </button>
    );
}

/**
 * The floating words & text palette (Paper W2): current verse, new verse,
 * split / hold, Twi letters, f, rit., D.S., Text, Footnote and Next note.
 */
export function TextPalette({ verseLabel, onAction }: { verseLabel: string; onAction: (action: TextAction) => void }) {
    return (
        <div className="flex w-max items-center gap-3 rounded-[16px] bg-ink px-3 py-2.5 shadow-[0_16px_40px_#00000040]">
            <div className="flex gap-1">
                <WideKey title="Lyric" sub={verseLabel} active onPress={() => onAction({ type: 'verse' })} />
                <WideKey title="+ Verse" sub="new line" onPress={() => onAction({ type: 'add-verse' })} />
            </div>
            <Divider />
            <div className="flex gap-1">
                <Key label="–" hint="split" labelClass="text-[16px] leading-5" onPress={() => onAction({ type: 'split' })} />
                <Key label="__" hint="hold" labelClass="text-[16px] leading-5" onPress={() => onAction({ type: 'hold' })} />
                {['ɛ', 'ɔ', 'ŋ'].map((letter) => (
                    <Key key={letter} label={letter} labelClass="text-[17px] leading-5.5" onPress={() => onAction({ type: 'letter', letter })} />
                ))}
            </div>
            <Divider />
            <div className="flex gap-1">
                <Key
                    label="f"
                    labelClass="font-dynamic text-[17px] leading-5.5 font-bold italic"
                    title="Dynamic"
                    onPress={() => onAction({ type: 'dynamic' })}
                />
                <TextKey className="text-[13px] leading-4 italic" onPress={() => onAction({ type: 'rit' })}>
                    rit.
                </TextKey>
                <TextKey className="font-solfa text-[13px] leading-4" onPress={() => onAction({ type: 'ds' })}>
                    D.S.
                </TextKey>
                <TextKey className="text-[13px] leading-4 font-semibold" onPress={() => onAction({ type: 'text' })}>
                    Text
                </TextKey>
                <TextKey className="text-[13px] leading-4 font-semibold" onPress={() => onAction({ type: 'footnote' })}>
                    Footnote
                </TextKey>
            </div>
            <NextKey label="Next note" kbd="Space" onPress={() => onAction({ type: 'next' })} />
        </div>
    );
}
