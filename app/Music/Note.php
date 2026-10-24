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
 * `octave` is -1 for the low octave (d₁), 0 for the middle, 1 for high (d').
 */
final readonly class Note implements JsonSerializable
{
    public function __construct(
        public Pitch $pitch,
        public int $octave,
        public float $start,
        public float $length,
        public NoteSource $source = NoteSource::Typed,
    ) {
        if ($octave < -1 || $octave > 1) {
            throw InvalidScoreDocument::at('octave', 'must be -1, 0 or 1');
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
            octave: Field::int($data, 'octave', $path, -1, 1),
            start: Field::number($data, 'start', $path, 0),
            length: $length,
            source: Field::enum($data, 'source', $path, NoteSource::class, NoteSource::Typed),
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
     * @return array{pitch: string, octave: int, start: float, length: float, source: string}
     */
    public function toArray(): array
    {
        return [
            'pitch' => $this->pitch->value,
            'octave' => $this->octave,
            'start' => $this->start,
            'length' => $this->length,
            'source' => $this->source->value,
        ];
    }

    /**
     * @return array{pitch: string, octave: int, start: float, length: float, source: string}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
