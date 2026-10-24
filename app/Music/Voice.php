<?php

namespace App\Music;

enum Voice: string
{
    case Soprano = 'S';
    case Alto = 'A';
    case Tenor = 'T';
    case Bass = 'B';

    public function label(): string
    {
        return match ($this) {
            self::Soprano => 'Soprano',
            self::Alto => 'Alto',
            self::Tenor => 'Tenor',
            self::Bass => 'Bass',
        };
    }
}
