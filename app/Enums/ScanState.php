<?php

namespace App\Enums;

enum ScanState: string
{
    case Reading = 'reading';
    case Review = 'review';
    case Done = 'done';
}
