import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { CloseIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

type RehearsalForm = {
    ensemble: string;
    singers: string;
    date: string;
    time: string;
    score_ids: string[];
};

function Label({ children, htmlFor }: { children: string; htmlFor?: string }) {
    return (
        <label htmlFor={htmlFor} className="block text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">
            {children}
        </label>
    );
}

const input =
    'h-10 w-full rounded-sm border border-rule bg-paper px-3 text-[14px] leading-4.5 text-ink outline-none focus:border-ink';

/** Plan the next rehearsal and pick the scores to work through. */
export function RehearsalModal({
    open,
    onClose,
    scores,
    ensemble,
}: {
    open: boolean;
    onClose: () => void;
    scores: { id: string; title: string }[];
    ensemble: string;
}) {
    const form = useForm<RehearsalForm>({
        ensemble,
        singers: '',
        date: '',
        time: '16:00',
        score_ids: [],
    });

    useEffect(() => {
        if (open) {
            form.reset();
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) {
        return null;
    }

    const toggle = (id: string) =>
        form.setData(
            'score_ids',
            form.data.score_ids.includes(id) ? form.data.score_ids.filter((s) => s !== id) : [...form.data.score_ids, id],
        );

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="rehearsal-title"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.transform((data) => ({ ...data, singers: data.singers === '' ? null : Number(data.singers) }));
                    form.post('/rehearsals', { preserveScroll: true, onSuccess: () => onClose() });
                }}
                className="flex max-h-[calc(100vh-32px)] w-full max-w-[420px] flex-col gap-4 overflow-y-auto rounded-[16px] border border-rule bg-paper p-5 shadow-[0_20px_50px_#00000024]"
            >
                <div className="flex items-start justify-between">
                    <h2 id="rehearsal-title" className="font-display text-[20px] leading-6 font-extrabold tracking-[-0.02em] text-ink">
                        Plan a rehearsal
                    </h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="text-pencil hover:text-ink">
                        <CloseIcon />
                    </button>
                </div>

                <div className="flex gap-2.5">
                    <div className="flex grow flex-col gap-1.5">
                        <Label htmlFor="rehearsal-ensemble">CHOIR</Label>
                        <input
                            id="rehearsal-ensemble"
                            required
                            value={form.data.ensemble}
                            onChange={(e) => form.setData('ensemble', e.target.value)}
                            className={input}
                        />
                    </div>
                    <div className="flex w-24 flex-col gap-1.5">
                        <Label htmlFor="rehearsal-singers">SINGERS</Label>
                        <input
                            id="rehearsal-singers"
                            inputMode="numeric"
                            value={form.data.singers}
                            onChange={(e) => form.setData('singers', e.target.value.replace(/\D/g, ''))}
                            className={input}
                        />
                    </div>
                </div>

                <div className="flex gap-2.5">
                    <div className="flex grow flex-col gap-1.5">
                        <Label htmlFor="rehearsal-date">DATE</Label>
                        <input
                            id="rehearsal-date"
                            type="date"
                            required
                            value={form.data.date}
                            onChange={(e) => form.setData('date', e.target.value)}
                            className={input}
                        />
                    </div>
                    <div className="flex w-32 flex-col gap-1.5">
                        <Label htmlFor="rehearsal-time">TIME</Label>
                        <input
                            id="rehearsal-time"
                            type="time"
                            required
                            value={form.data.time}
                            onChange={(e) => form.setData('time', e.target.value)}
                            className={input}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>SCORES TO REHEARSE</Label>
                    <div className="flex max-h-56 flex-col overflow-y-auto rounded-sm border border-rule">
                        {scores.map((score) => {
                            const on = form.data.score_ids.includes(score.id);

                            return (
                                <button
                                    key={score.id}
                                    type="button"
                                    onClick={() => toggle(score.id)}
                                    aria-pressed={on}
                                    className={cn(
                                        'flex h-10 shrink-0 items-center justify-between border-b border-rule px-3 text-left last:border-b-0',
                                        on && 'bg-wash',
                                    )}
                                >
                                    <span className="truncate text-[13px] leading-4 text-ink">{score.title}</span>
                                    <span className="font-solfa text-[11px] text-pencil">
                                        {on ? form.data.score_ids.indexOf(score.id) + 1 : ''}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {(form.errors.date || form.errors.ensemble) && (
                    <p className="text-[12px] text-danger">{form.errors.date ?? form.errors.ensemble}</p>
                )}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="h-9.5 rounded-full bg-copy px-4 text-[14px] leading-4.5 font-semibold text-ink">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="h-9.5 rounded-full bg-ink px-4.5 text-[14px] leading-4.5 font-semibold text-paper disabled:opacity-60"
                    >
                        Plan rehearsal
                    </button>
                </div>
            </form>
        </div>
    );
}
