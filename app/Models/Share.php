<?php

namespace App\Models;

use App\Enums\ShareAccess;
use App\Music\ScoreDocument;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A link to a score. The token is the secret in the URL; `version` pins the
 * link to one snapshot, or null to always show the latest music.
 *
 * @property string $id
 * @property string $score_id
 * @property string $token
 * @property ShareAccess $can
 * @property int|null $version
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Score $score
 */
#[Fillable(['can', 'version'])]
#[Hidden(['token'])]
class Share extends Model
{
    use HasUuids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'can' => 'view',
    ];

    protected static function booted(): void
    {
        static::creating(function (Share $share) {
            $share->token ??= Str::random(40);
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'can' => ShareAccess::class,
            'version' => 'integer',
        ];
    }

    /**
     * The music this link shows: the pinned snapshot, or the latest score.
     */
    public function document(): ScoreDocument
    {
        if ($this->version === null) {
            return $this->score->document;
        }

        return $this->score->versions()->where('version', $this->version)->firstOrFail()->document;
    }

    /**
     * @return BelongsTo<Score, $this>
     */
    public function score(): BelongsTo
    {
        return $this->belongsTo(Score::class);
    }
}
