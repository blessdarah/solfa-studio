<?php

namespace Tests\Feature;

use App\Enums\ShareAccess;
use App\Models\Score;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\BuildsMusic;
use Tests\TestCase;

class ScorePageTest extends TestCase
{
    use BuildsMusic;
    use RefreshDatabase;

    public function test_the_owner_opens_the_compose_screen(): void
    {
        $user = User::factory()->create();
        $score = Score::factory()->create([
            'owner_id' => $user->id,
            'title' => 'Onyame Ye',
            'doh' => 'Eb',
            'document' => $this->document(),
        ]);

        $this->actingAs($user)
            ->get("/scores/{$score->id}?part=A")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('scores/show')
                ->where('score.title', 'Onyame Ye')
                ->where('score.doh', 'Eb')
                ->where('score.version', 1)
                ->where('can_edit', true)
                ->where('is_owner', true)
                ->where('start_part', 'A')
                ->where('document.bars', 4)
                ->where('document.words_under', 'SA')
                ->has('document.parts', 4)
            );
    }

    public function test_another_composer_cannot_see_the_score(): void
    {
        $score = Score::factory()->create();

        $this->actingAs(User::factory()->create())
            ->get("/scores/{$score->id}")
            ->assertNotFound();
    }

    public function test_someone_with_a_practise_link_can_look_but_not_edit(): void
    {
        $score = Score::factory()->create(['document' => $this->document()]);
        $share = $score->shares()->create(['can' => ShareAccess::Practise]);
        $singer = User::factory()->create();

        $this->actingAs($singer)->get("/s/{$share->token}");

        $this->get("/scores/{$score->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('can_edit', false)->where('is_owner', false));

        $this->putJson("/scores/{$score->id}/document", [
            'version' => 1,
            'document' => $score->document->toArray(),
        ])->assertNotFound();
    }

    public function test_an_edit_link_lets_a_collaborator_save(): void
    {
        $score = Score::factory()->create(['document' => $this->document()]);
        $share = $score->shares()->create(['can' => ShareAccess::Edit]);
        $collaborator = User::factory()->create();

        $this->actingAs($collaborator)->get("/s/{$share->token}");

        $this->putJson("/scores/{$score->id}/document", [
            'version' => 1,
            'document' => $score->document->toArray(),
        ])->assertOk()->assertJson(['version' => 2]);

        // The owner hears that the link was opened.
        $this->assertSame(1, $score->owner->unreadNotifications()->count());
    }

    public function test_a_composer_starts_a_piece_with_their_choices(): void
    {
        $user = User::factory()->create(['name' => 'Blessdaraah']);

        $response = $this->actingAs($user)->post('/scores', [
            'title' => '  Onyame Ye  ',
            'composer' => '',
            'arranger' => '',
            'doh' => 'Eb',
            'beats' => 3,
            'bars' => 8,
            'parts' => ['A', 'S'],
        ]);

        $score = Score::query()->where('title', 'Onyame Ye')->firstOrFail();

        $response->assertRedirect(route('scores.show', [$score, 'part' => 'S']));

        $this->assertSame('Blessdaraah', $score->composer);
        $this->assertNull($score->arranger);
        $this->assertSame(8, $score->document->bars);
        $this->assertSame(3, $score->document->beatsInBar(1));
        $this->assertSame(['S', 'A'], array_map(fn ($p) => $p->id->value, $score->document->parts));
    }

    public function test_a_new_score_needs_a_title_and_a_real_key(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/scores', ['title' => '', 'doh' => 'H', 'beats' => 5])
            ->assertSessionHasErrors(['title', 'doh', 'beats']);

        $this->assertDatabaseCount('scores', 0);
    }

    public function test_autosave_bumps_the_version(): void
    {
        $user = User::factory()->create();
        $score = Score::factory()->create(['owner_id' => $user->id, 'document' => $this->document()]);

        $document = $score->document->toArray();
        $document['words_under'] = 'TB';

        $this->actingAs($user)
            ->putJson("/scores/{$score->id}/document", ['version' => 1, 'document' => $document])
            ->assertOk()
            ->assertJson(['version' => 2]);

        $this->assertSame('TB', $score->fresh()?->document->wordsUnder);
    }

    public function test_a_save_from_an_out_of_date_tab_gets_409(): void
    {
        $user = User::factory()->create();
        $score = Score::factory()->create(['owner_id' => $user->id, 'document' => $this->document()]);
        $score->saveDocument($score->document, 1);

        $this->actingAs($user)
            ->putJson("/scores/{$score->id}/document", ['version' => 1, 'document' => $score->document->toArray()])
            ->assertStatus(409)
            ->assertJson(['current_version' => 2]);
    }

    public function test_invalid_music_is_refused_with_the_reason(): void
    {
        $user = User::factory()->create();
        $score = Score::factory()->create(['owner_id' => $user->id, 'document' => $this->document()]);

        $document = $score->document->toArray();
        $document['parts'][0]['bars'][0]['notes'][] = ['pitch' => 'm', 'octave' => 0, 'start' => 3, 'length' => 2];

        $this->actingAs($user)
            ->putJson("/scores/{$score->id}/document", ['version' => 1, 'document' => $document])
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'parts.0.bars.0.notes.1: note runs past the end of bar 1 (4 beats)']);
    }

    public function test_suggestions_explain_when_no_api_key_is_set(): void
    {
        config(['services.anthropic.key' => null]);

        $user = User::factory()->create();
        $score = Score::factory()->create(['owner_id' => $user->id, 'document' => $this->document()]);

        $this->actingAs($user)
            ->postJson("/scores/{$score->id}/suggest", ['part' => 'A', 'from' => 1, 'to' => 2])
            ->assertStatus(503);
    }

    public function test_share_makes_a_link_once_per_access_level(): void
    {
        $user = User::factory()->create();
        $score = Score::factory()->create(['owner_id' => $user->id]);

        $first = $this->actingAs($user)->postJson("/scores/{$score->id}/shares", ['can' => 'practise'])->assertOk()->json('url');
        $again = $this->postJson("/scores/{$score->id}/shares", ['can' => 'practise'])->json('url');

        $this->assertSame($first, $again);
        $this->assertStringContainsString('/s/', (string) $first);
        $this->assertSame(1, $score->shares()->count());
    }

    public function test_guests_cannot_start_a_score(): void
    {
        $this->post('/scores', ['title' => 'New Song', 'doh' => 'C'])->assertRedirect('/login');
    }
}
