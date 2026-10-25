<?php

namespace App\Support;

use App\Models\Score;
use App\Music\Bar;
use App\Music\InvalidScoreDocument;
use App\Music\Note;
use App\Music\Part;
use App\Music\ScoreDocument;
use App\Music\Voice;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Asks Claude for one voice's notes over a few bars, given the other
 * voices. The answer is checked against the real document before it is
 * offered, so a bad suggestion can never be saved.
 */
class Harmonizer
{
    public static function available(): bool
    {
        return trim((string) config('services.anthropic.key')) !== '';
    }

    /**
     * @return list<array{no: int, notes: list<array<string, mixed>>, done: bool}>|null
     */
    public function suggest(Score $score, Voice $voice, int $from, int $to): ?array
    {
        $document = $score->document;

        $context = [];
        foreach ($document->parts as $part) {
            $context[$part->id->label()] = array_map(
                fn (Bar $bar) => ['bar' => $bar->no, 'beats' => $document->beatsInBar($bar->no), 'notes' => array_map(
                    fn (Note $note) => $note->toArray(),
                    $bar->notes,
                )],
                array_slice($part->bars, $from - 1, $to - $from + 1),
            );
        }

        $prompt = implode("\n", [
            'You write tonic sol-fa for Ghanaian SATB choirs.',
            "Doh is {$score->doh}. Style: ".($document->style ?? 'anthem').'.',
            "Write the {$voice->label()} part for bars {$from}–{$to}, fitting the other parts below.",
            'Notes use pitch (d r m f fe s l ta t), octave (-1 low, 0 middle, 1 high), start and length in beats from the start of the bar.',
            'Notes in a bar must not overlap and must fit the number of beats.',
            'Reply with JSON only: [{"bar": 10, "notes": [{"pitch": "m", "octave": 0, "start": 0, "length": 1}]}]',
            '',
            json_encode($context, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION),
        ]);

        try {
            $response = Http::timeout(45)
                ->withHeaders([
                    'x-api-key' => (string) config('services.anthropic.key'),
                    'anthropic-version' => '2023-06-01',
                ])
                ->post('https://api.anthropic.com/v1/messages', [
                    'model' => (string) config('services.anthropic.model'),
                    'max_tokens' => 2000,
                    'messages' => [['role' => 'user', 'content' => $prompt]],
                ]);
        } catch (Throwable $e) {
            Log::warning('Harmonizer request failed', ['error' => $e->getMessage()]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('Harmonizer returned an error', ['status' => $response->status()]);

            return null;
        }

        $text = (string) data_get($response->json(), 'content.0.text', '');

        return $this->parse($text, $document, $voice, $from, $to);
    }

    /**
     * @return list<array{no: int, notes: list<array<string, mixed>>, done: bool}>|null
     */
    private function parse(string $text, ScoreDocument $document, Voice $voice, int $from, int $to): ?array
    {
        $start = strpos($text, '[');
        $end = strrpos($text, ']');

        if ($start === false || $end === false) {
            return null;
        }

        $decoded = json_decode(substr($text, $start, $end - $start + 1), true);

        if (! is_array($decoded)) {
            return null;
        }

        $part = $document->part($voice) ?? Part::empty($voice, $document->bars);
        $bars = $part->bars;

        try {
            foreach ($decoded as $entry) {
                if (! is_array($entry) || ! is_int($entry['bar'] ?? null)) {
                    continue;
                }

                $no = $entry['bar'];
                if ($no < $from || $no > $to) {
                    continue;
                }

                $notes = array_map(fn ($note) => Note::fromArray(
                    is_array($note) ? $note + ['source' => 'ai'] : $note,
                ), is_array($entry['notes'] ?? null) ? array_values($entry['notes']) : []);

                usort($notes, fn (Note $a, Note $b) => $a->start <=> $b->start);
                $bars[$no - 1] = new Bar($no, $notes, false);
            }

            // Throws if anything doesn't fit the bars.
            $document->withPart(new Part($part->id, $part->name, $bars));
        } catch (InvalidScoreDocument) {
            return null;
        }

        return array_values(array_map(
            fn (Bar $bar) => $bar->toArray(),
            array_slice($bars, $from - 1, $to - $from + 1),
        ));
    }
}
