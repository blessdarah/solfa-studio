import type { ScoreDocument, Voice } from './score';
import type { ScoreSummary } from './dashboard';

export type { ScoreSummary };

/** A point in the score, using a 1-based bar and a 1-based beat. */
export type ComposeCursor = {
    part: Voice;
    bar: number;
    beat: number;
};

export type ComposeProps = {
    score: ScoreSummary;
    document: ScoreDocument;
    saved_label: string;
};

export type ScoreSystem = {
    bars: number[];
    from: number;
    to: number;
};
