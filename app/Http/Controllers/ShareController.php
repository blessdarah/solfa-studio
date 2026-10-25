<?php

namespace App\Http\Controllers;

use App\Enums\ScoreStatus;
use App\Enums\ShareAccess;
use App\Models\Score;
use App\Models\Share;
use App\Models\User;
use App\Notifications\ScoreActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Share links. The editor's Share button makes one and copies it; opening
 * it while signed in puts the score under "Shared with me".
 */
class ShareController extends Controller
{
    public function store(Request $request, Score $score): JsonResponse
    {
        abort_unless($score->owner_id === $request->user()?->id, 404);

        $validated = $request->validate([
            'can' => ['nullable', Rule::enum(ShareAccess::class)],
        ]);

        $can = ShareAccess::from($validated['can'] ?? ShareAccess::Practise->value);

        $share = $score->shares()->where('can', $can->value)->whereNull('version')->first()
            ?? $score->shares()->create(['can' => $can]);

        if ($score->status === ScoreStatus::Draft) {
            $score->forceFill(['status' => ScoreStatus::Shared])->save();
        }

        return response()->json([
            'url' => route('shares.open', $share->token),
            'can' => $share->can->value,
        ]);
    }

    public function open(Request $request, string $token): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $share = Share::query()->where('token', $token)->with('score.owner')->firstOrFail();

        if ($share->openedBy($user)) {
            $share->score->owner->notify(new ScoreActivity(
                actor: $user,
                score: $share->score,
                action: 'opened',
            ));
        }

        return redirect()->route('scores.show', $share->score);
    }
}
