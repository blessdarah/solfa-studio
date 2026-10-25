import { useMemo, useRef, useState } from 'react';
import { CloseIcon } from '@/components/icons';
import { applyMapChange } from '@/lib/editor';
import type { MapChange } from '@/lib/editor';
import { beatsInBar, tempoAt, tempoName, timeLabel } from '@/lib/music';
import { cn } from '@/lib/utils';
import type { Ramp, ScoreDocument } from '@/types';

const TIMES = [2, 3, 4, 6];

const SAMPLE: Record<number, { bar: string; feel: string }> = {
    2: { bar: 'd :r', feel: 'strong · weak' },
    3: { bar: 'd :r :m', feel: 'strong · weak · weak' },
    4: { bar: 'd :r  ¦ m :f', feel: 'strong · weak · medium · weak' },
    6: { bar: 'd :r :m ¦ f :s :l', feel: 'strong · weak · weak · medium · weak · weak' },
};

function Label({ children }: { children: string }) {
    return <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">{children}</div>;
}

/**
 * "Change from bar 13" (Paper W3): tempo with tap-tempo, how it changes,
 * beats in each bar, how long it lasts, a warning when notes will move,
 * Preview and Apply.
 */
export function TempoPopover({
    document,
    bar,
    onClose,
    onApply,
    onPreview,
    onRemove,
}: {
    document: ScoreDocument;
    bar: number;
    onClose: () => void;
    onApply: (change: MapChange) => void;
    onPreview: (preview: ScoreDocument, fromBar: number) => void;
    onRemove: (bar: number) => void;
}) {
    const existing = document.map.find((e) => e.bar === bar);
    const beforeBpm = bar > 1 ? tempoAt(document.map, bar - 1) : tempoAt(document.map, 1);
    const beforeBeats = bar > 1 ? beatsInBar(document.map, bar - 1) : beatsInBar(document.map, 1);

    const [bpm, setBpm] = useState(existing?.bpm ?? tempoAt(document.map, bar));
    const [ramp, setRamp] = useState<Ramp>(existing?.ramp ?? 'at_once');
    const [beats, setBeats] = useState(existing?.beats ?? beatsInBar(document.map, bar));
    const [until, setUntil] = useState<number | null>(existing?.until ?? null);
    const [other, setOther] = useState(false);
    const taps = useRef<number[]>([]);

    const change: MapChange = { bar, bpm, beats, ramp, until };
    const preview = useMemo(() => applyMapChange(document, change), [document, bpm, beats, ramp, until, bar]);

    const percent = beforeBpm > 0 ? Math.round(((bpm - beforeBpm) / beforeBpm) * 100) : 0;
    const relative = bar === 1 || percent === 0 ? 'Same speed' : percent < 0 ? `${-percent}% slower` : `${percent}% faster`;

    const tap = () => {
        const now = performance.now();
        taps.current = [...taps.current.filter((t) => now - t < 3000), now].slice(-6);

        if (taps.current.length >= 2) {
            const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
            const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            setBpm(Math.max(20, Math.min(320, Math.round(60000 / avg))));
        }
    };

    const sample = SAMPLE[beats] ?? { bar: Array.from({ length: beats }, (_, i) => 'drmfslt'[i % 7]).join(' :'), feel: `${beats} beats` };

    const ramps: { value: Ramp; label: string }[] = [
        { value: 'at_once', label: 'At once' },
        { value: 'rit', label: 'Gradually · rit.' },
        { value: 'accel', label: 'Speed up · accel.' },
    ];

    return (
        <div
            role="dialog"
            aria-label={`Change from bar ${bar}`}
            className="relative flex w-100 flex-col gap-4 rounded-[16px] border border-rule bg-paper p-5 shadow-[0_20px_50px_#00000024]"
        >
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.75">
                    <div className="font-display text-[20px] leading-6 font-extrabold tracking-[-0.02em] text-ink">
                        {bar === 1 ? 'Start of the score' : `Change from bar ${bar}`}
                    </div>
                    <div className="text-[13px] leading-4 text-pencil">
                        {bar === 1 ? `Bar 1 sets the opening speed and time` : `Before this: ♩ = ${beforeBpm} · ${beforeBeats} beats a bar`}
                    </div>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="text-pencil hover:text-ink">
                    <CloseIcon />
                </button>
            </div>

            <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between">
                    <Label>TEMPO · BEATS PER MINUTE</Label>
                    <button type="button" onClick={tap} className="text-[13px] leading-4 font-medium text-ink hover:underline">
                        Tap tempo
                    </button>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="flex h-12 grow basis-0 items-center justify-between rounded-md bg-copy px-1.5">
                        <button
                            type="button"
                            aria-label="Slower"
                            onClick={() => setBpm((v) => Math.max(20, v - 1))}
                            className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-paper text-[18px] leading-5.5 text-ink"
                        >
                            –
                        </button>
                        <label className="flex items-baseline gap-1.5 font-solfa text-[22px] leading-7 text-ink">
                            ♩ =
                            <input
                                value={bpm}
                                inputMode="numeric"
                                aria-label="Beats per minute"
                                onChange={(e) => {
                                    const v = Number(e.target.value.replace(/\D/g, ''));
                                    if (v > 0) setBpm(Math.min(320, v));
                                }}
                                className="w-[3ch] bg-transparent text-center outline-none"
                            />
                        </label>
                        <button
                            type="button"
                            aria-label="Faster"
                            onClick={() => setBpm((v) => Math.min(320, v + 1))}
                            className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-paper text-[18px] leading-5.5 text-ink"
                        >
                            +
                        </button>
                    </div>
                    <div className="flex w-27.5 shrink-0 flex-col gap-0.5">
                        <div className="text-[13px] leading-4 font-semibold text-ink">{tempoName(bpm)}</div>
                        <div className="text-[12px] leading-4 text-pencil">{relative}</div>
                    </div>
                </div>
                {bar > 1 && (
                    <div className="flex gap-1.5">
                        {ramps.map((r) => (
                            <button
                                key={r.value}
                                type="button"
                                onClick={() => setRamp(r.value)}
                                aria-pressed={ramp === r.value}
                                className={cn(
                                    'flex h-7.5 items-center rounded-full px-3 text-[13px] leading-4 whitespace-nowrap',
                                    ramp === r.value ? 'bg-ink font-semibold text-paper' : 'border border-rule text-ink hover:bg-copy',
                                )}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2.5 border-t border-rule pt-4">
                <Label>BEATS IN EACH BAR</Label>
                <div className="flex gap-1 rounded-full bg-copy p-1">
                    {TIMES.map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => {
                                setBeats(t);
                                setOther(false);
                            }}
                            aria-pressed={beats === t && !other}
                            className={cn(
                                'flex h-8 grow basis-0 items-center justify-center rounded-full font-solfa text-[13px] leading-4',
                                beats === t && !other ? 'bg-paper text-ink' : 'text-pencil',
                            )}
                        >
                            {timeLabel(t)}
                        </button>
                    ))}
                    {other || !TIMES.includes(beats) ? (
                        <input
                            autoFocus={other}
                            value={beats}
                            inputMode="numeric"
                            aria-label="Beats in each bar"
                            onChange={(e) => {
                                const v = Number(e.target.value.replace(/\D/g, ''));
                                if (v >= 1 && v <= 12) setBeats(v);
                            }}
                            className="h-8 w-0 grow basis-0 rounded-full bg-paper text-center font-solfa text-[13px] leading-4 text-ink outline-none"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setOther(true)}
                            className="flex h-8 grow basis-0 items-center justify-center text-[13px] leading-4 text-pencil"
                        >
                            Other
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2.5 font-solfa">
                    <span className="text-[14px] leading-4.5 text-pencil">Bar looks like</span>
                    <span className="text-[14px] leading-4.5 whitespace-pre text-ink">{sample.bar}</span>
                    {beats <= 3 && <span className="font-sans text-[12px] leading-4 text-pencil">({sample.feel})</span>}
                </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-rule pt-4">
                <div className="flex items-center justify-between">
                    <span className="text-[14px] leading-4.5 text-ink">Lasts until</span>
                    <label className="relative flex h-8 items-center gap-2 rounded-[8px] border border-rule px-3">
                        <span className="text-[13px] leading-4 font-medium text-ink">
                            {until === null ? `End of score (bar ${preview.document.bars})` : `Bar ${until}`}
                        </span>
                        <span className="text-[13px] leading-4 font-medium text-pencil">▾</span>
                        <select
                            aria-label="Lasts until"
                            value={until ?? ''}
                            onChange={(e) => setUntil(e.target.value === '' ? null : Number(e.target.value))}
                            className="absolute inset-0 cursor-pointer opacity-0"
                        >
                            <option value="">End of score</option>
                            {Array.from({ length: document.bars - bar + 1 }, (_, i) => bar + i).map((b) => (
                                <option key={b} value={b}>
                                    Bar {b}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {preview.message && (
                    <div className="flex gap-2.5 rounded-md bg-wash px-3 py-2.5">
                        <span className="text-[13px] leading-4 font-bold text-ink">!</span>
                        <span className="text-[13px] leading-4.75 text-ink">{preview.message}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2">
                    {existing && bar > 1 && (
                        <button type="button" onClick={() => onRemove(bar)} className="mr-auto text-[13px] leading-4 font-medium text-pencil hover:text-ink">
                            Remove change
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onPreview(preview.document, Math.max(1, bar - 1))}
                        className="flex h-9.5 items-center rounded-full bg-copy px-4 text-[14px] leading-4.5 font-semibold text-ink"
                    >
                        Preview ▶
                    </button>
                    <button
                        type="button"
                        onClick={() => onApply(change)}
                        className="flex h-9.5 items-center rounded-full bg-ink px-4.5 text-[14px] leading-4.5 font-semibold text-paper"
                    >
                        Apply change
                    </button>
                </div>
            </div>

            <div className="absolute -top-2 left-15 size-3.5 origin-top-left rotate-45 border-t border-l border-rule bg-paper" />
        </div>
    );
}
