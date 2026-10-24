<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per piece. Searchable facts (title, key, status) are real columns;
 * the music itself — parts, notes, words, marks, tempo map — is the
 * `document` JSON, read and written whole by the editor.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('composer')->nullable();
            $table->string('doh', 3);                           // "Eb", "F#"
            $table->string('origin', 16);                       // scanned | composed
            $table->string('status', 16)->default('draft');    // draft | checking | shared
            $table->jsonb('document');
            $table->unsignedInteger('version')->default(1);     // bumps on every save
            $table->timestamps();

            $table->index(['owner_id', 'updated_at']);          // the library list
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scores');
    }
};
