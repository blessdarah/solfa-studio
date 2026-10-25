<?php

namespace App\Http\Controllers;

use App\Models\Score;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Drop a score on "Archive" to put it away; drop it back on "All scores"
 * to restore it.
 */
class ScoreArchiveController extends Controller
{
    public function store(Request $request, Score $score): RedirectResponse
    {
        abort_unless($score->owner_id === $request->user()?->id, 404);

        $score->forceFill(['archived_at' => now()])->save();

        return back()->with('success', "{$score->title} moved to Archive.");
    }

    public function destroy(Request $request, Score $score): RedirectResponse
    {
        abort_unless($score->owner_id === $request->user()?->id, 404);

        $score->forceFill(['archived_at' => null])->save();

        return back()->with('success', "{$score->title} is back in your library.");
    }
}
