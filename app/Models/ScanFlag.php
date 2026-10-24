<?php

namespace App\Models;

use App\Music\Note;
use App\Music\Voice;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A note the scanner wasn't sure about — "Alto, bar 5, last note?" — with
 * where it sits on the photo and the ranked guesses to offer.
 *
 * @property int $id
 * @property string $scan_id
 * @property Voice $part
 * @property int $bar
 * @property float $beat
 * @property array{x: float, y: float, w: float, h: float} $crop
 * @property list<array{pitch: string, octave: int, confidence: float}> $guesses best first
 * @property bool $resolved
 * @property array{pitch: string, octave: int, start: float, length: float, source: string}|null $picked
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Scan $scan
 */
#[Fillable(['part', 'bar', 'beat', 'crop', 'guesses', 'resolved', 'picked'])]
class ScanFlag extends Model
{
    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'resolved' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'part' => Voice::class,
            'bar' => 'integer',
            'beat' => 'float',
            'crop' => 'array',
            'guesses' => 'array',
            'resolved' => 'boolean',
            'picked' => 'array',
        ];
    }

    /**
     * Record the note the person chose. (Writing it into the score document
     * is the editor's job, through Score::saveDocument.)
     */
    public function resolve(Note $note): void
    {
        $this->forceFill(['resolved' => true, 'picked' => $note->toArray()])->save();
    }

    /**
     * @return BelongsTo<Scan, $this>
     */
    public function scan(): BelongsTo
    {
        return $this->belongsTo(Scan::class);
    }
}
