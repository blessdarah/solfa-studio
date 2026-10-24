import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ChevronDownIcon, SearchIcon, XIcon } from '@/components/icons';
import { InsightRail } from '@/components/dashboard/insight-rail';
import { LibraryRail } from '@/components/dashboard/library-rail';
import { NewScoreModal } from '@/components/dashboard/new-score-modal';
import { ResumeCard } from '@/components/dashboard/resume-card';
import { ScoreLedger } from '@/components/dashboard/score-ledger';
import { Toast } from '@/components/toast';
import { TopBar } from '@/components/top-bar';
import { dashboardUrl } from '@/lib/dashboard-url';
import { cn } from '@/lib/utils';
import type {
    DashboardProps,
    DashboardSort,
    DashboardView,
} from '@/types';

const CHIPS: {
    view: DashboardView;
    label: string;
    countKey: 'all' | 'review' | 'composed' | 'scanned';
    marker?: boolean;
}[] = [
    { view: 'all', label: 'All', countKey: 'all' },
    { view: 'review', label: 'Needs review', countKey: 'review', marker: true },
    { view: 'composed', label: 'Composed', countKey: 'composed' },
    { view: 'scanned', label: 'Scanned', countKey: 'scanned' },
];

export default function Dashboard({
    scores,
    total,
    filtered_total,
    shown,
    counts,
    keys,
    resume,
    activity,
    shares,
    filters,
}: DashboardProps) {
    const { auth, flash } = usePage().props;
    const user = auth.user!;

    const [query, setQuery] = useState(filters.q);
    const [newScoreOpen, setNewScoreOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(flash.success ?? null);

    useEffect(() => {
        if (flash.success) {
            setToast(flash.success);
        }
    }, [flash.success]);

    useEffect(() => {
        setQuery(filters.q);
    }, [filters.q]);

    useEffect(() => {
        if (query === filters.q) {
            return;
        }

        const timer = window.setTimeout(() => {
            router.get(
                dashboardUrl({
                    view: filters.view,
                    key: filters.key,
                    sort: filters.sort,
                    q: query,
                    all: filters.all,
                }),
                {},
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                },
            );
        }, 320);

        return () => window.clearTimeout(timer);
    }, [
        query,
        filters.q,
        filters.view,
        filters.key,
        filters.sort,
        filters.all,
    ]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();

                const inputs = Array.from(
                    document.querySelectorAll<HTMLInputElement>(
                        '[data-score-search]',
                    ),
                );
                const input =
                    inputs.find(
                        (element) => element.offsetParent !== null,
                    ) ?? inputs[0];

                input?.focus();
                input?.select();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const hour = new Date().getHours();
    const greeting =
        hour < 12
            ? 'Good morning'
            : hour < 17
              ? 'Good afternoon'
              : 'Good evening';
    const firstName = user.name.split(/\s+/)[0] ?? user.name;

    const summaryLine =
        total === 0
            ? 'Your library is ready for its first score.'
            : [
                  `${total} ${total === 1 ? 'score' : 'scores'}`,
                  counts.review === 0
                      ? 'all caught up'
                      : `${counts.review} need${
                            counts.review === 1 ? 's' : ''
                        } a second look`,
                  counts.shared === 0
                      ? 'nothing shared yet'
                      : `${counts.shared} shared with the choir`,
              ].join(' · ');

    const changeView = (view: DashboardView) => {
        router.get(
            dashboardUrl({
                view,
                sort: filters.sort,
                q: filters.q,
                all: filters.all,
            }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    const changeSort = (sort: DashboardSort) => {
        router.get(
            dashboardUrl({
                view: filters.view,
                key: filters.key,
                sort,
                q: filters.q,
                all: filters.all,
            }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="Your scores" />

            <div className="min-h-screen bg-paper">
                <TopBar
                    user={user}
                    breadcrumb="Library"
                    search={{ value: query, onChange: setQuery }}
                    onNewScore={() => setNewScoreOpen(true)}
                />

                <div className="mx-auto flex w-full max-w-[1600px]">
                    <LibraryRail
                        user={user}
                        counts={counts}
                        keys={keys}
                        filters={filters}
                    />

                    <main className="min-w-0 flex-1 px-4 pt-7 pb-12 sm:px-7 lg:px-9">
                        <div>
                            <p className="text-[9.5px] font-semibold tracking-[0.16em] text-pencil uppercase">
                                {greeting}, {firstName}
                            </p>
                            <h1 className="mt-2 font-display text-[42px] leading-none font-extrabold tracking-[-0.055em] text-ink sm:text-[52px]">
                                Your scores
                            </h1>
                            <p className="mt-3 text-[12px] leading-5 text-pencil">
                                {summaryLine}
                            </p>
                        </div>

                        <label className="relative mt-5 block md:hidden">
                            <span className="sr-only">Search scores</span>
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-pencil" />
                            <input
                                id="score-search-mobile"
                                data-score-search
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Search scores"
                                autoComplete="off"
                                className="h-11 w-full rounded-full border border-rule bg-paper pr-10 pl-10 text-[13px] text-ink outline-none transition placeholder:text-pencil/60 focus:border-ink focus:ring-2 focus:ring-ink/10"
                            />
                            {query !== '' && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    aria-label="Clear search"
                                    className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-pencil hover:bg-copy hover:text-ink"
                                >
                                    <XIcon className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </label>

                        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {CHIPS.map((chip) => {
                                    const active =
                                        filters.view === chip.view;
                                    const count = counts[chip.countKey];

                                    return (
                                        <button
                                            key={chip.view}
                                            type="button"
                                            onClick={() =>
                                                changeView(chip.view)
                                            }
                                            className={cn(
                                                'inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-medium transition',
                                                active
                                                    ? 'border-ink bg-ink text-paper'
                                                    : 'border-rule bg-paper text-pencil hover:bg-copy hover:text-ink',
                                            )}
                                        >
                                            {chip.label}
                                            <span
                                                className={cn(
                                                    'ml-1.5 font-solfa text-[10px]',
                                                    active
                                                        ? 'text-paper/55'
                                                        : chip.marker &&
                                                            count > 0
                                                          ? 'rounded-full bg-marker px-1.5 py-0.5 font-medium text-ink'
                                                          : 'text-pencil/60',
                                                )}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}

                                {filters.key && (
                                    <Link
                                        href={dashboardUrl({
                                            view: filters.view,
                                            sort: filters.sort,
                                            q: filters.q,
                                            all: filters.all,
                                        })}
                                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-marker bg-marker px-3 text-[11px] font-semibold text-ink"
                                    >
                                        Key {filters.key}
                                        <XIcon className="h-3 w-3" />
                                    </Link>
                                )}
                            </div>

                            <div className="relative">
                                <select
                                    value={filters.sort}
                                    onChange={(event) =>
                                        changeSort(
                                            event.target
                                                .value as DashboardSort,
                                        )
                                    }
                                    aria-label="Sort scores"
                                    className="h-8 appearance-none rounded-full border border-rule bg-paper pr-8 pl-3 text-[11px] font-medium text-ink outline-none transition hover:bg-copy focus:border-ink"
                                >
                                    <option value="edited">
                                        Recently edited
                                    </option>
                                    <option value="title">Title A–Z</option>
                                    <option value="key">Key</option>
                                </select>
                                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-pencil" />
                            </div>
                        </div>

                        {keys.length > 0 && (
                            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 lg:hidden">
                                <span className="mr-1 shrink-0 text-[9px] font-semibold tracking-[0.14em] text-pencil uppercase">
                                    Keys
                                </span>
                                {keys.map((entry) => {
                                    const active =
                                        filters.key === entry.key;

                                    return (
                                        <Link
                                            key={entry.key}
                                            href={dashboardUrl({
                                                view: filters.view,
                                                key: active
                                                    ? null
                                                    : entry.key,
                                                sort: filters.sort,
                                                q: filters.q,
                                                all: filters.all,
                                            })}
                                            className={cn(
                                                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 font-solfa text-[10px] transition',
                                                active
                                                    ? 'border-ink bg-ink text-paper'
                                                    : 'border-rule bg-paper text-ink hover:bg-copy',
                                            )}
                                        >
                                            {entry.key}
                                            <span
                                                className={
                                                    active
                                                        ? 'text-paper/55'
                                                        : 'text-pencil/55'
                                                }
                                            >
                                                {entry.count}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}

                        {resume && (
                            <div className="mt-6 xl:hidden">
                                <ResumeCard score={resume} compact />
                            </div>
                        )}

                        <ScoreLedger
                            scores={scores}
                            filters={filters}
                            total={total}
                            filteredTotal={filtered_total}
                            shown={shown}
                            onNewScore={() => setNewScoreOpen(true)}
                        />
                    </main>

                    <InsightRail
                        resume={resume}
                        counts={counts}
                        activity={activity}
                        shares={shares}
                    />
                </div>
            </div>

            <NewScoreModal
                open={newScoreOpen}
                onClose={() => setNewScoreOpen(false)}
                user={user}
            />

            <Toast message={toast} onClose={() => setToast(null)} />
        </>
    );
}
