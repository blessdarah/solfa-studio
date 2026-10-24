<?php

namespace App\Music;

use JsonSerializable;

/**
 * One bar of one part. `done` marks the bar as finished by the composer,
 * which is what drives "Alto 9/16".
 */
final readonly class Bar implements JsonSerializable
{
    /**
     * @param  list<Note>  $notes  in start order, never overlapping
     */
    public function __construct(
        public int $no,
        public array $notes = [],
        public bool $done = false,
    ) {}

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);

        $notes = [];
        foreach (Field::list($data, 'notes', $path, optional: true) as $i => $note) {
            $notes[] = Note::fromArray($note, Field::join($path, "notes.{$i}"));
        }

        return new self(
            no: Field::int($data, 'no', $path, 1),
            notes: $notes,
            done: Field::bool($data, 'done', $path),
        );
    }

    public function isEmpty(): bool
    {
        return $this->notes === [];
    }

    /**
     * Notes must sit in order, not overlap, and fit inside the bar.
     */
    public function assertFits(int $beats, string $path): void
    {
        $previousEnd = 0.0;

        foreach ($this->notes as $i => $note) {
            $notePath = Field::join($path, "notes.{$i}");

            if ($note->start < $previousEnd) {
                throw InvalidScoreDocument::at($notePath, 'note overlaps the one before it');
            }

            if ($note->end() > $beats) {
                throw InvalidScoreDocument::at($notePath, "note runs past the end of bar {$this->no} ({$beats} beats)");
            }

            $previousEnd = $note->end();
        }
    }

    /**
     * @return array{no: int, notes: list<array<string, mixed>>, done: bool}
     */
    public function toArray(): array
    {
        return [
            'no' => $this->no,
            'notes' => array_map(fn (Note $n) => $n->toArray(), $this->notes),
            'done' => $this->done,
        ];
    }

    /**
     * @return array{no: int, notes: list<array<string, mixed>>, done: bool}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
