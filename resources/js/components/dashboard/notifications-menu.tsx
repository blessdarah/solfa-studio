import { Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { BellIcon } from '@/components/icons';
import { useDismiss } from '@/lib/use-dismiss';
import type { NotificationItem } from '@/types';

/**
 * The bell in the top bar. A marker dot means something new; opening it
 * shows the latest and marks them seen.
 */
export function NotificationsMenu({ unread, items }: { unread: number; items: NotificationItem[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useDismiss(ref, open, () => setOpen(false));

    const toggle = () => {
        const next = !open;
        setOpen(next);

        if (next && unread > 0) {
            router.post('/notifications/read', {}, { preserveScroll: true, preserveState: true, only: ['notifications'] });
        }
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={toggle}
                aria-label={unread > 0 ? `${unread} new notifications` : 'Notifications'}
                aria-expanded={open}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-copy text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
            >
                <BellIcon />
                {unread > 0 && <span className="absolute top-2 right-2.25 size-1.5 rounded-full bg-marker" />}
            </button>

            {open && (
                <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-80 rounded-md border border-rule bg-paper p-4 shadow-[0_20px_50px_#00000024]">
                    <p className="pb-3 text-[10px] leading-3.5 font-semibold tracking-[0.12em] text-pencil">
                        NOTIFICATIONS
                    </p>
                    {items.length === 0 ? (
                        <p className="text-[12.5px] leading-4 text-pencil">Nothing new yet.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {items.map((item) => (
                                <Link
                                    key={item.id}
                                    href={item.score_id ? `/scores/${item.score_id}` : '/dashboard'}
                                    className="flex items-start gap-2.5"
                                >
                                    <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-copy font-solfa text-[9px] leading-3 text-ink">
                                        {item.initials}
                                    </span>
                                    <span className="flex min-w-0 grow flex-col gap-px">
                                        <span className="text-[12.5px] leading-4 font-semibold text-ink">{item.actor}</span>
                                        <span className="text-[11.5px] leading-3.75 text-pencil">{item.text}</span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
