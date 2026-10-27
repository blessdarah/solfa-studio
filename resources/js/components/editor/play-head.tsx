import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { BarTime, Playback } from '@/lib/player';
import { audio } from '@/lib/tone';

type Box = { left: number; top: number; width: number; height: number };

/**
 * Follows playback on the sheet: outlines the bar that is sounding, fills
 * its beats as they pass, and keeps that line in view. Runs off the audio
 * clock, so the highlight stays in step with what you hear, rit. included.
 * After a D.S. jump the outline carries a "D.S." tag, so you can tell the
 * second time through from the first.
 */
export function PlayHead({
    playback,
    root,
    onBar,
}: {
    playback: Playback | null;
    root: RefObject<HTMLDivElement | null>;
    onBar: (step: Pick<BarTime, 'bar' | 'pass'> | null) => void;
}) {
    const [step, setStep] = useState<BarTime | null>(null);
    const bar = step?.bar ?? null;
    const [box, setBox] = useState<Box | null>(null);
    const fills = useRef<(HTMLSpanElement | null)[]>([]);
    const onBarRef = useRef(onBar);
    const overlay = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        onBarRef.current = onBar;
    });

    // Track the sounding bar on every frame; React only hears about bar changes.
    useEffect(() => {
        if (!playback) {
            setStep(null);
            onBarRef.current(null);

            return;
        }

        let frame = 0;
        let shown: BarTime | null = null;

        const tick = () => {
            const now = audio().currentTime;
            const current = playback.timeline.find((t) => now >= t.at && now < t.end) ?? (now < (playback.timeline[0]?.at ?? 0) ? playback.timeline[0] : undefined);

            const next = current ?? null;

            if (next !== shown) {
                shown = next;
                setStep(next);
                onBarRef.current(next && { bar: next.bar, pass: next.pass });
            }

            if (current) {
                current.beats.forEach((start, i) => {
                    const end = current.beats[i + 1] ?? current.end;
                    const el = fills.current[i];

                    if (el) el.style.width = `${Math.max(0, Math.min(1, (now - start) / (end - start))) * 100}%`;
                });
            }

            frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame);
    }, [playback]);

    // Place the outline over that bar's column of the system it sits in.
    // A passive effect: the sheet re-attaches its root ref on every commit,
    // after a child's layout effects have already run.
    useEffect(() => {
        if (bar === null || !root.current) {
            setBox(null);

            return;
        }

        // The bar's number cell gives its column (bars vary in width); its line gives the height.
        const cell = root.current.querySelector<HTMLElement>(`[data-bar="${bar}"]`);
        const system = cell?.closest<HTMLElement>('[data-system]');

        if (!cell || !system) {
            setBox(null);

            return;
        }

        setBox({
            left: cell.offsetLeft,
            top: system.offsetTop,
            width: cell.offsetWidth,
            height: system.offsetHeight,
        });
    }, [bar, root]);

    useEffect(() => {
        overlay.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [box?.top]);

    if (!step || !box || !playback) return null;

    const beats = step.beats.length;

    return (
        <>
            <div
                ref={overlay}
                aria-hidden="true"
                className="pointer-events-none absolute z-20 rounded-[3px] bg-marker/25 mix-blend-multiply outline-2 outline-ink outline-solid"
                style={{ left: box.left, top: box.top - 4, width: box.width, height: box.height + 16 }}
            >
                <div className="absolute inset-x-2 bottom-1.5 flex gap-1">
                    {Array.from({ length: beats }, (_, i) => (
                        <span key={`${step.at}-${i}`} className="relative h-0.75 grow overflow-hidden rounded-full bg-ink/15">
                            <span
                                ref={(el) => {
                                    fills.current[i] = el;
                                }}
                                className="absolute inset-y-0 left-0 w-0 bg-ink"
                            />
                        </span>
                    ))}
                </div>
            </div>
            {step.pass === 2 && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute z-20 flex h-4.5 items-center rounded-[4px] bg-ink px-1.5 text-[10.5px] leading-3 font-semibold text-paper"
                    style={{ left: box.left + box.width - 40, top: box.top - 13 }}
                >
                    D.S.
                </div>
            )}
        </>
    );
}
