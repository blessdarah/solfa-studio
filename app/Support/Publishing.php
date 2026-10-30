<?php

namespace App\Support;

use App\Models\Score;

/**
 * Where a score stands with its public page, for the publish dialog
 * (Paper W13) and the library's "Published" pills.
 *
 * @phpstan-type PublishingState array{
 *     published: bool,
 *     url: string|null,
 *     slug: string|null,
 *     published_human: string|null,
 *     visits: int,
 *     plays: int,
 *     has_changes: bool,
 *     listed: bool,
 *     allow_play: bool,
 *     allow_print: bool,
 *     show_words: bool
 * }
 */
final class Publishing
{
    /**
     * @return PublishingState
     */
    public static function state(Score $score): array
    {
        $published = $score->isPublished();

        return [
            'published' => $published,
            'url' => $published && $score->slug !== null ? route('public.score', $score->slug) : null,
            'slug' => $score->slug,
            'published_human' => $published ? ScoreSummary::human($score->published_at) : null,
            'visits' => $score->visits,
            'plays' => $score->plays,
            'has_changes' => $score->hasUnpublishedChanges(),
            'listed' => $score->listed,
            'allow_play' => $score->allow_play,
            'allow_print' => $score->allow_print,
            'show_words' => $score->show_words,
        ];
    }
}
