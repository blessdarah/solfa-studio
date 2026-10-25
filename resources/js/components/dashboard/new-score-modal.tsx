import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { CloseIcon, PenIcon } from '@/components/icons';
import { DOH_KEYS, VOICE_NAMES, dohSemitone, keyLabel } from '@/lib/music';
import { audio, playTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import type { DohKey, User, Voice } from '@/types';

type NewScoreForm = {
    title: string;
    composer: string;
    arranger: string;
    doh: DohKey;
    beats: number;
    bars: number;
    parts: Voice[];
};

const TIMES = [
    { beats: 2, label: '2/4' },
    { beats: 3, label: '3/4' },
    { beats: 4, label: '4/4' },
    { beats: 6, label: '6/8' },
];

const ROLES: Record<Voice, string> = {
    S: 'Melody',
    A: 'Harmony',
    T: 'Harmony',
    B: 'Bass line',
};

function Label({ children, htmlFor }: { children: string; htmlFor?: string }) {
    return (
        <label htmlFor={htmlFor} className="block text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">
            {children}
        </label>
    );
}

/**
 * "Write a new piece" — title, composer, doh, time, bars and parts, then
 * straight into the first part.
 */
export function NewScoreModal({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
    const form = useForm<NewScoreForm>({
        title: '',
        composer: user.name,
        arranger: '',
        doh: 'Eb',
        beats: 4,
        bars: 16,
        parts: ['S', 'A', 'T', 'B'],
    });

    useEffect(() => {
        if (!open) {
            return;
        }

        form.reset();
        form.clearErrors();

        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);

        return () => document.removeEventListener('keydown', onKey);
        // Reset only when the dialog opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) {
        return null;
    }

    const hearDoh = (doh: DohKey) => {
        form.setData('doh', doh);
        playTone(60 + dohSemitone(doh), audio().currentTime + 0.01, 0.9, 0.2);
    };

    const togglePart = (voice: Voice) => {
        const has = form.data.parts.includes(voice);
        const next = has ? form.data.parts.filter((v) => v !== voice) : [...form.data.parts, voice];
        form.setData('parts', (['S', 'A', 'T', 'B'] as Voice[]).filter((v) => next.includes(v)));
    };

    const first = form.data.parts[0];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-score-title"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/scores');
                }}
                className="flex max-h-[calc(100vh-32px)] w-full max-w-[460px] flex-col overflow-y-auto rounded-[16px] border border-rule bg-paper p-6 shadow-[0_20px_50px_#00000024]"
            >
                <div className="flex items-center justify-between">
                    <span className="font-solfa text-[12px] leading-4 text-pencil">New score</span>
                    <button type="button" onClick={onClose} aria-label="Close" className="text-pencil hover:text-ink">
                        <CloseIcon />
                    </button>
                </div>

                <h2
                    id="new-score-title"
                    className="pt-3 font-display text-[34px] leading-9 font-extrabold tracking-[-0.035em] text-ink"
                >
                    Write a new piece
                </h2>
                <p className="pt-1.5 text-[14px] leading-5 text-pencil">
                    Set it up once. You&apos;ll write each part bar by bar.
                </p>

                <div className="flex flex-col gap-1.5 border-b border-rule pt-6 pb-3">
                    <Label htmlFor="score-title">TITLE</Label>
                    <input
                        id="score-title"
                        autoFocus
                        required
                        value={form.data.title}
                        onChange={(event) => form.setData('title', event.target.value)}
                        placeholder="Onyame Ye"
                        className="bg-transparent text-[19px] leading-6 font-semibold text-ink outline-none placeholder:text-dot"
                    />
                    {form.errors.title && <p className="text-[12px] text-danger">{form.errors.title}</p>}
                </div>

                <div className="flex gap-4 border-b border-rule pt-4 pb-3">
                    <div className="flex grow basis-0 flex-col gap-1.5">
                        <Label htmlFor="score-composer">COMPOSER</Label>
                        <input
                            id="score-composer"
                            value={form.data.composer}
                            onChange={(event) => form.setData('composer', event.target.value)}
                            className="bg-transparent text-[16px] leading-5 text-ink outline-none"
                        />
                    </div>
                    <div className="flex grow basis-0 flex-col gap-1.5">
                        <Label htmlFor="score-arranger">ARRANGED BY</Label>
                        <input
                            id="score-arranger"
                            value={form.data.arranger}
                            onChange={(event) => form.setData('arranger', event.target.value)}
                            placeholder="Optional"
                            className="bg-transparent text-[16px] leading-5 text-ink outline-none placeholder:text-dot"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2.5 pt-5">
                    <Label>DOH IS</Label>
                    <div className="grid grid-cols-7 gap-1.5">
                        {DOH_KEYS.map((doh) => (
                            <button
                                key={doh}
                                type="button"
                                onClick={() => hearDoh(doh)}
                                aria-pressed={form.data.doh === doh}
                                className={cn(
                                    'flex h-11 items-center justify-center rounded-sm text-[15px] leading-5 font-medium',
                                    form.data.doh === doh ? 'bg-ink font-bold text-paper' : 'bg-copy text-ink hover:bg-rule',
                                )}
                            >
                                {keyLabel(doh)}
                            </button>
                        ))}
                    </div>
                    <p className="text-[12px] leading-4 text-pencil">
                        Hear doh before you start · Tap to play {keyLabel(form.data.doh)}
                    </p>
                </div>

                <div className="flex gap-3 pt-5">
                    <div className="flex grow flex-col gap-2.5">
                        <Label>TIME</Label>
                        <div className="flex gap-1 rounded-full bg-copy p-1">
                            {TIMES.map((time) => (
                                <button
                                    key={time.beats}
                                    type="button"
                                    onClick={() => form.setData('beats', time.beats)}
                                    aria-pressed={form.data.beats === time.beats}
                                    className={cn(
                                        'h-8 grow basis-0 rounded-full font-solfa text-[13px] leading-4',
                                        form.data.beats === time.beats ? 'bg-paper text-ink' : 'text-pencil',
                                    )}
                                >
                                    {time.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex w-28 shrink-0 flex-col gap-2.5">
                        <Label>BARS</Label>
                        <div className="flex h-10 items-center justify-between rounded-full bg-copy px-1.5">
                            <button
                                type="button"
                                aria-label="Fewer bars"
                                onClick={() => form.setData('bars', Math.max(1, form.data.bars - 1))}
                                className="flex size-7 items-center justify-center rounded-full text-[16px] text-ink hover:bg-paper"
                            >
                                –
                            </button>
                            <span className="font-display text-[17px] leading-5 font-bold text-ink">{form.data.bars}</span>
                            <button
                                type="button"
                                aria-label="More bars"
                                onClick={() => form.setData('bars', Math.min(200, form.data.bars + 1))}
                                className="flex size-7 items-center justify-center rounded-full text-[16px] text-ink hover:bg-paper"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2.5 pt-5">
                    <Label>PARTS</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {(['S', 'A', 'T', 'B'] as Voice[]).map((voice) => {
                            const on = form.data.parts.includes(voice);

                            return (
                                <button
                                    key={voice}
                                    type="button"
                                    onClick={() => togglePart(voice)}
                                    aria-pressed={on}
                                    aria-label={VOICE_NAMES[voice]}
                                    className={cn(
                                        'flex h-15.5 flex-col items-start justify-between rounded-md px-3 py-2.5 text-left',
                                        on ? 'bg-ink text-paper' : 'bg-copy text-pencil',
                                    )}
                                >
                                    <span className="font-display text-[19px] leading-5 font-extrabold">{voice}</span>
                                    <span className="text-[12px] leading-4 opacity-75">{ROLES[voice]}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[12px] leading-4 text-pencil">
                        Write them in any order. Most composers start with the soprano melody.
                    </p>
                    {form.errors.parts && <p className="text-[12px] text-danger">{form.errors.parts}</p>}
                </div>

                <button
                    type="submit"
                    disabled={form.processing || first === undefined}
                    className="mt-6 flex h-13 shrink-0 items-center justify-center gap-2.5 rounded-full bg-marker text-ink disabled:opacity-60"
                >
                    <PenIcon />
                    <span className="text-[16px] leading-5 font-semibold">
                        {form.processing ? 'Starting…' : `Start with ${first ? VOICE_NAMES[first] : 'a part'}`}
                    </span>
                </button>
            </form>
        </div>
    );
}
