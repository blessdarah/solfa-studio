import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Playback } from '@/lib/player';
import { audio } from '@/lib/tone';

/** Sheet layout: the part-letter column, then 165px per bar. */
const LABEL_COLUMN = 24;
const BAR_WIDTH = 165;

type Box = { left: number; top: number; height: number };

/**
 * Follows playback on the sheet: outlines the bar that is sounding, fills
 * its beats as they pass, and keeps that line in view. Runs off the audio
 * clock, so the highlight stays in step with what you hear, rit. included.
 */
export function PlayHead({
    playback,
    root,
    onBar,
}: {
    playback: Playback | null;
    root: RefObject<HTMLDivElement | null>;
    onBar: (bar: number | null) => void;
}) {
    const [bar, setBar] = useState<number | null>(null);
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
            setBar(null);
            onBarRef.current(null);

            return;
        }

        let frame = 0;
        let shown: number | null = null;

        const tick = () => {
            const now = audio().currentTime;
            const current = playback.timeline.find((t) => now >= t.at && now < t.end) ?? (now < (playback.timeline[0]?.at ?? 0) ? playback.timeline[0] : undefined);

            const number = current?.bar ?? null;

            if (number !== shown) {
                shown = number;
                setBar(number);
                onBarRef.current(number);
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
    useLayoutEffect(() => {
        if (bar === null || !root.current) {
            setBox(null);

            return;
        }

        const first = Math.floor((bar - 1) / 4) * 4 + 1;
        const system = root.current.querySelector<HTMLElement>(`[data-system="${first}"]`);

        if (!system) {
            setBox(null);

            return;
        }

        setBox({
            left: system.offsetLeft + LABEL_COLUMN + (bar - first) * BAR_WIDTH,
            top: system.offsetTop,
            height: system.offsetHeight,
        });
    }, [bar, root]);

    useEffect(() => {
        overlay.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [box?.top]);

    if (bar === null || !box || !playback) return null;

    const beats = playback.timeline.find((t) => t.bar === bar)?.beats.length ?? 0;

    return (
        <div
            ref={overlay}
            aria-hidden="true"
            className="pointer-events-none absolute z-20 rounded-[3px] bg-marker/25 mix-blend-multiply outline-2 outline-ink outline-solid"
            style={{ left: box.left, top: box.top - 4, width: BAR_WIDTH, height: box.height + 8 }}
        >
            <div className="absolute inset-x-1.5 bottom-1 flex gap-1">
                {Array.from({ length: beats }, (_, i) => (
                    <span key={`${bar}-${i}`} className="relative h-0.75 grow overflow-hidden rounded-full bg-ink/15">
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
    );
}
