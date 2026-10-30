import { Link, router } from '@inertiajs/react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRightIcon, ChevronDownIcon, FilterIcon } from '@/components/icons';
import { KeyBadge } from '@/components/dashboard/key-badge';
import { SCORE_DRAG_TYPE } from '@/components/dashboard/library-rail';
import { VoiceChips } from '@/components/dashboard/voice-chips';
import { dashboardUrl } from '@/lib/dashboard-url';
import { useDismiss } from '@/lib/use-dismiss';
import { cn } from '@/lib/utils';
import type { DashboardFilters, DashboardKind, DashboardProps, DashboardSort, ScoreSummary } from '@/types';

const KIND_CHIPS: { kind: DashboardKind; label: string }[] = [
    { kind: 'all', label: 'All' },
    { kind: 'composed', label: 'Composed' },
    { kind: 'arrangements', label: 'Arrangements' },
    { kind: 'published', label: 'Published' },
];

const SORTS: { value: DashboardSort; label: string }[] = [
    { value: 'edited', label: 'Recently edited' },
    { value: 'title', label: 'Title A–Z' },
    { value: 'key', label: 'Key' },
];

function Chips({ filters, kinds }: { filters: DashboardFilters; kinds: DashboardProps['kinds'] }) {
    return (
        <div className="flex items-center gap-1.5">
            {KIND_CHIPS.map((chip) => {
                const active = filters.kind === chip.kind;

                return (
                    <Link
                        key={chip.kind}
                        href={dashboardUrl({ ...filters, kind: chip.kind, all: false })}
                        preserveScroll
                        preserveState
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                            'flex h-7.5 shrink-0 items-center gap-1.5 rounded-full px-3 outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                            active ? 'bg-ink' : 'border border-rule',
                        )}
                    >
                        {chip.kind === 'published' && <span className="size-1.5 rounded-full bg-[#1F7A3A]" />}
                        <span
                            className={cn(
                                'text-[12.5px] leading-4',
                                active ? 'font-semibold text-paper' : 'font-medium text-ink',
                            )}
                        >
                            {chip.label}
                        </span>
                        <span className={cn('font-solfa text-[10.5px] leading-3.5', active ? 'text-paper/55' : 'text-pencil')}>
                            {kinds[chip.kind]}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}

function SortMenu({ filters }: { filters: DashboardFilters }) {
    return (
        <label className="relative flex shrink-0 items-center gap-1.75">
            <FilterIcon className="text-pencil" />
            <span className="text-[12.5px] leading-4 font-medium text-ink">
                {SORTS.find((s) => s.value === filters.sort)?.label}
            </span>
            <ChevronDownIcon size={12} className="text-pencil" />
            <select
                value={filters.sort}
                onChange={(event) =>
                    router.get(dashboardUrl({ ...filters, sort: event.target.value as DashboardSort }), {}, {
                        preserveScroll: true,
                        preserveState: true,
                    })
                }
                aria-label="Sort scores"
                className="absolute inset-0 cursor-pointer opacity-0"
            >
                {SORTS.map((sort) => (
                    <option key={sort.value} value={sort.value}>
                        {sort.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

export type ScoreActions = {
    onDetails: (score: ScoreSummary) => void;
    onPublish: (score: ScoreSummary) => void;
    onDelete: (score: ScoreSummary) => void;
    onToast: (message: string) => void;
};

/** "Published" or, after later edits, "Published · newer edits" (Paper W10). */
function StatusPill({ score }: { score: ScoreSummary }) {
    if (!score.published) return null;

    const changed = score.publishing.has_changes;

    return (
        <span
            className={cn(
                'flex h-4.5 shrink-0 items-center gap-1 rounded-full px-1.75 text-[11px] leading-3.5 font-semibold',
                changed ? 'bg-wash text-[#6E5700]' : 'bg-[#E3F1E6] text-[#1F7A3A]',
            )}
        >
            <span className={cn('size-1.5 rounded-full', changed ? 'bg-[#8A6D00]' : 'bg-[#1F7A3A]')} />
            {changed ? 'Published · newer edits' : 'Published'}
        </span>
    );
}

function MenuItem({ onSelect, hint, danger = false, children }: { onSelect: () => void; hint?: string; danger?: boolean; children: ReactNode }) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onSelect}
            className="flex h-8.5 w-full shrink-0 items-center justify-between gap-3 rounded-[8px] px-2.5 text-left outline-none hover:bg-copy focus-visible:bg-copy"
        >
            <span className={cn('text-[13.5px] leading-4.5', danger ? 'font-semibold text-danger' : 'font-medium text-ink')}>{children}</span>
            {hint && <span className="truncate text-[11px] leading-3.5 text-pencil">{hint}</span>}
        </button>
    );
}

/** The row's "⋯" menu: open, edit details, publish, print, copy, archive, delete. */
function ScoreMenu({ score, actions }: { score: ScoreSummary; actions: ScoreActions }) {
    const [menu, setMenu] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
    const box = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const close = useCallback(() => setMenu(null), []);

    useDismiss(box, menu !== null, close);

    const open = () => {
        const rect = button.current?.getBoundingClientRect();
        if (!rect) return;

        const right = window.innerWidth - rect.right;
        setMenu(rect.bottom + 420 > window.innerHeight ? { right, bottom: window.innerHeight - rect.top + 6 } : { right, top: rect.bottom + 6 });
    };

    const pick = (go: () => void) => () => {
        close();
        go();
    };

    const copyLink = async () => {
        if (!score.publishing.url) return;

        await navigator.clipboard?.writeText(score.publishing.url).catch(() => undefined);
        actions.onToast('Public link copied.');
    };

    return (
        <div ref={box} className="flex shrink-0">
            <button
                ref={button}
                type="button"
                onClick={() => (menu ? close() : open())}
                aria-haspopup="menu"
                aria-expanded={menu !== null}
                aria-label={`${score.title} options`}
                className={cn(
                    'flex size-7.5 items-center justify-center rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                    menu ? 'bg-ink text-paper' : 'text-pencil hover:bg-paper hover:text-ink',
                )}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                    <circle cx="3" cy="7" r="1.3" />
                    <circle cx="7" cy="7" r="1.3" />
                    <circle cx="11" cy="7" r="1.3" />
                </svg>
            </button>

            {menu && (
                <div
                    role="menu"
                    className="fixed z-50 flex w-71 flex-col rounded-md border border-rule bg-paper p-1.5 shadow-[0_20px_50px_#00000024]"
                    style={{ right: menu.right, top: menu.top, bottom: menu.bottom }}
                >
                    <div className="flex flex-col gap-0.5 px-2.5 pt-1.5 pb-2">
                        <div className="truncate text-[13px] leading-4.25 font-semibold text-ink">{score.title}</div>
                        <div className="text-[11.5px] leading-3.75 text-pencil">
                            {score.published
                                ? `Published ${score.publishing.published_human} · ${score.publishing.visits} visits`
                                : 'Not published'}
                        </div>
                    </div>
                    <div className="my-0.5 h-px bg-rule" />
                    <MenuItem onSelect={pick(() => router.visit(`/scores/${score.id}`))} hint="↵">
                        Open in editor
                    </MenuItem>
                    <MenuItem onSelect={pick(() => actions.onDetails(score))} hint="Title, composer, key">
                        Edit details
                    </MenuItem>
                    <div className="my-0.75 h-px bg-rule" />
                    {score.published && (
                        <MenuItem onSelect={pick(copyLink)} hint={`/p/${score.publishing.slug}`}>
                            Copy public link
                        </MenuItem>
                    )}
                    <MenuItem onSelect={pick(() => actions.onPublish(score))} hint={score.published ? 'Link, player, print' : 'Anyone can practise it'}>
                        {score.published ? 'Publishing…' : 'Publish…'}
                    </MenuItem>
                    <MenuItem onSelect={pick(() => router.visit(`/scores/${score.id}?print=1`))} hint="Pages for paper">
                        Print or save PDF
                    </MenuItem>
                    <MenuItem
                        onSelect={pick(() => router.post(`/scores/${score.id}/duplicate`, {}, { preserveScroll: true }))}
                        hint="For a new arrangement"
                    >
                        Make a copy
                    </MenuItem>
                    <div className="my-0.75 h-px bg-rule" />
                    {score.archived ? (
                        <MenuItem onSelect={pick(() => router.delete(`/scores/${score.id}/archive`, { preserveScroll: true }))} hint="Back to the library">
                            Unarchive
                        </MenuItem>
                    ) : (
                        <MenuItem onSelect={pick(() => router.post(`/scores/${score.id}/archive`, {}, { preserveScroll: true }))} hint="Hide, keep everything">
                            Archive
                        </MenuItem>
                    )}
                    <MenuItem onSelect={pick(() => actions.onDelete(score))} danger>
                        Delete score…
                    </MenuItem>
                </div>
            )}
        </div>
    );
}

function Row({ score, actions, owned }: { score: ScoreSummary; actions: ScoreActions; owned: boolean }) {
    return (
        <div
            draggable={owned}
            onDragStart={(event) => {
                event.dataTransfer.setData(SCORE_DRAG_TYPE, score.id);
                event.dataTransfer.effectAllowed = 'move';
            }}
            className="group flex h-15.5 shrink-0 items-center gap-4 border-b border-rule hover:bg-copy/40 has-[[aria-expanded=true]]:bg-copy/60"
        >
            <Link href={`/scores/${score.id}`} className="flex h-full min-w-0 grow basis-0 items-center gap-4 outline-none focus-visible:bg-copy/60">
                <span className="w-10 shrink-0">
                    <KeyBadge doh={score.doh} alert={score.needs_review} />
                </span>
                <span className="flex min-w-0 grow basis-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-display text-[15px] leading-4.75 font-semibold tracking-[-0.01em] text-ink">{score.title}</span>
                        <StatusPill score={score} />
                    </span>
                    <span className="truncate text-[12.5px] leading-4 text-pencil">{score.meta}</span>
                </span>
                <VoiceChips voices={score.voice_progress} />
                <span className="flex w-20 shrink-0 justify-end text-right text-[12px] leading-4 text-pencil">{score.updated_human}</span>
            </Link>
            <span className="flex w-8 shrink-0 justify-end">{owned && <ScoreMenu score={score} actions={actions} />}</span>
        </div>
    );
}

/** A row in Recently deleted: how long is left, Restore, or Delete forever. */
function DeletedRow({ score }: { score: ScoreSummary }) {
    const [sure, setSure] = useState(false);

    return (
        <div className="flex h-15.5 shrink-0 items-center gap-4 border-b border-rule">
            <span className="w-10 shrink-0 opacity-60">
                <KeyBadge doh={score.doh} alert={false} />
            </span>
            <span className="flex min-w-0 grow basis-0 flex-col gap-0.5">
                <span className="truncate font-display text-[15px] leading-4.75 font-semibold tracking-[-0.01em] text-ink/70">{score.title}</span>
                <span className="truncate text-[12.5px] leading-4 text-pencil">
                    {score.deleted_days_left === 0 ? 'Goes for good today' : `Goes for good in ${score.deleted_days_left} days`} · {score.meta}
                </span>
            </span>
            <button
                type="button"
                onClick={() => router.post(`/scores/${score.id}/restore`, {}, { preserveScroll: true })}
                className="flex h-8 shrink-0 items-center rounded-full bg-ink px-3.5 text-[12.5px] leading-4 font-semibold text-paper hover:bg-ink/90"
            >
                Restore
            </button>
            <button
                type="button"
                onClick={() => (sure ? router.delete(`/scores/${score.id}/forever`, { preserveScroll: true }) : setSure(true))}
                onBlur={() => setSure(false)}
                className="flex h-8 shrink-0 items-center rounded-full border border-rule px-3.5 text-[12.5px] leading-4 font-semibold text-danger hover:bg-danger/6"
            >
                {sure ? 'Click again — no undo' : 'Delete forever'}
            </button>
        </div>
    );
}

export function ScoreLedger({
    scores,
    filters,
    kinds,
    shown,
    filteredTotal,
    emptyText,
    actions,
}: {
    scores: ScoreSummary[];
    filters: DashboardFilters;
    kinds: DashboardProps['kinds'];
    shown: number;
    filteredTotal: number;
    emptyText: string;
    actions: ScoreActions;
}) {
    const deleted = filters.view === 'deleted';
    const owned = filters.view !== 'shared';

    return (
        <>
            <div className="flex shrink-0 items-center justify-between pt-7">
                <Chips filters={filters} kinds={kinds} />
                <SortMenu filters={filters} />
            </div>

            <div className="flex h-8.5 shrink-0 items-center gap-4 border-b border-rule pt-3" aria-hidden="true">
                <div className="w-10 shrink-0 text-[10px] leading-3.5 font-semibold tracking-[0.12em] text-pencil">KEY</div>
                <div className="min-w-0 grow basis-0 text-[10px] leading-3.5 font-semibold tracking-[0.12em] text-pencil">
                    TITLE &amp; COMPOSER
                </div>
                <div className="w-32 shrink-0 text-[10px] leading-3.5 font-semibold tracking-[0.12em] text-pencil">VOICES</div>
                <div className="flex w-20 shrink-0 justify-end text-right text-[10px] leading-3.5 font-semibold tracking-[0.12em] text-pencil">
                    LAST EDITED
                </div>
                <div className="w-8 shrink-0" />
            </div>

            <div className="flex shrink-0 flex-col">
                {scores.map((score) =>
                    deleted ? <DeletedRow key={score.id} score={score} /> : <Row key={score.id} score={score} actions={actions} owned={owned} />,
                )}
                {scores.length === 0 && (
                    <div className="flex h-15.5 shrink-0 items-center border-b border-rule text-[12.5px] leading-4 text-pencil">
                        {emptyText}
                    </div>
                )}
            </div>

            <div className="flex shrink-0 items-center justify-between pt-4.5">
                <div className="text-[12.5px] leading-4 text-pencil">
                    {filteredTotal === 0
                        ? 'No scores'
                        : shown < filteredTotal
                          ? `Showing ${shown} of ${filteredTotal} scores`
                          : `Showing all ${filteredTotal} ${filteredTotal === 1 ? 'score' : 'scores'}`}
                </div>
                {shown < filteredTotal && (
                    <Link
                        href={dashboardUrl({ ...filters, all: true })}
                        preserveScroll
                        className="flex items-center gap-1.5 text-ink outline-none focus-visible:underline"
                    >
                        <span className="text-[13px] leading-4.5 font-semibold">Open full library</span>
                        <ArrowRightIcon />
                    </Link>
                )}
            </div>
        </>
    );
}
