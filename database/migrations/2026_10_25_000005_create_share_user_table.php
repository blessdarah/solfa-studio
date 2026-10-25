<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who has opened a share link while signed in. Those scores appear under
 * "Shared with me" for that person.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('share_user', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('share_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('first_opened_at')->useCurrent();
            $table->timestamp('last_opened_at')->useCurrent();

            $table->unique(['share_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('share_user');
    }
};
