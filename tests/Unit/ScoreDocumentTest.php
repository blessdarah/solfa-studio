<?php

namespace Tests\Unit;

use App\Music\Bar;
use App\Music\InvalidScoreDocument;
use App\Music\MapEvent;
use App\Music\Mark;
use App\Music\MarkKind;
use App\Music\Note;
use App\Music\Part;
use App\Music\Pitch;
use App\Music\Position;
use App\Music\Ramp;
use App\Music\ScoreDocument;
use App\Music\Syllable;
use App\Music\Verse;
use App\Music\Voice;
use PHPUnit\Framework\TestCase;

class ScoreDocumentTest extends TestCase
{
    public function test_a_blank_score_has_four_parts_with_one_bar_each(): void
    {
        $doc = ScoreDocument::blank(bars: 16);

        $this->assertCount(4, $doc->parts);
        $this->assertSame(['S', 'A', 'T', 'B'], array_map(fn (Part $p) => $p->id->value, $doc->parts));
        $this->assertCount(16, $doc->part(Voice::Alto)?->bars ?? []);
        $this->assertSame(10, $doc->part(Voice::Alto)?->bar(10)?->no);
        $this->assertSame(4, $doc->beatsInBar(1));
        $this->assertSame(96, $doc->tempoAt(1));
    }

    public function test_it_survives_a_round_trip_through_json(): void
    {
        $doc = $this->withAltoBar10(ScoreDocument::blank(bars: 16))
            ->withMap([new MapEvent(1, 96, 4), new MapEvent(13, 72, 3, Ramp::Rit)])
            ->withMarks([new Mark(MarkKind::Hairpin, 'cresc', new Position(7), new Position(8, 4))]);

        $again = ScoreDocument::fromJson($doc->toJson());

        $this->assertSame($doc->toArray(), $again->toArray());
        $this->assertSame(1.5, $again->part(Voice::Alto)?->bar(10)?->notes[1]->start);
    }

    public function test_the_tempo_map_changes_beats_and_speed_from_a_bar(): void
    {
        $doc = ScoreDocument::blank(bars: 16)->withMap([
            new MapEvent(bar: 1, bpm: 96, beats: 4),
            new MapEvent(bar: 13, bpm: 72, beats: 3),
        ]);

        $this->assertSame(4, $doc->beatsInBar(12));
        $this->assertSame(3, $doc->beatsInBar(13));
        $this->assertSame(96, $doc->tempoAt(12));
        $this->assertSame(72, $doc->tempoAt(16));
    }

    public function test_a_change_with_until_falls_back_afterwards(): void
    {
        $doc = ScoreDocument::blank(bars: 16)->withMap([
            new MapEvent(bar: 1, bpm: 96, beats: 4),
            new MapEvent(bar: 5, bpm: 60, until: 6),
        ]);

        $this->assertSame(60, $doc->tempoAt(6));
        $this->assertSame(96, $doc->tempoAt(7));
        $this->assertSame(4, $doc->beatsInBar(5), 'beats were not part of the change');
    }

    public function test_a_note_cannot_run_past_the_end_of_its_bar(): void
    {
        $data = ScoreDocument::blank(bars: 16)->toArray();
        $data['parts'][1]['bars'][9]['notes'] = [['pitch' => 'm', 'octave' => 0, 'start' => 3, 'length' => 2]];

        $this->expectException(InvalidScoreDocument::class);
        $this->expectExceptionMessage('parts.1.bars.9.notes.0: note runs past the end of bar 10 (4 beats)');

        ScoreDocument::fromArray($data);
    }

    public function test_shrinking_a_bar_rejects_notes_that_no_longer_fit(): void
    {
        // m :–.f ¦ m :r — a full four beats
        $doc = $this->withAltoBar10(ScoreDocument::blank(bars: 16), [
            new Note(Pitch::Me, 0, 0, 1.5),
            new Note(Pitch::Fah, 0, 1.5, 0.5),
            new Note(Pitch::Me, 0, 2, 1),
            new Note(Pitch::Ray, 0, 3, 1),
        ]);

        $this->expectException(InvalidScoreDocument::class);
        $this->expectExceptionMessage('bar 10 (3 beats)');

        $doc->withMap([new MapEvent(1, 96, 4), new MapEvent(10, null, 3)]);
    }

    public function test_notes_cannot_overlap(): void
    {
        $this->expectExceptionMessage('note overlaps the one before it');

        $this->withAltoBar10(ScoreDocument::blank(bars: 16), [
            new Note(Pitch::Me, 0, 0, 2),
            new Note(Pitch::Fah, 0, 1, 1),
        ]);
    }

    public function test_the_map_must_start_at_bar_one_with_tempo_and_beats(): void
    {
        $this->expectExceptionMessage('map.0: the score must start at bar 1');

        ScoreDocument::blank(bars: 16)->withMap([new MapEvent(bar: 1, bpm: 96)]);
    }

    public function test_a_hairpin_needs_an_end_point(): void
    {
        $data = ScoreDocument::blank(bars: 16)->toArray();
        $data['marks'] = [['kind' => 'hairpin', 'value' => 'cresc', 'at' => ['bar' => 7, 'beat' => 0]]];

        $this->expectExceptionMessage('marks.0.to: a hairpin needs an end point');

        ScoreDocument::fromArray($data);
    }

    public function test_dynamics_only_accept_real_dynamics(): void
    {
        $data = ScoreDocument::blank(bars: 16)->toArray();
        $data['marks'] = [['kind' => 'dyn', 'value' => 'loud', 'at' => ['bar' => 5, 'beat' => 0]]];

        $this->expectExceptionMessage('marks.0.value: expected one of: pp, p, mp, mf, f, ff');

        ScoreDocument::fromArray($data);
    }

    public function test_words_must_land_on_a_part_and_beat_that_exist(): void
    {
        $doc = ScoreDocument::blank(bars: 16, voices: [Voice::Soprano, Voice::Alto]);

        $this->expectExceptionMessage('this score has no Tenor part');

        new ScoreDocument(
            bars: 16,
            map: $doc->map,
            parts: $doc->parts,
            verses: [new Verse('v1', 'Verse 1', 'tw', [new Syllable(Voice::Tenor, 9, 0, 'O')])],
        );
    }

    public function test_every_part_must_have_every_bar(): void
    {
        $data = ScoreDocument::blank(bars: 16)->toArray();
        array_pop($data['parts'][2]['bars']);

        $this->expectExceptionMessage('parts.2.bars: expected 16 bars, found 15');

        ScoreDocument::fromArray($data);
    }

    public function test_sol_fa_becomes_a_real_pitch_only_once_a_key_is_chosen(): void
    {
        $eFlat = 3; // semitones above C

        $this->assertSame(67, (new Note(Pitch::Me, 0, 2, 1))->midi($eFlat), 'm in E♭ is G4');
        $this->assertSame(58, (new Note(Pitch::Soh, -1, 0, 1))->midi($eFlat), 's₁ in E♭ is B♭3');
        $this->assertNull((new Note(Pitch::Rest, 0, 0, 1))->midi($eFlat));
    }

    public function test_words_print_under_a_choice_of_voices(): void
    {
        $data = ScoreDocument::blank(bars: 4)->toArray();
        $this->assertSame('SA', $data['words_under']);

        $data['words_under'] = 'each';
        $this->assertSame('each', ScoreDocument::fromArray($data)->wordsUnder);

        unset($data['words_under']);
        $this->assertSame('SA', ScoreDocument::fromArray($data)->wordsUnder);

        $data['words_under'] = 'men';
        $this->expectExceptionMessage('words_under: expected one of: SA, TB, each');
        ScoreDocument::fromArray($data);
    }

    public function test_a_note_held_over_the_bar_line_is_kept_as_a_tie(): void
    {
        $data = ScoreDocument::blank(bars: 2)->toArray();
        $data['parts'][0]['bars'][0]['notes'] = [['pitch' => 'd', 'octave' => 0, 'start' => 3, 'length' => 1]];
        $data['parts'][0]['bars'][1]['notes'] = [['pitch' => 'd', 'octave' => 0, 'start' => 0, 'length' => 1, 'tie' => true]];

        $doc = ScoreDocument::fromArray($data);
        $tied = $doc->part(Voice::Soprano)?->bar(2)?->notes[0];

        $this->assertTrue($tied?->tie);
        $this->assertFalse($doc->part(Voice::Soprano)?->bar(1)?->notes[0]->tie);
        $this->assertSame(true, $tied?->toArray()['tie'] ?? null);
        $this->assertArrayNotHasKey('tie', $doc->part(Voice::Soprano)?->bar(1)?->notes[0]->toArray() ?? []);
    }

    public function test_a_slur_is_kept_with_where_it_is_drawn(): void
    {
        $data = ScoreDocument::blank(bars: 2)->toArray();
        $data['parts'][0]['bars'][0]['notes'] = [
            ['pitch' => 's', 'octave' => 0, 'start' => 0, 'length' => 1, 'slur' => 'over'],
            ['pitch' => 'l', 'octave' => 0, 'start' => 1, 'length' => 1, 'slur' => 'under'],
            ['pitch' => 's', 'octave' => 0, 'start' => 2, 'length' => 1],
        ];

        $notes = ScoreDocument::fromArray($data)->part(Voice::Soprano)?->bar(1)?->notes ?? [];

        $this->assertSame('over', $notes[0]->slur);
        $this->assertSame('under', $notes[1]->toArray()['slur'] ?? null);
        $this->assertArrayNotHasKey('slur', $notes[2]->toArray());
    }

    public function test_a_slur_must_be_over_or_under(): void
    {
        $data = ScoreDocument::blank(bars: 1)->toArray();
        $data['parts'][0]['bars'][0]['notes'] = [['pitch' => 's', 'octave' => 0, 'start' => 0, 'length' => 1, 'slur' => 'sideways']];

        $this->expectException(InvalidScoreDocument::class);

        ScoreDocument::fromArray($data);
    }

    public function test_a_beat_can_hold_a_triplet(): void
    {
        $data = ScoreDocument::blank(bars: 2)->toArray();
        $third = 1 / 3;
        $data['parts'][0]['bars'][0]['notes'] = [
            ['pitch' => 'f', 'octave' => 0, 'start' => 0, 'length' => $third],
            ['pitch' => 'f', 'octave' => 0, 'start' => $third, 'length' => $third],
            ['pitch' => 'f', 'octave' => 0, 'start' => 2 / 3, 'length' => $third],
            ['pitch' => 's', 'octave' => 0, 'start' => 3 + 2 / 3, 'length' => $third],
        ];

        $doc = ScoreDocument::fromArray($data);

        $this->assertCount(4, $doc->part(Voice::Soprano)?->bar(1)?->notes ?? []);
    }

    public function test_a_part_taken_out_of_a_bar_is_kept_as_tacet(): void
    {
        $data = ScoreDocument::blank(bars: 4)->toArray();
        $data['parts'][2]['bars'][1]['tacet'] = true;

        $doc = ScoreDocument::fromArray($data);

        $this->assertTrue($doc->part(Voice::Tenor)?->bar(2)?->tacet);
        $this->assertFalse($doc->part(Voice::Tenor)?->bar(1)?->tacet);
        $this->assertTrue(ScoreDocument::fromArray($doc->toArray())->part(Voice::Tenor)?->bar(2)?->tacet);

        unset($data['parts'][2]['bars'][1]['tacet']);
        $this->assertFalse(ScoreDocument::fromArray($data)->part(Voice::Tenor)?->bar(2)?->tacet);
    }

    public function test_done_bars_drive_part_progress(): void
    {
        $doc = $this->withAltoBar10(ScoreDocument::blank(bars: 16));

        $this->assertSame(1, $doc->part(Voice::Alto)?->doneCount());
        $this->assertSame(0, $doc->part(Voice::Tenor)?->doneCount());
    }

    /**
     * Alto bar 10: m :–.f ¦ m :   (marked done)
     *
     * @param  list<Note>|null  $notes
     */
    private function withAltoBar10(ScoreDocument $doc, ?array $notes = null): ScoreDocument
    {
        $alto = $doc->part(Voice::Alto);
        $this->assertNotNull($alto);

        $notes ??= [
            new Note(Pitch::Me, 0, 0, 1.5),
            new Note(Pitch::Fah, 0, 1.5, 0.5),
            new Note(Pitch::Me, 0, 2, 1),
        ];

        $bars = $alto->bars;
        $bars[9] = new Bar(10, $notes, done: true);

        return $doc->withPart(new Part($alto->id, $alto->name, $bars));
    }
}
