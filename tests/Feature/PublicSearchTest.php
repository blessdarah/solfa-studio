<?php

namespace Tests\Feature;

use App\Http\Controllers\PublicController;
use App\Models\Score;
use App\Models\User;
use App\Music\Bar;
use App\Music\Part;
use App\Music\ScoreDocument;
use App\Music\Voice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\BuildsMusic;
use Tests\TestCase;

/**
 * Public search and "Browse by style" work from the published_style and
 * published_voices columns, in the database, however many songs there are.
 */
class PublicSearchTest extends TestCase
{
    use BuildsMusic;
    use RefreshDatabase;

    /**
     * A published song. `$voices` are the parts that have music.
     *
     * @param  list<Voice>  $voices
     */
    private function published(string $title, ?string $style = 'Highlife', array $voices = [Voice::Soprano, Voice::Alto, Voice::Tenor, Voice::Bass], ?User $owner = null): Score
    {
        $music = $this->document(done: true);
        $parts = array_map(
            fn (Part $part) => in_array($part->id, $voices, true)
                ? $part
                : new Part($part->id, $part->name, array_map(fn (Bar $bar) => new Bar(no: $bar->no, notes: [], done: false), $part->bars)),
            $music->parts,
        );

        $score = Score::factory()->create([
            'owner_id' => ($owner ?? User::factory()->create())->id,
            'title' => $title,
            'document' => new ScoreDocument($music->bars, $music->map, $parts, style: $style),
        ]);
        $score->publish();

        return $score;
    }

    public function test_publishing_stores_style_and_voices_and_unpublishing_clears_them(): void
    {
        $score = $this->published('Onyame Ye', ' Highlife ', [Voice::Soprano, Voice::Alto]);

        $this->assertSame('highlife', $score->fresh()?->published_style);
        $this->assertSame('SA', $score->fresh()?->published_voices);

        $score->unpublish();

        $this->assertNull($score->fresh()?->published_style);
        $this->assertNull($score->fresh()?->published_voices);
    }

    public function test_voices_and_style_filter_in_the_database(): void
    {
        $this->published('Hymn For Four', 'Hymn');
        $this->published('Highlife Duet', 'Highlife', [Voice::Soprano, Voice::Alto]);
        $this->published('Low Voices', null, [Voice::Tenor, Voice::Bass]);

        $this->get('/songs?voices=SA')->assertInertia(fn (Assert $page) => $page
            ->where('total', 1)
            ->where('results.0.title', 'Highlife Duet')
            // Style counts follow the voices filter but not the style filter.
            ->where('styles', [['name' => 'Highlife', 'count' => 1]]));

        $this->get('/songs?style=hymn')->assertInertia(fn (Assert $page) => $page
            ->where('total', 1)
            ->where('results.0.title', 'Hymn For Four')
            ->where('styles.0.count', 1)
            ->has('styles', 3));

        $this->get('/songs?style=Other')->assertInertia(fn (Assert $page) => $page
            ->where('total', 1)
            ->where('results.0.title', 'Low Voices'));
    }

    public function test_results_page_past_the_first_page_and_count_every_match(): void
    {
        $owner = User::factory()->create();
        $first = $this->published('Song 0', owner: $owner);
        $count = PublicController::PER_PAGE * 9; // well past the old 200-row cap

        // Copy the published song directly, so the test stays quick.
        $row = DB::table('scores')->where('id', $first->id)->first();
        $copies = [];
        for ($n = 1; $n < $count; $n++) {
            $copies[] = [...(array) $row, 'id' => (string) str()->uuid(), 'slug' => "song-{$n}", 'title' => "Song {$n}", 'published_at' => now()->subMinutes($n)];
        }
        foreach (array_chunk($copies, 50) as $chunk) {
            DB::table('scores')->insert($chunk);
        }

        $this->get('/songs?voices=SATB&style=highlife')->assertInertia(fn (Assert $page) => $page
            ->where('total', $count)
            ->has('results', PublicController::PER_PAGE)
            ->where('pages.current', 1)
            ->where('pages.last', 9)
            ->where('pages.prev', null)
            ->where('pages.next', fn (string $url) => str_contains($url, 'page=2') && str_contains($url, 'style=highlife')));

        $this->get('/songs?page=9')->assertInertia(fn (Assert $page) => $page
            ->has('results', PublicController::PER_PAGE)
            ->where('pages.next', null));
    }

    public function test_title_matches_come_before_matches_elsewhere(): void
    {
        // Newest first would put "Grace Notes" ahead; the title match wins.
        $this->published('Amazing Grace Hymnal', 'Hymn')->forceFill(['published_at' => now()->subDay()])->save();
        $this->published('Grace Notes', 'Hymn')->forceFill([
            'published_at' => now(),
            'search_text' => "grace notes\namazing tunes",
        ])->save();

        $this->get('/songs?q=amazing')->assertInertia(fn (Assert $page) => $page
            ->where('total', 2)
            ->where('results.0.title', 'Amazing Grace Hymnal')
            ->where('results.0.match.in', 'title'));
    }

    public function test_browse_by_style_is_cached_and_refreshed_on_publish(): void
    {
        $this->published('First Hymn', 'Hymn');

        $this->get('/')->assertInertia(fn (Assert $page) => $page->where('styles', fn ($styles) => collect($styles)->pluck('name')->all() === ['Hymn']));
        $this->assertTrue(Cache::has(Score::PUBLIC_STYLES_CACHE));

        $this->published('A Highlife', 'Highlife');
        $this->assertFalse(Cache::has(Score::PUBLIC_STYLES_CACHE));

        $this->get('/')->assertInertia(fn (Assert $page) => $page
            ->where('styles', fn ($styles) => collect($styles)->pluck('name')->sort()->values()->all() === ['Highlife', 'Hymn'])
            ->whereNot('styles.0.sample', null));
    }

    public function test_the_published_document_is_parsed_once_until_it_changes(): void
    {
        $score = $this->published('Onyame Ye')->fresh();
        $this->assertNotNull($score);

        $first = $score->publishedDocument();
        $this->assertSame($first, $score->publishedDocument());

        $score->forceFill(['document' => $this->document(bars: 8)])->save();
        $score->publish();

        $this->assertNotSame($first, $score->publishedDocument());
        $this->assertSame(8, $score->publishedDocument()?->bars);
    }
}
