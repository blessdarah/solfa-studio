import { useEffect, useRef } from 'react';
import { partContents } from '@/lib/editor';
import { beatsInBar, formatBar, partOf, VOICE_NAMES } from '@/lib/music';
import type { ScoreDocument, Voice } from '@/types';

/**
 * "Delete the bass part?" (Paper W5): what will go — how many bars have
 * notes, how the part starts, the words under it — before it goes.
 */
export function DeletePartDialog({
    document,
    voice,
    title,
    onCancel,
    onDelete,
}: {
    document: ScoreDocument;
    voice: Voice;
    title: string;
    onCancel: () => void;
    onDelete: () => void;
}) {
    const cancel = useRef<HTMLButtonElement>(null);
    const name = VOICE_NAMES[voice].toLowerCase();
    const contents = partContents(document, voice);
    const first = contents.firstBar;
    const opening = first !== null ? formatBar(partOf(document, voice)?.bars[first - 1]?.notes ?? [], beatsInBar(document.map, first)) : null;

    useEffect(() => {
        cancel.current?.focus();

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCancel();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/18 p-4" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-part-title"
                className="flex w-110 max-w-full flex-col gap-5 rounded-lg bg-paper p-7 shadow-[0_30px_80px_#00000038]"
            >
                <div className="flex flex-col gap-2">
                    <div className="flex size-10 items-center justify-center rounded-md bg-danger/8">
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                                d="M2.5 4.2h11M6.3 4.2V2.9c0-.4.3-.7.7-.7h2c.4 0 .7.3.7.7v1.3M4 4.2l.6 8.6c.1.7.6 1.2 1.3 1.2h4.2c.7 0 1.2-.5 1.3-1.2l.6-8.6M6.7 7v4.4M9.3 7v4.4"
                                stroke="#B42318"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    <h2 id="delete-part-title" className="pt-1.5 font-display text-[22px] leading-6.5 font-extrabold tracking-[-0.02em] text-ink">
                        Delete the {name} part?
                    </h2>
                    <p className="text-[14px] leading-5 text-pencil">
                        The {name} line comes out of every bar of {title}. The other parts stay as they are.
                    </p>
                </div>

                <div className="flex flex-col gap-0.5 rounded-md bg-copy px-3.5 py-1.5">
                    <div className="flex h-8.5 items-center justify-between">
                        <span className="text-[13.5px] leading-4.5 text-ink">Notes</span>
                        <span className="font-solfa text-[12px] leading-4 text-ink">
                            {contents.bars === 0 ? 'none' : `${contents.bars} of ${document.bars} bars`}
                        </span>
                    </div>
                    {opening && (
                        <>
                            <div className="h-px bg-rule" />
                            <div className="flex h-8.5 items-center justify-between gap-4">
                                <span className="shrink-0 text-[13.5px] leading-4.5 text-ink">First notes</span>
                                <span className="truncate font-solfa text-[12px] leading-4 whitespace-pre text-ink">{opening}</span>
                            </div>
                        </>
                    )}
                    <div className="h-px bg-rule" />
                    <div className="flex h-8.5 items-center justify-between">
                        <span className="text-[13.5px] leading-4.5 text-ink">Words under the {name}</span>
                        <span className={contents.syllables > 0 ? 'text-[13px] leading-4 text-ink' : 'text-[13px] leading-4 text-pencil'}>
                            {contents.syllables > 0 ? `${contents.syllables} syllables` : 'None'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[12px] leading-4 text-pencil">Changed your mind? ⌘ Z brings it back.</span>
                    <div className="flex shrink-0 gap-2">
                        <button
                            ref={cancel}
                            type="button"
                            onClick={onCancel}
                            className="flex h-10 items-center rounded-full border border-rule px-4 text-[14px] leading-4.5 font-semibold text-ink outline-none hover:bg-copy focus-visible:ring-2 focus-visible:ring-ink/20"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            className="flex h-10 items-center rounded-full bg-danger px-4 text-[14px] leading-4.5 font-semibold text-paper outline-none focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2"
                        >
                            Delete {name}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
