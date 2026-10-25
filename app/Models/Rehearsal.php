<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A planned rehearsal. Its scores, in order, are the rehearsal plan.
 *
 * @property int $id
 * @property int $owner_id
 * @property string $ensemble
 * @property int|null $singers
 * @property CarbonImmutable $starts_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $owner
 */
#[Fillable(['ensemble', 'singers', 'starts_at'])]
class Rehearsal extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'singers' => 'integer',
            'starts_at' => 'datetime',
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
        return $this->belongsToMany(Score::class)->withPivot('position')->orderByPivot('position');
    }
}
