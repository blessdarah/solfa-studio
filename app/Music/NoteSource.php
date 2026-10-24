<?php

namespace App\Music;

/**
 * How a note got into the score: typed by the composer, read from a scan,
 * or suggested by AI Harmonize and accepted.
 */
enum NoteSource: string
{
    case Typed = 'typed';
    case Scan = 'scan';
    case Ai = 'ai';
}
