<?php

namespace Tests\Feature;

use App\Enums\ScanState;
use App\Enums\ScoreStatus;
use App\Models\Score;
use App\Models\User;
use App\Music\Voice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\BuildsMusic;
use Tests\TestCase;

class ScorePageTest extends TestCase
{
    use BuildsMusic;
    use RefreshDatabase;

    public function test_the_owner_can_see_a_score_overview(): void
    {
        $user = User::factory()->create();
        $score = Score::factory()->create([
            'owner_id' => $user->id,
            'title' => 'Onyame Ye',
            'doh' => 'Eb',
            'document' => $this->document(),
            'status' => ScoreStatus::Draft,
        ]);

        $scan = $score->scans()->create([
            'pages' => ['demo/one.jpg'],
            'state' => ScanState::Review,
            'read_score' => 0.94,
        ]);

        $scan->flags()->create([
            'part' => Voice::Alto,
            'bar' => 5,
            'beat' => 2,
            'crop' => ['x' => 0.2, 'y' => 0.2, 'w' => 0.1, 'h' => 0.1],
            'guesses' => [['pitch' => 's', 'octave' => 0, 'confidence' => 0.71]],
            'resolved' => false,
        ]);

        $scan->flags()->create([
            'part' => Voice::Alto,
            'bar' => 6,
            'beat' => 1,
            'crop' => ['x' => 0.2, 'y' => 0.2, 'w' => 0.1, 'h' => 0.1],
            'guesses' => [['pitch' => 'f', 'octave' => 0, 'confidence' => 0.8]],
            'resolved' => true,
        ]);

        $this->actingAs($user)
            ->get("/scores/{$score->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('scores/show')
                ->where('score.title', 'Onyame Ye')
                ->where('score.doh', 'Eb')
                ->where('score.read_percent', 94)
                ->has('parts', 4)
                ->has('flags', 1)
                ->where('flags.0.part_label', 'Alto')
                ->where('flags.0.bar', 5)
                ->where('flags.0.beat', 2)
                ->has('versions', 1)
                ->has('shares', 0)
            );
    }

    public function test_another_composer_cannot_see_the_score(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $score = Score::factory()->create(['owner_id' => $owner->id]);

        $this->actingAs($stranger)
            ->get("/scores/{$score->id}")
            ->assertNotFound();
    }

    public function test_a_composer_can_start_a_blank_score(): void
    {
        $user = User::factory()->create(['name' => 'Blessdaraah']);

        $response = $this->actingAs($user)->post('/scores', [
            'title' => '  New Song  ',
            'composer' => '',
            'doh' => 'Eb',
        ]);

        $score = Score::query()->where('title', 'New Song')->firstOrFail();

        $response->assertRedirect(route('scores.show', $score));

        $this->assertSame($user->id, $score->owner_id);
        $this->assertSame('Blessdaraah', $score->composer);
        $this->assertSame('Eb', $score->doh);
        $this->assertSame(16, $score->document->bars);
        $this->assertSame(1, $score->version);
        $this->assertDatabaseHas('score_versions', [
            'score_id' => $score->id,
            'version' => 1,
            'note' => 'Created',
        ]);
    }

    public function test_a_new_score_needs_a_title_and_a_real_key(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post('/scores', [
                'title' => '',
                'doh' => 'H',
            ])
            ->assertSessionHasErrors(['title', 'doh']);

        $this->assertDatabaseCount('scores', 0);
    }

    public function test_guests_cannot_start_a_score(): void
    {
        $this->post('/scores', [
            'title' => 'New Song',
            'doh' => 'C',
        ])->assertRedirect('/login');
    }
}
