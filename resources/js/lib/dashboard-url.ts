import type { DashboardView } from '@/types';

export type DashboardUrlParams = {
    view?: DashboardView;
    key?: string | null;
    sort?: 'edited' | 'title' | 'key';
    q?: string;
    all?: boolean;
};

export function dashboardUrl({
    view = 'all',
    key = null,
    sort = 'edited',
    q = '',
    all = false,
}: DashboardUrlParams): string {
    const search = new URLSearchParams();

    if (view !== 'all') {
        search.set('view', view);
    }

    if (key) {
        search.set('key', key);
    }

    if (sort !== 'edited') {
        search.set('sort', sort);
    }

    const query = q.trim();

    if (query !== '') {
        search.set('q', query);
    }

    if (all) {
        search.set('all', '1');
    }

    const string = search.toString();

    return string ? `/dashboard?${string}` : '/dashboard';
}
