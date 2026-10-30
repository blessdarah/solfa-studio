/**
 * Small JSON requests to the app (publish, unpublish…), with Laravel's
 * CSRF cookie. Page changes go through Inertia's router instead.
 */
function xsrf(): string {
    const match = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.slice('XSRF-TOKEN='.length)) : '';
}

export async function requestJson<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
): Promise<{ ok: boolean; status: number; data: T & { message?: string } }> {
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrf(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as T & { message?: string };

    return { ok: response.ok, status: response.status, data };
}
