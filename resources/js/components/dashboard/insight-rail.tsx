import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { ArrowRightIcon, ShareIcon } from '@/components/icons';
import { ResumeCard } from '@/components/dashboard/resume-card';
import { cn } from '@/lib/utils';
import type {
    ActivityItem,
    DashboardCounts,
    LibraryShare,
    ScoreSummary,
} from '@/types';

function RailLabel({
    children,
    count,
}: {
    children: ReactNode;
    count?: number;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-semibold tracking-[0.14em] text-pencil uppercase">
                {children}
            </p>
            {count !== undefined && (
                <span className="font-solfa text-[9.5px] text-pencil/70">
                    {count}
                </span>
            )}
        </div>
    );
}

export function InsightRail({
    resume,
    counts,
    activity,
    shares,
}: {
    resume: ScoreSummary | null;
    counts: DashboardCounts;
    activity: ActivityItem[];
    shares: LibraryShare[];
}) {
    return (
        <aside className="sticky top-[60px] hidden h-[calc(100vh-60px)] w-[320px] shrink-0 flex-col overflow-y-auto border-l border-rule px-6 py-7 xl:flex">
            {resume && <ResumeCard score={resume} />}

            <section className={cn(resume ? 'mt-8' : 'mt-0')}>
                <RailLabel>At a glance</RailLabel>
                <dl className="mt-3 border-y border-rule">
                    {[
                        { label: 'All scores', value: counts.all },
                        { label: 'Performance-ready', value: counts.ready },
                        {
                            label: 'Awaiting review',
                            value: counts.review,
                            marker: counts.review > 0,
                        },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="flex items-center justify-between border-b border-rule py-2.5 last:border-b-0"
                        >
                            <dt className="text-[11.5px] text-pencil">
                                {stat.label}
                            </dt>
                            <dd className="flex items-center gap-2">
                                <span className="font-display text-[20px] leading-none font-bold tracking-[-0.03em] text-ink">
                                    {stat.value}
                                </span>
                                {stat.marker && (
                                    <span className="size-1.5 rounded-full bg-marker ring-1 ring-ink/10" />
                                )}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            {shares.length > 0 && (
                <section className="mt-7">
                    <RailLabel count={counts.shared}>
                        Shared with the choir
                    </RailLabel>
                    <div className="mt-2 space-y-1">
                        {shares.map((share) => (
                            <Link
                                key={share.id}
                                href={`/scores/${share.id}`}
                                className="group -mx-2 flex items-center gap-2.5 rounded-[9px] px-2 py-2 transition hover:bg-copy/65"
                            >
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-copy text-ink">
                                    <ShareIcon className="h-3 w-3 text-pencil" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[11.5px] font-semibold text-ink">
                                        {share.title}
                                    </span>
                                    <span className="block text-[10px] text-pencil">
                                        {share.label ?? 'Shared'} ·{' '}
                                        {share.when}
                                    </span>
                                </span>
                                <ArrowRightIcon className="h-3 w-3 shrink-0 text-pencil/40 transition group-hover:text-ink" />
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <section className="mt-7">
                <RailLabel>Recent activity</RailLabel>
                <div className="mt-3 space-y-4">
                    {activity.map((item) => (
                        <Link
                            key={item.id}
                            href={`/scores/${item.score_id}`}
                            className="group flex gap-2.5"
                        >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-copy font-solfa text-[9px] font-medium text-ink">
                                {item.initials}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[11.5px] leading-[1.4] text-ink">
                                    <span className="font-semibold">
                                        {item.user_name}
                                    </span>{' '}
                                    {item.action}
                                </span>
                                <span className="mt-0.5 block truncate text-[10.5px] text-pencil">
                                    {item.score_title} · {item.when}
                                </span>
                            </span>
                        </Link>
                    ))}
                    {activity.length === 0 && (
                        <p className="text-[11px] leading-5 text-pencil">
                            Saves and edits will appear here as you work.
                        </p>
                    )}
                </div>
            </section>

            <div className="mt-auto pt-8">
                <div className="flex items-center justify-between rounded-[10px] bg-copy px-3 py-2.5">
                    <span className="text-[10.5px] text-pencil">
                        Jump to any score
                    </span>
                    <kbd className="rounded-[5px] border border-rule bg-paper px-1.5 py-0.5 font-solfa text-[9px] text-pencil">
                        ⌘K
                    </kbd>
                </div>
            </div>
        </aside>
    );
}
