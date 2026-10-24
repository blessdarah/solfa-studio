<?php

namespace App\Music;

use JsonException;
use JsonSerializable;

/**
 * The music of one score, stored whole in scores.document (jsonb).
 *
 * Three rules hold everything together:
 *  1. Notes count beats, never seconds. Tempo lives only in `map`.
 *  2. Words and marks point at part · bar · beat; they never live inside notes.
 *  3. Doh is stored once, on the score row. "m" becomes G only at playback
 *     and print, so changing key moves every part.
 *
 * Every part holds exactly `bars` bars, so the four voices always line up.
 * The document is checked as a whole on the way in, so an invalid one can
 * never be saved.
 */
final readonly class ScoreDocument implements JsonSerializable
{
    public const SCHEMA = 1;

    public const MAX_BARS = 500;

    /**
     * @param  list<MapEvent>  $map
     * @param  list<Part>  $parts
     * @param  list<Verse>  $verses
     * @param  list<Mark>  $marks
     * @param  list<Section>  $sections
     * @param  list<string>  $footnotes
     */
    public function __construct(
        public int $bars,
        public array $map,
        public array $parts,
        public array $verses = [],
        public array $marks = [],
        public array $sections = [],
        public array $footnotes = [],
        public ?string $style = null,
    ) {
        $this->validate();
    }

    /**
     * A new, empty SATB score — what "New score" creates.
     *
     * @param  list<Voice>|null  $voices
     */
    public static function blank(int $bars = 16, int $bpm = 96, int $beats = 4, ?array $voices = null, ?string $style = null): self
    {
        $voices ??= Voice::cases();

        return new self(
            bars: $bars,
            map: [new MapEvent(bar: 1, bpm: $bpm, beats: $beats)],
            parts: array_map(fn (Voice $v) => Part::empty($v, $bars), $voices),
            style: $style,
        );
    }

    public static function fromArray(mixed $data): self
    {
        $data = Field::object($data, '');

        $schema = Field::int($data, 'schema', '');
        if ($schema !== self::SCHEMA) {
            throw InvalidScoreDocument::at('schema', 'unsupported version '.$schema);
        }

        return new self(
            bars: Field::int($data, 'bars', '', 1, self::MAX_BARS),
            map: self::each($data, 'map', MapEvent::fromArray(...)),
            parts: self::each($data, 'parts', Part::fromArray(...)),
            verses: self::each($data, 'verses', Verse::fromArray(...), optional: true),
            marks: self::each($data, 'marks', Mark::fromArray(...), optional: true),
            sections: self::each($data, 'sections', Section::fromArray(...), optional: true),
            footnotes: self::each(
                $data,
                'footnotes',
                fn (mixed $text, string $path) => Field::string(['text' => $text], 'text', $path),
                optional: true,
            ),
            style: Field::optionalString($data, 'style', ''),
        );
    }

    /**
     * @throws InvalidScoreDocument
     */
    public static function fromJson(string $json): self
    {
        try {
            $data = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw InvalidScoreDocument::at('', 'not valid JSON: '.$e->getMessage());
        }

        return self::fromArray($data);
    }

    public function toJson(): string
    {
        return json_encode($this->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    }

    public function part(Voice $voice): ?Part
    {
        foreach ($this->parts as $part) {
            if ($part->id === $voice) {
                return $part;
            }
        }

        return null;
    }

    /**
     * A copy of the document with one part replaced — how the editor saves
     * a change to the alto without touching the others.
     */
    public function withPart(Part $part): self
    {
        $parts = array_map(fn (Part $p) => $p->id === $part->id ? $part : $p, $this->parts);

        return new self($this->bars, $this->map, $parts, $this->verses, $this->marks, $this->sections, $this->footnotes, $this->style);
    }

    /**
     * @param  list<MapEvent>  $map
     */
    public function withMap(array $map): self
    {
        return new self($this->bars, $map, $this->parts, $this->verses, $this->marks, $this->sections, $this->footnotes, $this->style);
    }

    /**
     * @param  list<Mark>  $marks
     */
    public function withMarks(array $marks): self
    {
        return new self($this->bars, $this->map, $this->parts, $this->verses, $marks, $this->sections, $this->footnotes, $this->style);
    }

    /**
     * How many beats bar $bar has, following the tempo & time map.
     */
    public function beatsInBar(int $bar): int
    {
        return $this->mapValueAt($bar, fn (MapEvent $e) => $e->beats);
    }

    /**
     * Beats per minute in force at the start of bar $bar. (A rit. or accel.
     * ramps towards this value; the player handles the curve.)
     */
    public function tempoAt(int $bar): int
    {
        return $this->mapValueAt($bar, fn (MapEvent $e) => $e->bpm);
    }

    /**
     * @return array{
     *     schema: int,
     *     bars: int,
     *     style: string|null,
     *     map: list<array<string, mixed>>,
     *     parts: list<array<string, mixed>>,
     *     verses: list<array<string, mixed>>,
     *     marks: list<array<string, mixed>>,
     *     sections: list<array<string, mixed>>,
     *     footnotes: list<string>
     * }
     */
    public function toArray(): array
    {
        $out = fn (array $items) => array_map(fn (JsonSerializable $i) => (array) $i->jsonSerialize(), $items);

        return [
            'schema' => self::SCHEMA,
            'bars' => $this->bars,
            'style' => $this->style,
            'map' => $out($this->map),
            'parts' => $out($this->parts),
            'verses' => $out($this->verses),
            'marks' => $out($this->marks),
            'sections' => $out($this->sections),
            'footnotes' => $this->footnotes,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    /**
     * Walk the map in order; a change whose `until` has passed no longer
     * applies, so the value falls back to what was in force before it.
     *
     * @param  callable(MapEvent): ?int  $pick
     */
    private function mapValueAt(int $bar, callable $pick): int
    {
        $value = 0;

        foreach ($this->map as $event) {
            if ($event->bar > $bar) {
                break;
            }

            $v = $pick($event);
            if ($v !== null && ($event->until === null || $bar <= $event->until)) {
                $value = $v;
            }
        }

        return $value;
    }

    private function validate(): void
    {
        if ($this->bars < 1 || $this->bars > self::MAX_BARS) {
            throw InvalidScoreDocument::at('bars', 'must be between 1 and '.self::MAX_BARS);
        }

        $this->validateMap();
        $this->validateParts();
        $this->validateWords();
        $this->validateMarks();

        foreach ($this->sections as $i => $section) {
            if ($section->to > $this->bars) {
                throw InvalidScoreDocument::at("sections.{$i}.to", "the score only has {$this->bars} bars");
            }
        }
    }

    private function validateMap(): void
    {
        $first = $this->map[0] ?? null;

        if ($first === null || $first->bar !== 1 || $first->bpm === null || $first->beats === null) {
            throw InvalidScoreDocument::at('map.0', 'the score must start at bar 1 with a tempo and a number of beats');
        }

        $previous = 0;
        foreach ($this->map as $i => $event) {
            if ($event->bar <= $previous) {
                throw InvalidScoreDocument::at("map.{$i}.bar", 'changes must be in bar order, one per bar');
            }

            if ($event->bar > $this->bars) {
                throw InvalidScoreDocument::at("map.{$i}.bar", "the score only has {$this->bars} bars");
            }

            $previous = $event->bar;
        }
    }

    private function validateParts(): void
    {
        if ($this->parts === []) {
            throw InvalidScoreDocument::at('parts', 'a score needs at least one part');
        }

        $seen = [];
        foreach ($this->parts as $p => $part) {
            if (isset($seen[$part->id->value])) {
                throw InvalidScoreDocument::at("parts.{$p}.id", "{$part->name} appears twice");
            }
            $seen[$part->id->value] = true;

            if (count($part->bars) !== $this->bars) {
                throw InvalidScoreDocument::at("parts.{$p}.bars", "expected {$this->bars} bars, found ".count($part->bars));
            }

            foreach ($part->bars as $b => $bar) {
                if ($bar->no !== $b + 1) {
                    throw InvalidScoreDocument::at("parts.{$p}.bars.{$b}.no", 'expected bar '.($b + 1));
                }

                $bar->assertFits($this->beatsInBar($bar->no), "parts.{$p}.bars.{$b}");
            }
        }
    }

    private function validateWords(): void
    {
        foreach ($this->verses as $v => $verse) {
            foreach ($verse->syllables as $s => $syllable) {
                $path = "verses.{$v}.syllables.{$s}";

                if ($this->part($syllable->part) === null) {
                    throw InvalidScoreDocument::at("{$path}.part", "this score has no {$syllable->part->label()} part");
                }

                $this->assertPosition(new Position($syllable->bar, $syllable->beat), $path);
            }
        }
    }

    private function validateMarks(): void
    {
        foreach ($this->marks as $m => $mark) {
            $this->assertPosition($mark->at, "marks.{$m}.at");

            if ($mark->to !== null) {
                $this->assertPosition($mark->to, "marks.{$m}.to", endPoint: true);
            }
        }
    }

    /**
     * An end point may sit on the closing bar line (beat == beats in bar).
     */
    private function assertPosition(Position $at, string $path, bool $endPoint = false): void
    {
        if ($at->bar > $this->bars) {
            throw InvalidScoreDocument::at("{$path}.bar", "the score only has {$this->bars} bars");
        }

        $beats = $this->beatsInBar($at->bar);
        if ($endPoint ? $at->beat > $beats : $at->beat >= $beats) {
            throw InvalidScoreDocument::at("{$path}.beat", "bar {$at->bar} only has {$beats} beats");
        }
    }

    /**
     * @template T
     *
     * @param  array<string, mixed>  $data
     * @param  callable(mixed, string): T  $make
     * @return list<T>
     */
    private static function each(array $data, string $key, callable $make, bool $optional = false): array
    {
        $items = [];
        foreach (Field::list($data, $key, '', $optional) as $i => $item) {
            $items[] = $make($item, "{$key}.{$i}");
        }

        return $items;
    }
}
