import { VOICE_NAMES } from '@/lib/music';
import { cn } from '@/lib/utils';
import type { VoiceProgress } from '@/types';

/**
 * S A T B chips: black once a part has notes, yellow when a scan left
 * notes to check in it, grey while it is empty.
 */
const STYLE: Record<VoiceProgress['state'], string> = {
    complete: 'border-ink bg-ink text-paper',
    started: 'border-ink bg-ink text-paper',
    flagged: 'border-marker bg-marker text-ink',
    empty: 'border-rule bg-copy text-pencil',
};

const STATE_LABEL: Record<VoiceProgress['state'], string> = {
    complete: 'finished',
    started: 'started',
    flagged: 'notes to check',
    empty: 'empty',
};

export function VoiceChips({ voices }: { voices: VoiceProgress[] }) {
    return (
        <div className="flex w-32 shrink-0 items-center gap-1.75" aria-label="Voices">
            {voices.map((voice) => (
                <span
                    key={voice.voice}
                    title={`${VOICE_NAMES[voice.voice]} · ${STATE_LABEL[voice.state]} · ${voice.done}/${voice.total} bars`}
                    className={cn(
                        'flex h-5.5 w-6 shrink-0 items-center justify-center rounded-[5px] border font-solfa text-[10px] leading-3',
                        STYLE[voice.state],
                    )}
                >
                    {voice.voice}
                </span>
            ))}
        </div>
    );
}
