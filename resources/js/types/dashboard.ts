import type {
    DohKey,
    ScoreOrigin,
    ScoreStatus,
    ShareAccess,
    Voice,
} from './score';

export type VoiceState = 'complete' | 'started' | 'empty' | 'flagged';

export type VoiceProgress = {
    voice: Voice;
    done: number;
    total: number;
    state: VoiceState;
};

/** The flat shape the library and score overview receive from the server. */
export type ScoreSummary = {
    id: string;
    title: string;
    composer: string | null;
    doh: DohKey;
    origin: ScoreOrigin;
    status: ScoreStatus;
    bars: number;
    bpm: number;
    beats: number;
    style: string | null;
    updated_at: string;
    updated_human: string;
    notes_to_check: number;
    read_score: number | null;
    read_percent: number | null;
    voice_progress: VoiceProgress[];
    completion: number;
    needs_review: boolean;
    ready: boolean;
    shared: boolean;
    share_can: ShareAccess | null;
    share_label: string | null;
    solfa_preview: string;
};

export type DashboardView = 'all' | 'review' | 'composed' | 'scanned';
export type DashboardSort = 'edited' | 'title' | 'key';

export type DashboardFilters = {
    q: string;
    view: DashboardView;
    key: DohKey | null;
    sort: DashboardSort;
    all: boolean;
};

export type DashboardCounts = {
    all: number;
    review: number;
    composed: number;
    scanned: number;
    shared: number;
    ready: number;
};

export type KeyCount = {
    key: DohKey;
    count: number;
};

export type ActivityItem = {
    id: number;
    user_name: string;
    initials: string;
    action: string;
    score_title: string;
    score_id: string;
    when: string;
};

export type LibraryShare = {
    id: string;
    title: string;
    access: ShareAccess | null;
    label: string | null;
    when: string;
};

export type DashboardProps = {
    scores: ScoreSummary[];
    total: number;
    filtered_total: number;
    shown: number;
    counts: DashboardCounts;
    keys: KeyCount[];
    resume: ScoreSummary | null;
    activity: ActivityItem[];
    shares: LibraryShare[];
    filters: DashboardFilters;
};

export type ScoreFlagItem = {
    id: number;
    part: Voice;
    part_label: string;
    bar: number;
    beat: number;
    guesses: { pitch: string; octave: number; confidence: number }[];
};

export type OverviewVersion = {
    id: number;
    version: number;
    note: string | null;
    when: string;
    user_name: string;
    is_you: boolean;
};

export type OverviewShare = {
    id: string;
    can: ShareAccess;
    label: string;
    when: string;
    pinned_version: number | null;
};

export type PartOverview = {
    voice: Voice;
    label: string;
    done: number;
    total: number;
    preview: string;
};

export type SectionOverview = {
    name: string;
    from: number;
    to: number;
};

export type ScoreShowProps = {
    score: ScoreSummary;
    flags: ScoreFlagItem[];
    versions: OverviewVersion[];
    shares: OverviewShare[];
    parts: PartOverview[];
    sections: SectionOverview[];
};
