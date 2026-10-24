<?php

namespace App\Music;

/**
 * How a syllable links to the next one:
 * none = a whole word, split = "O–nya–me", hold = the vowel is held (daa__).
 */
enum SyllableJoin: string
{
    case None = 'none';
    case Split = 'split';
    case Hold = 'hold';
}
