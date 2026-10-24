<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Photos of a paper score and how well they were read.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('score_id')->constrained()->cascadeOnDelete();
            $table->jsonb('pages');                             // storage keys, in page order
            $table->string('state', 16)->default('reading');   // reading | review | done
            $table->float('read_score')->nullable();            // 0.94 → "94% read"
            $table->timestamps();
        });

        Schema::create('scan_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('scan_id')->constrained()->cascadeOnDelete();
            $table->char('part', 1);                            // S | A | T | B
            $table->unsignedSmallInteger('bar');
            $table->decimal('beat', 6, 3);                      // 0-based, can be 2.5
            $table->jsonb('crop');                              // {x, y, w, h} on the photo
            $table->jsonb('guesses');                           // [{pitch, octave, confidence}]
            $table->boolean('resolved')->default(false);
            $table->jsonb('picked')->nullable();                // the note the person chose
            $table->timestamps();

            $table->index(['scan_id', 'resolved']);             // "7 notes to check"
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scan_flags');
        Schema::dropIfExists('scans');
    }
};
