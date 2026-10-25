<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Next rehearsal · Sun 26 Oct · 4:00 PM · Darah-B Choir · 12 singers".
 * The rehearsal plan is the ordered list of scores to work on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rehearsals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('ensemble', 80);
            $table->unsignedSmallInteger('singers')->nullable();
            $table->timestamp('starts_at');
            $table->timestamps();

            $table->index(['owner_id', 'starts_at']);
        });

        Schema::create('rehearsal_score', function (Blueprint $table) {
            $table->foreignId('rehearsal_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('score_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);

            $table->primary(['rehearsal_id', 'score_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rehearsal_score');
        Schema::dropIfExists('rehearsals');
    }
};
