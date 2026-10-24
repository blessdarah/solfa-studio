<?php

namespace App\Music;

use JsonSerializable;

/**
 * One voice of the choir. It always holds one Bar per bar of the score,
 * so bars[9] is bar 10 for every part and the parts line up beat by beat.
 */
final readonly class Part implements JsonSerializable
{
    /**
     * @param  list<Bar>  $bars
     */
    public function __construct(
        public Voice $id,
        public string $name,
        public array $bars,
    ) {}

    public static function empty(Voice $voice, int $bars): self
    {
        return new self(
            id: $voice,
            name: $voice->label(),
            bars: array_map(fn (int $no) => new Bar($no), range(1, $bars)),
        );
    }

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);
        $voice = Field::enum($data, 'id', $path, Voice::class);

        $bars = [];
        foreach (Field::list($data, 'bars', $path) as $i => $bar) {
            $bars[] = Bar::fromArray($bar, Field::join($path, "bars.{$i}"));
        }

        return new self(
            id: $voice,
            name: Field::optionalString($data, 'name', $path) ?? $voice->label(),
            bars: $bars,
        );
    }

    public function bar(int $no): ?Bar
    {
        return $this->bars[$no - 1] ?? null;
    }

    public function doneCount(): int
    {
        return count(array_filter($this->bars, fn (Bar $b) => $b->done));
    }

    /**
     * @return array{id: string, name: string, bars: list<array<string, mixed>>}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id->value,
            'name' => $this->name,
            'bars' => array_map(fn (Bar $b) => $b->toArray(), $this->bars),
        ];
    }

    /**
     * @return array{id: string, name: string, bars: list<array<string, mixed>>}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
