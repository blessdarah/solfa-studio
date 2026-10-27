<?php

namespace App\Music;

use JsonSerializable;

/**
 * One bar of one part. `done` marks the bar as finished by the composer,
 * which is what drives "Alto 9/16". `tacet` means the part was taken out of
 * this bar on purpose: it rests, and its line is left off the sheet there.
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
        public bool $tacet = false,
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
            tacet: Field::bool($data, 'tacet', $path),
        );
    }

    public function isEmpty(): bool
    {
        return $this->notes === [];
    }

    /** Beats can be split in thirds (triplets, f,f,f), which floats can't hold exactly. */
    private const EPS = 1e-6;

    /**
     * Notes must sit in order, not overlap, and fit inside the bar.
     */
    public function assertFits(int $beats, string $path): void
    {
        $previousEnd = 0.0;

        foreach ($this->notes as $i => $note) {
            $notePath = Field::join($path, "notes.{$i}");

            if ($note->start < $previousEnd - self::EPS) {
                throw InvalidScoreDocument::at($notePath, 'note overlaps the one before it');
            }

            if ($note->end() > $beats + self::EPS) {
                throw InvalidScoreDocument::at($notePath, "note runs past the end of bar {$this->no} ({$beats} beats)");
            }

            $previousEnd = $note->end();
        }
    }

    /**
     * @return array{no: int, notes: list<array<string, mixed>>, done: bool, tacet: bool}
     */
    public function toArray(): array
    {
        return [
            'no' => $this->no,
            'notes' => array_map(fn (Note $n) => $n->toArray(), $this->notes),
            'done' => $this->done,
            'tacet' => $this->tacet,
        ];
    }

    /**
     * @return array{no: int, notes: list<array<string, mixed>>, done: bool, tacet: bool}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
