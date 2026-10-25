<?php

namespace App\Models;

use App\Casts\AsScoreDocument;
use App\Enums\ScoreOrigin;
use App\Enums\ScoreStatus;
use App\Enums\ShareAccess;
use App\Exceptions\StaleScoreVersion;
use App\Music\ScoreDocument;
use Carbon\CarbonImmutable;
use Database\Factories\ScoreFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;

/**
 * One piece of music. The searchable facts are columns; the music is
 * `document`, a validated ScoreDocument.
 *
 * @property string $id
 * @property int $owner_id
 * @property string $title
 * @property string|null $composer
 * @property string|null $arranger an arrangement when set ("arr. Ama Serwaa")
 * @property string $doh
 * @property ScoreOrigin $origin
 * @property ScoreStatus $status
 * @property ScoreDocument $document
 * @property int $version
 * @property CarbonImmutable|null $archived_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $owner
 */
#[Fillable(['title', 'composer', 'arranger', 'doh', 'origin', 'status', 'document'])]
class Score extends Model
{
    /** @use HasFactory<ScoreFactory> */
    use HasFactory, HasUuids;

    /**
     * Keys a choir can sing in, as written after "Doh is".
     */
    public const DOH_KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    /**
     * Autosave runs after every edit; a snapshot is kept at most this often
     * (or whenever the composer names a checkpoint).
     */
    public const SNAPSHOT_EVERY_MINUTES = 10;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'draft',
        'version' => 1,
    ];

    protected static function booted(): void
    {
        // Version 1 is always kept, so there is something to go back to.
        static::created(function (Score $score) {
            $score->versions()->create([
                'version' => $score->version,
                'document' => $score->document,
                'saved_by' => $score->owner_id,
                'note' => 'Created',
            ]);
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'origin' => ScoreOrigin::class,
            'status' => ScoreStatus::class,
            'document' => AsScoreDocument::class,
            'version' => 'integer',
            'archived_at' => 'datetime',
        ];
    }

    /**
     * Save new music, but only if nobody else saved since the editor loaded
     * `$expectedVersion`. Bumps the version, and keeps a snapshot when a
     * note is given or the last snapshot is old enough.
     *
     * @throws StaleScoreVersion
     */
    public function saveDocument(ScoreDocument $document, int $expectedVersion, ?User $by = null, ?string $note = null): void
    {
        DB::transaction(function () use ($document, $expectedVersion, $by, $note) {
            $now = now();
            $next = $expectedVersion + 1;

            $updated = static::query()
                ->whereKey($this->getKey())
                ->where('version', $expectedVersion)
                ->update([
                    'document' => $document->toJson(),
                    'version' => $next,
                    'updated_at' => $now,
                ]);

            if ($updated === 0) {
                throw new StaleScoreVersion(
                    $this->id,
                    $expectedVersion,
                    (int) static::query()->whereKey($this->getKey())->value('version'),
                );
            }

            $this->forceFill(['document' => $document, 'version' => $next, 'updated_at' => $now])->syncOriginal();

            $last = $this->latestVersion()->first();
            $due = $last === null || $last->saved_at->lte(now()->subMinutes(self::SNAPSHOT_EVERY_MINUTES));

            if ($note !== null || $due) {
                $this->versions()->create([
                    'version' => $next,
                    'document' => $document,
                    'saved_by' => $by?->id,
                    'note' => $note,
                    'saved_at' => $now,
                ]);
            }
        });
    }

    /**
     * Put an older snapshot back as the newest version (history is kept).
     *
     * @throws StaleScoreVersion
     */
    public function restore(ScoreVersion $snapshot, ?User $by = null): void
    {
        $this->saveDocument($snapshot->document, $this->version, $by, "Restored version {$snapshot->version}");
    }

    public function isArrangement(): bool
    {
        return $this->arranger !== null && trim($this->arranger) !== '';
    }

    /**
     * The owner, or anyone who has opened one of its share links.
     */
    public function isVisibleTo(User $user): bool
    {
        return $this->owner_id === $user->id || $this->shareFor($user) !== null;
    }

    /**
     * The owner, or someone holding an "edit" share link.
     */
    public function isEditableBy(User $user): bool
    {
        return $this->owner_id === $user->id
            || $this->shareFor($user)?->can === ShareAccess::Edit;
    }

    /**
     * The strongest share link this person has opened for this score.
     */
    public function shareFor(User $user): ?Share
    {
        return $this->shares()
            ->whereHas('recipients', fn (Builder $query) => $query->whereKey($user->id))
            ->get()
            ->sortByDesc(fn (Share $share) => match ($share->can) {
                ShareAccess::Edit => 3,
                ShareAccess::Practise => 2,
                ShareAccess::View => 1,
            })
            ->first();
    }

    /**
     * Scores still in the library (not archived).
     *
     * @param  Builder<Score>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->whereNull('archived_at');
    }

    /**
     * @param  Builder<Score>  $query
     */
    #[Scope]
    protected function archived(Builder $query): void
    {
        $query->whereNotNull('archived_at');
    }

    /**
     * @return BelongsToMany<Collection, $this>
     */
    public function collections(): BelongsToMany
    {
        return $this->belongsToMany(Collection::class)->withPivot('created_at');
    }

    /**
     * @return BelongsToMany<Rehearsal, $this>
     */
    public function rehearsals(): BelongsToMany
    {
        return $this->belongsToMany(Rehearsal::class)->withPivot('position');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return HasMany<ScoreVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(ScoreVersion::class);
    }

    /**
     * @return HasOne<ScoreVersion, $this>
     */
    public function latestVersion(): HasOne
    {
        return $this->hasOne(ScoreVersion::class)->ofMany('version', 'max');
    }

    /**
     * @return HasMany<Share, $this>
     */
    public function shares(): HasMany
    {
        return $this->hasMany(Share::class);
    }

    /**
     * @return HasMany<Scan, $this>
     */
    public function scans(): HasMany
    {
        return $this->hasMany(Scan::class);
    }

    /**
     * The most recent photograph session. Its unresolved flags are the
     * "notes to check" on the dashboard.
     *
     * @return HasOne<Scan, $this>
     */
    public function latestScan(): HasOne
    {
        return $this->hasOne(Scan::class)
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }

    /**
     * Every uncertain note from every scan — "7 notes to check".
     *
     * @return HasManyThrough<ScanFlag, Scan, $this>
     */
    public function scanFlags(): HasManyThrough
    {
        return $this->hasManyThrough(ScanFlag::class, Scan::class);
    }
}
