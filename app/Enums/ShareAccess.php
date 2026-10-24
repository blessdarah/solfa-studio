<?php

namespace App\Enums;

/**
 * What a share link lets someone do. Each level includes the ones before it.
 */
enum ShareAccess: string
{
    case View = 'view';
    case Practise = 'practise';
    case Edit = 'edit';

    public function allows(self $needed): bool
    {
        $rank = fn (self $a) => match ($a) {
            self::View => 1,
            self::Practise => 2,
            self::Edit => 3,
        };

        return $rank($this) >= $rank($needed);
    }
}
