import { cn } from '@/lib/utils';
import type { DohKey } from '@/types';

export function KeyBadge({
    doh,
    alert = false,
    size = 'md',
    className,
}: {
    doh: DohKey | string;
    alert?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}) {
    return (
        <span
            title={`Doh is ${doh}`}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-[9px] font-solfa font-medium tracking-[-0.03em]',
                size === 'md'
                    ? 'h-9 w-9 text-[11.5px]'
                    : 'h-7 w-7 rounded-[7px] text-[10px]',
                alert ? 'bg-marker text-ink' : 'bg-copy text-ink',
                className,
            )}
        >
            {doh}
        </span>
    );
}
