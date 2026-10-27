import { useCallback, useRef, useState } from 'react';
import { partContents } from '@/lib/editor';
import { keyLabel, tempoAt, timeLabel, VOICE_NAMES, VOICES } from '@/lib/music';
import { useDismiss } from '@/lib/use-dismiss';
import { cn } from '@/lib/utils';
import type { Part, ScoreDocument, Voice } from '@/types';

/**
 * One part in the rail (Paper W1/W4): pick it to write in it; on hover a
 * "⋯" opens its menu — clear its notes, or delete the part.
 */
function PartRow({
    document,
    part,
    active,
    writing,
    canEdit,
    onPick,
    onClear,
    onDelete,
}: {
    document: ScoreDocument;
    part: Part;
    active: boolean;
    writing: boolean;
    canEdit: boolean;
    onPick: () => void;
    onClear: () => void;
    onDelete: () => void;
}) {
    const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
    const row = useRef<HTMLDivElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const close = useCallback(() => setMenu(null), []);

    useDismiss(box, menu !== null, close);

    const done = part.bars.filter((b) => b.done).length;
    const ratio = document.bars > 0 ? done / document.bars : 0;
    const name = VOICE_NAMES[part.id];
    const contents = partContents(document, part.id);
    const empty = contents.bars === 0 && contents.syllables === 0;
    const last = document.parts.length <= 1;

    const open = () => {
        const rect = row.current?.getBoundingClientRect();
        if (rect) setMenu({ left: rect.left, top: rect.bottom + 4 });
    };

    return (
        <div ref={box}>
            <div
                ref={row}
                className={cn(
                    'group flex h-10 shrink-0 items-center gap-2.5 rounded-sm pr-1.5 pl-2',
                    active ? 'bg-ink' : menu ? 'bg-copy' : 'hover:bg-copy',
                )}
            >
                <button
                    type="button"
                    onClick={onPick}
                    aria-pressed={active}
                    className="flex h-full grow basis-0 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
                >
                    <span className={cn('w-5.5 shrink-0 font-display text-[15px] leading-4.5 font-extrabold', active ? 'text-paper' : 'text-ink')}>
                        {part.id}
                    </span>
                    <span className="flex grow basis-0 flex-col gap-1">
                        <span className={cn('text-[13px] leading-4', active ? 'font-semibold text-paper' : 'text-ink')}>
                            {name}
                            {active && writing ? ' · writing' : ''}
                        </span>
                        <span className={cn('flex h-0.75 shrink-0 rounded-full', active ? 'bg-paper/20' : 'bg-rule')}>
                            <span className={cn('h-0.75 shrink-0 rounded-full', active ? 'bg-marker' : 'bg-ink')} style={{ width: `${ratio * 100}%` }} />
                        </span>
                    </span>
                </button>
                <span
                    className={cn(
                        'flex w-7 shrink-0 justify-end text-right font-solfa text-[11px] leading-3.5',
                        active ? 'text-paper/75' : 'text-pencil',
                        canEdit && (menu ? 'hidden' : 'group-focus-within:hidden group-hover:hidden'),
                    )}
                >
                    {done}/{document.bars}
                </span>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => (menu ? close() : open())}
                        aria-haspopup="menu"
                        aria-expanded={menu !== null}
                        aria-label={`${name} options`}
                        className={cn(
                            'size-7 shrink-0 items-center justify-center rounded-sm border outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                            menu ? 'flex' : 'hidden group-focus-within:flex group-hover:flex',
                            active ? 'border-white/20 bg-white/10 text-paper' : 'border-rule bg-paper text-ink',
                        )}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                            <circle cx="3" cy="7" r="1.3" />
                            <circle cx="7" cy="7" r="1.3" />
                            <circle cx="11" cy="7" r="1.3" />
                        </svg>
                    </button>
                )}
            </div>

            {menu && (
                <div
                    role="menu"
                    className="fixed z-50 flex w-63 flex-col gap-1 rounded-md border border-rule bg-paper p-1.5 shadow-[0_20px_50px_#00000024]"
                    style={{ left: menu.left, top: menu.top }}
                >
                    <div className="flex flex-col gap-0.5 px-2.5 pt-2 pb-2.5">
                        <div className="text-[13px] leading-4.25 font-semibold text-ink">{name}</div>
                        <div className="text-[11.5px] leading-3.75 text-pencil">
                            {contents.bars === 0
                                ? 'No notes written yet'
                                : `Notes in ${contents.bars} of ${document.bars} bars${contents.syllables > 0 ? ` · ${contents.syllables} syllables` : ' · no words'}`}
                        </div>
                    </div>
                    <div className="h-px bg-rule" />
                    <button
                        type="button"
                        role="menuitem"
                        disabled={empty}
                        onClick={() => {
                            close();
                            onClear();
                        }}
                        className="flex h-11 items-center gap-2.5 rounded-[8px] px-2.5 text-left hover:bg-copy disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                                d="M6.2 13.5h7.3M2.9 9.6l5.6-5.6a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-5.1 5.1a1.4 1.4 0 0 1-1 .4H5a1.4 1.4 0 0 1-1-.4L2.9 12a1.7 1.7 0 0 1 0-2.4Z"
                                stroke="#6B6B6B"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span className="flex flex-col gap-px">
                            <span className="text-[13.5px] leading-4.5 font-medium text-ink">Clear its notes</span>
                            <span className="text-[11.5px] leading-3.75 text-pencil">Keeps the part, empties every bar</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        disabled={last}
                        onClick={() => {
                            close();
                            onDelete();
                        }}
                        className="flex h-11 items-center gap-2.5 rounded-[8px] px-2.5 text-left hover:bg-danger/6 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                                d="M2.5 4.2h11M6.3 4.2V2.9c0-.4.3-.7.7-.7h2c.4 0 .7.3.7.7v1.3M4 4.2l.6 8.6c.1.7.6 1.2 1.3 1.2h4.2c.7 0 1.2-.5 1.3-1.2l.6-8.6M6.7 7v4.4M9.3 7v4.4"
                                stroke="#B42318"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span className="flex flex-col gap-px">
                            <span className="text-[13.5px] leading-4.5 font-semibold text-danger">Delete {name.toLowerCase()} part</span>
                            <span className="text-[11.5px] leading-3.75 text-pencil">
                                {last ? 'A score needs at least one part' : 'Takes the line out of the score'}
                            </span>
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

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
    onClearPart,
    onDeletePart,
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
    onClearPart: (voice: Voice) => void;
    onDeletePart: (voice: Voice) => void;
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
            ? [{ name: [...new Set(endings.map((e) => (e.ending === 1 ? '1st' : 'D.S.')))].join(' / ') + ' time', from: endings[0].from, to: endings[endings.length - 1].to }]
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
                {document.parts.map((part) => (
                    <PartRow
                        key={part.id}
                        document={document}
                        part={part}
                        active={part.id === activePart}
                        writing={writing}
                        canEdit={canEdit}
                        onPick={() => onPart(part.id)}
                        onClear={() => onClearPart(part.id)}
                        onDelete={() => onDeletePart(part.id)}
                    />
                ))}
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
