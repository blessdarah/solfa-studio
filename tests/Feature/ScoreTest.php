<?php

namespace Tests\Feature;

use App\Enums\ScanState;
use App\Enums\ShareAccess;
use App\Exceptions\StaleScoreVersion;
use App\Models\Score;
use App\Models\User;
use App\Music\InvalidScoreDocument;
use App\Music\MapEvent;
use App\Music\ScoreDocument;
use App\Music\Voice;
use Database\Seeders\OnyameYeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use Tests\TestCase;

class ScoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_new_score_keeps_version_one(): void
    {
        $score = Score::factory()->create();

        $this->assertSame(1, $score->version);
        $this->assertSame([1], $score->versions()->pluck('version')->all());
        $this->assertInstanceOf(ScoreDocument::class, $score->fresh()?->document);
    }

    public function test_saving_music_bumps_the_version_and_persists_it(): void
    {
        $score = Score::factory()->create();
        $slower = $score->document->withMap([new MapEvent(1, 96, 4), new MapEvent(13, 72, 3)]);

        $score->saveDocument($slower, expectedVersion: 1, by: $score->owner, note: 'Slower ending');

        $fresh = Score::findOrFail($score->id);
        $this->assertSame(2, $fresh->version);
        $this->assertSame(3, $fresh->document->beatsInBar(13));
        $this->assertSame('Slower ending', $fresh->latestVersion?->note);
    }

    public function test_a_save_from_an_out_of_date_tab_is_refused(): void
    {
        $score = Score::factory()->create();
        $score->saveDocument($score->document, expectedVersion: 1);

        try {
            $score->saveDocument($score->document, expectedVersion: 1);
            $this->fail('Expected StaleScoreVersion');
        } catch (StaleScoreVersion $e) {
            $this->assertSame(2, $e->currentVersion);
            $this->assertSame(409, $e->render()->getStatusCode());
        }
    }

    public function test_autosaves_only_snapshot_every_few_minutes(): void
    {
        $score = Score::factory()->create();

        $score->saveDocument($score->document, 1);               // right after create: no snapshot
        $score->saveDocument($score->document, 2, note: 'Alto done'); // named: snapshot

        Date::setTestNow(now()->addMinutes(Score::SNAPSHOT_EVERY_MINUTES + 1));
        $score->saveDocument($score->document, 3);               // long enough: snapshot

        $this->assertSame([1, 3, 4], $score->versions()->orderBy('version')->pluck('version')->all());

        Date::setTestNow();
    }

    public function test_an_older_version_can_be_restored(): void
    {
        $score = Score::factory()->create();
        $original = $score->versions()->firstOrFail();

        $score->saveDocument($score->document->withMap([new MapEvent(1, 120, 3)]), 1, note: 'Try 3/4');
        $score->restore($original);

        $this->assertSame(3, $score->version);
        $this->assertSame(4, $score->fresh()?->document->beatsInBar(1));
    }

    public function test_invalid_music_never_reaches_the_database(): void
    {
        $data = ScoreDocument::blank(16)->toArray();
        $data['parts'][0]['bars'][0]['notes'] = [['pitch' => 'x', 'octave' => 0, 'start' => 0, 'length' => 1]];

        $this->expectException(InvalidScoreDocument::class);

        Score::factory()->create(['document' => $data]);
    }

    public function test_a_share_link_can_pin_a_version(): void
    {
        $score = Score::factory()->create();
        $score->saveDocument($score->document->withMap([new MapEvent(1, 72, 3)]), 1, note: 'Waltz');

        $latest = $score->shares()->create(['can' => ShareAccess::Practise]);
        $pinned = $score->shares()->create(['version' => 1]);

        $this->assertSame(40, strlen($latest->token));
        $this->assertSame(3, $latest->document()->beatsInBar(1));
        $this->assertSame(4, $pinned->document()->beatsInBar(1));
        $this->assertTrue($latest->can->allows(ShareAccess::View));
        $this->assertFalse($pinned->can->allows(ShareAccess::Edit));
    }

    public function test_unresolved_scan_flags_are_the_notes_to_check(): void
    {
        $score = Score::factory()->scanned()->create();
        $scan = $score->scans()->create(['pages' => ['scans/p1.jpg'], 'state' => ScanState::Review, 'read_score' => 0.94]);

        foreach ([[5, 3], [6, 0], [7, 1]] as [$bar, $beat]) {
            $scan->flags()->create([
                'part' => Voice::Alto,
                'bar' => $bar,
                'beat' => $beat,
                'crop' => ['x' => 0.1, 'y' => 0.2, 'w' => 0.05, 'h' => 0.03],
                'guesses' => [['pitch' => 's', 'octave' => -1, 'confidence' => 0.71]],
            ]);
        }

        $scan->flags()->firstOrFail()->update(['resolved' => true]);

        $this->assertSame(2, $score->scanFlags()->where('resolved', false)->count());
        $this->assertSame([6, 7], $scan->flagsToCheck()->pluck('bar')->all());
    }

    public function test_the_demo_score_seeds(): void
    {
        $user = User::factory()->create(['phone' => '+237670000000', 'email' => null]);

        (new OnyameYeSeeder)->run($user);

        $score = $user->scores()->firstOrFail();
        $this->assertSame('Onyame Ye', $score->title);
        $this->assertSame('Eb', $score->doh);
        $this->assertSame(3, $score->document->beatsInBar(13));
        $this->assertSame(1, $score->document->part(Voice::Alto)?->doneCount());
        $this->assertCount(10, $score->document->marks);
    }
}
