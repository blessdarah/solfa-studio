<?php

namespace Tests\Feature;

use App\Enums\ScanState;
use App\Enums\ScoreOrigin;
use App\Enums\ScoreStatus;
use App\Enums\ShareAccess;
use App\Models\Score;
use App\Models\User;
use App\Music\Voice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\BuildsMusic;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use BuildsMusic;
    use RefreshDatabase;

    public function test_guests_are_sent_to_the_login_screen(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_the_library_summarises_real_scores(): void
    {
        $user = User::factory()->create();

        $ready = $this->score($user, [
            'title' => 'Yesu Ne Hene',
            'doh' => 'G',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Shared,
        ], done: true);

        $ready->shares()->create(['can' => ShareAccess::View]);

        $review = $this->score($user, [
            'title' => 'Israel Anigyeɛ',
            'doh' => 'F',
            'origin' => ScoreOrigin::Scanned,
            'status' => ScoreStatus::Checking,
        ]);

        $scan = $review->scans()->create([
            'pages' => ['demo/one.jpg'],
            'state' => ScanState::Review,
            'read_score' => 0.94,
        ]);

        foreach ([3, 5] as $bar) {
            $scan->flags()->create([
                'part' => Voice::Alto,
                'bar' => $bar,
                'beat' => 1,
                'crop' => ['x' => 0.2, 'y' => 0.2, 'w' => 0.1, 'h' => 0.1],
                'guesses' => [['pitch' => 's', 'octave' => 0, 'confidence' => 0.7]],
                'resolved' => false,
            ]);
        }

        $this->score($user, [
            'title' => 'Mfitiase',
            'doh' => 'E',
        ]);

        $other = User::factory()->create();
        $this->score($other, ['title' => 'Not Yours']);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->has('scores', 3)
                ->where('total', 3)
                ->where('filtered_total', 3)
                ->where('shown', 3)
                ->where('counts.all', 3)
                ->where('counts.review', 1)
                ->where('counts.composed', 2)
                ->where('counts.scanned', 1)
                ->where('counts.ready', 1)
                ->where('counts.shared', 1)
                ->where('resume.title', 'Israel Anigyeɛ')
                ->where('resume.notes_to_check', 2)
                ->where('resume.read_percent', 94)
                ->has('keys')
                ->has('activity')
            );
    }

    public function test_the_library_can_be_filtered_by_view_search_and_key(): void
    {
        $user = User::factory()->create();

        $this->score($user, [
            'title' => 'Yesu Ne Hene',
            'composer' => 'Ama Serwaa',
            'doh' => 'G',
            'origin' => ScoreOrigin::Composed,
        ], done: true);

        $this->score($user, [
            'title' => 'Israel Anigyeɛ',
            'composer' => 'Adu-Gyamfi Gabriel',
            'doh' => 'F',
            'origin' => ScoreOrigin::Scanned,
            'status' => ScoreStatus::Checking,
        ]);

        $this->score($user, [
            'title' => 'Nkwagye Kuruwa',
            'composer' => 'Kwesi Appiah',
            'doh' => 'D',
            'origin' => ScoreOrigin::Composed,
        ]);

        $this->actingAs($user);

        $this->get('/dashboard?view=review')
            ->assertInertia(fn (Assert $page) => $page
                ->has('scores', 1)
                ->where('scores.0.title', 'Israel Anigyeɛ')
                ->where('filters.view', 'review')
            );

        $this->get('/dashboard?view=composed')
            ->assertInertia(fn (Assert $page) => $page->has('scores', 2));

        $this->get('/dashboard?view=scanned')
            ->assertInertia(fn (Assert $page) => $page->has('scores', 1));

        $this->get('/dashboard?q=ama')
            ->assertInertia(fn (Assert $page) => $page
                ->has('scores', 1)
                ->where('scores.0.title', 'Yesu Ne Hene')
            );

        $this->get('/dashboard?key=F')
            ->assertInertia(fn (Assert $page) => $page
                ->has('scores', 1)
                ->where('scores.0.title', 'Israel Anigyeɛ')
            );
    }

    public function test_the_library_shows_eight_scores_until_asked_for_all(): void
    {
        $user = User::factory()->create();

        foreach (range(1, 10) as $number) {
            $this->score($user, ['title' => "Score {$number}"]);
        }

        $this->actingAs($user);

        $this->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->has('scores', 8)
                ->where('shown', 8)
                ->where('filtered_total', 10)
                ->where('filters.all', false)
            );

        $this->get('/dashboard?all=1')
            ->assertInertia(fn (Assert $page) => $page
                ->has('scores', 10)
                ->where('shown', 10)
                ->where('filters.all', true)
            );
    }

    public function test_recent_activity_comes_from_saved_versions(): void
    {
        $user = User::factory()->create();
        $score = $this->score($user, ['title' => 'Onyame Ye']);

        $score->versions()->where('version', 1)->update([
            'saved_at' => now()->subDay(),
        ]);

        $score->versions()->create([
            'version' => 2,
            'document' => $score->document,
            'saved_by' => $user->id,
            'note' => 'marked alto bar 9 done',
            'saved_at' => now()->subMinutes(2),
        ]);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->where('activity.0.user_name', 'You')
                ->where('activity.0.action', 'marked alto bar 9 done')
                ->where('activity.0.score_title', 'Onyame Ye')
            );
    }

    public function test_an_empty_library_has_no_resume_card(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->has('scores', 0)
                ->where('total', 0)
                ->where('resume', null)
            );
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function score(User $user, array $attributes, bool $done = false): Score
    {
        return Score::factory()->create(array_merge([
            'owner_id' => $user->id,
            'document' => $this->document($done),
        ], $attributes));
    }
}
