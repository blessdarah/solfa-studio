/**
 * Typing the words in one go: split them into syllables and put one
 * syllable on each note of the part the words follow.
 *
 * The splitting follows general (English-style) spelling rules — no
 * language-specific syllable tables. It's a best guess; a hyphen typed in
 * a word always wins: "Hal-le-lu-jah" is split exactly there.
 */
import { noteStarts, setSyllable } from '@/lib/editor';
import { partOf } from '@/lib/music';
import { slotKey, slurStarts } from '@/lib/slurs';
import type { ScoreDocument, SyllableJoin, Voice } from '@/types/score';

const VOWELS = new Set([...'aeiouàáâäèéêëìíîïòóôöùúûüɛɔ']);

/** Consonant pairs that sound as one ("father", "mighty") and stay together. */
const DIGRAPHS = ['ch', 'sh', 'th', 'ph', 'wh', 'gh', 'ck', 'ng', 'qu'];

/** Pairs a syllable can begin with ("a-bra-ham", "my-stery"). */
const ONSETS = new Set(['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'wr', 'kn', 'ch', 'sh', 'th', 'ph', 'wh', 'qu']);

const isVowel = (word: string, i: number): boolean => {
    const c = word[i];

    if (VOWELS.has(c)) return true;

    // "y" is a vowel after a consonant: glo-ry, my, rhy-thm.
    return c === 'y' && i > 0 && !VOWELS.has(word[i - 1]);
};

/** Split one word (letters only, lower case) into syllables. */
function splitLetters(word: string): string[] {
    // Vowel groups: [start, end) of each run of vowels.
    const groups: [number, number][] = [];

    for (let i = 0; i < word.length; i++) {
        if (!isVowel(word, i)) continue;

        const start = i;
        while (i + 1 < word.length && isVowel(word, i + 1)) i++;
        groups.push([start, i + 1]);
    }

    // Two vowels that are sung apart: glo-ri-a, li-on, Em-man-u-el (not "true", "queen").
    const spread: [number, number][] = [];

    for (const [start, end] of groups) {
        let from = start;

        for (let i = start + 1; i < end; i++) {
            const pair = word[i - 1] + word[i];
            const afterQ = word[i - 2] === 'q' || word[i - 2] === 'g';
            const final = i === word.length - 1;

            if (['ia', 'io', 'iu', 'eo', 'ua', 'uo'].includes(pair) || (pair === 'ue' && !afterQ && !final) || (pair === 'ui' && word[i + 1] === 'a')) {
                spread.push([from, i]);
                from = i;
            }
        }

        spread.push([from, end]);
    }

    // A silent final e (praise, love) or es / ed (loves, loved) adds no syllable;
    // "-ble", "-tle" (ta-ble) and "-ted", "-ses" (want-ed, rose-s) still do.
    const last = spread[spread.length - 1];

    if (spread.length > 1 && last[0] === word.length - 1 && word.endsWith('e')) {
        const before = word[word.length - 2];
        const consonantLe = word.endsWith('le') && !VOWELS.has(word[word.length - 3] ?? 'a') && word[word.length - 3] !== 'l';

        if (!VOWELS.has(before) && !consonantLe) spread.pop();
    } else if (spread.length > 1 && last[0] === word.length - 2 && /e[sd]$/.test(word)) {
        const stem = word.slice(0, -2);
        const sounded = word.endsWith('ed') ? /[td]$/.test(stem) : /(s|z|x|ch|sh|ge|ce)$/.test(stem);

        if (!sounded && !VOWELS.has(stem[stem.length - 1])) spread.pop();
    }

    if (spread.length <= 1) return [word];

    // Cut between each pair of vowel groups, in the consonants between them.
    const cuts: number[] = [];

    for (let g = 1; g < spread.length; g++) {
        const gapStart = spread[g - 1][1];
        const gapEnd = spread[g][0];
        const gap = word.slice(gapStart, gapEnd);

        let keep: number; // consonants that stay with the syllable before

        if (gap.length === 0) {
            keep = 0;
        } else if (gap.length === 1) {
            keep = gap === 'x' ? 1 : 0; // ho-ly, but ex-alt
        } else if (gap.length === 2) {
            keep = DIGRAPHS.includes(gap) && gap !== 'ck' ? 0 : gap === 'ck' ? 2 : ONSETS.has(gap) && gap !== 'st' ? 0 : 1;
            if (gap === 'gh') keep = 2;
            if (gap === 'ng') keep = /^(ing|ed)$/.test(word.slice(gapEnd)) ? 2 : 1; // sing-ing, an-gels
        } else {
            // Three or more: the end that can start a syllable goes on; "ght" stays (migh-ty).
            keep = gap.startsWith('gh') ? 2 : ONSETS.has(gap.slice(-2)) ? gap.length - 2 : gap.length - 1;
        }

        // Sung endings keep the word whole before them: want-ed, last-ing, com-ing.
        const ending = word.slice(gapEnd);
        if (g === spread.length - 1 && (ending === 'ing' || ending === 'ed' || ending === 'ings') && gap.length > 0) keep = gap.length;

        cuts.push(gapStart + keep);
    }

    const out: string[] = [];
    let from = 0;

    for (const cut of cuts) {
        out.push(word.slice(from, cut));
        from = cut;
    }

    out.push(word.slice(from));

    return out.filter((s) => s !== '');
}

/** Split a word as typed (keeping its capitals and punctuation) into syllables. */
export function syllablesOf(word: string): string[] {
    if (word.includes('-')) {
        return word.split('-').filter((s) => s !== '');
    }

    const match = /^([^\p{L}]*)([\p{L}'’]+)([^\p{L}]*)$/u.exec(word);

    if (!match) return [word];

    const [, lead, letters, tail] = match;
    const parts = splitLetters(letters.toLowerCase());

    // Map the lower-case pieces back onto the typed letters.
    const pieces: string[] = [];
    let at = 0;

    for (const part of parts) {
        pieces.push(letters.slice(at, at + part.length));
        at += part.length;
    }

    pieces[0] = lead + pieces[0];
    pieces[pieces.length - 1] += tail;

    return pieces;
}

export type LyricToken = { text: string; join: SyllableJoin } | { hold: true };

/**
 * The words as syllables to place, in order: a word's syllables join with
 * "split" (sung on, printed with a hyphen); "_" holds the syllable before
 * over one more note.
 */
export function lyricTokens(text: string): LyricToken[] {
    const tokens: LyricToken[] = [];

    for (const raw of text.split(/\s+/).filter((w) => w !== '')) {
        // "Lord_" or "Lord __": the underscores are holds after the word.
        const holds = (raw.match(/_/g) ?? []).length;
        const word = raw.replace(/_/g, '');

        if (word !== '') {
            const syllables = syllablesOf(word);
            syllables.forEach((s, i) => tokens.push({ text: s, join: i < syllables.length - 1 ? 'split' : 'none' }));
        }

        for (let i = 0; i < holds; i++) tokens.push({ hold: true });
    }

    return tokens;
}

export type PlacedWords = {
    document: ScoreDocument;
    /** Where each syllable went, for the preview. */
    placed: { bar: number; beat: number; text: string; join: SyllableJoin }[];
    /** Syllables that found no note. */
    leftOver: number;
    /** Bar and beat after the last note used. */
    end: { bar: number; beat: number } | null;
};

/**
 * Put the syllables on the notes of `part` from (bar, beat) on — one per
 * note, rests skipped — replacing the words already on those notes.
 */
export function placeWords(document: ScoreDocument, verse: number, part: Voice, from: { bar: number; beat: number }, tokens: LyricToken[]): PlacedWords {
    const slots: { bar: number; beat: number }[] = [];

    for (let bar = from.bar; bar <= document.bars && slots.length < tokens.length; bar++) {
        for (const beat of noteStarts(document, part, bar)) {
            if (bar === from.bar && beat < from.beat - 1e-6) continue;
            slots.push({ bar, beat });
        }
    }

    const used = slots.slice(0, tokens.length);
    const starts = slurStarts(partOf(document, part));
    let next = document;
    const placed: PlacedWords['placed'] = [];

    // Clear what was on those notes first, so nothing old is left between new syllables.
    for (const slot of used) next = setSyllable(next, verse, part, slot.bar, slot.beat, '');

    tokens.slice(0, used.length).forEach((token, i) => {
        if ('hold' in token) {
            // Mark the syllable before as held over this note.
            const previous = placed[placed.length - 1];

            if (previous) {
                previous.join = 'hold';
                next = setSyllable(next, verse, part, previous.bar, previous.beat, previous.text, 'hold');
            }

            return;
        }

        const slot = used[i];
        // The syllable on a slur's first note is held over the rest of it.
        const join = starts.has(slotKey(slot.bar, slot.beat)) ? 'hold' : token.join;
        const syllable = { bar: slot.bar, beat: slot.beat, text: token.text, join };
        placed.push(syllable);
        next = setSyllable(next, verse, part, slot.bar, slot.beat, token.text, join);
    });

    const lastSlot = used[used.length - 1];

    return { document: next, placed, leftOver: Math.max(0, tokens.length - used.length), end: lastSlot ?? null };
}

/**
 * Where typed words start: at the cursor if the part has notes from there
 * on; otherwise at the first note without words in this verse (so switching
 * to words after writing the music starts at the top, not past the end).
 */
export function wordsStart(document: ScoreDocument, verse: number, part: Voice, cursor: { bar: number; beat: number }): { bar: number; beat: number } | null {
    const syllables = document.verses[verse]?.syllables ?? [];
    let firstEmpty: { bar: number; beat: number } | null = null;

    for (let bar = 1; bar <= document.bars; bar++) {
        for (const beat of noteStarts(document, part, bar)) {
            const fromCursor = bar > cursor.bar || (bar === cursor.bar && beat >= cursor.beat - 1e-6);

            if (fromCursor) return { bar, beat };

            if (!firstEmpty && !syllables.some((s) => s.part === part && s.bar === bar && Math.abs(s.beat - beat) < 1e-6)) {
                firstEmpty = { bar, beat };
            }
        }
    }

    return firstEmpty;
}
