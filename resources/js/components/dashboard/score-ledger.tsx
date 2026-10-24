import { Link } from '@inertiajs/react';
import { ArrowRightIcon, MusicIcon } from '@/components/icons';
import { KeyBadge } from '@/components/dashboard/key-badge';
import { VoiceChips } from '@/components/dashboard/voice-chips';
import { dashboardUrl } from '@/lib/dashboard-url';
import type { DashboardFilters, ScoreSummary } from '@/types';

function Meta({ score }: { score: ScoreSummary }) {
    return (
        <p className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10.5px] whitespace-nowrap text-pencil">
            <span className="truncate">
                {score.composer ?? 'Unknown composer'}
            </span>
            <span className="shrink-0 text-rule">·</span>
            <span className="shrink-0">Doh is {score.doh}</span>
            <span className="shrink-0 text-rule">·</span>
            <span className="shrink-0">{score.bars} bars</span>
            {score.notes_to_check > 0 && (
                <>
                    <span className="shrink-0 text-rule">·</span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-medium text-ink">
                        <span className="size-1.5 rounded-full bg-marker ring-1 ring-ink/10" />
                        {score.notes_to_check} to check
                    </span>
                </>
            )}
        </p>
    );
}

function ScoreRows({ scores }: { scores: ScoreSummary[] }) {
    return (
        <>
            <div className="hidden md:block">
                <div className="grid grid-cols-[40px_minmax(0,1fr)_110px_82px] items-center gap-4 border-b border-rule px-3 pb-2.5">
                    <span className="text-[9px] font-semibold tracking-[0.13em] text-pencil uppercase">
                        Key
                    </span>
                    <span className="text-[9px] font-semibold tracking-[0.13em] text-pencil uppercase">
                        Score
                    </span>
                    <span className="text-[9px] font-semibold tracking-[0.13em] text-pencil uppercase">
                        Voices
                    </span>
                    <span className="text-right text-[9px] font-semibold tracking-[0.13em] text-pencil uppercase">
                        Edited
                    </span>
                </div>

                {scores.map((score) => (
                    <Link
                        key={score.id}
                        href={`/scores/${score.id}`}
                        aria-label={`Open ${score.title}`}
                        className="group grid h-[62px] grid-cols-[40px_minmax(0,1fr)_110px_82px] items-center gap-4 border-b border-rule px-3 outline-none transition-colors hover:bg-copy/55 focus-visible:bg-copy/55 focus-visible:ring-2 focus-visible:ring-ink/10 focus-visible:ring-inset"
                    >
                        <KeyBadge
                            doh={score.doh}
                            alert={score.needs_review}
                        />

                        <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold tracking-[-0.015em] text-ink">
                                {score.title}
                            </p>
                            <Meta score={score} />
                        </div>

                        <VoiceChips voices={score.voice_progress} />

                        <span className="text-right text-[10.5px] text-pencil">
                            {score.updated_human}
                        </span>
                    </Link>
                ))}
            </div>

            <div className="md:hidden">
                {scores.map((score) => (
                    <Link
                        key={score.id}
                        href={`/scores/${score.id}`}
                        aria-label={`Open ${score.title}`}
                        className="flex gap-3 border-b border-rule px-1 py-4 outline-none transition-colors hover:bg-copy/55 focus-visible:bg-copy/55"
                    >
                        <KeyBadge
                            doh={score.doh}
                            alert={score.needs_review}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.015em] text-ink">
                                    {score.title}
                                </p>
                                <span className="shrink-0 pt-0.5 text-[10px] text-pencil">
                                    {score.updated_human}
                                </span>
                            </div>
                            <Meta score={score} />
                            <div className="mt-2.5">
                                <VoiceChips voices={score.voice_progress} />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </>
    );
}

function EmptyState({
    filtered,
    onNewScore,
}: {
    filtered: boolean;
    onNewScore: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center border-b border-rule px-5 py-16 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-copy">
                <MusicIcon className="h-4.5 w-4.5 text-pencil" />
            </span>
            <h2 className="mt-4 font-display text-[22px] font-bold tracking-[-0.03em] text-ink">
                {filtered ? 'No scores match' : 'Your library is empty'}
            </h2>
            <p className="mt-1.5 max-w-[300px] text-[12px] leading-5 text-pencil">
                {filtered
                    ? 'Try another search, or clear the filters to see the whole library.'
                    : 'Start with a blank score and add the voices as you hear them.'}
            </p>
            {filtered ? (
                <Link
                    href="/dashboard"
                    className="mt-5 inline-flex h-9 items-center rounded-full border border-rule px-4 text-[12px] font-semibold text-ink transition hover:bg-copy"
                >
                    Clear filters
                </Link>
            ) : (
                <button
                    type="button"
                    onClick={onNewScore}
                    className="mt-5 inline-flex h-9 items-center rounded-full bg-ink px-4 text-[12px] font-semibold text-paper transition hover:bg-ink/85"
                >
                    New score
                </button>
            )}
        </div>
    );
}

export function ScoreLedger({
    scores,
    filters,
    total,
    filteredTotal,
    shown,
    onNewScore,
}: {
    scores: ScoreSummary[];
    filters: DashboardFilters;
    total: number;
    filteredTotal: number;
    shown: number;
    onNewScore: () => void;
}) {
    if (scores.length === 0) {
        return (
            <div className="mt-6">
                <EmptyState
                    filtered={total > 0}
                    onNewScore={onNewScore}
                />
            </div>
        );
    }

    const viewAllHref = dashboardUrl({ ...filters, all: true });
    const fewerHref = dashboardUrl({ ...filters, all: false });
    const hidden = Math.max(0, filteredTotal - shown);

    return (
        <div className="mt-6">
            <ScoreRows scores={scores} />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10.5px] text-pencil">
                    {hidden > 0
                        ? `Showing ${shown} of ${filteredTotal} scores`
                        : `Showing all ${filteredTotal} ${
                              filteredTotal === 1 ? 'score' : 'scores'
                          }`}
                </p>

                {hidden > 0 ? (
                    <Link
                        href={viewAllHref}
                        className="group inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink"
                    >
                        View all {filteredTotal} scores
                        <ArrowRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                ) : filters.all && filteredTotal > 8 ? (
                    <Link
                        href={fewerHref}
                        className="text-[11px] font-semibold text-pencil transition hover:text-ink"
                    >
                        Show fewer
                    </Link>
                ) : null}
            </div>
        </div>
    );
}
