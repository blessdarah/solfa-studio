<?php

namespace App\Http\Controllers;

use App\Models\Score;
use App\Support\Publishing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Publishing (Paper W13): put a score on its public page, publish newer
 * changes, choose what visitors can do, or take the page down.
 */
class PublishController extends Controller
{
    /**
     * Publish, or publish the changes made since.
     */
    public function store(Request $request, Score $score): JsonResponse
    {
        $this->owner($request, $score);

        $score->publish();

        return response()->json(Publishing::state($score));
    }

    public function update(Request $request, Score $score): JsonResponse
    {
        $this->owner($request, $score);

        $validated = $request->validate([
            'listed' => ['sometimes', 'boolean'],
            'allow_play' => ['sometimes', 'boolean'],
            'allow_print' => ['sometimes', 'boolean'],
            'show_words' => ['sometimes', 'boolean'],
        ]);

        $score->forceFill($validated)->save();

        return response()->json(Publishing::state($score));
    }

    /**
     * Unpublish: the link stops working; the score stays yours.
     */
    public function destroy(Request $request, Score $score): JsonResponse
    {
        $this->owner($request, $score);

        $score->unpublish();

        return response()->json(Publishing::state($score));
    }

    private function owner(Request $request, Score $score): void
    {
        abort_unless($score->owner_id === $request->user()?->id, 404);
    }
}
