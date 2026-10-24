<?php

namespace App\Music;

enum MarkKind: string
{
    /** A dynamic at one point: pp p mp mf f ff. */
    case Dynamic = 'dyn';

    /** A wedge that spans to an end point: cresc or dim. */
    case Hairpin = 'hairpin';

    /** Where the choir goes: $ (segno), DS, DC, Fine. */
    case Nav = 'nav';

    /** Free words above the music: "joyfully", "gently". */
    case Text = 'text';

    /**
     * The values each kind accepts, or null when any text is allowed.
     *
     * @return list<string>|null
     */
    public function allowedValues(): ?array
    {
        return match ($this) {
            self::Dynamic => ['pp', 'p', 'mp', 'mf', 'f', 'ff'],
            self::Hairpin => ['cresc', 'dim'],
            self::Nav => ['$', 'DS', 'DC', 'Fine'],
            self::Text => null,
        };
    }

    public function spans(): bool
    {
        return $this === self::Hairpin;
    }
}
