<?php

namespace App\Music;

use JsonSerializable;

/**
 * A marking printed above the music: mp, a crescendo wedge, the $ sign,
 * D.S., Fine, or words like "joyfully".
 *
 * Hairpins have an end point (`to`) so the wedge can stretch across bars.
 * `parts` limits a mark to some voices; null means it applies to everyone.
 */
final readonly class Mark implements JsonSerializable
{
    /**
     * @param  list<Voice>|null  $parts
     */
    public function __construct(
        public MarkKind $kind,
        public string $value,
        public Position $at,
        public ?Position $to = null,
        public ?array $parts = null,
    ) {}

    public static function fromArray(mixed $data, string $path = ''): self
    {
        $data = Field::object($data, $path);
        $kind = Field::enum($data, 'kind', $path, MarkKind::class);
        $value = Field::string($data, 'value', $path);

        $allowed = $kind->allowedValues();
        if ($allowed !== null && ! in_array($value, $allowed, true)) {
            throw InvalidScoreDocument::at(Field::join($path, 'value'), 'expected one of: '.implode(', ', $allowed));
        }

        $at = Position::fromArray($data['at'] ?? null, Field::join($path, 'at'));
        $to = ($data['to'] ?? null) === null ? null : Position::fromArray($data['to'], Field::join($path, 'to'));

        if ($kind->spans() && $to === null) {
            throw InvalidScoreDocument::at(Field::join($path, 'to'), 'a hairpin needs an end point');
        }

        if ($to !== null && ! $to->isAfter($at)) {
            throw InvalidScoreDocument::at(Field::join($path, 'to'), 'must come after the start');
        }

        $parts = null;
        if (($data['parts'] ?? null) !== null) {
            $parts = [];
            foreach (Field::list($data, 'parts', $path) as $i => $voice) {
                $parts[] = Field::enum(['v' => $voice], 'v', Field::join($path, "parts.{$i}"), Voice::class);
            }
        }

        return new self($kind, $value, $at, $to, $parts);
    }

    /**
     * @return array{kind: string, value: string, at: array{bar: int, beat: float}, to: array{bar: int, beat: float}|null, parts: list<string>|null}
     */
    public function toArray(): array
    {
        return [
            'kind' => $this->kind->value,
            'value' => $this->value,
            'at' => $this->at->toArray(),
            'to' => $this->to?->toArray(),
            'parts' => $this->parts === null ? null : array_map(fn (Voice $v) => $v->value, $this->parts),
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
