<?php

namespace App\Http\Controllers;

use App\Models\Collection;
use App\Models\Score;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Collections in the library rail. "+" creates one; dropping a score row
 * onto a collection files it there.
 */
class CollectionController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $request->merge(['name' => trim((string) $request->input('name'))]);

        $validated = $request->validate([
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('collections', 'name')->where('owner_id', $user->id),
            ],
        ]);

        $position = (int) $user->collections()->max('position') + 1;
        $count = $user->collections()->count();

        $collection = $user->collections()->create([
            'name' => $validated['name'],
            'color' => Collection::COLORS[$count % count(Collection::COLORS)],
            'position' => $position,
        ]);

        return redirect()->route('dashboard', ['view' => 'collection', 'collection' => $collection->id]);
    }

    public function attach(Request $request, Collection $collection): RedirectResponse
    {
        $this->authorizeOwner($request, $collection);

        $score = Score::query()->findOrFail((string) $request->input('score_id'));
        abort_unless($score->owner_id === $collection->owner_id, 404);

        $collection->scores()->syncWithoutDetaching([$score->id]);

        return back()->with('success', "Added to {$collection->name}.");
    }

    public function detach(Request $request, Collection $collection, Score $score): RedirectResponse
    {
        $this->authorizeOwner($request, $collection);

        $collection->scores()->detach($score->id);

        return back()->with('success', "Removed from {$collection->name}.");
    }

    private function authorizeOwner(Request $request, Collection $collection): void
    {
        abort_unless($collection->owner_id === $request->user()?->id, 404);
    }
}
