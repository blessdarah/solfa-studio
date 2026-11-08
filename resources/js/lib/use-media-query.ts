import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches, kept up to date as the window changes.
 * On the server (and before hydration) it answers false.
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);

            return () => list.removeEventListener('change', onChange);
        },
        [query],
    );

    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => false,
    );
}

/** Below Tailwind's `md` (768px): a phone, where the editor gives way to the read-and-play view. */
export const PHONE_QUERY = '(max-width: 767.98px)';
