import { keyLabel, tempoAt, timeLabel, VOICE_NAMES, VOICES } from '@/lib/music';
import { cn } from '@/lib/utils';
import type { ScoreDocument, Voice } from '@/types';

function Heading({ children, action, onAction, disabled }: { children: string; action?: string; onAction?: () => void; disabled?: boolean }) {
    return (
        <div className="flex justify-between">
            <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">{children}</div>
            {action && (
                <button
                    type="button"
                    onClick={onAction}
                    disabled={disabled}
                    className={cn('text-[13px] leading-4 font-medium', disabled ? 'text-dot' : 'text-ink hover:underline')}
                >
                    {action}
                </button>
            )}
        </div>
    );
}

/**
 * The left rail (Paper W1): score facts, parts with their progress, and
 * the sections (with the $ sign and how it ends).
 */
export function ScoreRail({
    document,
    doh,
    activePart,
    cursorBar,
    writing,
    canEdit,
    onPart,
    onAddPart,
    onSection,
    onAddSection,
    onMapChip,
}: {
    document: ScoreDocument;
    doh: string;
    activePart: Voice;
    cursorBar: number;
    writing: boolean;
    canEdit: boolean;
    onPart: (voice: Voice) => void;
    onAddPart: () => void;
    onSection: (bar: number) => void;
    onAddSection: () => void;
    onMapChip: () => void;
}) {
    const first = document.map[0];
    const changes = document.map.filter((e) => e.bar > 1);
    const lastBeats = changes.filter((e) => e.beats !== null).at(-1)?.beats;
    const lastBpm = changes.filter((e) => e.bpm !== null).at(-1)?.bpm;

    const chips = [
        { label: `Doh is ${keyLabel(doh)}` },
        {
            label: lastBeats && lastBeats !== first.beats ? `${timeLabel(first.beats ?? 4)} → ${timeLabel(lastBeats)}` : timeLabel(first.beats ?? 4),
            map: true,
        },
        { label: lastBpm && lastBpm !== first.bpm ? `♩ ${first.bpm} → ${lastBpm}` : `♩ ${tempoAt(document.map, 1)}`, map: true },
        { label: `${document.bars} bars` },
    ];

    const segno = (bar: number) => document.marks.some((m) => m.kind === 'nav' && m.value === '$' && m.at.bar === bar);
    const nav = new Set(document.marks.filter((m) => m.kind === 'nav').map((m) => m.value));
    const ends = nav.has('DS') ? 'Ends: D.S. al Fine' : nav.has('DC') ? 'Ends: D.C. al Fine' : nav.has('Fine') ? 'Ends: Fine' : null;

    const missing = VOICES.filter((v) => !document.parts.some((p) => p.id === v));

    const sections = [...document.sections].sort((a, b) => a.from - b.from);
    const endings = sections.filter((s) => s.ending !== null);
    const merged = [
        ...sections.filter((s) => s.ending === null).map((s) => ({ name: s.name, from: s.from, to: s.to })),
        ...(endings.length > 1
            ? [{ name: endings.map((e) => ['1st', '2nd', '3rd', '4th'][(e.ending ?? 1) - 1]).join(' / ') + ' time', from: endings[0].from, to: endings[endings.length - 1].to }]
            : endings.map((s) => ({ name: s.name, from: s.from, to: s.to }))),
    ].sort((a, b) => a.from - b.from);

    return (
        <aside className="flex w-62 shrink-0 flex-col gap-7 overflow-y-auto border-r border-rule bg-paper px-5 py-6">
            <div className="flex flex-col gap-2.5">
                <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">SCORE</div>
                <div className="flex flex-wrap gap-1.5">
                    {chips.map((chip) =>
                        chip.map && canEdit ? (
                            <button
                                key={chip.label}
                                type="button"
                                onClick={onMapChip}
                                title="Change tempo & time"
                                className="flex h-7 items-center rounded-sm bg-copy px-2.5 font-solfa text-[12px] leading-4 text-ink hover:bg-rule"
                            >
                                {chip.label}
                            </button>
                        ) : (
                            <div key={chip.label} className="flex h-7 items-center rounded-sm bg-copy px-2.5 font-solfa text-[12px] leading-4 text-ink">
                                {chip.label}
                            </div>
                        ),
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <div className="pb-1.5">
                    <Heading action="+ Add" onAction={onAddPart} disabled={!canEdit || missing.length === 0}>
                        PARTS
                    </Heading>
                </div>
                {document.parts.map((part) => {
                    const active = part.id === activePart;
                    const done = part.bars.filter((b) => b.done).length;
                    const ratio = document.bars > 0 ? done / document.bars : 0;

                    return (
                        <button
                            key={part.id}
                            type="button"
                            onClick={() => onPart(part.id)}
                            aria-pressed={active}
                            className={cn(
                                'flex h-10 shrink-0 items-center gap-2.5 rounded-sm px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                                active ? 'bg-ink' : 'hover:bg-copy',
                            )}
                        >
                            <span className={cn('w-5.5 shrink-0 font-display text-[15px] leading-4.5 font-extrabold', active ? 'text-paper' : 'text-ink')}>
                                {part.id}
                            </span>
                            <span className="flex grow basis-0 flex-col gap-1">
                                <span className={cn('text-[13px] leading-4', active ? 'font-semibold text-paper' : 'text-ink')}>
                                    {VOICE_NAMES[part.id]}
                                    {active && writing ? ' · writing' : ''}
                                </span>
                                <span className={cn('flex h-0.75 shrink-0 rounded-full', active ? 'bg-paper/20' : 'bg-rule')}>
                                    <span
                                        className={cn('h-0.75 shrink-0 rounded-full', active ? 'bg-marker' : 'bg-ink')}
                                        style={{ width: `${ratio * 100}%` }}
                                    />
                                </span>
                            </span>
                            <span className={cn('flex w-9 shrink-0 justify-end text-right font-solfa text-[11px] leading-3.5', active ? 'text-paper/75' : 'text-pencil')}>
                                {done}/{document.bars}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-col gap-0.5">
                <div className="pb-2">
                    <Heading action="+ Add" onAction={onAddSection} disabled={!canEdit}>
                        SECTIONS
                    </Heading>
                </div>
                {merged.map((section) => {
                    const active = cursorBar >= section.from && cursorBar <= section.to;

                    return (
                        <button
                            key={`${section.name}-${section.from}`}
                            type="button"
                            onClick={() => onSection(section.from)}
                            className={cn(
                                'flex h-8.5 shrink-0 items-center justify-between rounded-sm px-2 text-left',
                                active ? 'bg-copy' : 'hover:bg-copy/60',
                            )}
                        >
                            <span className={cn('text-[14px] leading-4.5 text-ink', active && 'font-semibold')}>
                                {section.name}
                                {segno(section.from) ? ' $' : ''}
                            </span>
                            <span className="font-solfa text-[12px] leading-4 text-pencil">
                                {section.from === section.to ? section.from : `${section.from}–${section.to}`}
                            </span>
                        </button>
                    );
                })}
                {ends && <div className="px-2 pt-2.5 text-[12px] leading-4.5 text-pencil">{ends}</div>}
            </div>
        </aside>
    );
}
