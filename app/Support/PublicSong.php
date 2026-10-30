<?php

namespace App\Support;

use App\Models\Score;
use App\Music\Bar;
use App\Music\Part;
use App\Music\ScoreDocument;
use App\Music\SyllableJoin;
use App\Music\Voice;
use Illuminate\Support\Str;

/**
 * A published score as the public pages show it (Paper W14–W17): what was
 * published, never the composer's newer, unpublished edits.
 *
 * @phpstan-type SongCard array{
 *     slug: string,
 *     title: string,
 *     composer: string|null,
 *     arranger: string|null,
 *     doh: string,
 *     style: string|null,
 *     voices: list<string>,
 *     owner: string,
 *     preview: list<array{beats: int, notes: list<array<string, mixed>>}>,
 *     first_words: string|null,
 *     published_human: string
 * }
 */
final class PublicSong
{
    /**
     * @return SongCard
     */
    public static function card(Score $score): array
    {
        $published = $score->published ?? [];
        $document = $score->publishedDocument() ?? $score->document;

        return [
            'slug' => (string) $score->slug,
            'title' => (string) ($published['title'] ?? $score->title),
            'composer' => $published['composer'] ?? $score->composer,
            'arranger' => $published['arranger'] ?? $score->arranger,
            'doh' => (string) ($published['doh'] ?? $score->doh),
            'style' => $document->style,
            'voices' => self::voices($document),
            'owner' => $score->owner->workspaceLabel(),
            'preview' => ScoreSummary::preview($document, 2),
            'first_words' => $score->show_words ? self::firstWords($document) : null,
            'published_human' => ScoreSummary::human($score->published_at),
        ];
    }

    /**
     * The parts that have music in them, in S A T B order.
     *
     * @return list<string>
     */
    public static function voices(ScoreDocument $document): array
    {
        return collect($document->parts)
            ->filter(fn (Part $part) => collect($part->bars)->contains(fn (Bar $bar) => $bar->notes !== []))
            ->map(fn (Part $part) => $part->id->value)
            ->sortBy(fn (string $voice) => array_search($voice, array_map(fn (Voice $v) => $v->value, Voice::cases()), true))
            ->values()
            ->all();
    }

    /**
     * Each verse's words as one line of text: "O-nya-me ye, ɔ-dɔ me o".
     *
     * @return list<array{label: string, text: string}>
     */
    public static function verses(ScoreDocument $document): array
    {
        return collect($document->verses)->map(function ($verse): array {
            $text = '';

            foreach ($verse->syllables as $syllable) {
                $text .= $syllable->text.($syllable->join === SyllableJoin::Split ? '' : ' ');
            }

            return ['label' => $verse->label, 'text' => trim(preg_replace('/\s+/', ' ', $text) ?? '')];
        })->filter(fn (array $verse) => $verse['text'] !== '')->values()->all();
    }

    public static function firstWords(ScoreDocument $document, int $words = 7): ?string
    {
        $first = self::verses($document)[0]['text'] ?? null;

        return $first === null ? null : Str::words($first, $words, '…');
    }

    /**
     * Where a search matched, for the line under a result: the title, the
     * composer, or a few words around the match in a verse.
     *
     * @return array{in: string, before: string, match: string, after: string}|null
     */
    public static function match(Score $score, string $query): ?array
    {
        $needle = Str::lower(trim($query));

        if ($needle === '') {
            return null;
        }

        $published = $score->published ?? [];
        $title = (string) ($published['title'] ?? $score->title);

        if (Str::contains(Str::lower($title), $needle)) {
            return ['in' => 'title', 'before' => '', 'match' => '', 'after' => ''];
        }

        foreach (['composer', 'arranger'] as $field) {
            $value = (string) ($published[$field] ?? '');

            if ($value !== '' && Str::contains(Str::lower($value), $needle)) {
                return ['in' => $field, 'before' => '', 'match' => $value, 'after' => ''];
            }
        }

        if (! $score->show_words) {
            return null;
        }

        foreach (self::verses($score->publishedDocument() ?? $score->document) as $verse) {
            $at = mb_stripos($verse['text'], $needle);

            if ($at === false) {
                continue;
            }

            $before = mb_substr($verse['text'], max(0, $at - 32), min($at, 32));
            $match = mb_substr($verse['text'], $at, mb_strlen($needle));
            $after = mb_substr($verse['text'], $at + mb_strlen($needle), 40);

            return [
                'in' => $verse['label'],
                'before' => ($at > 32 ? '…' : '').$before,
                'match' => $match,
                'after' => $after.(mb_strlen($verse['text']) > $at + mb_strlen($needle) + 40 ? '…' : ''),
            ];
        }

        return null;
    }
}
