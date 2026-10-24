<?php

namespace Database\Seeders;

use App\Enums\ScoreOrigin;
use App\Models\Score;
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
 * highlife, slowing to ♩ = 72 in 3/4 from bar 13. Bars 9–10 of the soprano
 * and alto are filled in, with the dynamics, $ sign and Fine.
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

        // Soprano 9: d :r ¦ m :f   ·   10: s :–.l ¦ s :m
        $document = $this->fill($document, Voice::Soprano, [
            9 => [[Pitch::Doh, 0, 0, 1], [Pitch::Ray, 0, 1, 1], [Pitch::Me, 0, 2, 1], [Pitch::Fah, 0, 3, 1]],
            10 => [[Pitch::Soh, 0, 0, 1.5], [Pitch::Lah, 0, 1.5, 0.5], [Pitch::Soh, 0, 2, 1], [Pitch::Me, 0, 3, 1]],
        ]);

        // Alto 9: s₁:t₁ ¦ d :r   ·   10: m :–.f ¦ m :   (beat 4 still to write)
        $document = $this->fill($document, Voice::Alto, [
            9 => [[Pitch::Soh, -1, 0, 1], [Pitch::Te, -1, 1, 1], [Pitch::Doh, 0, 2, 1], [Pitch::Ray, 0, 3, 1]],
            10 => [[Pitch::Me, 0, 0, 1.5], [Pitch::Fah, 0, 1.5, 0.5], [Pitch::Me, 0, 2, 1]],
        ], done: [9]);

        $document = new ScoreDocument(
            bars: $document->bars,
            map: $document->map,
            parts: $document->parts,
            verses: [
                new Verse('v1', 'Verse 1', 'tw', [
                    new Syllable(Voice::Soprano, 9, 0, 'O', SyllableJoin::Split),
                    new Syllable(Voice::Soprano, 9, 1, 'nya', SyllableJoin::Split),
                    new Syllable(Voice::Soprano, 9, 2, 'me'),
                    new Syllable(Voice::Soprano, 9, 3, 'ye'),
                    new Syllable(Voice::Soprano, 10, 0, 'ɔ', SyllableJoin::Split),
                    new Syllable(Voice::Soprano, 10, 1.5, 'dɔ'),
                    new Syllable(Voice::Soprano, 10, 2, 'me'),
                    new Syllable(Voice::Soprano, 10, 3, 'o'),
                ]),
            ],
            marks: [
                new Mark(MarkKind::Dynamic, 'mp', new Position(5)),
                new Mark(MarkKind::Text, 'gently', new Position(5)),
                new Mark(MarkKind::Hairpin, 'cresc', new Position(7), new Position(8, 4)),
                new Mark(MarkKind::Dynamic, 'f', new Position(9)),
                new Mark(MarkKind::Nav, '$', new Position(9)),
                new Mark(MarkKind::Text, 'joyfully', new Position(9)),
                new Mark(MarkKind::Hairpin, 'dim', new Position(11), new Position(11, 4)),
                new Mark(MarkKind::Dynamic, 'mp', new Position(12)),
                new Mark(MarkKind::Nav, 'Fine', new Position(12, 3)),
                new Mark(MarkKind::Text, 'Slower', new Position(13)),
            ],
            sections: [
                new Section('Verse', 1, 8),
                new Section('Chorus', 9, 14),
                new Section('1st time', 15, 15, ending: 1),
                new Section('2nd time', 16, 16, ending: 2),
            ],
            footnotes: ['NB: Sing the chorus in highlife style; the verses as an anthem.'],
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

            return isset($bars[$bar->no]) ? new Bar($bar->no, $notes, in_array($bar->no, $done, true)) : $bar;
        }, $part->bars);

        return $document->withPart(new Part($part->id, $part->name, $newBars));
    }
}
