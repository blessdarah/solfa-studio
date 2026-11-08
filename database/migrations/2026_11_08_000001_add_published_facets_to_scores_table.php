<?php

use App\Models\Score;
use App\Music\ScoreDocument;
use App\Support\PublicSong;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The public pages filter and count published songs by style and voices.
 * Keeping those two facts in columns (set when publishing) lets the
 * database do it, instead of parsing every published document per visit.
 *
 * On Postgres, a trigram index lets `search_text LIKE '%word%'` use an
 * index instead of reading the whole table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            // Lower case, e.g. "highlife"; null when the song has no style.
            $table->string('published_style', 60)->nullable()->after('search_text');
            // The parts with music, in S A T B order: "SATB", "SA", "TB".
            $table->string('published_voices', 4)->nullable()->after('published_style');

            $table->index(['listed', 'published_style']);
            $table->index(['listed', 'published_voices']);
        });

        DB::table('scores')->whereNotNull('published')->select(['id', 'published'])->orderBy('id')
            ->each(function (object $row): void {
                $published = json_decode((string) $row->published, true);
                $document = ScoreDocument::fromArray(is_array($published) ? ($published['document'] ?? []) : []);

                DB::table('scores')->where('id', $row->id)->update([
                    'published_style' => Score::styleKey($document->style),
                    'published_voices' => implode('', PublicSong::voices($document)),
                ]);
            });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
            DB::statement('CREATE INDEX scores_search_text_trgm_index ON scores USING gin (search_text gin_trgm_ops)');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS scores_search_text_trgm_index');
        }

        Schema::table('scores', function (Blueprint $table) {
            $table->dropIndex(['listed', 'published_style']);
            $table->dropIndex(['listed', 'published_voices']);
            $table->dropColumn(['published_style', 'published_voices']);
        });
    }
};
