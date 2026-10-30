<?php

use Illuminate\Foundation\Inspiring;
use App\Models\Score;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Scores deleted more than 30 days ago leave "Recently deleted" for good.
Schedule::command('model:prune', ['--model' => [Score::class]])->daily();
