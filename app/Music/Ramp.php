<?php

namespace App\Music;

/**
 * How a tempo change arrives: straight away, or by slowing down (rit.)
 * or speeding up (accel.) across the bars before it.
 */
enum Ramp: string
{
    case AtOnce = 'at_once';
    case Rit = 'rit';
    case Accel = 'accel';
}
