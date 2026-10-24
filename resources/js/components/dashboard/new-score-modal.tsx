import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { FormField } from '@/components/form-field';
import { ChevronDownIcon, XIcon } from '@/components/icons';
import type { DohKey, User } from '@/types';

const DOH_KEYS: DohKey[] = [
    'C',
    'C#',
    'Db',
    'D',
    'Eb',
    'E',
    'F',
    'F#',
    'Gb',
    'G',
    'Ab',
    'A',
    'Bb',
    'B',
];

type NewScoreForm = {
    title: string;
    composer: string;
    doh: DohKey;
};

export function NewScoreModal({
    open,
    onClose,
    user,
}: {
    open: boolean;
    onClose: () => void;
    user: User;
}) {
    const form = useForm<NewScoreForm>({
        title: '',
        composer: user.name,
        doh: 'C',
    });

    useEffect(() => {
        if (!open) {
            return;
        }

        form.reset();
        form.clearErrors();
        // Reset only when the dialog opens; typing must not reset it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !form.processing) {
                onClose();
            }
        };

        document.addEventListener('keydown', onKey);

        return () => {
            document.body.style.overflow = previous;
            document.removeEventListener('keydown', onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !form.processing) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-score-title"
                className="w-full max-w-[440px] rounded-card border border-rule bg-paper p-6 shadow-[0_24px_80px_rgba(17,17,17,0.18)] sm:p-7"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[9px] font-semibold tracking-[0.14em] text-pencil uppercase">
                            New score
                        </p>
                        <h2
                            id="new-score-title"
                            className="mt-1.5 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.04em] text-ink"
                        >
                            Start a blank score
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-pencil transition hover:bg-copy hover:text-ink"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                <p className="mt-2 text-[12px] leading-5 text-pencil">
                    Name the piece and choose its key. You can change both
                    later.
                </p>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/scores', {
                            preserveScroll: true,
                            onSuccess: () => onClose(),
                        });
                    }}
                    className="mt-6 space-y-4"
                >
                    <FormField
                        id="score-title"
                        label="Title"
                        value={form.data.title}
                        onChange={(value) => form.setData('title', value)}
                        error={form.errors.title}
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Onyame Ye"
                    />

                    <FormField
                        id="score-composer"
                        label="Composer"
                        value={form.data.composer}
                        onChange={(value) =>
                            form.setData('composer', value)
                        }
                        error={form.errors.composer}
                        type="text"
                        placeholder="Who wrote it?"
                    />

                    <div>
                        <label
                            htmlFor="score-doh"
                            className="mb-1.5 block text-[10px] font-semibold tracking-[0.12em] text-pencil uppercase"
                        >
                            Key
                        </label>
                        <div className="relative">
                            <select
                                id="score-doh"
                                value={form.data.doh}
                                onChange={(event) =>
                                    form.setData(
                                        'doh',
                                        event.target.value as DohKey,
                                    )
                                }
                                className="h-11 w-full appearance-none rounded-[10px] border border-rule bg-paper px-3.5 pr-10 text-[14px] text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                            >
                                {DOH_KEYS.map((key) => (
                                    <option key={key} value={key}>
                                        {key} · Doh is {key}
                                    </option>
                                ))}
                            </select>
                            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3.5 h-3.5 w-3.5 -translate-y-1/2 text-pencil" />
                        </div>
                        {form.errors.doh && (
                            <p className="mt-1.5 text-[11.5px] text-danger">
                                {form.errors.doh}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={form.processing}
                            className="inline-flex h-9 items-center rounded-full border border-rule px-4 text-[12px] font-semibold text-ink transition hover:bg-copy disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[12px] font-semibold text-paper transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {form.processing ? 'Creating…' : 'Create score'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
