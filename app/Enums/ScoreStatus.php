<?php

namespace App\Enums;

enum ScoreStatus: string
{
    case Draft = 'draft';
    case Checking = 'checking';
    case Shared = 'shared';
}
