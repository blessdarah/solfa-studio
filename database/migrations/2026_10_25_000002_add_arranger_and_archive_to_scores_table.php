<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A score with an arranger is an arrangement ("Traditional · arr. Ama
 * Serwaa"); without one it is an original composition. Archived scores
 * leave the library and live under Archive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            $table->string('arranger')->nullable()->after('composer');
            $table->timestamp('archived_at')->nullable()->after('version');

            $table->index(['owner_id', 'archived_at']);
        });
    }

    public function down(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            $table->dropIndex(['owner_id', 'archived_at']);
            $table->dropColumn(['arranger', 'archived_at']);
        });
    }
};
