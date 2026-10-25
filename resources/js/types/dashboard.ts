import type { DohKey, Note, ScoreOrigin, ScoreStatus, ShareAccess, Voice } from './score';

export type VoiceState = 'complete' | 'started' | 'empty' | 'flagged';

export type VoiceProgress = {
    voice: Voice;
    done: number;
    total: number;
    state: VoiceState;
};

/** One row of the library, as the server summarises a score. */
export type ScoreSummary = {
    id: string;
    title: string;
    composer: string | null;
    arranger: string | null;
    kind: 'composition' | 'arrangement';
    /** "Traditional · arr. Ama Serwaa · Doh is G" */
    meta: string;
    archived: boolean;
    owner_name: string;
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
    /** Up to four bars of the busiest voice, for the resume card's sketch. */
    preview: { beats: number; notes: Note[] }[];
};

export type DashboardView = 'all' | 'review' | 'shared' | 'archive' | 'collection' | 'rehearsal';
export type DashboardKind = 'all' | 'composed' | 'arrangements';
export type DashboardSort = 'edited' | 'title' | 'key';

export type DashboardFilters = {
    view: DashboardView;
    collection: number | null;
    rehearsal: number | null;
    kind: DashboardKind;
    sort: DashboardSort;
    q: string;
    all: boolean;
};

export type Workspace = {
    name: string;
    initials: string;
    role: string;
    plan: string;
};

export type CollectionItem = {
    id: number;
    name: string;
    color: 'ink' | 'marker' | 'grey';
    count: number;
};

export type ActivityItem = {
    id: number;
    user_name: string;
    initials: string;
    /** "added the tenor line in Onyame Ye · 2h" */
    text: string;
    score_id: string;
};

export type NextRehearsal = {
    id: number;
    in: string;
    when: string;
    ensemble: string;
    singers: number | null;
    scores: number;
};

export type NotificationItem = {
    id: string;
    initials: string;
    actor: string;
    text: string;
    score_id: string | null;
    read: boolean;
};

export type DashboardProps = {
    workspace: Workspace;
    nav: { all: number; review: number; shared: number; archive: number };
    collections: CollectionItem[];
    heading: string;
    scores: ScoreSummary[];
    shown: number;
    filtered_total: number;
    kinds: Record<DashboardKind, number>;
    counts: { all: number; review: number; shared: number; ready: number };
    resume: ScoreSummary | null;
    /** Every score in the library, for picking a rehearsal plan. */
    choices: { id: string; title: string }[];
    activity: ActivityItem[];
    rehearsal: NextRehearsal | null;
    notifications: { unread: number; items: NotificationItem[] };
    filters: DashboardFilters;
};
