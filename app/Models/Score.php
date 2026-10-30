<?php

namespace App\Models;

use App\Casts\AsScoreDocument;
use App\Enums\ScoreOrigin;
use App\Enums\ScoreStatus;
use App\Enums\ShareAccess;
use App\Exceptions\StaleScoreVersion;
use App\Music\ScoreDocument;
use App\Music\SyllableJoin;
use Carbon\CarbonImmutable;
use Database\Factories\ScoreFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
 * @property string|null $slug the public page is /p/{slug}
 * @property CarbonImmutable|null $published_at
 * @property int|null $published_version the version that was published
 * @property array{title: string, composer: string|null, arranger: string|null, doh: string, document: array<string, mixed>}|null $published
 * @property string|null $search_text
 * @property bool $listed shows in public search
 * @property bool $allow_play
 * @property bool $allow_print
 * @property bool $show_words
 * @property int $visits
 * @property int $plays
 * @property CarbonImmutable|null $deleted_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $owner
 */
#[Fillable(['title', 'composer', 'arranger', 'doh', 'origin', 'status', 'document'])]
class Score extends Model
{
    /** @use HasFactory<ScoreFactory> */
    use HasFactory, HasUuids, MassPrunable, SoftDeletes;

    /**
     * Deleted scores wait this long in "Recently deleted" before they go for good.
     */
    public const KEEP_DELETED_DAYS = 30;

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
        'listed' => true,
        'allow_play' => true,
        'allow_print' => true,
        'show_words' => true,
        'visits' => 0,
        'plays' => 0,
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
            'published_at' => 'datetime',
            'published_version' => 'integer',
            'published' => 'array',
            'listed' => 'boolean',
            'allow_play' => 'boolean',
            'allow_print' => 'boolean',
            'show_words' => 'boolean',
            'visits' => 'integer',
            'plays' => 'integer',
        ];
    }

    /**
     * Scores deleted more than 30 days ago are removed by `model:prune`.
     *
     * @return Builder<Score>
     */
    public function prunable(): Builder
    {
        return static::onlyTrashed()->where('deleted_at', '<=', now()->subDays(self::KEEP_DELETED_DAYS));
    }

    // ------------------------------------------------------------ publishing

    public function isPublished(): bool
    {
        return $this->published_at !== null && $this->published !== null;
    }

    /**
     * Edited since it was last published ("Published · newer edits").
     */
    public function hasUnpublishedChanges(): bool
    {
        if (! $this->isPublished()) {
            return false;
        }

        $published = $this->published ?? [];

        return $this->version !== $this->published_version
            || ($published['title'] ?? null) !== $this->title
            || ($published['composer'] ?? null) !== $this->composer
            || ($published['arranger'] ?? null) !== $this->arranger
            || ($published['doh'] ?? null) !== $this->doh;
    }

    /**
     * Publish the score as it is now: anyone with /p/{slug} can read, play
     * and print this version until it is published again.
     */
    public function publish(): void
    {
        $this->slug ??= $this->uniqueSlug();
        $this->published_at = now();
        $this->published_version = $this->version;
        $this->published = [
            'title' => $this->title,
            'composer' => $this->composer,
            'arranger' => $this->arranger,
            'doh' => $this->doh,
            'document' => $this->document->toArray(),
        ];
        $this->search_text = self::searchTextFor($this->title, $this->composer, $this->arranger, $this->document);

        if ($this->status === ScoreStatus::Draft) {
            $this->status = ScoreStatus::Shared;
        }

        $this->save();
    }

    /**
     * Take the public page down. The slug is kept, so publishing again
     * brings the same link back.
     */
    public function unpublish(): void
    {
        $this->forceFill(['published_at' => null, 'published' => null, 'published_version' => null, 'search_text' => null])->save();
    }

    /**
     * The music as published.
     */
    public function publishedDocument(): ?ScoreDocument
    {
        $published = $this->published;

        return isset($published['document']) ? ScoreDocument::fromArray($published['document']) : null;
    }

    /**
     * Title, composer, arranger and every verse's words, lower case, so a
     * line someone half-remembers finds the song.
     */
    public static function searchTextFor(string $title, ?string $composer, ?string $arranger, ScoreDocument $document): string
    {
        $words = collect($document->verses)->map(function ($verse): string {
            $text = '';

            foreach ($verse->syllables as $syllable) {
                $text .= $syllable->text.($syllable->join === SyllableJoin::Split ? '' : ' ');
            }

            return trim($text);
        });

        return Str::lower(trim(implode("\n", array_filter([$title, $composer, $arranger, ...$words->all(), $document->style]))));
    }

    /**
     * "Onyame Ye" → "onyame-ye", or "onyame-ye-2" when that is taken.
     */
    private function uniqueSlug(): string
    {
        $base = Str::slug(Str::ascii($this->title)) ?: 'song';
        $slug = $base;

        for ($n = 2; static::withTrashed()->where('slug', $slug)->whereKeyNot($this->getKey())->exists(); $n++) {
            $slug = "{$base}-{$n}";
        }

        return $slug;
    }

    /**
     * Published scores that show in public search.
     *
     * @param  Builder<Score>  $query
     */
    #[Scope]
    protected function listedPublicly(Builder $query): void
    {
        $query->whereNotNull('published_at')->where('listed', true);
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
    public function restoreVersion(ScoreVersion $snapshot, ?User $by = null): void
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
