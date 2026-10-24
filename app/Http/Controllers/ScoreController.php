<?php

namespace App\Http\Controllers;

use App\Enums\ScoreOrigin;
use App\Enums\ScoreStatus;
use App\Http\Requests\StoreScoreRequest;
use App\Models\ScanFlag;
use App\Models\Score;
use App\Models\ScoreVersion;
use App\Models\Share;
use App\Music\ScoreDocument;
use App\Music\Voice;
use App\Support\ScoreSummary;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ScoreController extends Controller
{
    /**
     * The quiet "Saved 4s ago" note in the compose bar.
     */
    private function savedLabel(Score $score): string
    {
        $saved = $score->updated_at;

        if ($saved === null) {
            return 'Saved';
        }

        $seconds = (int) abs($saved->diffInSeconds(now()));

        return match (true) {
            $seconds < 60 => "Saved {$seconds}s ago",
            $seconds < 3600 => 'Saved '.(int) floor($seconds / 60).'m ago',
            $seconds < 86400 => 'Saved '.(int) floor($seconds / 3600).'h ago',
            default => 'Saved '.ScoreSummary::human($saved),
        };
    }

    /**
     * Start a blank score and open its overview.
     */
    public function store(StoreScoreRequest $request): RedirectResponse
    {
        $score = $request->user()->scores()->create([
            'title' => $request->validated('title'),
            'composer' => $request->validated('composer') ?: $request->user()->name,
            'doh' => $request->validated('doh'),
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Draft,
            'document' => ScoreDocument::blank(bars: 16),
        ]);

        return redirect()
            ->route('scores.show', $score)
            ->with('success', 'Score created. It is ready for its first notes.');
    }

    /**
     * A read-only overview of one score: parts, flags, sharing and history.
     */
    public function show(Request $request, Score $score): Response
    {
        abort_unless($score->owner_id === $request->user()->id, 404);

        $score->load(['latestScan.flags', 'shares']);

        $document = $score->document;
        $summary = ScoreSummary::from($score);
        $latestScan = $score->latestScan;

        $flags = ($latestScan->flags ?? collect())
            ->where('resolved', false)
            ->sortBy([['bar', 'asc'], ['beat', 'asc']])
            ->map(fn (ScanFlag $flag) => [
                'id' => $flag->id,
                'part' => $flag->part->value,
                'part_label' => $flag->part->label(),
                'bar' => $flag->bar,
                'beat' => (float) $flag->beat,
                'guesses' => collect($flag->guesses)->map(fn (array $guess) => [
                    'pitch' => (string) $guess['pitch'],
                    'octave' => (int) $guess['octave'],
                    'confidence' => (float) $guess['confidence'],
                ])->values()->all(),
            ])
            ->values();

        $versions = $score->versions()
            ->select(['id', 'score_id', 'version', 'saved_by', 'note', 'saved_at'])
            ->with('savedBy:id,name')
            ->orderByDesc('saved_at')
            ->limit(6)
            ->get()
            ->map(fn (ScoreVersion $version) => [
                'id' => $version->id,
                'version' => $version->version,
                'note' => $version->note,
                'when' => ScoreSummary::human($version->saved_at),
                'user_name' => $version->saved_by === $request->user()->id
                    ? 'You'
                    : ($version->savedBy->name ?? 'Someone'),
                'is_you' => $version->saved_by === $request->user()->id,
            ])
            ->values();

        $shares = $score->shares()
            ->select(['id', 'score_id', 'can', 'version', 'created_at'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Share $share) => [
                'id' => $share->id,
                'can' => $share->can->value,
                'label' => ScoreSummary::shareLabel($share->can),
                'when' => ScoreSummary::human($share->created_at),
                'pinned_version' => $share->version,
            ])
            ->values();

        $parts = collect(Voice::cases())->map(function (Voice $voice) use ($document): array {
            $part = $document->part($voice);

            return [
                'voice' => $voice->value,
                'label' => $voice->label(),
                'done' => $part?->doneCount() ?? 0,
                'total' => $document->bars,
                'preview' => ScoreSummary::partPreview($part, 2),
            ];
        })->values();

        $sections = collect($document->sections)->map(fn ($section) => [
            'name' => $section->name,
            'from' => $section->from,
            'to' => $section->to,
        ])->values();

        return Inertia::render('scores/show', [
            'score' => $summary,
            'document' => $document,
            'saved_label' => $this->savedLabel($score),
            'flags' => $flags,
            'versions' => $versions,
            'shares' => $shares,
            'parts' => $parts,
            'sections' => $sections,
        ]);
    }
}
