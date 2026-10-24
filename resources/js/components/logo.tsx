import { cn } from '@/lib/utils';

export function Logo({
    className,
    compact = false,
}: {
    className?: string;
    compact?: boolean;
}) {
    return (
        <span className={cn('flex items-center gap-2.5', className)}>
            <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-[7px] bg-marker font-solfa text-[12px] font-semibold text-ink"
            >
                d
            </span>
            {!compact && (
                <span className="font-display text-[16px] font-extrabold tracking-[-0.035em] text-ink">
                    Sol-fa Studio
                </span>
            )}
        </span>
    );
}
