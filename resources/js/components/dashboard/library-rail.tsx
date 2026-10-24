import { Link, router } from '@inertiajs/react';
import { initialsOf } from '@/components/avatar-menu';
import {
    AlertIcon,
    KeyIcon,
    LayersIcon,
    LogOutIcon,
    PenIcon,
    ScanIcon,
} from '@/components/icons';
import { KeyBadge } from '@/components/dashboard/key-badge';
import { cn } from '@/lib/utils';
import type {
    DashboardCounts,
    DashboardFilters,
    DashboardView,
    KeyCount,
    User,
} from '@/types';

type NavItem = {
    view: DashboardView;
    label: string;
    count: number;
    icon: typeof LayersIcon;
};

function hrefFor(view: DashboardView): string {
    return view === 'all' ? '/dashboard' : `/dashboard?view=${view}`;
}

export function LibraryRail({
    user,
    counts,
    keys,
    filters,
}: {
    user: User;
    counts: DashboardCounts;
    keys: KeyCount[];
    filters: DashboardFilters;
}) {
    const items: NavItem[] = [
        { view: 'all', label: 'All scores', count: counts.all, icon: LayersIcon },
        {
            view: 'review',
            label: 'Needs review',
            count: counts.review,
            icon: AlertIcon,
        },
        {
            view: 'composed',
            label: 'Composed',
            count: counts.composed,
            icon: PenIcon,
        },
        {
            view: 'scanned',
            label: 'Scanned',
            count: counts.scanned,
            icon: ScanIcon,
        },
    ];

    return (
        <aside className="sticky top-[60px] hidden h-[calc(100vh-60px)] w-[248px] shrink-0 flex-col overflow-y-auto border-r border-rule px-4 py-5 lg:flex">
            <div className="flex items-center gap-2.5 px-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-copy font-solfa text-[10.5px] font-medium text-ink">
                    {initialsOf(user.name)}
                </span>
                <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink">
                        {user.name}
                    </p>
                    <p className="truncate text-[10.5px] text-pencil">
                        {user.email ?? user.phone ?? 'Composer'}
                    </p>
                </div>
            </div>

            <nav className="mt-7 space-y-0.5" aria-label="Library">
                {items.map((item) => {
                    const active = filters.view === item.view;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.view}
                            href={hrefFor(item.view)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[12.5px] transition',
                                active
                                    ? 'bg-copy font-semibold text-ink'
                                    : 'font-medium text-pencil hover:bg-copy/65 hover:text-ink',
                            )}
                        >
                            <Icon
                                className={cn(
                                    'h-3.5 w-3.5 shrink-0',
                                    active ? 'text-ink' : 'text-pencil/80',
                                )}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.view === 'review' &&
                            item.count > 0 &&
                            !active ? (
                                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-marker px-1 font-solfa text-[9.5px] font-medium text-ink">
                                    {item.count}
                                </span>
                            ) : (
                                <span
                                    className={cn(
                                        'font-solfa text-[10px]',
                                        active ? 'text-pencil' : 'text-pencil/60',
                                    )}
                                >
                                    {item.count}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-7">
                <div className="flex items-center gap-1.5 px-2.5">
                    <KeyIcon className="h-3 w-3 text-pencil/70" />
                    <p className="text-[9px] font-semibold tracking-[0.14em] text-pencil uppercase">
                        Keys
                    </p>
                </div>
                <div className="mt-2 space-y-0.5">
                    {keys.map((entry) => {
                        const active = filters.key === entry.key;
                        const href = active
                            ? '/dashboard'
                            : `/dashboard?key=${encodeURIComponent(entry.key)}`;

                        return (
                            <Link
                                key={entry.key}
                                href={href}
                                aria-current={active ? 'true' : undefined}
                                className={cn(
                                    'flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[12px] transition',
                                    active
                                        ? 'bg-copy font-semibold text-ink'
                                        : 'font-medium text-pencil hover:bg-copy/65 hover:text-ink',
                                )}
                            >
                                <KeyBadge
                                    doh={entry.key}
                                    size="sm"
                                    alert={active}
                                    className="h-6 w-6 rounded-[6px] text-[9px]"
                                />
                                <span className="flex-1 truncate text-[11.5px] font-normal">
                                    Doh is {entry.key}
                                </span>
                                <span className="font-solfa text-[10px] text-pencil/60">
                                    {entry.count}
                                </span>
                            </Link>
                        );
                    })}
                    {keys.length === 0 && (
                        <p className="px-2.5 text-[11.5px] text-pencil">
                            Keys appear as you add scores.
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-auto pt-8">
                <div className="px-2.5 pb-4 font-solfa text-[10px] tracking-[0.28em] text-pencil/50">
                    d r m f s l t
                </div>
                <button
                    type="button"
                    onClick={() => router.post('/logout')}
                    className="flex h-9 w-full items-center gap-2.5 rounded-[9px] border border-rule px-2.5 text-[12px] font-medium text-pencil transition hover:bg-copy hover:text-ink"
                >
                    <LogOutIcon className="h-3.5 w-3.5" />
                    Sign out
                </button>
            </div>
        </aside>
    );
}
