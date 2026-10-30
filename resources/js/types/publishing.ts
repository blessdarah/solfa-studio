/** Where a score stands with its public page (Paper W13). */
export type Publishing = {
    published: boolean;
    /** The public page, e.g. https://…/p/onyame-ye */
    url: string | null;
    slug: string | null;
    /** "Oct 20" */
    published_human: string | null;
    visits: number;
    plays: number;
    /** Edited since it was last published. */
    has_changes: boolean;
    /** Shows in the public song search. */
    listed: boolean;
    allow_play: boolean;
    allow_print: boolean;
    show_words: boolean;
};
