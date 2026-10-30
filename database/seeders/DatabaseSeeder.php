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
        User::factory()->create([
            'name' => 'Blessdaraah',
            'email' => 'test@example.com',
            'phone' => '+233241234567',
            'workspace_name' => 'Darah-B Studios',
            'workspace_role' => 'Director',
            'plan' => 'free',
        ]);
    }
}
