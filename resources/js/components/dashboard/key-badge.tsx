import { keyLabel } from '@/lib/music';
import { cn } from '@/lib/utils';

/** The square key tile at the start of a library row: "E♭", yellow when it needs review. */
export function KeyBadge({ doh, alert = false }: { doh: string; alert?: boolean }) {
    return (
        <span
            title={`Doh is ${keyLabel(doh)}`}
            className={cn(
                'flex size-9.5 items-center justify-center rounded-[8px] font-solfa text-[12.5px] leading-4 text-ink',
                alert ? 'bg-marker' : 'bg-copy',
            )}
        >
            {keyLabel(doh)}
        </span>
    );
}
