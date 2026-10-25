import { Link } from '@inertiajs/react';
import { ArrowRightIcon } from '@/components/icons';
import { ResumeCard } from '@/components/dashboard/resume-card';
import { dashboardUrl } from '@/lib/dashboard-url';
import type { DashboardProps } from '@/types';

function Label({ children }: { children: string }) {
    return <div className="text-[10px] leading-3.5 font-semibold tracking-[0.12em] text-pencil">{children}</div>;
}

/**
 * The right rail (Paper W0): resume card, at a glance, recent activity,
 * next rehearsal, and the ⌘K hint.
 */
export function InsightRail({
    resume,
    counts,
    activity,
    rehearsal,
    onPlanRehearsal,
    onJump,
}: Pick<DashboardProps, 'resume' | 'counts' | 'activity' | 'rehearsal'> & {
    onPlanRehearsal: () => void;
    onJump: () => void;
}) {
    const glance = [
        { value: counts.all, label: 'Scores in your library' },
        { value: counts.ready, label: 'Performance-ready' },
        { value: counts.review, label: 'Awaiting review' },
    ];

    return (
        <aside className="flex w-80 shrink-0 flex-col border-l border-rule px-6 pt-6 pb-5">
            {resume && <ResumeCard score={resume} />}

            <div className="flex shrink-0 flex-col pt-5.5">
                <div className="pb-4.5">
                    <Label>AT A GLANCE</Label>
                </div>
                {glance.map((row, i) => (
                    <div
                        key={row.label}
                        className={`flex h-11.5 shrink-0 items-center gap-3 ${i < glance.length - 1 ? 'border-b border-rule' : ''}`}
                    >
                        <div className="w-9.5 shrink-0 font-display text-[24px] leading-7 font-bold tracking-[-0.03em] text-ink">
                            {row.value}
                        </div>
                        <div className="text-[12.5px] leading-4 text-pencil">{row.label}</div>
                    </div>
                ))}
            </div>

            <div className="flex shrink-0 flex-col gap-3 pt-6">
                <Label>RECENT ACTIVITY</Label>
                <div className="flex flex-col gap-3">
                    {activity.map((item) => (
                        <Link key={item.id} href={`/scores/${item.score_id}`} className="flex shrink-0 items-start gap-2.5">
                            <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-copy font-solfa text-[9px] leading-3 text-ink">
                                {item.initials}
                            </span>
                            <span className="flex min-w-0 grow basis-0 flex-col gap-px">
                                <span className="text-[12.5px] leading-4 font-semibold text-ink">{item.user_name}</span>
                                <span className="text-[11.5px] leading-3.75 text-pencil">{item.text}</span>
                            </span>
                        </Link>
                    ))}
                    {activity.length === 0 && (
                        <span className="text-[11.5px] leading-3.75 text-pencil">Saves and edits will show here.</span>
                    )}
                </div>
            </div>

            <div className="flex shrink-0 flex-col pt-5.5">
                <div className="flex flex-col border-t border-rule pt-4.5">
                    <div className="flex items-center justify-between">
                        <Label>NEXT REHEARSAL</Label>
                        {rehearsal && <span className="text-[11px] leading-3.5 text-pencil">{rehearsal.in}</span>}
                    </div>
                    {rehearsal ? (
                        <>
                            <div className="pt-3 text-[13px] leading-4.5 font-semibold text-ink">{rehearsal.when}</div>
                            <div className="pt-1 text-[11.5px] leading-3.75 text-pencil">
                                {rehearsal.ensemble}
                                {rehearsal.singers ? ` · ${rehearsal.singers} singers` : ''}
                            </div>
                            <Link
                                href={dashboardUrl({ view: 'rehearsal', rehearsal: rehearsal.id })}
                                className="flex items-center gap-1.25 pt-3 text-ink"
                            >
                                <span className="text-[12.5px] leading-4 font-semibold">Rehearsal plan</span>
                                <ArrowRightIcon size={11} strokeWidth={1.7} />
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="pt-3 text-[11.5px] leading-3.75 text-pencil">Nothing planned yet.</div>
                            <button type="button" onClick={onPlanRehearsal} className="flex items-center gap-1.25 pt-3 text-ink">
                                <span className="text-[12.5px] leading-4 font-semibold">Plan a rehearsal</span>
                                <ArrowRightIcon size={11} strokeWidth={1.7} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="min-h-4 grow basis-0" />

            <button
                type="button"
                onClick={onJump}
                className="flex shrink-0 items-center justify-between border-t border-rule pt-3 text-left"
            >
                <span className="text-[11px] leading-3.5 text-pencil">Jump to any score</span>
                <kbd className="flex items-center gap-0.75 rounded-[4px] bg-copy px-1.5 py-0.75 font-solfa text-[10px] leading-3 text-pencil">
                    ⌘K
                </kbd>
            </button>
        </aside>
    );
}
