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
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
     * Record that a signed-in person opened this link, so the score shows
     * under their "Shared with me". Returns true the first time.
     */
    public function openedBy(User $user): bool
    {
        if ($user->id === $this->score->owner_id) {
            return false;
        }

        $existing = $this->recipients()->whereKey($user->id)->exists();

        if ($existing) {
            $this->recipients()->updateExistingPivot($user->id, ['last_opened_at' => now()]);

            return false;
        }

        $this->recipients()->attach($user->id, ['first_opened_at' => now(), 'last_opened_at' => now()]);

        return true;
    }

    /**
     * People who have opened this link while signed in.
     *
     * @return BelongsToMany<User, $this>
     */
    public function recipients(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot(['first_opened_at', 'last_opened_at']);
    }

    /**
     * @return BelongsTo<Score, $this>
     */
    public function score(): BelongsTo
    {
        return $this->belongsTo(Score::class);
    }
}
