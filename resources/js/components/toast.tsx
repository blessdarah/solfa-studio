import { useEffect, useRef } from 'react';
import { XIcon } from '@/components/icons';

export function Toast({
    message,
    onClose,
}: {
    message: string | null;
    onClose: () => void;
}) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        if (!message) {
            return;
        }

        const timer = window.setTimeout(() => closeRef.current(), 4500);

        return () => window.clearTimeout(timer);
    }, [message]);

    if (!message) {
        return null;
    }

    return (
        <div
            role="status"
            className="fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-full border border-rule bg-paper py-2.5 pr-2 pl-4 shadow-[0_16px_45px_rgba(17,17,17,0.14)] sm:bottom-7"
        >
            <span className="h-2 w-2 shrink-0 rounded-full bg-marker ring-1 ring-ink/10" />
            <p className="text-[12.5px] font-medium text-ink">{message}</p>
            <button
                type="button"
                onClick={onClose}
                aria-label="Dismiss"
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-pencil transition hover:bg-copy hover:text-ink"
            >
                <XIcon className="h-3 w-3" />
            </button>
        </div>
    );
}
