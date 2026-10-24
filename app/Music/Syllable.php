<?php

namespace App\Music;

use JsonSerializable;

/**
 * One sung syllable, pinned to a part, bar and beat — "daa" on soprano,
 * bar 11, beat 3. Words point at the music; they are never stored inside it.
 */
final readonly class Syllable implements JsonSerializable
{
    public function __construct(
        public Voice $part,
        public int $bar,
        public float $beat,
        public string $text,
        public SyllableJoin $join = SyllableJoin::None,
    ) {}

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);

        return new self(
            part: Field::enum($data, 'part', $path, Voice::class),
            bar: Field::int($data, 'bar', $path, 1),
            beat: Field::number($data, 'beat', $path, 0),
            text: Field::string($data, 'text', $path),
            join: Field::enum($data, 'join', $path, SyllableJoin::class, SyllableJoin::None),
        );
    }

    /**
     * @return array{part: string, bar: int, beat: float, text: string, join: string}
     */
    public function toArray(): array
    {
        return [
            'part' => $this->part->value,
            'bar' => $this->bar,
            'beat' => $this->beat,
            'text' => $this->text,
            'join' => $this->join->value,
        ];
    }

    /**
     * @return array{part: string, bar: int, beat: float, text: string, join: string}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
