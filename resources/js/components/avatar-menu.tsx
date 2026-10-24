import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { LogOutIcon } from '@/components/icons';
import type { User } from '@/types';
import { cn } from '@/lib/utils';

export function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';

    return (first + last).toUpperCase();
}

export function AvatarMenu({ user }: { user: User }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onPointer = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Account menu"
                className="flex size-8 items-center justify-center rounded-full bg-ink font-solfa text-[11px] font-medium text-paper outline-none transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2"
            >
                {initialsOf(user.name)}
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute top-[calc(100%+10px)] right-0 z-50 w-60 rounded-2xl border border-rule bg-paper p-1.5 shadow-[0_18px_50px_rgba(17,17,17,0.12)]"
                >
                    <div className="px-3 py-2.5">
                        <p className="truncate text-[13px] font-semibold text-ink">
                            {user.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-pencil">
                            {user.email ?? user.phone ?? 'Composer'}
                        </p>
                    </div>
                    <div className="my-1 h-px bg-rule" />
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => router.post('/logout')}
                        className={cn(
                            'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium text-ink transition',
                            'hover:bg-copy focus-visible:bg-copy focus-visible:outline-none',
                        )}
                    >
                        <LogOutIcon className="h-3.5 w-3.5 text-pencil" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
