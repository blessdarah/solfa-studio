import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { LogOutIcon } from '@/components/icons';
import { useDismiss } from '@/lib/use-dismiss';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

/**
 * The round initial at the right of the top bar ("B"), opening a menu with
 * the account and sign out.
 */
export function AvatarMenu({ user, size = 'md' }: { user: User; size?: 'md' | 'lg' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useDismiss(ref, open, () => setOpen(false));

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Account menu"
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-full bg-copy font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
                    size === 'lg' ? 'size-9 text-[13px] leading-4' : 'size-8.5 text-[12px] leading-4',
                )}
            >
                {user.name.trim().charAt(0).toUpperCase()}
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute top-[calc(100%+8px)] right-0 z-50 w-60 rounded-md border border-rule bg-paper p-1.5 shadow-[0_20px_50px_#00000024]"
                >
                    <div className="px-2.5 py-2">
                        <p className="truncate text-[13px] leading-4.25 font-semibold text-ink">{user.name}</p>
                        <p className="mt-px truncate text-[11.5px] leading-3.75 text-pencil">
                            {user.email ?? user.phone ?? ''}
                        </p>
                    </div>
                    <div className="my-1 h-px bg-rule" />
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => router.post('/logout')}
                        className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13.5px] leading-4.5 font-medium text-ink hover:bg-copy focus-visible:bg-copy focus-visible:outline-none"
                    >
                        <LogOutIcon className="text-pencil" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
