<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $workspace_name
 * @property string $workspace_role
 * @property string $plan
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'phone', 'email', 'password', 'workspace_name', 'workspace_role', 'plan'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'workspace_role' => 'Director',
        'plan' => 'free',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * "Darah-B Studios", or "Blessdaraah's studio" until they name it.
     */
    public function workspaceLabel(): string
    {
        $name = trim((string) $this->workspace_name);

        return $name !== '' ? $name : "{$this->name}'s studio";
    }

    /**
     * The scores this person scanned or composed.
     *
     * @return HasMany<Score, $this>
     */
    public function scores(): HasMany
    {
        return $this->hasMany(Score::class, 'owner_id');
    }

    /**
     * @return HasMany<Collection, $this>
     */
    public function collections(): HasMany
    {
        return $this->hasMany(Collection::class, 'owner_id')->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<Rehearsal, $this>
     */
    public function rehearsals(): HasMany
    {
        return $this->hasMany(Rehearsal::class, 'owner_id');
    }

    /**
     * Share links this person has opened.
     *
     * @return BelongsToMany<Share, $this>
     */
    public function openedShares(): BelongsToMany
    {
        return $this->belongsToMany(Share::class)->withPivot(['first_opened_at', 'last_opened_at']);
    }

    /**
     * Other people's scores this person can see through a share link.
     *
     * @return Builder<Score>
     */
    public function sharedWithMe(): Builder
    {
        return Score::query()
            ->where('owner_id', '!=', $this->id)
            ->whereHas('shares.recipients', fn (Builder $query) => $query->whereKey($this->id));
    }
}
