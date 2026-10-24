<?php

namespace App\Support;

use App\Enums\ScoreStatus;
use App\Enums\ShareAccess;
use App\Models\ScanFlag;
use App\Models\Score;
use App\Music\Bar;
use App\Music\Note;
use App\Music\Part;
use App\Music\Pitch;
use App\Music\ScoreDocument;
use App\Music\Voice;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Turns a Score into the small, flat shape the library and overview need:
 * voice progress, flags, a sol-fa sketch, and dates a person can read.
 *
 * @phpstan-type ScoreRow array{
 *     id: string,
 *     title: string,
 *     composer: string|null,
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
 *     solfa_preview: string
 * }
 * @phpstan-type KeyCount array{key: string, count: int}
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
            'solfa_preview' => self::solfaPreview($document),
        ];
    }

    /**
     * A short sol-fa line for the busiest voice, used on the resume card.
     */
    public static function solfaPreview(ScoreDocument $document, int $bars = 4): string
    {
        $busiest = collect($document->parts)
            ->sortByDesc(fn (Part $part) => collect($part->bars)->sum(
                fn (Bar $bar) => count($bar->notes),
            ))
            ->first();

        return self::partPreview($busiest, $bars);
    }

    /**
     * Up to $bars bars of one part, with the silences left out.
     */
    public static function partPreview(?Part $part, int $bars = 3): string
    {
        if ($part === null) {
            return '';
        }

        $lines = [];

        foreach ($part->bars as $bar) {
            if ($bar->notes === []) {
                continue;
            }

            $lines[] = collect($bar->notes)
                ->take(8)
                ->map(fn (Note $note) => self::solfa($note))
                ->implode(' · ');

            if (count($lines) === $bars) {
                break;
            }
        }

        return implode(' | ', $lines);
    }

    public static function solfa(Note $note): string
    {
        if ($note->pitch === Pitch::Rest) {
            return '–';
        }

        return $note->pitch->value.match ($note->octave) {
            -1 => ',',
            1 => "'",
            default => '',
        };
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

    public static function initials(?string $name): string
    {
        $parts = preg_split('/\s+/', trim($name ?? 'You')) ?: [];
        $first = $parts[0] ?? 'Y';
        $last = $parts[1] ?? '';

        return strtoupper(substr($first, 0, 1).substr($last, 0, 1));
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
     * @param  Collection<int, ScoreRow>  $scores
     * @return Collection<int, KeyCount>
     */
    public static function keys(Collection $scores): Collection
    {
        return $scores
            ->groupBy('doh')
            ->map(fn (Collection $group, string $key) => [
                'key' => $key,
                'count' => $group->count(),
            ])
            ->sortByDesc('count')
            ->take(6)
            ->values();
    }
}
