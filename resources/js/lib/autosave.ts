import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScoreDocument } from '@/types/score';

export type SaveState =
    | { kind: 'saved'; at: number }
    | { kind: 'saving' }
    | { kind: 'conflict' }
    | { kind: 'error'; message: string };

function xsrf(): string {
    const match = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.slice('XSRF-TOKEN='.length)) : '';
}

/**
 * Saves the whole document shortly after each change. The version number
 * travels with every save, so a second tab can't silently overwrite this
 * one — the server answers 409 instead.
 */
export function useAutosave(scoreId: string, initialVersion: number, savedAt: string | null, enabled: boolean) {
    const version = useRef(initialVersion);
    const pending = useRef<ScoreDocument | null>(null);
    const inFlight = useRef(false);
    const timer = useRef<number | null>(null);
    const [state, setState] = useState<SaveState>({
        kind: 'saved',
        at: savedAt ? Date.parse(savedAt) : Date.now(),
    });

    const flush = useCallback(async () => {
        if (inFlight.current || pending.current === null) {
            return;
        }

        const document = pending.current;
        pending.current = null;
        inFlight.current = true;
        setState({ kind: 'saving' });

        try {
            const response = await fetch(`/scores/${scoreId}/document`, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrf(),
                },
                body: JSON.stringify({ version: version.current, document }),
            });

            if (response.status === 409) {
                setState({ kind: 'conflict' });

                return;
            }

            const body = (await response.json().catch(() => ({}))) as { version?: number; message?: string };

            if (!response.ok) {
                setState({ kind: 'error', message: body.message ?? 'Could not save. Check your connection.' });

                return;
            }

            version.current = body.version ?? version.current + 1;
            setState({ kind: 'saved', at: Date.now() });
        } catch {
            pending.current = pending.current ?? document;
            setState({ kind: 'error', message: 'Offline — your changes will save when you reconnect.' });
        } finally {
            inFlight.current = false;

            if (pending.current !== null) {
                void flush();
            }
        }
    }, [scoreId]);

    const save = useCallback(
        (document: ScoreDocument) => {
            if (!enabled) {
                return;
            }

            pending.current = document;

            if (timer.current !== null) {
                window.clearTimeout(timer.current);
            }

            timer.current = window.setTimeout(() => void flush(), 600);
        },
        [enabled, flush],
    );

    // Try to send anything unsaved before the page goes away.
    useEffect(() => {
        const onLeave = () => {
            if (pending.current !== null) {
                void flush();
            }
        };

        window.addEventListener('online', onLeave);
        window.addEventListener('beforeunload', onLeave);

        return () => {
            window.removeEventListener('online', onLeave);
            window.removeEventListener('beforeunload', onLeave);
        };
    }, [flush]);

    return { save, state };
}

/** "Saved 4s ago" — refreshed every few seconds. */
export function useSavedLabel(state: SaveState): string {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(id);
    }, []);

    if (state.kind === 'saving') return 'Saving…';
    if (state.kind === 'conflict') return 'Changed elsewhere';
    if (state.kind === 'error') return 'Not saved';

    const seconds = Math.max(0, Math.round((now - state.at) / 1000));

    if (seconds < 60) return `Saved ${seconds}s ago`;
    if (seconds < 3600) return `Saved ${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `Saved ${Math.floor(seconds / 3600)}h ago`;

    return `Saved ${new Date(state.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
