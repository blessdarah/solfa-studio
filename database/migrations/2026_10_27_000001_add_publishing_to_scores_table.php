<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Publishing (Paper W13): a published score has a public page at
 * /p/{slug} that anyone can open without an account. The page shows a
 * snapshot taken when the composer last pressed Publish — later edits stay
 * private until they publish again.
 *
 * Deleting moves a score to "Recently deleted" for 30 days (deleted_at).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            $table->string('slug')->nullable()->unique()->after('title');
            $table->timestamp('published_at')->nullable()->after('archived_at');
            $table->unsignedInteger('published_version')->nullable()->after('published_at');
            // Title, composer, key and the music, as they were when published.
            $table->jsonb('published')->nullable()->after('published_version');
            // Lower-case title, composer and words of the published version, for search.
            $table->text('search_text')->nullable()->after('published');
            $table->boolean('listed')->default(true)->after('search_text');      // shows in public search
            $table->boolean('allow_play')->default(true)->after('listed');
            $table->boolean('allow_print')->default(true)->after('allow_play');
            $table->boolean('show_words')->default(true)->after('allow_print');
            $table->unsignedInteger('visits')->default(0)->after('show_words');
            $table->unsignedInteger('plays')->default(0)->after('visits');
            $table->softDeletes();

            $table->index(['published_at', 'listed']);
        });
    }

    public function down(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            $table->dropIndex(['published_at', 'listed']);
            $table->dropUnique(['slug']);
            $table->dropSoftDeletes();
            $table->dropColumn([
                'slug', 'published_at', 'published_version', 'published', 'search_text',
                'listed', 'allow_play', 'allow_print', 'show_words', 'visits', 'plays',
            ]);
        });
    }
};
