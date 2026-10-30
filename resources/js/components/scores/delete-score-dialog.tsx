import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { ArchiveIcon, TrashIcon } from '@/components/icons';
import type { ScoreSummary } from '@/types';

/**
 * "Delete Yesu Ne Hene?" (Paper W12): what goes with it — the music, the
 * words, its public page — with Archive offered instead. Deleted scores
 * wait 30 days in Recently deleted.
 */
export function DeleteScoreDialog({ score, onClose }: { score: ScoreSummary; onClose: () => void }) {
    const cancel = useRef<HTMLButtonElement>(null);
    const [busy, setBusy] = useState(false);
    const voices = score.voice_progress.filter((v) => v.state !== 'empty').map((v) => v.voice);

    useEffect(() => {
        cancel.current?.focus();

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const act = (go: () => void) => {
        setBusy(true);
        go();
    };

    const rows: [string, string][] = [
        ['Music', `${voices.length > 0 ? voices.join(' ') : 'No notes yet'} · ${score.bars} bars`],
        ['Public page', score.published ? `Live · ${score.publishing.visits} visits` : 'Not published'],
        ['Shared', score.shared ? (score.share_label ?? 'Yes') : 'Only you'],
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/18 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="delete-score-title" className="flex w-110 max-w-full flex-col gap-5 rounded-lg bg-paper p-7 shadow-[0_30px_80px_#00000038]">
                <div className="flex flex-col gap-2">
                    <div className="flex size-10 items-center justify-center rounded-md bg-danger/8 text-danger">
                        <TrashIcon size={20} strokeWidth={1.3} />
                    </div>
                    <h2 id="delete-score-title" className="pt-1.5 font-display text-[22px] leading-6.5 font-extrabold tracking-[-0.02em] text-ink">
                        Delete {score.title}?
                    </h2>
                    <p className="text-[14px] leading-5 text-pencil">
                        The score, its parts and words leave your library.
                        {score.published ? ' Its public page stops working for everyone who has the link.' : ''}
                    </p>
                </div>

                <div className="flex flex-col rounded-md bg-copy px-3.5 py-1.5">
                    {rows.map(([label, value], i) => (
                        <div key={label} className={i > 0 ? 'border-t border-rule' : undefined}>
                            <div className="flex h-8.5 items-center justify-between gap-4">
                                <span className="text-[13.5px] leading-4.5 text-ink">{label}</span>
                                <span className="truncate text-[13px] leading-4 text-ink">{value}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {!score.archived && (
                    <div className="flex items-center gap-2.5 rounded-md border border-rule px-3 py-2.5">
                        <ArchiveIcon className="text-ink" />
                        <span className="grow basis-0 text-[12.5px] leading-4.25 text-ink">Only want it out of sight? Archive keeps it, and its public page, safe.</span>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => act(() => router.post(`/scores/${score.id}/archive`, {}, { preserveScroll: true, onFinish: onClose }))}
                            className="shrink-0 text-[13px] leading-4 font-semibold text-ink underline hover:no-underline"
                        >
                            Archive
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] leading-4 text-pencil">Kept 30 days in Recently deleted.</span>
                    <div className="flex shrink-0 gap-2">
                        <button
                            ref={cancel}
                            type="button"
                            onClick={onClose}
                            className="flex h-10 items-center rounded-full border border-rule px-4 text-[14px] leading-4.5 font-semibold text-ink outline-none hover:bg-copy focus-visible:ring-2 focus-visible:ring-ink/20"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => act(() => router.delete(`/scores/${score.id}`, { preserveScroll: true, onFinish: onClose }))}
                            className="flex h-10 items-center rounded-full bg-danger px-4 text-[14px] leading-4.5 font-semibold text-paper outline-none focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2 disabled:opacity-50"
                        >
                            Delete score
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
