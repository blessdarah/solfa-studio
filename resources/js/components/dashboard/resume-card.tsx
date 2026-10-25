import { Link } from '@inertiajs/react';
import { ArrowRightIcon } from '@/components/icons';
import { formatBar, keyLabel, timeLabel } from '@/lib/music';
import type { ScoreSummary } from '@/types';

/**
 * The card at the top of the right rail: the score to pick up again,
 * with a sketch of its first bars and how far it has got.
 */
export function ResumeCard({ score }: { score: ScoreSummary }) {
    const toCheck = score.notes_to_check;
    const percent = score.read_percent ?? score.completion;
    const lines: string[] = [];

    for (let i = 0; i < score.preview.length; i += 2) {
        lines.push(
            score.preview
                .slice(i, i + 2)
                .map((bar) => formatBar(bar.notes, bar.beats))
                .join(' | '),
        );
    }

    return (
        <div className="flex shrink-0 flex-col rounded-lg bg-copy p-4.5">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center rounded-[4px] bg-marker px-1.75 py-1.25">
                    <span className="text-[9.5px] leading-3 font-bold tracking-[0.06em] text-ink">
                        {toCheck > 0 ? `${toCheck} NOTES TO CHECK` : 'KEEP WRITING'}
                    </span>
                </span>
                <span className="text-[11px] leading-3.5 text-pencil">{score.updated_human}</span>
            </div>

            <div className="truncate pt-3 font-display text-[22px] leading-6.5 font-bold tracking-[-0.02em] text-ink">
                {score.title}
            </div>
            <div className="truncate pt-1 text-[12px] leading-4 text-pencil">
                {score.composer ?? 'Unknown composer'} · Doh is {keyLabel(score.doh)} · {timeLabel(score.beats)}
            </div>

            {lines.length > 0 && (
                <div className="pt-3.5 font-solfa text-[12px] leading-5 tracking-[0.01em] whitespace-pre text-ink">
                    {lines.join('\n')}
                </div>
            )}

            <div className="flex items-center gap-2.5 pt-3">
                <div className="h-1 grow basis-0 rounded-full bg-rule">
                    <div className="h-1 rounded-full bg-ink" style={{ width: `${Math.max(2, percent)}%` }} />
                </div>
                <span className="text-[11px] leading-3.5 text-pencil">
                    {percent}% {score.read_percent !== null ? 'read' : 'written'}
                </span>
            </div>

            <div className="pt-4">
                <Link
                    href={`/scores/${score.id}`}
                    className="flex h-9 items-center justify-center gap-1.75 rounded-full bg-ink text-paper outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-copy"
                >
                    <span className="text-[13px] leading-4.5 font-semibold">
                        {toCheck > 0 ? `Review ${toCheck} notes` : 'Continue writing'}
                    </span>
                    <ArrowRightIcon size={12} strokeWidth={1.7} />
                </Link>
            </div>
        </div>
    );
}
