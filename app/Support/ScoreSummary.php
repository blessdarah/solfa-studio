<?php

namespace App\Support;

use App\Enums\ScoreStatus;
use App\Enums\ShareAccess;
use App\Models\ScanFlag;
use App\Models\Score;
use App\Music\Bar;
use App\Music\Note;
use App\Music\Part;
use App\Music\ScoreDocument;
use App\Music\Voice;
use Carbon\CarbonInterface;

/**
 * Turns a Score into the small, flat shape the library and overview need:
 * voice progress, flags, a sol-fa sketch, and dates a person can read.
 *
 * @phpstan-type ScoreRow array{
 *     id: string,
 *     title: string,
 *     composer: string|null,
 *     arranger: string|null,
 *     kind: string,
 *     meta: string,
 *     archived: bool,
 *     owner_name: string,
 *     doh: string,
 *     origin: string,
 *     status: string,
 *     bars: int,
 *     bpm: int,
 *     beats: int,
 *     style: string|null,
 *     updated_at: string,
 *     updated_human: string,
 *     notes_to_check: int,
 *     read_score: float|null,
 *     read_percent: int|null,
 *     voice_progress: list<array{voice: string, done: int, total: int, state: string}>,
 *     completion: int,
 *     needs_review: bool,
 *     ready: bool,
 *     shared: bool,
 *     share_can: string|null,
 *     share_label: string|null,
 *     published: bool,
 *     publishing: array<string, mixed>,
 *     deleted_at: string|null,
 *     deleted_days_left: int|null,
 *     preview: list<array{beats: int, notes: list<array<string, mixed>>}>
 * }
 */
final class ScoreSummary
{
    /**
     * @return ScoreRow
     */
    public static function from(Score $score): array
    {
        $document = $score->document;
        $scan = $score->latestScan;
        $flags = $scan?->flags->where('resolved', false) ?? collect();

        $flaggedParts = $flags
            ->map(fn (ScanFlag $flag) => $flag->part->value)
            ->unique()
            ->values();

        $voices = collect(Voice::cases())->map(function (Voice $voice) use ($document, $flaggedParts): array {
            $part = $document->part($voice);
            $done = $part?->doneCount() ?? 0;
            $started = $part !== null && collect($part->bars)->contains(
                fn (Bar $bar) => $bar->done || $bar->notes !== [],
            );

            $state = match (true) {
                $flaggedParts->contains($voice->value) => 'flagged',
                $done === $document->bars && $done > 0 => 'complete',
                $started => 'started',
                default => 'empty',
            };

            return [
                'voice' => $voice->value,
                'done' => $done,
                'total' => $document->bars,
                'state' => $state,
            ];
        })->values();

        $done = $voices->sum('done');
        $totalBars = $document->bars * count(Voice::cases());
        $completion = $totalBars > 0 ? (int) round($done / $totalBars * 100) : 0;

        $share = $score->shares
            ->sortByDesc(fn ($share) => match ($share->can) {
                ShareAccess::Edit => 3,
                ShareAccess::Practise => 2,
                ShareAccess::View => 1,
            })
            ->first();

        $ready = $flags->isEmpty()
            && $voices->every(fn (array $voice) => $voice['state'] === 'complete')
            && $document->bars > 0;

        return [
            'id' => $score->id,
            'title' => $score->title,
            'composer' => $score->composer,
            'arranger' => $score->arranger,
            'kind' => $score->isArrangement() ? 'arrangement' : 'composition',
            'meta' => self::meta($score, $document),
            'archived' => $score->archived_at !== null,
            'owner_name' => $score->owner->name,
            'doh' => $score->doh,
            'origin' => $score->origin->value,
            'status' => $score->status->value,
            'bars' => $document->bars,
            'bpm' => $document->tempoAt(1),
            'beats' => $document->beatsInBar(1),
            'style' => $document->style,
            'updated_at' => $score->updated_at?->toIso8601String() ?? now()->toIso8601String(),
            'updated_human' => self::human($score->updated_at),
            'notes_to_check' => $flags->count(),
            'read_score' => $scan?->read_score,
            'read_percent' => $scan?->read_score !== null ? (int) round($scan->read_score * 100) : null,
            'voice_progress' => array_values($voices->all()),
            'completion' => $completion,
            'needs_review' => $flags->isNotEmpty() || $score->status === ScoreStatus::Checking,
            'ready' => $ready,
            'shared' => $score->shares->isNotEmpty(),
            'share_can' => $share?->can->value,
            'share_label' => $share ? self::shareLabel($share->can) : null,
            'published' => $score->isPublished(),
            'publishing' => Publishing::state($score),
            'deleted_at' => $score->deleted_at?->toIso8601String(),
            'deleted_days_left' => $score->deleted_at !== null
                ? max(0, Score::KEEP_DELETED_DAYS - (int) $score->deleted_at->diffInDays(now()))
                : null,
            'preview' => self::preview($document),
        ];
    }

    /**
     * The first four bars with notes in the busiest voice, for the sol-fa
     * sketch on the resume card (the browser prints them).
     *
     * @return list<array{beats: int, notes: list<array<string, mixed>>}>
     */
    public static function preview(ScoreDocument $document, int $bars = 4): array
    {
        $busiest = collect($document->parts)
            ->sortByDesc(fn (Part $part) => collect($part->bars)->sum(fn (Bar $bar) => count($bar->notes)))
            ->first();

        if ($busiest === null) {
            return [];
        }

        return collect($busiest->bars)
            ->filter(fn (Bar $bar) => $bar->notes !== [])
            ->take($bars)
            ->map(fn (Bar $bar) => [
                'beats' => $document->beatsInBar($bar->no),
                'notes' => array_map(fn (Note $note) => $note->toArray(), $bar->notes),
            ])
            ->values()
            ->all();
    }

    public static function human(?CarbonInterface $date): string
    {
        if ($date === null) {
            return '';
        }

        if ($date->isToday()) {
            $minutes = (int) abs($date->diffInMinutes(now()));

            if ($minutes < 1) {
                return 'Just now';
            }

            if ($minutes < 60) {
                return $minutes.' min ago';
            }

            return (int) abs($date->diffInHours(now())).'h ago';
        }

        if ($date->isYesterday()) {
            return 'Yesterday';
        }

        return $date->year === now()->year
            ? $date->format('M j')
            : $date->format('M j, Y');
    }

    /**
     * "Gabriel Adjei" → "GA", "Darah-B Studios" → "DB".
     */
    public static function initials(?string $name): string
    {
        $parts = preg_split('/[\s\-]+/', trim($name ?? 'You'), -1, PREG_SPLIT_NO_EMPTY) ?: ['You'];

        return mb_strtoupper(mb_substr($parts[0], 0, 1).mb_substr($parts[1] ?? '', 0, 1));
    }

    public static function shareLabel(ShareAccess $access): string
    {
        return match ($access) {
            ShareAccess::View => 'View only',
            ShareAccess::Practise => 'Practice',
            ShareAccess::Edit => 'Can edit',
        };
    }

    /**
     * The grey line under a title in the library:
     * "Traditional · arr. Ama Serwaa · Doh is G" or
     * "Blessdaraah · Highlife · Doh is E♭".
     */
    public static function meta(Score $score, ScoreDocument $document): string
    {
        $parts = [];

        $composer = trim((string) $score->composer);
        $parts[] = $composer !== '' ? $composer : 'Unknown composer';

        if ($score->isArrangement()) {
            $parts[] = 'arr. '.trim((string) $score->arranger);
        }

        if ($document->style !== null && trim($document->style) !== '') {
            $parts[] = ucfirst(trim($document->style));
        }

        $parts[] = 'Doh is '.self::key($score->doh);

        return implode(' · ', $parts);
    }

    /**
     * "Eb" → "E♭", "F#" → "F♯".
     */
    public static function key(string $doh): string
    {
        return str_replace(['b', '#'], ['♭', '♯'], $doh);
    }

    /**
     * Compact times for activity lines: "now", "12m", "2h", "Yesterday", "Oct 21".
     */
    public static function short(?CarbonInterface $date): string
    {
        if ($date === null) {
            return '';
        }

        if ($date->isToday()) {
            $minutes = (int) abs($date->diffInMinutes(now()));

            return match (true) {
                $minutes < 1 => 'now',
                $minutes < 60 => $minutes.'m',
                default => (int) abs($date->diffInHours(now())).'h',
            };
        }

        if ($date->isYesterday()) {
            return 'Yesterday';
        }

        return $date->year === now()->year ? $date->format('M j') : $date->format('M j, Y');
    }
}
