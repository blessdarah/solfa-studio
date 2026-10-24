<?php

namespace Database\Seeders;

use App\Enums\ScanState;
use App\Enums\ScoreOrigin;
use App\Enums\ScoreStatus;
use App\Enums\ShareAccess;
use App\Models\Scan;
use App\Models\Score;
use App\Models\User;
use App\Music\Bar;
use App\Music\Note;
use App\Music\Part;
use App\Music\Pitch;
use App\Music\ScoreDocument;
use App\Music\Section;
use App\Music\Voice;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * A working library for the demo composer: a handful of finished pieces,
 * two scores mid-scan, shares, and a little collaborator history.
 */
class DemoLibrarySeeder extends Seeder
{
    public function run(?User $owner = null): void
    {
        $owner ??= User::query()->where('email', 'test@example.com')->firstOrFail();

        $gabriel = $this->person('Gabriel Adjei', 'gabriel@example.com');
        $akosua = $this->person('Akosua Boakye', 'akosua@example.com');
        $ama = $this->person('Ama Serwaa', 'ama@example.com');

        (new OnyameYeSeeder)->run($owner);

        $onyame = $owner->scores()->where('title', 'Onyame Ye')->firstOrFail();

        $this->touch($onyame, now()->subSeconds(4), version: 3);
        $this->firstVersionAt($onyame, now()->subDays(9));
        $this->version($onyame, 2, $gabriel, 'added the tenor line', now()->subHours(2));
        $this->version($onyame, 3, $owner, 'marked alto bar 9 done', now()->subSeconds(4));

        $israel = $this->score($owner, [
            'title' => 'Israel Anigyeɛ',
            'composer' => 'Adu-Gyamfi Gabriel',
            'doh' => 'F',
            'origin' => ScoreOrigin::Scanned,
            'status' => ScoreStatus::Checking,
        ], $this->document(18, 84, 4, 'highlife', [
            'S' => ['all' => true],
            'A' => ['done' => range(1, 12), 'bars' => range(1, 16)],
            'T' => ['bars' => [1, 2, 3]],
        ]), now()->subMinutes(8));

        $scan = $israel->scans()->create([
            'pages' => ['demo/israel-1.jpg', 'demo/israel-2.jpg', 'demo/israel-3.jpg'],
            'state' => ScanState::Review,
            'read_score' => 0.94,
        ]);

        $this->flag($scan, Voice::Alto, [3, 5, 6, 7, 8, 11, 14], [1, 3, 0, 2, 1, 3, 0]);

        $this->firstVersionAt($israel, now()->subDays(5));
        $this->version($israel, 2, $akosua, 'left a note on bar 6', now()->subHours(5));
        $this->touch($israel, now()->subHours(5), version: 2);

        $yesu = $this->score($owner, [
            'title' => 'Yesu Ne Hene',
            'composer' => 'Traditional, arr. Ama Serwaa',
            'doh' => 'G',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Shared,
        ], $this->document(12, 88, 4, 'anthem', [
            'S' => ['all' => true],
            'A' => ['all' => true],
            'T' => ['all' => true],
            'B' => ['all' => true],
        ]), now()->subDay());

        $yesu->shares()->create(['can' => ShareAccess::Practise]);

        $this->firstVersionAt($yesu, now()->subDays(3));
        $this->version($yesu, 2, $owner, 'finished the bass line', now()->subDay());
        $this->touch($yesu, now()->subDay(), version: 2);

        $hallelujah = $this->score($owner, [
            'title' => 'Hallelujah',
            'composer' => 'Br Jerry Ayigyu Daniell',
            'doh' => 'A',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Checking,
        ], $this->document(8, 72, 4, 'anthem', [
            'S' => ['all' => true],
            'A' => ['all' => true],
            'T' => ['all' => true],
        ]), now()->subDay()->subHours(3));

        $this->firstVersionAt($hallelujah, now()->subDays(4));

        $nkwagye = $this->score($owner, [
            'title' => 'Nkwagye Kuruwa',
            'composer' => 'Kwesi Appiah',
            'doh' => 'D',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Shared,
        ], $this->document(20, 100, 4, 'highlife', [
            'S' => ['all' => true],
            'A' => ['all' => true],
            'T' => ['all' => true],
            'B' => ['all' => true],
        ]), now()->subDays(3));

        $nkwagye->shares()->create(['can' => ShareAccess::View]);
        $this->firstVersionAt($nkwagye, now()->subDays(8));

        $christmas = $this->score($owner, [
            'title' => 'Christmas Medley',
            'composer' => 'Traditional',
            'doh' => 'C',
            'origin' => ScoreOrigin::Scanned,
            'status' => ScoreStatus::Draft,
        ], $this->document(12, 96, 6, 'anthem', [
            'S' => ['all' => true],
            'A' => ['all' => true],
        ]), now()->subDays(6));

        $christmas->scans()->create([
            'pages' => ['demo/christmas-1.jpg', 'demo/christmas-2.jpg'],
            'state' => ScanState::Done,
            'read_score' => 0.99,
        ]);

        $this->firstVersionAt($christmas, now()->subDays(11));

        $aseda = $this->score($owner, [
            'title' => 'Aseda Nnwom',
            'composer' => 'Ama Serwaa',
            'doh' => 'Bb',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Shared,
        ], $this->document(14, 84, 4, 'anthem', [
            'S' => ['all' => true],
            'A' => ['all' => true],
            'T' => ['all' => true],
            'B' => ['all' => true],
        ]), now()->subDays(12));

        $aseda->shares()->create(['can' => ShareAccess::Edit]);
        $this->firstVersionAt($aseda, now()->subDays(19));

        $wona = $this->score($owner, [
            'title' => 'Wo Na Woye',
            'composer' => 'Blessdaraah',
            'doh' => 'G',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Shared,
        ], $this->document(16, 76, 4, 'anthem', [
            'S' => ['all' => true],
            'A' => ['all' => true],
            'T' => ['all' => true],
            'B' => ['all' => true],
        ]), now()->subDays(9));

        $wona->shares()->create(['can' => ShareAccess::Practise]);
        $this->firstVersionAt($wona, now()->subDays(16));

        $mfitiase = $this->score($owner, [
            'title' => 'Mfitiase',
            'composer' => 'Gabriel Adu-Gyamfi',
            'doh' => 'E',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Draft,
        ], $this->document(24, 92, 4, 'highlife', [
            'S' => ['bars' => [1, 2, 3, 4]],
        ]), now()->subDays(21));

        $this->firstVersionAt($mfitiase, now()->subDays(28));

        $nyame = $this->score($owner, [
            'title' => 'Nyame Nnwom',
            'composer' => 'Traditional',
            'doh' => 'Bb',
            'origin' => ScoreOrigin::Scanned,
            'status' => ScoreStatus::Checking,
        ], $this->document(16, 88, 4, 'anthem', [
            'S' => ['all' => true],
            'A' => ['done' => range(1, 10), 'bars' => range(1, 12)],
            'T' => ['bars' => [1, 2, 3, 4, 5, 6]],
        ]), now()->subDays(15));

        $nyameScan = $nyame->scans()->create([
            'pages' => ['demo/nyame-1.jpg'],
            'state' => ScanState::Review,
            'read_score' => 0.87,
        ]);

        $this->flag($nyameScan, Voice::Tenor, [4, 9], [2, 1], confidence: 0.63);

        $this->firstVersionAt($nyame, now()->subDays(22));

        $meda = $this->score($owner, [
            'title' => "Meda W'ase",
            'composer' => 'Kwesi Appiah',
            'doh' => 'C',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Draft,
        ], $this->document(12, 96, 4, 'anthem', [
            'S' => ['all' => true],
            'A' => ['all' => true],
            'T' => ['all' => true],
            'B' => ['all' => true],
        ]), now()->subDays(30));

        $this->firstVersionAt($meda, now()->subDays(45));

        $onyameBa = $this->score($owner, [
            'title' => 'Onyame Ba',
            'composer' => 'Blessdaraah',
            'doh' => 'Ab',
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Draft,
        ], $this->document(20, 80, 4, 'anthem', [
            'S' => ['all' => true],
            'A' => ['done' => range(1, 6), 'bars' => range(1, 8)],
            'T' => ['bars' => [1, 2, 3, 4]],
        ]), now()->subDays(45));

        $this->firstVersionAt($onyameBa, now()->subDays(52));
    }

    private function person(string $name, string $email): User
    {
        return User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'email_verified_at' => now(),
                'password' => Hash::make('password'),
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function score(User $owner, array $attributes, ScoreDocument $document, CarbonInterface $updated): Score
    {
        $score = $owner->scores()->create($attributes + ['document' => $document]);

        $this->touch($score, $updated);

        return $score;
    }

    private function touch(Score $score, CarbonInterface $at, int $version = 1): void
    {
        $score->timestamps = false;

        $score->forceFill([
            'created_at' => $at->copy()->subDays(10),
            'updated_at' => $at,
            'version' => $version,
        ])->save();

        $score->timestamps = true;
    }

    private function firstVersionAt(Score $score, CarbonInterface $at): void
    {
        $score->versions()->where('version', 1)->update(['saved_at' => $at]);
    }

    private function version(
        Score $score,
        int $number,
        ?User $by,
        string $note,
        CarbonInterface $at,
    ): void {
        $score->versions()->create([
            'version' => $number,
            'document' => $score->document,
            'saved_by' => $by?->id,
            'note' => $note,
            'saved_at' => $at,
        ]);
    }

    /**
     * @param  list<int>  $bars
     * @param  list<float|int>  $beats
     */
    private function flag(
        Scan $scan,
        Voice $part,
        array $bars,
        array $beats,
        float $confidence = 0.71,
    ): void {
        foreach ($bars as $index => $bar) {
            $scan->flags()->create([
                'part' => $part,
                'bar' => $bar,
                'beat' => $beats[$index] ?? 0,
                'crop' => ['x' => 0.22, 'y' => 0.3, 'w' => 0.08, 'h' => 0.06],
                'guesses' => [
                    ['pitch' => 's', 'octave' => 0, 'confidence' => $confidence],
                    ['pitch' => 'f', 'octave' => 0, 'confidence' => round(1 - $confidence - 0.1, 2)],
                    ['pitch' => 'm', 'octave' => 0, 'confidence' => 0.1],
                ],
                'resolved' => false,
            ]);
        }
    }

    /**
     * @param  array<string, array{all?: bool, bars?: list<int>, done?: list<int>}>  $progress
     */
    private function document(int $bars, int $bpm, int $beats, ?string $style, array $progress): ScoreDocument
    {
        $blank = ScoreDocument::blank(bars: $bars, bpm: $bpm, beats: $beats, style: $style);

        $parts = array_map(function (Part $part) use ($progress, $beats): Part {
            $setting = $progress[$part->id->value] ?? [];
            $all = $setting['all'] ?? false;
            $filled = $all ? range(1, count($part->bars)) : ($setting['bars'] ?? []);
            $done = $all ? range(1, count($part->bars)) : ($setting['done'] ?? []);

            $newBars = array_map(fn (Bar $bar) => new Bar(
                no: $bar->no,
                notes: in_array($bar->no, $filled, true) ? $this->notes($bar->no, $beats) : [],
                done: in_array($bar->no, $done, true),
            ), $part->bars);

            return new Part($part->id, $part->name, $newBars);
        }, $blank->parts);

        $middle = (int) floor($bars / 2);

        return new ScoreDocument(
            bars: $bars,
            map: $blank->map,
            parts: $parts,
            sections: [
                new Section('Verse', 1, $middle),
                new Section('Chorus', $middle + 1, $bars),
            ],
            style: $style,
        );
    }

    /**
     * @return list<Note>
     */
    private function notes(int $bar, int $beats): array
    {
        $patterns = [
            [Pitch::Doh, Pitch::Me, Pitch::Soh, Pitch::Me, Pitch::Ray, Pitch::Fah],
            [Pitch::Ray, Pitch::Fah, Pitch::Lah, Pitch::Fah, Pitch::Me, Pitch::Soh],
            [Pitch::Me, Pitch::Soh, Pitch::Doh, Pitch::Soh, Pitch::Ray, Pitch::Fah],
            [Pitch::Soh, Pitch::Lah, Pitch::Te, Pitch::Doh, Pitch::Lah, Pitch::Soh],
        ];

        $pattern = $patterns[($bar - 1) % count($patterns)];

        $notes = [];

        for ($i = 0; $i < $beats; $i++) {
            $notes[] = new Note($pattern[$i % count($pattern)], 0, (float) $i, 1.0);
        }

        return $notes;
    }
}
