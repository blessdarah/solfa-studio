import type { DohKey, Note, ScoreDocument } from './score';

/** A published song as the public pages show it (Paper W14–W17). */
export type SongCard = {
    slug: string;
    title: string;
    composer: string | null;
    arranger: string | null;
    doh: DohKey;
    style: string | null;
    /** The parts that have music: ['S', 'A', 'T', 'B'] */
    voices: string[];
    /** Who published it: "Darah-B Studios" */
    owner: string;
    preview: { beats: number; notes: Note[] }[];
    first_words: string | null;
    published_human: string;
};

/** Where a search matched: the title, the composer, or words in a verse. */
export type SearchMatch = { in: string; before: string; match: string; after: string };

export type StyleCount = { name: string; count: number; sample?: { beats: number; notes: Note[] } | null };

export type PublicHomeProps = {
    songs: SongCard[];
    styles: StyleCount[];
    total: number;
    signed_in: boolean;
};

export type PublicSearchProps = {
    results: (SongCard & { match: SearchMatch | null })[];
    total: number;
    styles: StyleCount[];
    filters: { q: string; voices: 'any' | 'SATB' | 'SA' | 'TB'; style: string };
    signed_in: boolean;
};

export type PublicScoreProps = {
    song: SongCard & { url: string; published_at: string | null; is_owner: boolean; score_id: string | null };
    document: ScoreDocument;
    doh: DohKey;
    can: { play: boolean; print: boolean };
    signed_in: boolean;
};
