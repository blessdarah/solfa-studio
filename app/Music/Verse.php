<?php

namespace App\Music;

use JsonSerializable;

/**
 * One set of words for the music: verse 1 in Twi, verse 2, an English
 * translation. Each verse lays its syllables over the same notes.
 */
final readonly class Verse implements JsonSerializable
{
    /**
     * @param  list<Syllable>  $syllables
     */
    public function __construct(
        public string $id,
        public string $label,
        public string $lang,
        public array $syllables = [],
    ) {}

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);

        $syllables = [];
        foreach (Field::list($data, 'syllables', $path, optional: true) as $i => $syllable) {
            $syllables[] = Syllable::fromArray($syllable, Field::join($path, "syllables.{$i}"));
        }

        return new self(
            id: Field::string($data, 'id', $path),
            label: Field::string($data, 'label', $path),
            lang: Field::string($data, 'lang', $path),
            syllables: $syllables,
        );
    }

    /**
     * @return array{id: string, label: string, lang: string, syllables: list<array<string, mixed>>}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'lang' => $this->lang,
            'syllables' => array_map(fn (Syllable $s) => $s->toArray(), $this->syllables),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
