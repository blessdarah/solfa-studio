/**
 * Shapes of the score data the server sends to the editor.
 * Mirrors app/Music/* (the score document) and app/Models/* (the rows).
 *
 * Rules: notes count beats, never seconds (tempo lives in `map`);
 * words and marks point at part · bar · beat; doh is stored once on the score.
 */

export type Voice = 'S' | 'A' | 'T' | 'B';

export type Pitch = 'd' | 'r' | 'm' | 'f' | 'fe' | 's' | 'l' | 'ta' | 't' | 'rest';

/** -1 = low (d₁), 0 = middle (d), 1 = high (d'). */
export type Octave = -1 | 0 | 1;

export type NoteSource = 'typed' | 'scan' | 'ai';

export type Note = {
    pitch: Pitch;
    octave: Octave;
    /** Beat the note starts on, 0-based from the start of the bar. */
    start: number;
    /** Length in beats: 1, 0.5, 2… */
    length: number;
    source: NoteSource;
};

export type Bar = {
    /** 1-based bar number; bars[i].no === i + 1. */
    no: number;
    notes: Note[];
    /** Marked finished by the composer — drives "Alto 9/16". */
    done: boolean;
};

export type Part = {
    id: Voice;
    name: string;
    /** Always one per bar of the score, so parts line up beat by beat. */
    bars: Bar[];
};

export type Ramp = 'at_once' | 'rit' | 'accel';

export type MapEvent = {
    bar: number;
    bpm: number | null;
    beats: number | null;
    ramp: Ramp;
    /** Last bar the change lasts for; null = to the end. */
    until: number | null;
};

export type Position = { bar: number; beat: number };

export type MarkKind = 'dyn' | 'hairpin' | 'nav' | 'text';

export type Mark =
    | { kind: 'dyn'; value: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'; at: Position; to: null; parts: Voice[] | null }
    | { kind: 'hairpin'; value: 'cresc' | 'dim'; at: Position; to: Position; parts: Voice[] | null }
    | { kind: 'nav'; value: '$' | 'DS' | 'DC' | 'Fine'; at: Position; to: null; parts: Voice[] | null }
    | { kind: 'text'; value: string; at: Position; to: null; parts: Voice[] | null };

export type SyllableJoin = 'none' | 'split' | 'hold';

export type Syllable = {
    part: Voice;
    bar: number;
    beat: number;
    text: string;
    join: SyllableJoin;
};

export type Verse = {
    id: string;
    label: string;
    /** "tw", "en"… */
    lang: string;
    syllables: Syllable[];
};

export type Section = {
    name: string;
    from: number;
    to: number;
    /** 1 or 2 for 1st/2nd-time endings. */
    ending: number | null;
    repeat: number;
};

export type ScoreDocument = {
    schema: 1;
    bars: number;
    style: string | null;
    /** First event is always bar 1 with both bpm and beats. */
    map: MapEvent[];
    parts: Part[];
    verses: Verse[];
    marks: Mark[];
    sections: Section[];
    footnotes: string[];
};

export type DohKey = 'C' | 'C#' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'F#' | 'Gb' | 'G' | 'Ab' | 'A' | 'Bb' | 'B';

export type ScoreOrigin = 'scanned' | 'composed';
export type ScoreStatus = 'draft' | 'checking' | 'shared';

export type Score = {
    id: string;
    owner_id: number;
    title: string;
    composer: string | null;
    doh: DohKey;
    origin: ScoreOrigin;
    status: ScoreStatus;
    document: ScoreDocument;
    /** Send back with every save; a 409 means another tab saved first. */
    version: number;
    created_at: string;
    updated_at: string;
};

export type ScoreVersion = {
    id: number;
    score_id: string;
    version: number;
    document: ScoreDocument;
    saved_by: number | null;
    note: string | null;
    saved_at: string;
};

export type ShareAccess = 'view' | 'practise' | 'edit';

export type Share = {
    id: string;
    score_id: string;
    can: ShareAccess;
    /** Pinned snapshot, or null for always-latest. */
    version: number | null;
    created_at: string;
};

export type ScanState = 'reading' | 'review' | 'done';

export type Scan = {
    id: string;
    score_id: string;
    pages: string[];
    state: ScanState;
    /** 0–1; 0.94 shows as "94% read". */
    read_score: number | null;
    created_at: string;
};

export type ScanFlag = {
    id: number;
    scan_id: string;
    part: Voice;
    bar: number;
    beat: number;
    crop: { x: number; y: number; w: number; h: number };
    /** Best guess first. */
    guesses: { pitch: Pitch; octave: Octave; confidence: number }[];
    resolved: boolean;
    picked: Note | null;
};
