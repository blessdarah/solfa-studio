<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A named group of scores in the library rail ("Choir repertoire").
 *
 * @property int $id
 * @property int $owner_id
 * @property string $name
 * @property string $color ink | marker | grey — the little square beside the name
 * @property int $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $owner
 */
#[Fillable(['name', 'color', 'position'])]
class Collection extends Model
{
    public const COLORS = ['ink', 'marker', 'grey'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return BelongsToMany<Score, $this>
     */
    public function scores(): BelongsToMany
    {
        return $this->belongsToMany(Score::class)->withPivot('created_at');
    }
}
