<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Named groups of scores in the library rail: "Choir repertoire",
 * "Christmas", "Practice". A score can sit in several.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('color', 16)->default('ink');        // ink | marker | grey
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['owner_id', 'name']);
        });

        Schema::create('collection_score', function (Blueprint $table) {
            $table->foreignId('collection_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('score_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['collection_id', 'score_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_score');
        Schema::dropIfExists('collections');
    }
};
