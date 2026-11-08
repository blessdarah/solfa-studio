<?php

namespace App\Http\Controllers;

use App\Models\Score;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Plan a rehearsal: when, who, and which scores to work through.
 */
class RehearsalController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'ensemble' => ['required', 'string', 'max:80'],
            'singers' => ['nullable', 'integer', 'min:1', 'max:999'],
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'date_format:H:i'],
            'score_ids' => ['array'],
            'score_ids.*' => ['string'],
        ]);

        $rehearsal = $user->rehearsals()->create([
            'ensemble' => trim($validated['ensemble']),
            'singers' => $validated['singers'] ?? null,
            'starts_at' => Carbon::createFromFormat('Y-m-d H:i', "{$validated['date']} {$validated['time']}"),
        ]);

        // Keep the order the director chose; only their own scores count.
        $chosen = collect(array_values(array_unique(array_filter($request->array('score_ids'), is_string(...)))));
        $owned = Score::query()
            ->where('owner_id', $user->id)
            ->whereIn('id', $chosen)
            ->pluck('id');
        $ids = $chosen->filter(fn (string $id) => $owned->contains($id))->values();

        $rehearsal->scores()->sync(
            $ids->mapWithKeys(fn (string $id, int $position) => [$id => ['position' => $position]])->all(),
        );

        return back()->with('success', 'Rehearsal planned.');
    }
}
