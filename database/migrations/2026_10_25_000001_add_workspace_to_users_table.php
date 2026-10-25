<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The studio name, role and plan shown at the top of the library rail
 * ("Darah-B Studios · Director · Free plan").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('workspace_name', 80)->nullable()->after('phone');
            $table->string('workspace_role', 40)->default('Director')->after('workspace_name');
            $table->string('plan', 16)->default('free')->after('workspace_role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['workspace_name', 'workspace_role', 'plan']);
        });
    }
};
