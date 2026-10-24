<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $user = User::factory()->create([
            'name' => 'Blessdaraah',
            'email' => 'test@example.com',
            'phone' => '+233241234567',
        ]);

        $this->callWith(DemoLibrarySeeder::class, ['owner' => $user]);
    }
}
