<?php

namespace Database\Factories;

use App\Enums\ScoreOrigin;
use App\Enums\ScoreStatus;
use App\Models\Score;
use App\Models\User;
use App\Music\ScoreDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Score>
 */
class ScoreFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'owner_id' => User::factory(),
            'title' => rtrim(ucwords(fake()->sentence(2)), '.'),
            'composer' => fake()->name(),
            'doh' => fake()->randomElement(Score::DOH_KEYS),
            'origin' => ScoreOrigin::Composed,
            'status' => ScoreStatus::Draft,
            'document' => ScoreDocument::blank(bars: 16),
        ];
    }

    public function scanned(): static
    {
        return $this->state(fn () => ['origin' => ScoreOrigin::Scanned, 'status' => ScoreStatus::Checking]);
    }

    public function bars(int $bars, int $bpm = 96, int $beats = 4): static
    {
        return $this->state(fn () => ['document' => ScoreDocument::blank($bars, $bpm, $beats)]);
    }
}
