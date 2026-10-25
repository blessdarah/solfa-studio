import type { DashboardFilters } from '@/types';

/**
 * Builds a library URL, leaving out anything at its default so links stay
 * short: /dashboard?view=collection&collection=3&kind=arrangements
 */
export function dashboardUrl(filters: Partial<DashboardFilters>): string {
    const search = new URLSearchParams();
    const view = filters.view ?? 'all';

    if (view !== 'all') {
        search.set('view', view);
    }

    if (view === 'collection' && filters.collection) {
        search.set('collection', String(filters.collection));
    }

    if (view === 'rehearsal' && filters.rehearsal) {
        search.set('rehearsal', String(filters.rehearsal));
    }

    if (filters.kind && filters.kind !== 'all') {
        search.set('kind', filters.kind);
    }

    if (filters.sort && filters.sort !== 'edited') {
        search.set('sort', filters.sort);
    }

    const q = (filters.q ?? '').trim();

    if (q !== '') {
        search.set('q', q);
    }

    if (filters.all) {
        search.set('all', '1');
    }

    const string = search.toString();

    return string ? `/dashboard?${string}` : '/dashboard';
}
