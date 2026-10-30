<?php

namespace App\Http\Controllers;

use App\Enums\ScoreOrigin;
use App\Enums\ScoreStatus;
use App\Http\Requests\StoreScoreRequest;
use App\Models\Score;
use App\Models\User;
use App\Music\InvalidScoreDocument;
use App\Music\ScoreDocument;
use App\Music\Voice;
use App\Support\Harmonizer;
use App\Support\Publishing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The compose screen (Paper W1–W3). The editor changes the document in
 * the browser and autosaves it whole; the server checks it is valid music
 * and that nobody else saved in between.
 */
class ScoreController extends Controller
{
    /**
     * "Write a new piece" — then open it on the first chosen part.
     */
    public function store(StoreScoreRequest $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $voices = $request->voices();

        $composer = (string) $request->validated('composer');
        $arranger = (string) $request->validated('arranger');

        $score = $user->scores()->create([
            'title' => $request->validated('title'),
            'composer' => $composer !== '' ? $composer : $user->name,
            'arranger' => $arranger !== '' ? $arranger : null,
            'doh' => $request->validated('doh'),
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Draft,
            'document' => ScoreDocument::blank(
                bars: (int) ($request->validated('bars') ?? 16),
                beats: (int) ($request->validated('beats') ?? 4),
                voices: $voices,
            ),
        ]);

        return redirect()->route('scores.show', [$score, 'part' => $voices[0]->value]);
    }

    public function show(Request $request, Score $score): Response
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($score->isVisibleTo($user), 404);

        $part = Voice::tryFrom((string) $request->query('part', ''));

        return Inertia::render('scores/show', [
            'score' => [
                'id' => $score->id,
                'title' => $score->title,
                'composer' => $score->composer,
                'arranger' => $score->arranger,
                'doh' => $score->doh,
                'version' => $score->version,
                'saved_at' => $score->updated_at?->toIso8601String(),
            ],
            'document' => $score->document,
            'can_edit' => $score->isEditableBy($user),
            'is_owner' => $score->owner_id === $user->id,
            'start_part' => $part?->value,
            'publishing' => $score->owner_id === $user->id ? Publishing::state($score) : null,
            'suggestions' => Harmonizer::available(),
        ]);
    }

    /**
     * Autosave. 409 when another tab or device saved first.
     */
    public function saveDocument(Request $request, Score $score): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($score->isEditableBy($user), 404);

        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'document' => ['required', 'array'],
            'note' => ['nullable', 'string', 'max:120'],
        ]);

        try {
            $document = ScoreDocument::fromArray($validated['document']);
        } catch (InvalidScoreDocument $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $score->saveDocument($document, (int) $validated['version'], $user, $validated['note'] ?? null);

        return response()->json([
            'version' => $score->version,
            'saved_at' => $score->updated_at?->toIso8601String(),
        ]);
    }

    /**
     * "Suggest alto for bars 10–12": a harmony line from the other parts.
     */
    public function suggest(Request $request, Score $score): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($score->isEditableBy($user), 404);

        if (! Harmonizer::available()) {
            return response()->json([
                'message' => 'Suggestions need an Anthropic API key. Add ANTHROPIC_API_KEY to .env.',
            ], 503);
        }

        $validated = $request->validate([
            'part' => ['required', Rule::enum(Voice::class)],
            'from' => ['required', 'integer', 'min:1'],
            'to' => ['required', 'integer', 'gte:from'],
        ]);

        $bars = (new Harmonizer)->suggest(
            $score,
            Voice::from($validated['part']),
            (int) $validated['from'],
            min((int) $validated['to'], $score->document->bars),
        );

        if ($bars === null) {
            return response()->json(['message' => 'No suggestion this time. Try again.'], 502);
        }

        return response()->json(['bars' => $bars]);
    }
}
