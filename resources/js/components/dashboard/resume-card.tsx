import { Link } from '@inertiajs/react';
import { ArrowRightIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { ScoreSummary } from '@/types';

export function ResumeCard({
    score,
    compact = false,
}: {
    score: ScoreSummary;
    compact?: boolean;
}) {
    const isReview = score.notes_to_check > 0;
    const progress = score.read_percent ?? score.completion;
    const progressLabel =
        score.read_percent !== null
            ? `${score.read_percent}% read`
            : `${score.completion}% complete`;

    return (
        <div className={cn('rounded-card bg-copy p-[18px]', compact && 'p-4')}>
            <div className="flex items-center justify-between gap-3">
                <span
                    className={cn(
                        'inline-flex h-6 items-center rounded-full px-2.5 text-[8.5px] font-semibold tracking-[0.1em] uppercase',
                        isReview
                            ? 'bg-marker text-ink'
                            : 'bg-paper text-pencil',
                    )}
                >
                    {isReview
                        ? `${score.notes_to_check} notes to check`
                        : 'Recently edited'}
                </span>
                <span className="shrink-0 text-[10px] text-pencil">
                    {score.updated_human}
                </span>
            </div>

            <Link
                href={`/scores/${score.id}`}
                className="group mt-3 block rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
            >
                <h3 className="font-display text-[22px] leading-[1.06] font-bold tracking-[-0.035em] text-ink decoration-rule underline-offset-4 group-hover:underline">
                    {score.title}
                </h3>
            </Link>

            <p className="mt-1 text-[11.5px] leading-4 text-pencil">
                {score.composer ?? 'Unknown composer'} · Doh is {score.doh} ·
                ♩ = {score.bpm}
            </p>

            {score.solfa_preview && (
                <p className="mt-3 font-solfa text-[11px] leading-[1.75] break-words text-ink/80">
                    {score.solfa_preview}
                </p>
            )}

            <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] text-pencil">
                    <span>{progressLabel}</span>
                    <span>{score.bars} bars</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper">
                    <div
                        className="h-full rounded-full bg-ink"
                        style={{ width: `${Math.max(3, progress)}%` }}
                    />
                </div>
            </div>

            <Link
                href={`/scores/${score.id}`}
                className={cn(
                    'mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-ink text-[12px] font-semibold text-paper outline-none transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-copy',
                    compact ? 'w-full sm:w-auto sm:px-5' : 'w-full',
                )}
            >
                {isReview ? `Review ${score.notes_to_check} notes` : 'Open score'}
                <ArrowRightIcon className="h-3 w-3" />
            </Link>
        </div>
    );
}
