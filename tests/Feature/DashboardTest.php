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
use Illuminate\Support\Facades\Date;
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
        $user = User::factory()->create(['workspace_name' => 'Darah-B Studios']);

        $ready = $this->score($user, ['title' => 'Yesu Ne Hene', 'composer' => 'Traditional', 'arranger' => 'Ama Serwaa', 'doh' => 'G'], done: true);
        $ready->shares()->create(['can' => ShareAccess::View]);

        $review = $this->score($user, [
            'title' => 'Israel Anigyeɛ',
            'doh' => 'F',
            'origin' => ScoreOrigin::Scanned,
            'status' => ScoreStatus::Checking,
        ]);
        $this->flagged($review, 2);

        $this->score($user, ['title' => 'Mfitiase', 'doh' => 'E']);
        $this->score(User::factory()->create(), ['title' => 'Not Yours']);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->where('workspace.name', 'Darah-B Studios')
                ->where('workspace.initials', 'DB')
                ->where('workspace.plan', 'Free plan')
                ->where('heading', 'Your scores')
                ->has('scores', 3)
                ->where('counts.all', 3)
                ->where('counts.review', 1)
                ->where('counts.shared', 1)
                ->where('counts.ready', 1)
                ->where('kinds.all', 3)
                ->where('kinds.composed', 2)
                ->where('kinds.arrangements', 1)
                ->where('nav.review', 1)
                ->where('resume.title', 'Israel Anigyeɛ')
                ->where('resume.notes_to_check', 2)
                ->where('resume.read_percent', 94)
                ->where('scores', fn ($scores) => collect($scores)->firstWhere('title', 'Yesu Ne Hene')['meta']
                    === 'Traditional · arr. Ama Serwaa · Doh is G')
            );
    }

    public function test_the_library_filters_by_kind_search_and_view(): void
    {
        $user = User::factory()->create();

        $this->score($user, ['title' => 'Yesu Ne Hene', 'composer' => 'Traditional', 'arranger' => 'Ama Serwaa']);
        $review = $this->score($user, ['title' => 'Israel Anigyeɛ', 'composer' => 'Adu-Gyamfi Gabriel']);
        $this->flagged($review, 1);
        $this->score($user, ['title' => 'Nkwagye Kuruwa', 'composer' => 'Kwesi Appiah']);

        $this->actingAs($user);

        $this->get('/dashboard?kind=arrangements')
            ->assertInertia(fn (Assert $page) => $page->has('scores', 1)->where('scores.0.title', 'Yesu Ne Hene'));

        $this->get('/dashboard?kind=composed')
            ->assertInertia(fn (Assert $page) => $page->has('scores', 2));

        $this->get('/dashboard?view=review')
            ->assertInertia(fn (Assert $page) => $page
                ->where('heading', 'Needs review')
                ->has('scores', 1)
                ->where('scores.0.title', 'Israel Anigyeɛ'));

        $this->get('/dashboard?q=serwaa')
            ->assertInertia(fn (Assert $page) => $page->has('scores', 1)->where('scores.0.title', 'Yesu Ne Hene'));
    }

    public function test_the_library_shows_eight_scores_until_asked_for_all(): void
    {
        $user = User::factory()->create();

        foreach (range(1, 10) as $number) {
            $this->score($user, ['title' => "Score {$number}"]);
        }

        $this->actingAs($user);

        $this->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page->has('scores', 8)->where('shown', 8)->where('filtered_total', 10));

        $this->get('/dashboard?all=1')
            ->assertInertia(fn (Assert $page) => $page->has('scores', 10)->where('filters.all', true));
    }

    public function test_recent_activity_names_who_did_what(): void
    {
        Date::setTestNow('2026-10-25 14:00:00');

        $user = User::factory()->create();
        $gabriel = User::factory()->create(['name' => 'Gabriel Adjei']);
        $score = $this->score($user, ['title' => 'Onyame Ye']);

        $score->versions()->where('version', 1)->update(['saved_at' => now()->subDay()]);
        $score->versions()->create([
            'version' => 2,
            'document' => $score->document,
            'saved_by' => $gabriel->id,
            'note' => 'Added the tenor line',
            'saved_at' => now()->subHours(2),
        ]);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->where('activity.0.user_name', 'Gabriel Adjei')
                ->where('activity.0.initials', 'GA')
                ->where('activity.0.text', 'added the tenor line in Onyame Ye · 2h')
                ->where('notifications.unread', 1)
            );
    }

    public function test_an_empty_library_has_no_resume_card(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page->has('scores', 0)->where('resume', null)->where('rehearsal', null));
    }

    public function test_collections_can_be_made_and_filled(): void
    {
        $user = User::factory()->create();
        $score = $this->score($user, ['title' => 'Christmas Medley']);
        $this->score($user, ['title' => 'Other']);

        $this->actingAs($user)->post('/collections', ['name' => ' Christmas '])->assertRedirect();

        $collection = $user->collections()->firstOrFail();
        $this->assertSame('Christmas', $collection->name);

        $this->post("/collections/{$collection->id}/scores", ['score_id' => $score->id])->assertRedirect();

        $this->get("/dashboard?view=collection&collection={$collection->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('heading', 'Christmas')
                ->has('scores', 1)
                ->where('collections.0.count', 1));

        $this->delete("/collections/{$collection->id}/scores/{$score->id}")->assertRedirect();
        $this->assertSame(0, $collection->scores()->count());
    }

    public function test_another_composer_cannot_file_into_my_collection(): void
    {
        $owner = User::factory()->create();
        $collection = $owner->collections()->create(['name' => 'Mine']);
        $stranger = User::factory()->create();
        $theirs = $this->score($stranger, ['title' => 'Theirs']);

        $this->actingAs($stranger)
            ->post("/collections/{$collection->id}/scores", ['score_id' => $theirs->id])
            ->assertNotFound();
    }

    public function test_scores_can_be_archived_and_restored(): void
    {
        $user = User::factory()->create();
        $score = $this->score($user, ['title' => 'Meda W\'ase']);

        $this->actingAs($user)->post("/scores/{$score->id}/archive")->assertRedirect();

        $this->get('/dashboard')->assertInertia(fn (Assert $page) => $page->has('scores', 0)->where('nav.archive', 1));
        $this->get('/dashboard?view=archive')->assertInertia(fn (Assert $page) => $page->has('scores', 1));

        $this->delete("/scores/{$score->id}/archive")->assertRedirect();
        $this->assertNull($score->fresh()?->archived_at);
    }

    public function test_the_next_rehearsal_and_its_plan(): void
    {
        $user = User::factory()->create();
        $first = $this->score($user, ['title' => 'Onyame Ye']);
        $second = $this->score($user, ['title' => 'Yesu Ne Hene']);
        $this->score($user, ['title' => 'Not rehearsed']);

        $this->actingAs($user)->post('/rehearsals', [
            'ensemble' => 'Darah-B Choir',
            'singers' => 12,
            'date' => now()->addDays(3)->format('Y-m-d'),
            'time' => '16:00',
            'score_ids' => [$second->id, $first->id],
        ])->assertRedirect();

        $rehearsal = $user->rehearsals()->firstOrFail();

        $this->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->where('rehearsal.in', 'in 3 days')
                ->where('rehearsal.ensemble', 'Darah-B Choir')
                ->where('rehearsal.singers', 12));

        $this->get("/dashboard?view=rehearsal&rehearsal={$rehearsal->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('heading', 'Rehearsal plan')
                ->has('scores', 2)
                ->where('scores.0.title', 'Yesu Ne Hene'));
    }

    public function test_opening_a_share_link_puts_the_score_under_shared_with_me(): void
    {
        $owner = User::factory()->create(['name' => 'Gabriel Adjei']);
        $score = $this->score($owner, ['title' => 'Ayɛyi Dwom']);
        $share = $score->shares()->create(['can' => ShareAccess::Practise]);
        $me = User::factory()->create(['name' => 'Bless Darah']);

        $this->actingAs($me)->get("/s/{$share->token}")->assertRedirect(route('scores.show', $score));

        $this->get('/dashboard?view=shared')
            ->assertInertia(fn (Assert $page) => $page
                ->where('nav.shared', 1)
                ->has('scores', 1)
                ->where('scores.0.title', 'Ayɛyi Dwom'));

        $this->assertSame(1, $owner->unreadNotifications()->count());

        $this->actingAs($owner)->post('/notifications/read')->assertRedirect();
        $this->assertSame(0, $owner->unreadNotifications()->count());
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

    private function flagged(Score $score, int $count): void
    {
        $scan = $score->scans()->create([
            'pages' => ['demo/one.jpg'],
            'state' => ScanState::Review,
            'read_score' => 0.94,
        ]);

        foreach (range(1, $count) as $bar) {
            $scan->flags()->create([
                'part' => Voice::Alto,
                'bar' => $bar,
                'beat' => 1,
                'crop' => ['x' => 0.2, 'y' => 0.2, 'w' => 0.1, 'h' => 0.1],
                'guesses' => [['pitch' => 's', 'octave' => 0, 'confidence' => 0.7]],
                'resolved' => false,
            ]);
        }
    }
}
