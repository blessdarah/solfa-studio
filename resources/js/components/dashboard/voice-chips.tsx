import { cn } from '@/lib/utils';
import type { VoiceProgress } from '@/types';

const stateStyles: Record<VoiceProgress['state'], string> = {
    complete: 'border-ink bg-ink text-paper',
    started: 'border-rule bg-copy text-ink',
    empty: 'border-rule bg-transparent text-pencil/45',
    flagged: 'border-marker bg-marker text-ink',
};

export function VoiceChips({ voices }: { voices: VoiceProgress[] }) {
    return (
        <div
            className="flex items-center gap-1"
            aria-label="Voice progress"
        >
            {voices.map((voice) => (
                <span
                    key={voice.voice}
                    title={`${voice.voice} — ${voice.done} of ${voice.total} bars done${
                        voice.state === 'flagged' ? ' · needs checking' : ''
                    }`}
                    aria-label={`${voice.voice}, ${voice.state}, ${voice.done} of ${voice.total} bars done`}
                    className={cn(
                        'flex size-5 items-center justify-center rounded-[5px] border font-solfa text-[9.5px] leading-none font-medium',
                        stateStyles[voice.state],
                    )}
                >
                    {voice.voice}
                </span>
            ))}
        </div>
    );
}
