<?php

namespace Tests\Feature;

use App\Models\Score;
use App\Models\User;
use App\Music\ScoreDocument;
use App\Music\Syllable;
use App\Music\SyllableJoin;
use App\Music\Verse;
use App\Music\Voice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\BuildsMusic;
use Tests\TestCase;

class PublishingTest extends TestCase
{
    use BuildsMusic;
    use RefreshDatabase;

    /**
     * Four bars of SATB with "O-nya-me ye" under the soprano.
     */
    private function song(User $owner, string $title = 'Onyame Ye'): Score
    {
        $music = $this->document(done: true);
        $words = new Verse('v1', 'Verse 1', 'tw', [
            new Syllable(Voice::Soprano, 1, 0, 'O', SyllableJoin::Split),
            new Syllable(Voice::Soprano, 2, 0, 'nya', SyllableJoin::Split),
            new Syllable(Voice::Soprano, 3, 0, 'me'),
            new Syllable(Voice::Soprano, 4, 0, 'ye'),
        ]);

        return Score::factory()->create([
            'owner_id' => $owner->id,
            'title' => $title,
            'composer' => 'Blessdarah',
            'doh' => 'Eb',
            'document' => new ScoreDocument($music->bars, $music->map, $music->parts, [$words], style: 'Highlife'),
        ]);
    }

    public function test_publishing_gives_a_public_page_anyone_can_open(): void
    {
        $owner = User::factory()->create();
        $score = $this->song($owner);

        $this->actingAs($owner)
            ->postJson("/scores/{$score->id}/publish")
            ->assertOk()
            ->assertJson(['published' => true, 'slug' => 'onyame-ye', 'has_changes' => false]);

        auth()->logout();

        $this->get('/p/onyame-ye')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/score')
                ->where('song.title', 'Onyame Ye')
                ->where('song.voices', ['S', 'A', 'T', 'B'])
                ->where('doh', 'Eb')
                ->where('can.play', true)
                ->where('document.bars', 4));

        $this->assertSame(1, $score->fresh()?->visits);
    }

    public function test_later_edits_stay_private_until_published_again(): void
    {
        $owner = User::factory()->create();
        $score = $this->song($owner);
        $score->publish();

        $score->forceFill(['title' => 'Onyame Ye (new)'])->save();
        $this->assertTrue($score->fresh()?->hasUnpublishedChanges());

        $this->get('/p/onyame-ye')->assertInertia(fn (Assert $page) => $page->where('song.title', 'Onyame Ye'));

        $this->actingAs($owner)->postJson("/scores/{$score->id}/publish")->assertJson(['has_changes' => false]);

        $this->get('/p/onyame-ye')->assertInertia(fn (Assert $page) => $page->where('song.title', 'Onyame Ye (new)'));
    }

    public function test_unpublishing_takes_the_page_down(): void
    {
        $owner = User::factory()->create();
        $score = $this->song($owner);
        $score->publish();

        $this->actingAs($owner)->deleteJson("/scores/{$score->id}/publish")->assertJson(['published' => false]);

        $this->get('/p/onyame-ye')->assertNotFound();
    }

    public function test_only_the_owner_can_publish(): void
    {
        $score = $this->song(User::factory()->create());

        $this->actingAs(User::factory()->create())
            ->postJson("/scores/{$score->id}/publish")
            ->assertNotFound();
    }

    public function test_search_finds_songs_by_title_composer_and_words(): void
    {
        $owner = User::factory()->create();
        $this->song($owner)->publish();
        $this->song($owner, 'Yesu Ne Hene')->publish();
        $this->song($owner, 'Still a draft');

        $this->get('/songs?q=yesu')->assertInertia(fn (Assert $page) => $page
            ->component('public/search')
            ->where('total', 1)
            ->where('results.0.title', 'Yesu Ne Hene')
            ->where('results.0.match.in', 'title'));

        // The words of a verse are searchable: "Onyame" is sung in both songs.
        $this->get('/songs?q=onyame')->assertInertia(fn (Assert $page) => $page
            ->where('total', 2)
            ->where('results.0.title', 'Onyame Ye'));

        $this->get('/songs?q=draft')->assertInertia(fn (Assert $page) => $page->where('total', 0));
    }

    public function test_unlisted_songs_open_by_link_but_stay_out_of_search(): void
    {
        $owner = User::factory()->create();
        $score = $this->song($owner);
        $score->publish();

        $this->actingAs($owner)->patchJson("/scores/{$score->id}/publish", ['listed' => false])->assertJson(['listed' => false]);

        $this->get('/songs?q=onyame')->assertInertia(fn (Assert $page) => $page->where('total', 0));
        $this->get('/p/onyame-ye')->assertOk();
    }

    public function test_the_home_page_lists_new_songs(): void
    {
        $this->song(User::factory()->create())->publish();

        $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('public/home')
            ->where('total', 1)
            ->where('songs.0.slug', 'onyame-ye')
            ->where('styles.0.name', 'Highlife'));
    }

    public function test_deleting_keeps_the_score_30_days_and_takes_the_page_down(): void
    {
        $owner = User::factory()->create();
        $score = $this->song($owner);
        $score->publish();

        $this->actingAs($owner)->delete("/scores/{$score->id}")->assertRedirect();

        $this->assertSoftDeleted($score);
        $this->get('/p/onyame-ye')->assertNotFound();

        $this->get('/dashboard?view=deleted')->assertInertia(fn (Assert $page) => $page
            ->where('nav.deleted', 1)
            ->where('scores.0.title', 'Onyame Ye')
            ->where('scores.0.deleted_days_left', 30));

        $this->post("/scores/{$score->id}/restore")->assertRedirect();
        $this->assertNotSoftDeleted($score);
        $this->get('/p/onyame-ye')->assertOk();
    }

    public function test_old_deleted_scores_are_pruned(): void
    {
        $owner = User::factory()->create();
        $old = $this->song($owner, 'Old');
        $recent = $this->song($owner, 'Recent');
        $old->delete();
        $recent->delete();
        Score::withTrashed()->whereKey($old->id)->update(['deleted_at' => now()->subDays(31)]);

        $this->artisan('model:prune', ['--model' => [Score::class]])->assertSuccessful();

        $this->assertNull(Score::withTrashed()->find($old->id));
        $this->assertNotNull(Score::withTrashed()->find($recent->id));
    }

    public function test_details_can_be_edited(): void
    {
        $owner = User::factory()->create();
        $score = $this->song($owner);

        $this->actingAs($owner)
            ->patch("/scores/{$score->id}/details", [
                'title' => 'Onyame Ye Ɔdɔ',
                'composer' => 'Traditional',
                'arranger' => 'Ama Serwaa',
                'doh' => 'G',
                'style' => 'Hymn',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $fresh = $score->fresh();
        $this->assertSame('Onyame Ye Ɔdɔ', $fresh?->title);
        $this->assertSame('Ama Serwaa', $fresh?->arranger);
        $this->assertSame('G', $fresh?->doh);
        $this->assertSame('Hymn', $fresh?->document->style);
    }

    public function test_a_copy_starts_as_an_unpublished_draft(): void
    {
        $owner = User::factory()->create();
        $score = $this->song($owner);
        $score->publish();

        $this->actingAs($owner)->post("/scores/{$score->id}/duplicate")->assertRedirect();

        $copy = Score::query()->where('title', 'Onyame Ye (copy)')->firstOrFail();
        $this->assertFalse($copy->isPublished());
        $this->assertSame($owner->id, $copy->owner_id);
    }
}
