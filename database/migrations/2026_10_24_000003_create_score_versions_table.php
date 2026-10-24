<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshots of a score's document, so a composer can go back to
 * yesterday's draft. (score_id, version) is unique; a plain id keeps
 * Eloquent simple.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('score_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('score_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->jsonb('document');
            $table->foreignId('saved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note')->nullable();                 // "added alto 10–12"
            $table->timestamp('saved_at')->useCurrent();

            $table->unique(['score_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('score_versions');
    }
};
