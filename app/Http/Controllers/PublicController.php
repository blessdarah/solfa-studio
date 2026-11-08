<?php

namespace App\Http\Controllers;

use App\Models\Score;
use App\Music\ScoreDocument;
use App\Support\PublicSong;
use App\Support\ScoreSummary;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The pages anyone can open, signed in or not (Paper W14–W17): the home
 * page with search, the search results, and a published song's page to
 * read, practise and print.
 *
 * @phpstan-import-type SongCard from PublicSong
 */
class PublicController extends Controller
{
    /**
     * Voice filters on the search page.
     */
    public const VOICES = ['any', 'SATB', 'SA', 'TB'];

    /**
     * Search results per page.
     */
    public const PER_PAGE = 24;

    public function home(Request $request): Response
    {
        $published = Score::query()->listedPublicly()->with('owner')->latest('published_at');

        return Inertia::render('public/home', [
            'songs' => (clone $published)->limit(8)->get()->map(fn (Score $score) => PublicSong::card($score))->values(),
            'styles' => $this->styles(),
            'total' => (clone $published)->count(),
            'signed_in' => $request->user() !== null,
        ]);
    }

    public function search(Request $request): Response
    {
        $q = trim(Str::limit((string) $request->query('q', ''), 80, ''));
        $voices = (string) $request->query('voices', 'any');
        $voices = in_array($voices, self::VOICES, true) ? $voices : 'any';
        $style = trim((string) $request->query('style', ''));

        $query = Score::query()->listedPublicly();

        // Every word must appear somewhere: title, composer or the words of a verse.
        foreach (preg_split('/\s+/', Str::lower($q), -1, PREG_SPLIT_NO_EMPTY) ?: [] as $word) {
            $query->where('search_text', 'like', '%'.addcslashes($word, '%_\\').'%');
        }

        if ($voices !== 'any') {
            $query->where('published_voices', $voices);
        }

        // Counts for the style list come before the style filter, so you can switch.
        $styles = $this->styleCounts(clone $query)
            ->map(fn (array $row) => ['name' => $row['name'], 'count' => $row['count']])
            ->values();

        if ($style !== '') {
            Str::lower($style) === 'other'
                ? $query->whereNull('published_style')
                : $query->where('published_style', Score::styleKey($style));
        }

        // Title matches first, then composers, then words.
        if ($q !== '') {
            $needle = '%'.addcslashes(Str::lower($q), '%_\\').'%';

            // The published title and composer live in the `published` JSON.
            $rank = $query->getModel()->getConnection()->getDriverName() === 'pgsql'
                ? "case when lower(published->>'title') like ? then 0 when lower(published->>'composer') like ? or lower(published->>'arranger') like ? then 1 else 2 end"
                : "case when lower(json_extract(published, '$.title')) like ? then 0 when lower(json_extract(published, '$.composer')) like ? or lower(json_extract(published, '$.arranger')) like ? then 1 else 2 end";

            $query->orderByRaw($rank, [$needle, $needle, $needle]);
        }

        $page = $query->with('owner')
            ->latest('published_at')
            ->orderBy('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        $results = collect($page->items())->map(fn (Score $score) => [
            ...PublicSong::card($score),
            'match' => PublicSong::match($score, $q),
        ]);

        return Inertia::render('public/search', [
            'results' => $results->values(),
            'total' => $page->total(),
            'pages' => [
                'current' => $page->currentPage(),
                'last' => $page->lastPage(),
                'prev' => $page->previousPageUrl(),
                'next' => $page->nextPageUrl(),
            ],
            'styles' => $styles,
            'filters' => ['q' => $q, 'voices' => $voices, 'style' => $style],
            'signed_in' => $request->user() !== null,
        ]);
    }

    public function show(Request $request, string $slug): Response
    {
        $score = $this->published($slug);

        // One visit per person per session, however often they reload.
        $seen = (array) $request->session()->get('visited', []);

        if (! in_array($score->id, $seen, true)) {
            $score->increment('visits');
            $request->session()->put('visited', [...array_slice($seen, -50), $score->id]);
        }

        $document = $score->publishedDocument() ?? $score->document;
        $published = $score->published ?? [];

        if (! $score->show_words) {
            $document = new ScoreDocument(
                $document->bars, $document->map, $document->parts, [], $document->marks,
                $document->sections, $document->footnotes, $document->style, $document->wordsUnder,
            );
        }

        return Inertia::render('public/score', [
            'song' => [
                ...PublicSong::card($score),
                'url' => route('public.score', $score->slug),
                'published_at' => $score->published_at?->toFormattedDateString(),
                'is_owner' => $request->user()?->id === $score->owner_id,
                'score_id' => $request->user()?->id === $score->owner_id ? $score->id : null,
            ],
            'document' => $document,
            'doh' => (string) ($published['doh'] ?? $score->doh),
            'can' => [
                'play' => $score->allow_play,
                'print' => $score->allow_print,
            ],
            'signed_in' => $request->user() !== null,
        ]);
    }

    /**
     * Counted once per person per session, for "31 plays this week".
     */
    public function played(Request $request, string $slug): JsonResponse
    {
        $score = $this->published($slug);
        $played = (array) $request->session()->get('played', []);

        if (! in_array($score->id, $played, true)) {
            $score->increment('plays');
            $request->session()->put('played', [...array_slice($played, -50), $score->id]);
        }

        return response()->json(['ok' => true]);
    }

    private function published(string $slug): Score
    {
        return Score::query()
            ->where('slug', $slug)
            ->whereNotNull('published_at')
            ->with('owner')
            ->firstOrFail();
    }

    /**
     * "Browse by style": the styles that have published songs, busiest
     * first, each with the first bar of its newest song. Cached, and
     * cleared whenever a song is published, unpublished or unlisted.
     *
     * @return list<array{name: string, count: int, sample: array{beats: int, notes: list<array<string, mixed>>}|null}>
     */
    private function styles(): array
    {
        return Cache::remember(Score::PUBLIC_STYLES_CACHE, now()->addMinutes(10), fn () => array_values($this
            ->styleCounts(Score::query()->listedPublicly())
            ->take(6)
            ->map(function (array $row): array {
                $newest = Score::query()->listedPublicly()
                    ->when(
                        $row['key'] === null,
                        fn (Builder $query) => $query->whereNull('published_style'),
                        fn (Builder $query) => $query->where('published_style', $row['key']),
                    )
                    ->latest('published_at')
                    ->first(['id', 'published']);
                $document = $newest?->publishedDocument();

                return [
                    'name' => $row['name'],
                    'count' => $row['count'],
                    'sample' => $document !== null ? (ScoreSummary::preview($document, 1)[0] ?? null) : null,
                ];
            })
            ->all()));
    }

    /**
     * How many songs each style has among `$query`, busiest first.
     *
     * @param  Builder<Score>  $query
     * @return Collection<int, array{key: string|null, name: string, count: int}>
     */
    private function styleCounts(Builder $query): Collection
    {
        return $query->toBase()
            ->select('published_style')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('published_style')
            ->orderByDesc('aggregate')
            ->orderBy('published_style')
            ->get()
            ->map(function (object $row): array {
                $key = is_string($row->published_style) ? $row->published_style : null;

                return [
                    'key' => $key,
                    'name' => $key !== null ? Str::ucfirst($key) : 'Other',
                    'count' => (int) $row->aggregate,
                ];
            });
    }
}
