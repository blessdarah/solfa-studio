<?php

namespace App\Http\Controllers;

use App\Models\Score;
use App\Music\ScoreDocument;
use App\Support\PublicSong;
use App\Support\ScoreSummary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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

        $query = Score::query()->listedPublicly()->with('owner')->latest('published_at');

        // Every word must appear somewhere: title, composer or the words of a verse.
        foreach (preg_split('/\s+/', Str::lower($q), -1, PREG_SPLIT_NO_EMPTY) ?: [] as $word) {
            $query->where('search_text', 'like', '%'.addcslashes($word, '%_\\').'%');
        }

        /** @var Collection<int, Score> $found */
        $found = $query->limit(200)->get();

        $cards = $found->map(fn (Score $score) => [
            ...PublicSong::card($score),
            'match' => PublicSong::match($score, $q),
        ]);

        // Counts for the style list come before the style filter, so you can switch.
        $styles = $cards
            ->filter(fn (array $card) => $this->hasVoices($card['voices'], $voices))
            ->groupBy(fn (array $card) => $card['style'] !== null ? Str::ucfirst($card['style']) : 'Other')
            ->map(fn (Collection $group, string $name) => ['name' => $name, 'count' => $group->count()])
            ->sortByDesc('count')
            ->values();

        $results = $cards
            ->filter(fn (array $card) => $this->hasVoices($card['voices'], $voices))
            ->filter(fn (array $card) => $style === '' || Str::lower((string) ($card['style'] ?? 'other')) === Str::lower($style))
            // Title matches first, then composers, then words.
            ->sortBy(fn (array $card) => match ($card['match']['in'] ?? null) {
                'title' => 0,
                'composer', 'arranger' => 1,
                null => 3,
                default => 2,
            })
            ->values();

        return Inertia::render('public/search', [
            'results' => $results->take(40)->values(),
            'total' => $results->count(),
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
     * @param  list<string>  $voices
     */
    private function hasVoices(array $voices, string $wanted): bool
    {
        return $wanted === 'any' || implode('', $voices) === $wanted;
    }

    /**
     * "Browse by style": the styles that have published songs, busiest first.
     *
     * @return list<array{name: string, count: int, sample: array{beats: int, notes: list<array<string, mixed>>}|null}>
     */
    private function styles(): array
    {
        return Score::query()->listedPublicly()
            ->get(['id', 'published'])
            ->groupBy(fn (Score $score) => Str::ucfirst((string) ($score->published['document']['style'] ?? '')) ?: 'Other')
            ->map(function (Collection $group, string $name): array {
                /** @var Score $first */
                $first = $group->first();
                $preview = ScoreSummary::preview(ScoreDocument::fromArray($first->published['document'] ?? []), 1)[0] ?? null;

                return ['name' => $name, 'count' => $group->count(), 'sample' => $preview];
            })
            ->sortByDesc('count')
            ->take(6)
            ->values()
            ->all();
    }
}
