import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '@/components/icons';
import { requestJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { Publishing } from '@/types';

type Option = 'allow_play' | 'allow_print' | 'show_words' | 'listed';

const OPTIONS: { key: Option; label: string; hint: string; off?: string }[] = [
    { key: 'allow_play', label: 'Listen and practise', hint: 'Play, slow down, hear one part' },
    { key: 'allow_print', label: 'Print or save a PDF', hint: 'Same pages as your print view' },
    { key: 'show_words', label: 'Read the words', hint: 'Every verse under the notes' },
    { key: 'listed', label: 'Show in song search', hint: 'Anyone can find it on Sol-fa Studio', off: 'Off: only people with the link' },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            onClick={onChange}
            className={cn(
                'flex h-5 w-8.5 shrink-0 items-center rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ink/25',
                on ? 'justify-end bg-ink' : 'justify-start bg-rule',
            )}
        >
            <span className="size-4 rounded-full bg-paper" />
        </button>
    );
}

/**
 * Publish a score (Paper W13): its public link, publishing newer changes,
 * what visitors can do, sending it to the choir, and unpublishing.
 */
export function PublishDialog({
    scoreId,
    title,
    publishing,
    onChange,
    onClose,
}: {
    scoreId: string;
    title: string;
    publishing: Publishing;
    onChange: (state: Publishing) => void;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const close = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        close.current?.focus();

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const send = async (method: 'POST' | 'PATCH' | 'DELETE', body?: Partial<Record<Option, boolean>>, done?: string) => {
        setBusy(true);
        setNote(null);

        try {
            const { ok, data } = await requestJson<Publishing>(method, `/scores/${scoreId}/publish`, body);

            if (!ok) {
                setNote(data.message ?? 'That did not work. Try again.');

                return;
            }

            onChange(data);
            if (done) setNote(done);
        } catch {
            setNote('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    const copy = async () => {
        if (!publishing.url) return;

        await navigator.clipboard?.writeText(publishing.url).catch(() => undefined);
        setNote('Link copied.');
    };

    const whatsapp = publishing.url
        ? `https://wa.me/?text=${encodeURIComponent(`${title} — practise your part here: ${publishing.url}`)}`
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/18 p-4 pt-[6vh]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="publish-title" className="flex w-160 max-w-full flex-col gap-5 rounded-lg bg-paper p-7 shadow-[0_30px_80px_#00000038]">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                        <h2 id="publish-title" className="font-display text-[22px] leading-6.5 font-extrabold tracking-[-0.02em] text-ink">
                            Publish {title}
                        </h2>
                        <p className="text-[13.5px] leading-4.75 text-pencil">Anyone with the link can read, play and print it — no account needed.</p>
                    </div>
                    <button
                        ref={close}
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-copy text-ink outline-none hover:bg-rule focus-visible:ring-2 focus-visible:ring-ink/20"
                    >
                        <CloseIcon size={14} />
                    </button>
                </div>

                {!publishing.published ? (
                    <div className="flex flex-col gap-3 rounded-md border border-rule p-4">
                        <div className="text-[14px] leading-4.5 font-semibold text-ink">Not published yet</div>
                        <p className="text-[13px] leading-4.5 text-pencil">
                            Publishing makes a page for this score as it is now. Changes you make later stay private until you publish them.
                        </p>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => send('POST', undefined, 'Published. Copy the link and send it to your choir.')}
                            className="flex h-10.5 items-center justify-center self-start rounded-full bg-ink px-5 text-[14px] leading-4.5 font-semibold text-paper outline-none hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 disabled:opacity-50"
                        >
                            Publish
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-2.5 rounded-md border border-rule p-3.5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="size-2 shrink-0 rounded-full bg-[#1F7A3A]" />
                                    <span className="text-[13px] leading-4 font-semibold text-[#1F7A3A]">Live</span>
                                    <span className="truncate text-[12.5px] leading-4 text-pencil">
                                        since {publishing.published_human} · {publishing.visits} {publishing.visits === 1 ? 'visit' : 'visits'} · {publishing.plays}{' '}
                                        {publishing.plays === 1 ? 'play' : 'plays'}
                                    </span>
                                </div>
                                {publishing.url && (
                                    <a href={publishing.url} target="_blank" rel="noreferrer" className="shrink-0 text-[12.5px] leading-4 font-semibold text-ink underline hover:no-underline">
                                        Open page ↗
                                    </a>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={publishing.url ?? ''}
                                    onFocus={(event) => event.currentTarget.select()}
                                    aria-label="Public link"
                                    className="h-10.5 min-w-0 grow rounded-[10px] bg-copy px-3 font-solfa text-[13px] leading-4.5 text-ink outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={copy}
                                    className="flex h-10.5 shrink-0 items-center rounded-full bg-ink px-4 text-[13.5px] leading-4.5 font-semibold text-paper outline-none hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2"
                                >
                                    Copy link
                                </button>
                            </div>
                        </div>

                        {publishing.has_changes && (
                            <div className="flex items-center gap-3 rounded-md bg-wash px-3.5 py-3">
                                <div className="flex grow flex-col gap-0.5">
                                    <div className="text-[13.5px] leading-4.5 font-semibold text-ink">You’ve made changes since</div>
                                    <div className="text-[12.5px] leading-4.25 text-[#5C4A00]">
                                        Singers still see the {publishing.published_human} version until you publish the changes.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => send('POST', undefined, 'Changes published.')}
                                    className="flex h-9.5 shrink-0 items-center rounded-full bg-ink px-3.5 text-[13px] leading-4 font-semibold whitespace-nowrap text-paper outline-none hover:bg-ink/90 disabled:opacity-50"
                                >
                                    Publish changes
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col gap-6 sm:flex-row">
                            <div className="flex grow basis-0 flex-col gap-1">
                                <div className="pb-1.5 text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">VISITORS CAN</div>
                                {OPTIONS.map((option, i) => (
                                    <div key={option.key} className={cn('flex h-12 items-center justify-between gap-3', i > 0 && 'border-t border-rule')}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[13.5px] leading-4.5 font-medium text-ink">{option.label}</span>
                                            <span className="text-[11.5px] leading-3.75 text-pencil">
                                                {!publishing[option.key] && option.off ? option.off : option.hint}
                                            </span>
                                        </div>
                                        <Toggle
                                            label={option.label}
                                            on={publishing[option.key]}
                                            onChange={() => send('PATCH', { [option.key]: !publishing[option.key] })}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-50">
                                <div className="pb-1.5 text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">SEND TO THE CHOIR</div>
                                {whatsapp && (
                                    <a
                                        href={whatsapp}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex h-9 items-center justify-center rounded-full border border-rule text-[12.5px] leading-4 font-semibold text-ink hover:bg-copy"
                                    >
                                        WhatsApp
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={copy}
                                    className="flex h-9 items-center justify-center rounded-full border border-rule text-[12.5px] leading-4 font-semibold text-ink hover:bg-copy"
                                >
                                    Copy the link
                                </button>
                                <p className="text-[11.5px] leading-4 text-pencil">Singers open the link on their phones, pick their part and practise.</p>
                            </div>
                        </div>
                    </>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
                    {publishing.published ? (
                        <button type="button" disabled={busy} onClick={() => send('DELETE', undefined, 'Unpublished. The link no longer works.')} className="flex flex-col items-start gap-0.5 text-left disabled:opacity-50">
                            <span className="text-[13.5px] leading-4.5 font-semibold text-danger hover:underline">Unpublish</span>
                            <span className="text-[11.5px] leading-3.75 text-pencil">The link stops working; the score stays yours.</span>
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className="flex items-center gap-3">
                        {note && (
                            <span className="text-[12.5px] leading-4 text-pencil" aria-live="polite">
                                {note}
                            </span>
                        )}
                        <button type="button" onClick={onClose} className="flex h-10 items-center rounded-full border border-rule px-5 text-[14px] leading-4.5 font-semibold text-ink hover:bg-copy">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
