<?php

namespace App\Http\Controllers;

use App\Models\Score;
use App\Models\ScoreVersion;
use App\Support\ScoreSummary;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * @phpstan-import-type ScoreRow from ScoreSummary
 *
 * @phpstan-type ActivityRow array{
 *     id: int,
 *     user_name: string,
 *     initials: string,
 *     action: string,
 *     score_title: string,
 *     score_id: string,
 *     when: string
 * }
 * @phpstan-type ShareRow array{
 *     id: string,
 *     title: string,
 *     access: string|null,
 *     label: string|null,
 *     when: string
 * }
 */
class DashboardController extends Controller
{
    private const VIEWS = ['all', 'review', 'composed', 'scanned'];

    private const SORTS = ['edited', 'title', 'key'];

    /**
     * The composer's library: every score, its progress, and what needs a
     * second look.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $view = (string) $request->query('view', 'all');
        $view = in_array($view, self::VIEWS, true) ? $view : 'all';

        $sort = (string) $request->query('sort', 'edited');
        $sort = in_array($sort, self::SORTS, true) ? $sort : 'edited';

        $key = (string) $request->query('key', '');
        $key = in_array($key, Score::DOH_KEYS, true) ? $key : '';

        $search = trim((string) $request->query('q', ''));
        $showAll = $request->boolean('all');

        $summaries = Score::query()
            ->where('owner_id', $user->id)
            ->with(['latestScan.flags', 'shares'])
            ->get()
            ->map(fn (Score $score) => ScoreSummary::from($score))
            ->values();

        $counts = [
            'all' => $summaries->count(),
            'review' => $summaries->where('needs_review', true)->count(),
            'composed' => $summaries->where('origin', 'composed')->count(),
            'scanned' => $summaries->where('origin', 'scanned')->count(),
            'shared' => $summaries->where('shared', true)->count(),
            'ready' => $summaries->where('ready', true)->count(),
        ];

        $filtered = $this->filter($summaries, $view, $key, $search);
        $filtered = $this->sort($filtered, $sort);

        $shown = $showAll ? $filtered : $filtered->take(8);

        return Inertia::render('dashboard', [
            'scores' => $shown->values(),
            'total' => $summaries->count(),
            'filtered_total' => $filtered->count(),
            'shown' => $shown->count(),
            'counts' => $counts,
            'keys' => ScoreSummary::keys($summaries),
            'resume' => $this->resume($summaries),
            'activity' => $this->activity($request),
            'shares' => $this->shares($summaries),
            'filters' => [
                'q' => $search,
                'view' => $view,
                'key' => $key === '' ? null : $key,
                'sort' => $sort,
                'all' => $showAll,
            ],
        ]);
    }

    /**
     * @param  Collection<int, ScoreRow>  $scores
     * @return Collection<int, ScoreRow>
     */
    private function filter(Collection $scores, string $view, string $key, string $search): Collection
    {
        if ($view === 'review') {
            $scores = $scores->where('needs_review', true);
        } elseif ($view === 'composed') {
            $scores = $scores->where('origin', 'composed');
        } elseif ($view === 'scanned') {
            $scores = $scores->where('origin', 'scanned');
        }

        if ($key !== '') {
            $scores = $scores->where('doh', $key);
        }

        if ($search !== '') {
            $needle = Str::lower($search);

            $scores = $scores->filter(fn (array $score) => Str::contains(
                Str::lower(implode(' ', [
                    $score['title'],
                    $score['composer'] ?? '',
                    $score['doh'],
                ])),
                $needle,
            ));
        }

        return $scores->values();
    }

    /**
     * @param  Collection<int, ScoreRow>  $scores
     * @return Collection<int, ScoreRow>
     */
    private function sort(Collection $scores, string $sort): Collection
    {
        return match ($sort) {
            'title' => $scores->sortBy(fn (array $score) => Str::lower($score['title'])),
            'key' => $scores->sortBy(fn (array $score) => array_search($score['doh'], Score::DOH_KEYS, true)),
            default => $scores->sortByDesc('updated_at'),
        };
    }

    /**
     * @param  Collection<int, ScoreRow>  $scores
     * @return ScoreRow|null
     */
    private function resume(Collection $scores): ?array
    {
        if ($scores->isEmpty()) {
            return null;
        }

        return $scores
            ->filter(fn (array $score) => $score['notes_to_check'] > 0)
            ->sortByDesc('updated_at')
            ->first()
            ?? $scores->sortByDesc('updated_at')->first();
    }

    /**
     * @return Collection<int, ActivityRow>
     */
    private function activity(Request $request): Collection
    {
        $user = $request->user();

        return ScoreVersion::query()
            ->whereHas('score', fn ($query) => $query->where('owner_id', $user->id))
            ->with(['score:id,title', 'savedBy:id,name'])
            ->orderByDesc('saved_at')
            ->limit(4)
            ->get()
            ->map(function (ScoreVersion $version) use ($user): array {
                $isYou = $version->saved_by === $user->id;
                $note = $version->note;

                $action = $note !== null ? Str::lcfirst($note) : 'saved changes';

                if ($action === 'created') {
                    $action = 'started this score';
                }

                return [
                    'id' => $version->id,
                    'user_name' => $isYou ? 'You' : ($version->savedBy->name ?? 'Someone'),
                    'initials' => ScoreSummary::initials($version->savedBy->name ?? null),
                    'action' => $action,
                    'score_title' => $version->score->title,
                    'score_id' => $version->score_id,
                    'when' => ScoreSummary::human($version->saved_at),
                ];
            })
            ->values();
    }

    /**
     * @param  Collection<int, ScoreRow>  $scores
     * @return Collection<int, ShareRow>
     */
    private function shares(Collection $scores): Collection
    {
        return $scores
            ->filter(fn (array $score) => $score['shared'])
            ->sortByDesc('updated_at')
            ->take(4)
            ->map(fn (array $score) => [
                'id' => $score['id'],
                'title' => $score['title'],
                'access' => $score['share_can'],
                'label' => $score['share_label'],
                'when' => $score['updated_human'],
            ])
            ->values();
    }
}
