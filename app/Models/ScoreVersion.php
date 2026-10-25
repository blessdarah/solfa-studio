<?php

namespace App\Models;

use App\Casts\AsScoreDocument;
use App\Music\ScoreDocument;
use App\Notifications\ScoreActivity;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A saved snapshot of a score's music, for going back to an older draft.
 *
 * @property int $id
 * @property string $score_id
 * @property int $version
 * @property ScoreDocument $document
 * @property int|null $saved_by
 * @property string|null $note
 * @property CarbonImmutable $saved_at
 * @property-read Score $score
 * @property-read User|null $savedBy
 */
#[Fillable(['version', 'document', 'saved_by', 'note', 'saved_at'])]
class ScoreVersion extends Model
{
    public $timestamps = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'document' => AsScoreDocument::class,
            'saved_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ScoreVersion $version) {
            $version->saved_at ??= now();
        });

        // Tell the owner when someone else changes their score.
        static::created(function (ScoreVersion $version) {
            $score = $version->score;

            if ($version->saved_by === null || $version->saved_by === $score->owner_id) {
                return;
            }

            $by = $version->savedBy;

            if ($by !== null) {
                $score->owner->notify(new ScoreActivity(
                    actor: $by,
                    score: $score,
                    action: $version->note !== null ? lcfirst($version->note) : 'edited',
                ));
            }
        });
    }

    /**
     * @return BelongsTo<Score, $this>
     */
    public function score(): BelongsTo
    {
        return $this->belongsTo(Score::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function savedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'saved_by');
    }
}
