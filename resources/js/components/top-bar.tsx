import { Link } from '@inertiajs/react';
import { forwardRef } from 'react';
import { AvatarMenu } from '@/components/avatar-menu';
import { NotificationsMenu } from '@/components/dashboard/notifications-menu';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { Logo } from '@/components/logo';
import type { NotificationItem, User } from '@/types';

/**
 * The library's top bar (Paper W0): logo, "Workspace / Library", search
 * with ⌘K, the bell, New score and the account initial.
 */
export const TopBar = forwardRef<
    HTMLInputElement,
    {
        user: User;
        crumb: string;
        search: string;
        onSearch: (value: string) => void;
        onNewScore: () => void;
        notifications: { unread: number; items: NotificationItem[] };
    }
>(function TopBar({ user, crumb, search, onSearch, onNewScore, notifications }, searchRef) {
    return (
        <header className="flex h-15 w-full shrink-0 items-center justify-between border-b border-rule bg-paper px-5">
            <div className="flex items-center gap-5">
                <Link href="/dashboard" className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ink/20">
                    <Logo />
                </Link>
                <div className="h-5 w-px shrink-0 bg-rule" />
                <nav className="flex items-center gap-2" aria-label="Breadcrumb">
                    <Link href="/dashboard" className="text-[13.5px] leading-4.5 text-pencil hover:text-ink">
                        Workspace
                    </Link>
                    <span className="text-[13.5px] leading-4.5 text-faint">/</span>
                    <span className="text-[13.5px] leading-4.5 font-medium text-ink">{crumb}</span>
                </nav>
            </div>

            <div className="flex items-center gap-2.5">
                <label className="flex h-9 w-62.5 shrink-0 items-center gap-2 rounded-full bg-copy px-3 focus-within:ring-2 focus-within:ring-ink/10">
                    <SearchIcon className="text-pencil" />
                    <span className="sr-only">Search scores</span>
                    <input
                        ref={searchRef}
                        value={search}
                        onChange={(event) => onSearch(event.target.value)}
                        placeholder="Search scores, composers"
                        autoComplete="off"
                        className="min-w-0 grow bg-transparent text-[13px] leading-4 text-ink outline-none placeholder:text-pencil"
                    />
                    <kbd className="flex shrink-0 items-center rounded-[4px] bg-paper px-1.25 py-0.5 font-solfa text-[10px] leading-3 text-pencil">
                        ⌘K
                    </kbd>
                </label>

                <NotificationsMenu unread={notifications.unread} items={notifications.items} />

                <button
                    type="button"
                    onClick={onNewScore}
                    className="flex h-9 shrink-0 items-center gap-1.75 rounded-full bg-ink px-4 text-paper outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2"
                >
                    <PlusIcon />
                    <span className="text-[13.5px] leading-4.5 font-semibold">New score</span>
                </button>

                <AvatarMenu user={user} />
            </div>
        </header>
    );
});
