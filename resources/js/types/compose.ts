import type { DohKey, ScoreDocument, Voice } from './score';

/** What the compose screen (Paper W1–W3) receives. */
export type ComposeProps = {
    score: {
        id: string;
        title: string;
        composer: string | null;
        arranger: string | null;
        doh: DohKey;
        version: number;
        saved_at: string | null;
    };
    document: ScoreDocument;
    can_edit: boolean;
    is_owner: boolean;
    /** The part to open on, e.g. after "Start with Soprano". */
    start_part: Voice | null;
    /** Whether "Suggest alto for bars 10–12" can reach the AI. */
    suggestions: boolean;
};

export type EditorMode = 'notes' | 'lyrics';
