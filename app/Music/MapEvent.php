<?php

namespace App\Music;

use JsonSerializable;

/**
 * A tempo and/or time change starting at a bar: "from bar 13, ♩ = 72, 3 beats".
 *
 * Either field may be left out to keep the value in force before it.
 * `until` ends the change and returns to what came before (null = to the end).
 * The first event of every score is at bar 1 and sets both values.
 */
final readonly class MapEvent implements JsonSerializable
{
    public function __construct(
        public int $bar,
        public ?int $bpm = null,
        public ?int $beats = null,
        public Ramp $ramp = Ramp::AtOnce,
        public ?int $until = null,
    ) {}

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);

        $event = new self(
            bar: Field::int($data, 'bar', $path, 1),
            bpm: Field::optionalInt($data, 'bpm', $path, 20, 320),
            beats: Field::optionalInt($data, 'beats', $path, 1, 12),
            ramp: Field::enum($data, 'ramp', $path, Ramp::class, Ramp::AtOnce),
            until: Field::optionalInt($data, 'until', $path, 1),
        );

        if ($event->bpm === null && $event->beats === null) {
            throw InvalidScoreDocument::at($path, 'a change needs a tempo, a number of beats, or both');
        }

        if ($event->until !== null && $event->until < $event->bar) {
            throw InvalidScoreDocument::at(Field::join($path, 'until'), 'must be on or after the bar the change starts');
        }

        return $event;
    }

    /**
     * @return array{bar: int, bpm: int|null, beats: int|null, ramp: string, until: int|null}
     */
    public function toArray(): array
    {
        return [
            'bar' => $this->bar,
            'bpm' => $this->bpm,
            'beats' => $this->beats,
            'ramp' => $this->ramp->value,
            'until' => $this->until,
        ];
    }

    /**
     * @return array{bar: int, bpm: int|null, beats: int|null, ramp: string, until: int|null}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
