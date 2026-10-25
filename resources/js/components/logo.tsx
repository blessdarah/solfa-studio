import { cn } from '@/lib/utils';

/** The yellow "d" tile and wordmark, as in every Paper screen. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
    return (
        <span className={cn('flex items-center gap-2.5', className)}>
            <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-marker"
            >
                <span className="font-solfa text-[14px] leading-4.5 text-ink">d</span>
            </span>
            {!compact && (
                <span className="font-display text-[17px] leading-5.5 font-extrabold tracking-[-0.02em] text-ink">
                    Sol-fa Studio
                </span>
            )}
        </span>
    );
}
