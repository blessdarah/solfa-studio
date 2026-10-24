<?php

namespace Tests\Support;

use App\Music\Bar;
use App\Music\Note;
use App\Music\Part;
use App\Music\Pitch;
use App\Music\ScoreDocument;

trait BuildsMusic
{
    /**
     * A simple four-part score. Every bar has one note; `$done` decides
     * whether every voice is finished.
     */
    protected function document(bool $done = false, int $bars = 4): ScoreDocument
    {
        $blank = ScoreDocument::blank(bars: $bars);

        $parts = array_map(fn (Part $part) => new Part(
            $part->id,
            $part->name,
            array_map(fn (Bar $bar) => new Bar(
                no: $bar->no,
                notes: [new Note(Pitch::Doh, 0, 0.0, 1.0)],
                done: $done,
            ), $part->bars),
        ), $blank->parts);

        return new ScoreDocument(
            bars: $bars,
            map: $blank->map,
            parts: $parts,
        );
    }
}
