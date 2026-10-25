<?php

namespace Database\Seeders;

use App\Enums\ScoreOrigin;
use App\Models\User;
use App\Music\Bar;
use App\Music\MapEvent;
use App\Music\Mark;
use App\Music\MarkKind;
use App\Music\Note;
use App\Music\Part;
use App\Music\Pitch;
use App\Music\Position;
use App\Music\Ramp;
use App\Music\ScoreDocument;
use App\Music\Section;
use App\Music\Syllable;
use App\Music\SyllableJoin;
use App\Music\Verse;
use App\Music\Voice;
use Illuminate\Database\Seeder;
use LogicException;

/**
 * The demo piece from the designs: "Onyame Ye", Doh is E♭, 16 bars of
 * highlife, slowing to ♩ = 72 in 3/4 from bar 13.
 *
 * The chorus bars 5–12 carry the soprano and alto lines, words and marks
 * shown in W1. Soprano is finished (16/16), alto is mid-write (9/16, bar 10
 * on the cursor), tenor is empty and bass has its first four bars.
 */
class OnyameYeSeeder extends Seeder
{
    public function run(?User $owner = null): void
    {
        $owner ??= User::query()->firstOrFail();

        $blank = ScoreDocument::blank(bars: 16, bpm: 96, beats: 4, style: 'highlife');

        $document = new ScoreDocument(
            bars: 16,
            map: [
                new MapEvent(bar: 1, bpm: 96, beats: 4),
                new MapEvent(bar: 13, bpm: 72, beats: 3, ramp: Ramp::AtOnce),
            ],
            parts: $blank->parts,
            style: 'highlife',
        );

        $lines = [
            'S' => [
                1 => [[Pitch::Doh, 0, 0, 1], [Pitch::Doh, 0, 1, 1], [Pitch::Ray, 0, 2, 1], [Pitch::Me, 0, 3, 1]],
                2 => [[Pitch::Fah, 0, 0, 1], [Pitch::Me, 0, 1, 1], [Pitch::Ray, 0, 2, 2]],
                3 => [[Pitch::Me, 0, 0, 1], [Pitch::Soh, 0, 1, 1], [Pitch::Lah, 0, 2, 1], [Pitch::Soh, 0, 3, 1]],
                4 => [[Pitch::Fah, 0, 0, 1], [Pitch::Me, 0, 1, 1], [Pitch::Ray, 0, 2, 2]],
                5 => [[Pitch::Doh, 0, 0, 1], [Pitch::Doh, 0, 1, 1], [Pitch::Ray, 0, 2, 1], [Pitch::Me, 0, 3, 1]],
                6 => [[Pitch::Fah, 0, 0, 1], [Pitch::Me, 0, 1, 1], [Pitch::Ray, 0, 2, 2]],
                7 => [[Pitch::Me, 0, 0, 1], [Pitch::Soh, 0, 1, 1], [Pitch::Lah, 0, 2, 1], [Pitch::Soh, 0, 3, 1]],
                8 => [[Pitch::Fah, 0, 0, 1], [Pitch::Me, 0, 1, 1], [Pitch::Ray, 0, 2, 2]],
                9 => [[Pitch::Doh, 0, 0, 1], [Pitch::Ray, 0, 1, 1], [Pitch::Me, 0, 2, 1], [Pitch::Fah, 0, 3, 1]],
                10 => [[Pitch::Soh, 0, 0, 1.5], [Pitch::Lah, 0, 1.5, 0.5], [Pitch::Soh, 0, 2, 1], [Pitch::Me, 0, 3, 1]],
                11 => [[Pitch::Ray, 0, 0, 1], [Pitch::Me, 0, 1, 0.5], [Pitch::Ray, 0, 1.5, 0.5], [Pitch::Doh, 0, 2, 2]],
                12 => [[Pitch::Me, 0, 0, 1], [Pitch::Fah, 0, 1, 1], [Pitch::Soh, 0, 2, 2]],
                13 => [[Pitch::Doh, 0, 0, 1.5], [Pitch::Ray, 0, 1.5, 1.5]],
                14 => [[Pitch::Me, 0, 0, 1.5], [Pitch::Fah, 0, 1.5, 1.5]],
                15 => [[Pitch::Soh, 0, 0, 3]],
                16 => [[Pitch::Doh, 0, 0, 3]],
            ],
            'A' => [
                1 => [[Pitch::Soh, -1, 0, 1], [Pitch::Soh, -1, 1, 1], [Pitch::Te, -1, 2, 1], [Pitch::Doh, 0, 3, 1]],
                2 => [[Pitch::Doh, 0, 0, 1], [Pitch::Doh, 0, 1, 1], [Pitch::Te, -1, 2, 2]],
                3 => [[Pitch::Doh, 0, 0, 1], [Pitch::Me, 0, 1, 1], [Pitch::Fah, 0, 2, 1], [Pitch::Me, 0, 3, 1]],
                4 => [[Pitch::Ray, 0, 0, 1], [Pitch::Doh, 0, 1, 1], [Pitch::Te, -1, 2, 2]],
                5 => [[Pitch::Soh, -1, 0, 1], [Pitch::Soh, -1, 1, 1], [Pitch::Te, -1, 2, 1], [Pitch::Doh, 0, 3, 1]],
                6 => [[Pitch::Doh, 0, 0, 1], [Pitch::Doh, 0, 1, 1], [Pitch::Te, -1, 2, 2]],
                7 => [[Pitch::Doh, 0, 0, 1], [Pitch::Me, 0, 1, 1], [Pitch::Fah, 0, 2, 1], [Pitch::Me, 0, 3, 1]],
                8 => [[Pitch::Ray, 0, 0, 1], [Pitch::Doh, 0, 1, 1], [Pitch::Te, -1, 2, 2]],
                9 => [[Pitch::Soh, -1, 0, 1], [Pitch::Te, -1, 1, 1], [Pitch::Doh, 0, 2, 1], [Pitch::Ray, 0, 3, 1]],
                10 => [[Pitch::Me, 0, 0, 1.5], [Pitch::Fah, 0, 1.5, 0.5], [Pitch::Me, 0, 2, 1]],
            ],
            'B' => [
                1 => [[Pitch::Doh, -1, 0, 4]],
                2 => [[Pitch::Te, -1, 0, 4]],
                3 => [[Pitch::Doh, -1, 0, 4]],
                4 => [[Pitch::Soh, -1, 0, 4]],
            ],
        ];

        $doneS = range(1, 16);
        $doneA = range(1, 9);
        $doneB = range(1, 4);

        $document = $this->fill($document, Voice::Soprano, $lines['S'], $doneS);
        $document = $this->fill($document, Voice::Alto, $lines['A'], $doneA);
        $document = $this->fill($document, Voice::Bass, $lines['B'], $doneB);

        // The words of W1, one syllable per soprano note.
        $words = [
            5 => [['Me', SyllableJoin::Split], ['da', SyllableJoin::None], ['wo', SyllableJoin::None], ['a', SyllableJoin::Split]],
            6 => [['Nyan', SyllableJoin::Split], ['ko', SyllableJoin::Split], ['pɔn', SyllableJoin::None]],
            7 => [['wo', SyllableJoin::None], ['dɔ', SyllableJoin::None], ['no', SyllableJoin::None], ['so', SyllableJoin::None]],
            8 => [['ma', SyllableJoin::None], ['me', SyllableJoin::None], ['nkwa', SyllableJoin::None]],
            9 => [['O', SyllableJoin::Split], ['nya', SyllableJoin::Split], ['me', SyllableJoin::None], ['ye', SyllableJoin::None]],
            10 => [['ɔ', SyllableJoin::Split], ['dɔ', SyllableJoin::None], ['me', SyllableJoin::None], ['o', SyllableJoin::None]],
            11 => [['ɔ', SyllableJoin::Split], ['dɔ', SyllableJoin::None], ['me', SyllableJoin::None], ['daa', SyllableJoin::Hold]],
            12 => [['Ye', SyllableJoin::Split], ['su', SyllableJoin::None], ['ne', SyllableJoin::None]],
        ];

        $syllables = [];
        foreach ($words as $bar => $line) {
            $starts = array_map(fn (array $note) => (float) $note[2], $lines['S'][$bar]);

            foreach ($line as $i => [$text, $join]) {
                if (isset($starts[$i])) {
                    $syllables[] = new Syllable(Voice::Soprano, $bar, $starts[$i], $text, $join);
                }
            }
        }

        // Verse 2 changes the opening words of the chorus.
        $verseTwo = [
            new Syllable(Voice::Soprano, 9, 0.0, 'A', SyllableJoin::Split),
            new Syllable(Voice::Soprano, 9, 1.0, 'yɛ', SyllableJoin::Split),
            new Syllable(Voice::Soprano, 9, 2.0, 'yi', SyllableJoin::None),
            new Syllable(Voice::Soprano, 9, 3.0, 'nwom', SyllableJoin::None),
            new Syllable(Voice::Soprano, 10, 0.0, 'ma', SyllableJoin::None),
            new Syllable(Voice::Soprano, 10, 2.0, 'no', SyllableJoin::None),
            new Syllable(Voice::Soprano, 10, 3.0, 'daa', SyllableJoin::None),
        ];

        $document = new ScoreDocument(
            bars: $document->bars,
            map: $document->map,
            parts: $document->parts,
            verses: [
                new Verse('v1', 'Verse 1', 'tw', $syllables),
                new Verse('v2', 'Verse 2', 'tw', $verseTwo),
            ],
            marks: [
                new Mark(MarkKind::Dynamic, 'mp', new Position(5)),
                new Mark(MarkKind::Text, 'gently', new Position(5)),
                new Mark(MarkKind::Hairpin, 'cresc', new Position(7), new Position(8, 4)),
                new Mark(MarkKind::Dynamic, 'f', new Position(8, 3)),
                new Mark(MarkKind::Dynamic, 'f', new Position(9)),
                new Mark(MarkKind::Nav, '$', new Position(9)),
                new Mark(MarkKind::Text, 'joyfully', new Position(9)),
                new Mark(MarkKind::Hairpin, 'dim', new Position(11), new Position(11, 4)),
                new Mark(MarkKind::Dynamic, 'mp', new Position(12)),
                new Mark(MarkKind::Nav, 'Fine', new Position(12, 3)),
                new Mark(MarkKind::Nav, 'DS', new Position(16, 2)),
            ],
            sections: [
                new Section('Verse', 1, 8),
                new Section('Chorus', 9, 14),
                new Section('1st time', 15, 15, ending: 1),
                new Section('2nd time', 16, 16, ending: 2),
            ],
            footnotes: [
                'Verse 2: sing “Ayɛyi nwom” in bar 9 in place of “Onyame ye”.',
                'NB: Written for highlife band. You may perform it as an anthem with your own orchestration.',
            ],
            style: 'highlife',
        );

        $owner->scores()->create([
            'title' => 'Onyame Ye',
            'composer' => $owner->name,
            'doh' => 'Eb',
            'origin' => ScoreOrigin::Composed,
            'document' => $document,
        ]);
    }

    /**
     * @param  array<int, list<array{Pitch, int, float|int, float|int}>>  $bars  bar no → [pitch, octave, start, length]
     * @param  list<int>  $done
     */
    private function fill(ScoreDocument $document, Voice $voice, array $bars, array $done = []): ScoreDocument
    {
        $part = $document->part($voice) ?? throw new LogicException("No {$voice->label()} part");

        $newBars = array_map(function (Bar $bar) use ($bars, $done) {
            $notes = array_map(
                fn (array $n) => new Note($n[0], $n[1], (float) $n[2], (float) $n[3]),
                $bars[$bar->no] ?? [],
            );

            return isset($bars[$bar->no])
                ? new Bar($bar->no, $notes, in_array($bar->no, $done, true))
                : $bar;
        }, $part->bars);

        return $document->withPart(new Part($part->id, $part->name, $newBars));
    }
}
