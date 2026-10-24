<?php

namespace App\Casts;

use App\Music\ScoreDocument;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * Turns the `document` jsonb column into a ScoreDocument and back.
 * Writing an array validates it first, so bad music never reaches the database.
 *
 * @implements CastsAttributes<ScoreDocument, ScoreDocument|array<string, mixed>>
 */
class AsScoreDocument implements CastsAttributes
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?ScoreDocument
    {
        if ($value === null) {
            return null;
        }

        return is_string($value)
            ? ScoreDocument::fromJson($value)
            : ScoreDocument::fromArray($value);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            $value = ScoreDocument::fromArray($value);
        }

        if (! $value instanceof ScoreDocument) {
            throw new InvalidArgumentException("The {$key} attribute must be a ScoreDocument or an array.");
        }

        return $value->toJson();
    }
}
