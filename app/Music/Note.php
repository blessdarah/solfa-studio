<?php

namespace App\Music;

use JsonSerializable;

/**
 * One sol-fa note in one bar of one part.
 *
 * `start` and `length` count beats from the start of the bar (0-based), never
 * seconds — tempo lives only in the tempo map, so changing speed never
 * rewrites a note. `m` at start 2, length 1 is "m on beat 3 for one beat".
 *
 * `octave` is -2 two below (d₂), -1 low (d₁), 0 middle, 1 high (d'), 2 two above (d'').
 */
final readonly class Note implements JsonSerializable
{
    public function __construct(
        public Pitch $pitch,
        public int $octave,
        public float $start,
        public float $length,
        public NoteSource $source = NoteSource::Typed,
        /** Carries on the note before it over a bar line — written "–", sung on, not struck again. */
        public bool $tie = false,
    ) {
        if ($octave < -2 || $octave > 2) {
            throw InvalidScoreDocument::at('octave', 'must be between -2 and 2');
        }

        if ($start < 0) {
            throw InvalidScoreDocument::at('start', 'must be 0 or more');
        }

        if ($length <= 0) {
            throw InvalidScoreDocument::at('length', 'must be more than 0');
        }
    }

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);

        $length = Field::number($data, 'length', $path);
        if ($length <= 0) {
            throw InvalidScoreDocument::at(Field::join($path, 'length'), 'must be more than 0');
        }

        return new self(
            pitch: Field::enum($data, 'pitch', $path, Pitch::class),
            octave: Field::int($data, 'octave', $path, -2, 2),
            start: Field::number($data, 'start', $path, 0),
            length: $length,
            source: Field::enum($data, 'source', $path, NoteSource::class, NoteSource::Typed),
            tie: Field::bool($data, 'tie', $path),
        );
    }

    public function end(): float
    {
        return $this->start + $this->length;
    }

    public function isRest(): bool
    {
        return $this->pitch === Pitch::Rest;
    }

    /**
     * MIDI note number once a key is chosen — "m" in E♭ sounds G.
     * Middle-octave doh sits in octave 4 (E♭4 = 63); null for a rest.
     */
    public function midi(int $dohSemitone): ?int
    {
        $semitones = $this->pitch->semitones();

        return $semitones === null ? null : 60 + $dohSemitone + $semitones + 12 * $this->octave;
    }

    /**
     * @return array{pitch: string, octave: int, start: float, length: float, source: string, tie?: true}
     */
    public function toArray(): array
    {
        $note = [
            'pitch' => $this->pitch->value,
            'octave' => $this->octave,
            'start' => $this->start,
            'length' => $this->length,
            'source' => $this->source->value,
        ];

        // Only a tied note says so, keeping ordinary notes as they were.
        return $this->tie ? $note + ['tie' => true] : $note;
    }

    /**
     * @return array{pitch: string, octave: int, start: float, length: float, source: string, tie?: true}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
