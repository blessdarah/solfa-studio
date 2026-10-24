<?php

namespace App\Music;

/**
 * A sol-fa syllable. fe and ta are the common chromatic notes
 * (sharpened fah, flattened te); rest is silence.
 */
enum Pitch: string
{
    case Doh = 'd';
    case Ray = 'r';
    case Me = 'm';
    case Fah = 'f';
    case Fe = 'fe';
    case Soh = 's';
    case Lah = 'l';
    case Ta = 'ta';
    case Te = 't';
    case Rest = 'rest';

    /**
     * Semitones above doh, or null for a rest.
     */
    public function semitones(): ?int
    {
        return match ($this) {
            self::Doh => 0,
            self::Ray => 2,
            self::Me => 4,
            self::Fah => 5,
            self::Fe => 6,
            self::Soh => 7,
            self::Lah => 9,
            self::Ta => 10,
            self::Te => 11,
            self::Rest => null,
        };
    }
}
