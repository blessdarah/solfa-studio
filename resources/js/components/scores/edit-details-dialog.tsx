import { useForm } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { CloseIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { ScoreSummary } from '@/types';

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const STYLES = ['Hymn', 'Highlife', 'Anthem', 'Chorus', 'Christmas', 'Easter', 'Wedding', 'Funeral', 'Folk'];

const keyLabel = (doh: string) => doh.replace('b', '♭').replace('#', '♯');

function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
    return (
        <label className={cn('flex flex-col gap-1.5', className)}>
            <span className="text-[12.5px] leading-4 font-semibold text-ink">{label}</span>
            {children}
            {error && <span className="text-[12px] leading-4 text-danger">{error}</span>}
        </label>
    );
}

const input = 'h-10 rounded-[10px] border border-rule px-3 text-[14px] leading-4.5 text-ink outline-none focus:border-ink';

/**
 * Edit details (Paper W11): title, composer, arranger, style and key —
 * what shows in the library, on paper and on the public page.
 */
export function EditDetailsDialog({ score, onClose }: { score: ScoreSummary; onClose: () => void }) {
    const form = useForm({
        title: score.title,
        composer: score.composer ?? '',
        arranger: score.arranger ?? '',
        doh: score.doh as string,
        style: score.style ?? '',
    });
    const first = useRef<HTMLInputElement>(null);

    useEffect(() => {
        first.current?.focus();
        first.current?.select();

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const styles = score.style && !STYLES.includes(score.style) ? [score.style, ...STYLES] : STYLES;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/18 p-4 pt-[7vh]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="details-title"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.patch(`/scores/${score.id}/details`, { preserveScroll: true, onSuccess: onClose });
                }}
                className="flex w-145 max-w-full flex-col gap-5.5 rounded-lg bg-paper p-7 shadow-[0_30px_80px_#00000038]"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                        <h2 id="details-title" className="font-display text-[22px] leading-6.5 font-extrabold tracking-[-0.02em] text-ink">
                            Edit details
                        </h2>
                        <p className="text-[13.5px] leading-4.75 text-pencil">What shows in the library, on the printed page and on the public page.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-copy text-ink hover:bg-rule">
                        <CloseIcon size={14} />
                    </button>
                </div>

                <div className="flex flex-col gap-3.5">
                    <Field label="Title" error={form.errors.title}>
                        <input
                            ref={first}
                            value={form.data.title}
                            onChange={(event) => form.setData('title', event.target.value)}
                            maxLength={120}
                            className="h-11 rounded-[10px] border-[1.5px] border-ink px-3.5 font-display text-[17px] leading-5.5 font-semibold text-ink outline-none"
                        />
                    </Field>
                    <div className="flex gap-3">
                        <Field label="Composer" error={form.errors.composer} className="grow basis-0">
                            <input value={form.data.composer} onChange={(event) => form.setData('composer', event.target.value)} placeholder="Traditional" className={input} />
                        </Field>
                        <Field label="Arranged by" error={form.errors.arranger} className="grow basis-0">
                            <input value={form.data.arranger} onChange={(event) => form.setData('arranger', event.target.value)} placeholder="Leave empty if it’s the original" className={input} />
                        </Field>
                    </div>
                    <div className="flex gap-3">
                        <Field label="Style" error={form.errors.style} className="grow basis-0">
                            <select value={form.data.style} onChange={(event) => form.setData('style', event.target.value)} className={cn(input, 'bg-paper')}>
                                <option value="">None</option>
                                {styles.map((style) => (
                                    <option key={style} value={style}>
                                        {style}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Key" error={form.errors.doh} className="w-44">
                            <select value={form.data.doh} onChange={(event) => form.setData('doh', event.target.value)} className={cn(input, 'bg-paper font-solfa')}>
                                {KEYS.map((key) => (
                                    <option key={key} value={key}>
                                        Doh is {keyLabel(key)}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <p className="text-[12px] leading-4.25 text-pencil">
                        Changing the key keeps every note as it is — in sol-fa only “Doh is …” moves, and the sound follows. Tempo and time changes stay in the editor.
                    </p>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-rule pt-4">
                    <span className="text-[12px] leading-4 text-pencil">
                        {score.published ? 'The new details reach the public page when you publish your changes.' : ''}
                    </span>
                    <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={onClose} className="flex h-10 items-center rounded-full border border-rule px-4 text-[14px] leading-4.5 font-semibold text-ink hover:bg-copy">
                            Cancel
                        </button>
                        <button type="submit" disabled={form.processing} className="flex h-10 items-center rounded-full bg-ink px-4.5 text-[14px] leading-4.5 font-semibold text-paper hover:bg-ink/90 disabled:opacity-50">
                            Save details
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
