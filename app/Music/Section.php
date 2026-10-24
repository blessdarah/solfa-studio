<?php

namespace App\Music;

use JsonSerializable;

/**
 * A named stretch of bars: "Verse" 1–8, "Chorus" 9–14, a 1st or 2nd ending.
 */
final readonly class Section implements JsonSerializable
{
    public function __construct(
        public string $name,
        public int $from,
        public int $to,
        public ?int $ending = null,
        public int $repeat = 1,
    ) {}

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);

        $section = new self(
            name: Field::string($data, 'name', $path),
            from: Field::int($data, 'from', $path, 1),
            to: Field::int($data, 'to', $path, 1),
            ending: Field::optionalInt($data, 'ending', $path, 1, 4),
            repeat: Field::optionalInt($data, 'repeat', $path, 1, 8) ?? 1,
        );

        if ($section->to < $section->from) {
            throw InvalidScoreDocument::at(Field::join($path, 'to'), 'must be on or after the first bar');
        }

        return $section;
    }

    /**
     * @return array{name: string, from: int, to: int, ending: int|null, repeat: int}
     */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'from' => $this->from,
            'to' => $this->to,
            'ending' => $this->ending,
            'repeat' => $this->repeat,
        ];
    }

    /**
     * @return array{name: string, from: int, to: int, ending: int|null, repeat: int}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
