import { Link, router, useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import {
    ArchiveIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    LayersIcon,
    LogOutIcon,
    PlusIcon,
    ScanIcon,
    TrashIcon,
    UsersIcon,
} from '@/components/icons';
import { dashboardUrl } from '@/lib/dashboard-url';
import { useDismiss } from '@/lib/use-dismiss';
import { cn } from '@/lib/utils';
import type { CollectionItem, DashboardFilters, DashboardProps, User, Workspace } from '@/types';

export const SCORE_DRAG_TYPE = 'application/x-solfa-score';

/** The score id being dragged, if the drag carries one. */
function draggedScore(event: DragEvent): string | null {
    return event.dataTransfer.types.includes(SCORE_DRAG_TYPE) ? event.dataTransfer.getData(SCORE_DRAG_TYPE) : null;
}

/**
 * A rail row that also takes a dropped score row (to archive it, restore
 * it, or file it in a collection).
 */
function DropRow({
    href,
    active,
    onDropScore,
    className,
    children,
}: {
    href: string;
    active: boolean;
    onDropScore?: (scoreId: string) => void;
    className?: string;
    children: ReactNode;
}) {
    const [over, setOver] = useState(false);

    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            onDragOver={(event) => {
                if (onDropScore && event.dataTransfer.types.includes(SCORE_DRAG_TYPE)) {
                    event.preventDefault();
                    setOver(true);
                }
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
                const id = draggedScore(event);
                setOver(false);

                if (id && onDropScore) {
                    event.preventDefault();
                    onDropScore(id);
                }
            }}
            className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-[8px] px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ink/15',
                active ? 'bg-copy' : 'hover:bg-copy/60',
                over && 'bg-wash ring-[1.5px] ring-ink',
                className,
            )}
        >
            {children}
        </Link>
    );
}

function WorkspaceMenu({ workspace, user }: { workspace: Workspace; user: User }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useDismiss(ref, open, () => setOpen(false));

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex w-full shrink-0 items-center gap-2.5 rounded-[8px] px-1.5 py-1 text-left outline-none hover:bg-copy/60 focus-visible:ring-2 focus-visible:ring-ink/15"
            >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-copy">
                    <span className="font-solfa text-[10px] leading-3.5 tracking-[0.02em] text-ink">
                        {workspace.initials}
                    </span>
                </span>
                <span className="flex min-w-0 grow basis-0 flex-col gap-px">
                    <span className="truncate text-[13px] leading-4.25 font-semibold text-ink">{workspace.name}</span>
                    <span className="truncate text-[11.5px] leading-3.75 text-pencil">
                        {workspace.role} · {workspace.plan}
                    </span>
                </span>
                <ChevronDownIcon className="text-pencil" />
            </button>

            {open && (
                <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 rounded-md border border-rule bg-paper p-1.5 shadow-[0_20px_50px_#00000024]">
                    <div className="px-2.5 py-2">
                        <p className="truncate text-[13px] leading-4.25 font-semibold text-ink">{user.name}</p>
                        <p className="mt-px truncate text-[11.5px] leading-3.75 text-pencil">
                            {user.email ?? user.phone ?? ''}
                        </p>
                    </div>
                    <div className="my-1 h-px bg-rule" />
                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13.5px] leading-4.5 font-medium text-ink hover:bg-copy"
                    >
                        <LogOutIcon className="text-pencil" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

const SQUARE: Record<CollectionItem['color'], string> = {
    ink: 'bg-ink',
    marker: 'bg-marker',
    grey: 'bg-faint',
};

function NewCollection({ onDone }: { onDone: () => void }) {
    const form = useForm({ name: '' });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post('/collections', { preserveScroll: true, onSuccess: () => onDone() });
            }}
            className="flex h-8 shrink-0 items-center gap-2.5 rounded-[8px] px-2.5"
        >
            <span className="flex size-4 shrink-0 items-center justify-center">
                <span className="size-1.5 shrink-0 rounded-[2px] bg-rule" />
            </span>
            <input
                autoFocus
                value={form.data.name}
                onChange={(event) => form.setData('name', event.target.value)}
                onBlur={() => form.data.name.trim() === '' && onDone()}
                onKeyDown={(event) => event.key === 'Escape' && onDone()}
                placeholder="Name the collection"
                aria-label="Collection name"
                aria-invalid={form.errors.name ? true : undefined}
                className="min-w-0 grow bg-transparent text-[13px] leading-4.25 text-ink outline-none placeholder:text-pencil"
            />
        </form>
    );
}

export function LibraryRail({
    user,
    workspace,
    nav,
    collections,
    filters,
    onScan,
}: {
    user: User;
    workspace: Workspace;
    nav: DashboardProps['nav'];
    collections: CollectionItem[];
    filters: DashboardFilters;
    onScan: () => void;
}) {
    const [adding, setAdding] = useState(false);
    const keep = { sort: filters.sort };

    const post = (url: string, data: Record<string, string> = {}) =>
        router.post(url, data, { preserveScroll: true, preserveState: true });

    const restore = (scoreId: string) => {
        if (filters.view === 'archive') {
            router.delete(`/scores/${scoreId}/archive`, { preserveScroll: true, preserveState: true });
        } else if (filters.view === 'collection' && filters.collection) {
            router.delete(`/collections/${filters.collection}/scores/${scoreId}`, {
                preserveScroll: true,
                preserveState: true,
            });
        }
    };

    const items = [
        {
            view: 'all' as const,
            label: 'All scores',
            icon: LayersIcon,
            count: nav.all,
            drop: filters.view === 'archive' || filters.view === 'collection' ? restore : undefined,
        },
        { view: 'review' as const, label: 'Needs review', icon: CheckCircleIcon, count: nav.review, badge: true },
        { view: 'shared' as const, label: 'Shared with me', icon: UsersIcon, count: nav.shared },
        {
            view: 'archive' as const,
            label: 'Archive',
            icon: ArchiveIcon,
            count: nav.archive,
            drop: filters.view !== 'archive' && filters.view !== 'shared'
                ? (id: string) => post(`/scores/${id}/archive`)
                : undefined,
        },
        ...(nav.deleted > 0 || filters.view === 'deleted'
            ? [{ view: 'deleted' as const, label: 'Recently deleted', icon: TrashIcon, count: nav.deleted }]
            : []),
    ];

    return (
        <aside className="flex w-62 shrink-0 flex-col border-r border-rule bg-paper px-4 pt-5 pb-4">
            <WorkspaceMenu workspace={workspace} user={user} />

            <nav className="flex shrink-0 flex-col gap-0.5 pt-6" aria-label="Library">
                {items.map((item) => {
                    const active = filters.view === item.view;
                    const Icon = item.icon;

                    return (
                        <DropRow
                            key={item.view}
                            href={dashboardUrl({ ...keep, view: item.view })}
                            active={active}
                            onDropScore={item.drop}
                            className="h-9"
                        >
                            <Icon className={active ? 'text-ink' : 'text-pencil'} />
                            <span
                                className={cn(
                                    'grow basis-0 truncate text-[13.5px] leading-4.5 text-ink',
                                    active ? 'font-semibold' : 'font-medium',
                                )}
                            >
                                {item.label}
                            </span>
                            {item.badge && item.count > 0 ? (
                                <span className="flex h-4.5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-marker font-solfa text-[10px] leading-3 text-ink">
                                    {item.count}
                                </span>
                            ) : (
                                <span className="shrink-0 font-solfa text-[11px] leading-3.5 text-pencil">{item.count}</span>
                            )}
                        </DropRow>
                    );
                })}
            </nav>

            <div className="flex shrink-0 flex-col gap-px pt-7">
                <div className="flex h-6 shrink-0 items-center justify-between px-2.5">
                    <span className="text-[10.5px] leading-3.5 font-semibold tracking-[0.1em] text-pencil">COLLECTIONS</span>
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        aria-label="New collection"
                        className="flex size-5 items-center justify-center rounded-full text-pencil outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/15"
                    >
                        <PlusIcon strokeWidth={1.5} />
                    </button>
                </div>

                {collections.map((collection) => (
                    <DropRow
                        key={collection.id}
                        href={dashboardUrl({ ...keep, view: 'collection', collection: collection.id })}
                        active={filters.view === 'collection' && filters.collection === collection.id}
                        onDropScore={(id) => post(`/collections/${collection.id}/scores`, { score_id: id })}
                        className="h-8"
                    >
                        <span className="flex size-4 shrink-0 items-center justify-center">
                            <span className={cn('size-1.5 shrink-0 rounded-[2px]', SQUARE[collection.color])} />
                        </span>
                        <span className="grow basis-0 truncate text-[13px] leading-4.25 text-ink">{collection.name}</span>
                        <span className="shrink-0 font-solfa text-[11px] leading-3.5 text-pencil">{collection.count}</span>
                    </DropRow>
                ))}

                {adding && <NewCollection onDone={() => setAdding(false)} />}
            </div>

            <div className="min-h-4 grow basis-0" />

            <div className="flex shrink-0 flex-col gap-3.5 px-1">
                <div className="font-solfa text-[10px] leading-3.5 tracking-[0.24em] text-faint" aria-hidden="true">
                    d r m f s l t
                </div>
                <button
                    type="button"
                    onClick={onScan}
                    className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-marker text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2"
                >
                    <ScanIcon />
                    <span className="text-[13.5px] leading-4.5 font-semibold">Scan a score</span>
                </button>
            </div>
        </aside>
    );
}
