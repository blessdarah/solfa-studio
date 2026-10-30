<?php

namespace App\Http\Controllers;

use App\Enums\ScoreStatus;
use App\Models\Score;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Looking after a score from the library (Paper W10–W12): edit its
 * details, make a copy, delete it (kept 30 days in Recently deleted),
 * restore it, or delete it for good.
 */
class ScoreManageController extends Controller
{
    public function updateDetails(Request $request, Score $score): RedirectResponse
    {
        $user = $this->owner($request, $score);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'composer' => ['nullable', 'string', 'max:120'],
            'arranger' => ['nullable', 'string', 'max:120'],
            'doh' => ['required', Rule::in(Score::DOH_KEYS)],
            'style' => ['nullable', 'string', 'max:40'],
        ]);

        $style = trim((string) ($validated['style'] ?? ''));
        $style = $style !== '' ? $style : null;

        // The style lives with the music, so changing it is a (small) edit of the music.
        if ($style !== $score->document->style) {
            $score->saveDocument($score->document->withStyle($style), $score->version, $user, 'Changed the style');
        }

        $arranger = trim((string) ($validated['arranger'] ?? ''));

        $score->forceFill([
            'title' => trim($validated['title']),
            'composer' => trim((string) ($validated['composer'] ?? '')) ?: null,
            'arranger' => $arranger !== '' ? $arranger : null,
            'doh' => $validated['doh'],
        ])->save();

        return back()->with('success', 'Details saved.');
    }

    /**
     * "Make a copy" — for a new arrangement. The copy starts as a draft, unpublished.
     */
    public function duplicate(Request $request, Score $score): RedirectResponse
    {
        $user = $this->owner($request, $score);

        $user->scores()->create([
            'title' => $score->title.' (copy)',
            'composer' => $score->composer,
            'arranger' => $score->arranger,
            'doh' => $score->doh,
            'origin' => $score->origin,
            'status' => ScoreStatus::Draft,
            'document' => $score->document,
        ]);

        return back()->with('success', "Made a copy of {$score->title}.");
    }

    /**
     * Into "Recently deleted" for 30 days; the public page stops working at once.
     */
    public function destroy(Request $request, Score $score): RedirectResponse
    {
        $this->owner($request, $score);

        $score->delete();

        return back()->with('success', "{$score->title} moved to Recently deleted.");
    }

    public function restore(Request $request, Score $score): RedirectResponse
    {
        $this->owner($request, $score);

        $score->restore();

        return back()->with('success', "{$score->title} is back in your library.");
    }

    public function forceDestroy(Request $request, Score $score): RedirectResponse
    {
        $this->owner($request, $score);

        abort_unless($score->trashed(), 404);

        $title = $score->title;
        $score->forceDelete();

        return back()->with('success', "{$title} is gone for good.");
    }

    private function owner(Request $request, Score $score): User
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($score->owner_id === $user->id, 404);

        return $user;
    }
}
