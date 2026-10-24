<?php

namespace App\Music;

use InvalidArgumentException;

/**
 * Thrown when score JSON does not describe valid music. The message names
 * the exact path, e.g. "parts.1.bars.9.notes.2: note runs past the end of
 * bar 10 (4 beats)".
 */
class InvalidScoreDocument extends InvalidArgumentException
{
    public static function at(string $path, string $problem): self
    {
        return new self($path === '' ? $problem : "{$path}: {$problem}");
    }
}
