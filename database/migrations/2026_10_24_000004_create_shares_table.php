<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links to share a score. `version` pins the link to one snapshot;
 * null means the link always shows the latest score.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shares', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('score_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->string('can', 16)->default('view');        // view | practise | edit
            $table->unsignedInteger('version')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shares');
    }
};
