<?php

namespace App\Models;

use App\Enums\ScanState;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Photos of a paper score and how well they were read.
 *
 * @property string $id
 * @property string $score_id
 * @property list<string> $pages storage keys, in page order
 * @property ScanState $state
 * @property float|null $read_score 0–1; 0.94 shows as "94% read"
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Score $score
 */
#[Fillable(['pages', 'state', 'read_score'])]
class Scan extends Model
{
    use HasUuids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'state' => 'reading',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'pages' => 'array',
            'state' => ScanState::class,
            'read_score' => 'float',
        ];
    }

    /**
     * @return BelongsTo<Score, $this>
     */
    public function score(): BelongsTo
    {
        return $this->belongsTo(Score::class);
    }

    /**
     * @return HasMany<ScanFlag, $this>
     */
    public function flags(): HasMany
    {
        return $this->hasMany(ScanFlag::class);
    }

    /**
     * @return HasMany<ScanFlag, $this>
     */
    public function flagsToCheck(): HasMany
    {
        return $this->flags()->where('resolved', false)->orderBy('bar')->orderBy('beat');
    }
}
