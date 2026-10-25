<?php

namespace App\Http\Requests;

use App\Models\Score;
use App\Music\Voice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * "Write a new piece": title, composer, doh, time, bars and the parts.
 */
class StoreScoreRequest extends FormRequest
{
    public const BEATS = [2, 3, 4, 6];

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'composer' => ['nullable', 'string', 'max:120'],
            'arranger' => ['nullable', 'string', 'max:120'],
            'doh' => ['required', 'string', Rule::in(Score::DOH_KEYS)],
            'beats' => ['nullable', 'integer', Rule::in(self::BEATS)],
            'bars' => ['nullable', 'integer', 'min:1', 'max:200'],
            'parts' => ['nullable', 'array', 'min:1'],
            'parts.*' => ['string', 'distinct', Rule::enum(Voice::class)],
        ];
    }

    /**
     * @return list<Voice>
     */
    public function voices(): array
    {
        /** @var list<string> $parts */
        $parts = $this->validated('parts') ?? ['S', 'A', 'T', 'B'];

        // Keep choir order whatever order they were ticked in.
        return array_values(array_filter(
            Voice::cases(),
            fn (Voice $voice) => in_array($voice->value, $parts, true),
        ));
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'title' => trim((string) $this->input('title')),
            'composer' => trim((string) $this->input('composer')),
            'arranger' => trim((string) $this->input('arranger')),
        ]);
    }
}
