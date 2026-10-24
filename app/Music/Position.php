<?php

namespace App\Music;

use JsonSerializable;

/**
 * A point in the score: a bar (1-based) and a beat inside it (0-based).
 */
final readonly class Position implements JsonSerializable
{
    public function __construct(
        public int $bar,
        public float $beat = 0.0,
    ) {}

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);

        return new self(
            bar: Field::int($data, 'bar', $path, 1),
            beat: Field::number($data, 'beat', $path, 0),
        );
    }

    public function isAfter(self $other): bool
    {
        return $this->bar > $other->bar || ($this->bar === $other->bar && $this->beat > $other->beat);
    }

    /**
     * @return array{bar: int, beat: float}
     */
    public function toArray(): array
    {
        return ['bar' => $this->bar, 'beat' => $this->beat];
    }

    /**
     * @return array{bar: int, beat: float}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
