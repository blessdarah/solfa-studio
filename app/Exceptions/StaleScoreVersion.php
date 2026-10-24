<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * The score changed since the editor loaded it (another tab or device saved
 * first). The editor should reload, re-apply its edit, and save again.
 */
class StaleScoreVersion extends RuntimeException
{
    public function __construct(
        public readonly string $scoreId,
        public readonly int $expectedVersion,
        public readonly int $currentVersion,
    ) {
        parent::__construct("Score {$scoreId} is at version {$currentVersion}, not {$expectedVersion}.");
    }

    public function render(): JsonResponse
    {
        return new JsonResponse([
            'message' => 'This score was changed somewhere else. Reload to get the latest version.',
            'current_version' => $this->currentVersion,
        ], 409);
    }
}
