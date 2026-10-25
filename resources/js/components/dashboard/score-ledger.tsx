import { Link, router } from '@inertiajs/react';
import { ArrowRightIcon, ChevronDownIcon, FilterIcon } from '@/components/icons';
import { KeyBadge } from '@/components/dashboard/key-badge';
import { SCORE_DRAG_TYPE } from '@/components/dashboard/library-rail';
import { VoiceChips } from '@/components/dashboard/voice-chips';
import { dashboardUrl } from '@/lib/dashboard-url';
import { cn } from '@/lib/utils';
import type { DashboardFilters, DashboardKind, DashboardProps, DashboardSort, ScoreSummary } from '@/types';

const KIND_CHIPS: { kind: DashboardKind; label: string }[] = [
    { kind: 'all', label: 'All' },
    { kind: 'composed', label: 'Composed' },
    { kind: 'arrangements', label: 'Arrangements' },
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

function Row({ score }: { score: ScoreSummary }) {
    return (
        <Link
            href={`/scores/${score.id}`}
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData(SCORE_DRAG_TYPE, score.id);
                event.dataTransfer.effectAllowed = 'move';
            }}
            className="flex h-15.5 shrink-0 items-center gap-4 border-b border-rule outline-none hover:bg-copy/40 focus-visible:bg-copy/60"
        >
            <span className="w-10 shrink-0">
                <KeyBadge doh={score.doh} alert={score.needs_review} />
            </span>
            <span className="flex min-w-0 grow basis-0 flex-col gap-0.5">
                <span className="truncate font-display text-[15px] leading-4.75 font-semibold tracking-[-0.01em] text-ink">
                    {score.title}
                </span>
                <span className="truncate text-[12.5px] leading-4 text-pencil">{score.meta}</span>
            </span>
            <VoiceChips voices={score.voice_progress} />
            <span className="flex w-20 shrink-0 justify-end text-right text-[12px] leading-4 text-pencil">
                {score.updated_human}
            </span>
        </Link>
    );
}

export function ScoreLedger({
    scores,
    filters,
    kinds,
    shown,
    filteredTotal,
    emptyText,
}: {
    scores: ScoreSummary[];
    filters: DashboardFilters;
    kinds: DashboardProps['kinds'];
    shown: number;
    filteredTotal: number;
    emptyText: string;
}) {
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
            </div>

            <div className="flex shrink-0 flex-col">
                {scores.map((score) => (
                    <Row key={score.id} score={score} />
                ))}
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
