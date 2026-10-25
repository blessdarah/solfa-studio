<?php

namespace App\Http\Controllers;

use App\Models\Collection as ScoreCollection;
use App\Models\Rehearsal;
use App\Models\Score;
use App\Models\ScoreVersion;
use App\Models\User;
use App\Support\ScoreSummary;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The library (Paper W0): a workspace rail with views and collections,
 * the score table, and a rail with the score to resume, totals, recent
 * activity and the next rehearsal.
 *
 * @phpstan-import-type ScoreRow from ScoreSummary
 */
class DashboardController extends Controller
{
    public const VIEWS = ['all', 'review', 'shared', 'archive', 'collection', 'rehearsal'];

    public const KINDS = ['all', 'composed', 'arrangements'];

    public const SORTS = ['edited', 'title', 'key'];

    /**
     * How many rows the library shows before "Open full library".
     */
    public const PAGE = 8;

    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $view = $this->pick($request, 'view', self::VIEWS);
        $kind = $this->pick($request, 'kind', self::KINDS);
        $sort = $this->pick($request, 'sort', self::SORTS);
        $search = trim((string) $request->query('q', ''));
        $showAll = $request->boolean('all');

        $collection = null;
        $rehearsal = null;

        if ($view === 'collection') {
            $collection = $user->collections()->find($request->integer('collection'));
            $view = $collection === null ? 'all' : $view;
        }

        if ($view === 'rehearsal') {
            $rehearsal = $user->rehearsals()->find($request->integer('rehearsal'));
            $view = $rehearsal === null ? 'all' : $view;
        }

        $owned = $this->summaries(Score::query()->where('owner_id', $user->id));
        $active = $owned->where('archived', false)->values();

        $inView = match ($view) {
            'review' => $active->where('needs_review', true)->values(),
            'shared' => $this->summaries($user->sharedWithMe()->whereNull('archived_at')),
            'archive' => $owned->where('archived', true)->values(),
            'collection' => $this->only($active, $collection?->scores()->pluck('scores.id')),
            'rehearsal' => $this->only($active, $rehearsal?->scores()->pluck('scores.id'), keepOrder: true),
            default => $active,
        };

        $searched = $this->search($inView, $search);

        $kinds = [
            'all' => $searched->count(),
            'composed' => $searched->where('kind', 'composition')->count(),
            'arrangements' => $searched->where('kind', 'arrangement')->count(),
        ];

        $filtered = match ($kind) {
            'composed' => $searched->where('kind', 'composition'),
            'arrangements' => $searched->where('kind', 'arrangement'),
            default => $searched,
        };

        $filtered = $view === 'rehearsal' && $sort === 'edited'
            ? $filtered->values()
            : $this->sort($filtered, $sort);

        $shown = $showAll ? $filtered : $filtered->take(self::PAGE);

        return Inertia::render('dashboard', [
            'workspace' => [
                'name' => $user->workspaceLabel(),
                'initials' => ScoreSummary::initials($user->workspaceLabel()),
                'role' => $user->workspace_role,
                'plan' => Str::ucfirst($user->plan).' plan',
            ],
            'nav' => [
                'all' => $active->count(),
                'review' => $active->where('needs_review', true)->count(),
                'shared' => $user->sharedWithMe()->whereNull('archived_at')->count(),
                'archive' => $owned->where('archived', true)->count(),
            ],
            'collections' => $user->collections()
                ->withCount(['scores' => fn (Builder $query) => $query->whereNull('archived_at')])
                ->get()
                ->map(fn (ScoreCollection $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'color' => $c->color,
                    'count' => (int) $c->getAttribute('scores_count'),
                ])
                ->values(),
            'heading' => match ($view) {
                'review' => 'Needs review',
                'shared' => 'Shared with me',
                'archive' => 'Archive',
                'collection' => $collection->name ?? 'Collection',
                'rehearsal' => 'Rehearsal plan',
                default => 'Your scores',
            },
            'scores' => $shown->values(),
            'shown' => $shown->count(),
            'filtered_total' => $filtered->count(),
            'kinds' => $kinds,
            'counts' => [
                'all' => $active->count(),
                'review' => $active->where('needs_review', true)->count(),
                'shared' => $active->where('shared', true)->count(),
                'ready' => $active->where('ready', true)->count(),
            ],
            'resume' => $this->resume($active),
            'choices' => $active
                ->sortBy(fn (array $score) => Str::lower($score['title']))
                ->map(fn (array $score) => ['id' => $score['id'], 'title' => $score['title']])
                ->values(),
            'activity' => $this->activity($user),
            'rehearsal' => $this->nextRehearsal($user),
            'notifications' => $this->notifications($user),
            'filters' => [
                'view' => $view,
                'collection' => $collection?->id,
                'rehearsal' => $rehearsal?->id,
                'kind' => $kind,
                'sort' => $sort,
                'q' => $search,
                'all' => $showAll,
            ],
        ]);
    }

    /**
     * @param  list<string>  $allowed
     */
    private function pick(Request $request, string $key, array $allowed): string
    {
        $value = (string) $request->query($key, $allowed[0]);

        return in_array($value, $allowed, true) ? $value : $allowed[0];
    }

    /**
     * @param  Builder<Score>  $query
     * @return Collection<int, ScoreRow>
     */
    private function summaries(Builder $query): Collection
    {
        return $query
            ->with(['latestScan.flags', 'shares', 'owner'])
            ->get()
            ->map(fn (Score $score) => ScoreSummary::from($score))
            ->values();
    }

    /**
     * @param  Collection<int, ScoreRow>  $scores
     * @param  Collection<int, mixed>|null  $ids
     * @return Collection<int, ScoreRow>
     */
    private function only(Collection $scores, ?Collection $ids, bool $keepOrder = false): Collection
    {
        if ($ids === null) {
            return collect();
        }

        $wanted = $ids->map(fn ($id) => (string) $id)->values();
        $kept = $scores->filter(fn (array $score) => $wanted->contains($score['id']));

        return $keepOrder
            ? $kept->sortBy(fn (array $score) => $wanted->search($score['id']))->values()
            : $kept->values();
    }

    /**
     * @param  Collection<int, ScoreRow>  $scores
     * @return Collection<int, ScoreRow>
     */
    private function search(Collection $scores, string $search): Collection
    {
        if ($search === '') {
            return $scores;
        }

        $needle = Str::lower($search);

        return $scores->filter(fn (array $score) => Str::contains(
            Str::lower(implode(' ', [$score['title'], $score['composer'] ?? '', $score['arranger'] ?? ''])),
            $needle,
        ))->values();
    }

    /**
     * @param  Collection<int, ScoreRow>  $scores
     * @return Collection<int, ScoreRow>
     */
    private function sort(Collection $scores, string $sort): Collection
    {
        $sorted = match ($sort) {
            'title' => $scores->sortBy(fn (array $score) => Str::lower($score['title'])),
            'key' => $scores->sortBy(fn (array $score) => array_search($score['doh'], Score::DOH_KEYS, true)),
            default => $scores->sortByDesc('updated_at'),
        };

        return $sorted->values();
    }

    /**
     * The score with notes waiting to be checked, else the latest edit.
     *
     * @param  Collection<int, ScoreRow>  $scores
     * @return ScoreRow|null
     */
    private function resume(Collection $scores): ?array
    {
        return $scores
            ->filter(fn (array $score) => $score['notes_to_check'] > 0)
            ->sortByDesc('updated_at')
            ->first()
            ?? $scores->sortByDesc('updated_at')->first();
    }

    /**
     * "Gabriel Adjei · added the tenor line in Onyame Ye · 2h"
     *
     * @return list<array{id: int, user_name: string, initials: string, text: string, score_id: string}>
     */
    private function activity(User $user): array
    {
        return ScoreVersion::query()
            ->where(fn (Builder $query) => $query
                ->whereHas('score', fn (Builder $score) => $score->where('owner_id', $user->id))
                ->orWhere('saved_by', $user->id))
            ->with(['score:id,title', 'savedBy:id,name'])
            ->orderByDesc('saved_at')
            ->limit(3)
            ->get()
            ->map(function (ScoreVersion $version) use ($user): array {
                $isYou = $version->saved_by === $user->id;
                $name = $version->savedBy->name ?? 'Someone';
                $note = $version->note;

                $action = match (true) {
                    $note === null => "edited {$version->score->title}",
                    Str::lower($note) === 'created' => "started {$version->score->title}",
                    default => Str::lcfirst($note)." in {$version->score->title}",
                };

                return [
                    'id' => $version->id,
                    'user_name' => $isYou ? 'You' : $name,
                    'initials' => ScoreSummary::initials($name),
                    'text' => $action.' · '.ScoreSummary::short($version->saved_at),
                    'score_id' => $version->score_id,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array{id: int, in: string, when: string, ensemble: string, singers: int|null, scores: int}|null
     */
    private function nextRehearsal(User $user): ?array
    {
        /** @var Rehearsal|null $next */
        $next = $user->rehearsals()
            ->where('starts_at', '>=', now()->startOfDay())
            ->withCount('scores')
            ->orderBy('starts_at')
            ->first();

        if ($next === null) {
            return null;
        }

        $days = (int) now()->startOfDay()->diffInDays($next->starts_at->copy()->startOfDay());

        return [
            'id' => $next->id,
            'in' => match (true) {
                $days <= 0 => 'today',
                $days === 1 => 'tomorrow',
                default => "in {$days} days",
            },
            'when' => $next->starts_at->format('D j M · g:i A'),
            'ensemble' => $next->ensemble,
            'singers' => $next->singers,
            'scores' => (int) $next->getAttribute('scores_count'),
        ];
    }

    /**
     * @return array{unread: int, items: list<array{id: string, initials: string, actor: string, text: string, score_id: string|null, read: bool}>}
     */
    private function notifications(User $user): array
    {
        $items = $user->notifications()
            ->limit(6)
            ->get()
            ->map(function (DatabaseNotification $notification): array {
                /** @var array<string, mixed> $data */
                $data = $notification->data;

                return [
                    'id' => (string) $notification->id,
                    'initials' => (string) ($data['initials'] ?? ''),
                    'actor' => (string) ($data['actor'] ?? 'Someone'),
                    'text' => trim(((string) ($data['action'] ?? '')).' · '.((string) ($data['score_title'] ?? '')).' · '.ScoreSummary::short($notification->created_at), ' ·'),
                    'score_id' => isset($data['score_id']) ? (string) $data['score_id'] : null,
                    'read' => $notification->read_at !== null,
                ];
            })
            ->values()
            ->all();

        return [
            'unread' => $user->unreadNotifications()->count(),
            'items' => $items,
        ];
    }
}
