import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { InsightRail } from '@/components/dashboard/insight-rail';
import { LibraryRail } from '@/components/dashboard/library-rail';
import { NewScoreModal } from '@/components/dashboard/new-score-modal';
import { RehearsalModal } from '@/components/dashboard/rehearsal-modal';
import { ScoreLedger } from '@/components/dashboard/score-ledger';
import { Toast } from '@/components/toast';
import { TopBar } from '@/components/top-bar';
import { dashboardUrl } from '@/lib/dashboard-url';
import type { DashboardProps } from '@/types';

function greeting(): string {
    const hour = new Date().getHours();

    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * The library (Paper W0 — Dashboard · Scores).
 */
export default function Dashboard(props: DashboardProps) {
    const { auth, flash } = usePage().props;
    const user = auth.user!;
    const { filters, counts } = props;

    const [query, setQuery] = useState(filters.q);
    const [newScore, setNewScore] = useState(false);
    const [planning, setPlanning] = useState(false);
    const [toast, setToast] = useState<string | null>(flash.success ?? null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => setToast(flash.success ?? null), [flash.success]);

    useEffect(() => setQuery(filters.q), [filters.q]);

    // Search as you type, without stacking up history entries.
    useEffect(() => {
        if (query === filters.q) {
            return;
        }

        const timer = window.setTimeout(() => {
            router.get(dashboardUrl({ ...filters, q: query, all: false }), {}, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [query, filters]);

    // ⌘K / Ctrl-K jumps to search.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const firstName = (user.name.split(/\s+/)[0] ?? user.name).toUpperCase();
    const summary =
        filters.view === 'all'
            ? [
                  `${counts.all} ${counts.all === 1 ? 'score' : 'scores'}`,
                  `${counts.review} need${counts.review === 1 ? 's' : ''} a second look`,
                  `${counts.shared} shared with the choir`,
              ].join(' · ')
            : `${props.filtered_total} ${props.filtered_total === 1 ? 'score' : 'scores'}`;

    const emptyText =
        filters.q !== ''
            ? 'No scores match your search.'
            : filters.view === 'archive'
              ? 'Drag a score onto Archive to put it away.'
              : filters.view === 'collection'
                ? 'Drag scores onto this collection to add them.'
                : filters.view === 'shared'
                  ? 'Scores other people share with you appear here.'
                  : 'No scores yet. Start one with New score.';

    return (
        <>
            <Head title={props.heading} />

            <div className="flex h-screen min-h-[640px] flex-col bg-paper">
                <TopBar
                    ref={searchRef}
                    user={user}
                    crumb="Library"
                    search={query}
                    onSearch={setQuery}
                    onNewScore={() => setNewScore(true)}
                    notifications={props.notifications}
                />

                <div className="flex min-h-0 w-full grow basis-0 bg-paper">
                    <div className="hidden lg:flex">
                        <LibraryRail
                            user={user}
                            workspace={props.workspace}
                            nav={props.nav}
                            collections={props.collections}
                            filters={filters}
                            onScan={() => setToast('Scanning a paper score is coming to the web soon.')}
                        />
                    </div>

                    <main className="flex min-w-0 grow basis-0 flex-col overflow-y-auto px-9 pt-9 pb-5">
                        <div className="flex shrink-0 flex-col gap-2">
                            <div className="text-[10.5px] leading-3.5 font-semibold tracking-[0.11em] text-pencil">
                                {greeting().toUpperCase()}, {firstName}
                            </div>
                            <h1 className="font-display text-[56px] leading-14 font-extrabold tracking-[-0.035em] text-ink">
                                {props.heading}
                            </h1>
                            <div className="text-[13.5px] leading-5 text-pencil">{summary}</div>
                        </div>

                        <ScoreLedger
                            scores={props.scores}
                            filters={filters}
                            kinds={props.kinds}
                            shown={props.shown}
                            filteredTotal={props.filtered_total}
                            emptyText={emptyText}
                        />
                    </main>

                    <div className="hidden xl:flex">
                        <InsightRail
                            resume={props.resume}
                            counts={counts}
                            activity={props.activity}
                            rehearsal={props.rehearsal}
                            onPlanRehearsal={() => setPlanning(true)}
                            onJump={() => searchRef.current?.focus()}
                        />
                    </div>
                </div>
            </div>

            <NewScoreModal open={newScore} onClose={() => setNewScore(false)} user={user} />
            <RehearsalModal
                open={planning}
                onClose={() => setPlanning(false)}
                scores={props.choices}
                ensemble={props.workspace.name}
            />
            <Toast message={toast} onClose={() => setToast(null)} />
        </>
    );
}
