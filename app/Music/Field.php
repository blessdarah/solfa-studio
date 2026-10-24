<?php

namespace App\Music;

use BackedEnum;

/**
 * Typed reads from decoded JSON. Each method names the path it failed on,
 * so a bad document points straight at the broken note or mark.
 *
 * @internal
 */
final class Field
{
    /**
     * @return array<string, mixed>
     */
    public static function object(mixed $value, string $path): array
    {
        if (! is_array($value) || ($value !== [] && array_is_list($value))) {
            throw InvalidScoreDocument::at($path, 'expected an object');
        }

        /** @var array<string, mixed> $value */
        return $value;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<mixed>
     */
    public static function list(array $data, string $key, string $path, bool $optional = false): array
    {
        $value = $data[$key] ?? null;

        if ($value === null && $optional) {
            return [];
        }

        if (! is_array($value) || ! array_is_list($value)) {
            throw InvalidScoreDocument::at(self::join($path, $key), 'expected a list');
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function int(array $data, string $key, string $path, ?int $min = null, ?int $max = null): int
    {
        $value = $data[$key] ?? null;

        if (! is_int($value)) {
            throw InvalidScoreDocument::at(self::join($path, $key), 'expected a whole number');
        }

        self::range($value, $min, $max, self::join($path, $key));

        return $value;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function optionalInt(array $data, string $key, string $path, ?int $min = null, ?int $max = null): ?int
    {
        return ($data[$key] ?? null) === null ? null : self::int($data, $key, $path, $min, $max);
    }

    /**
     * Beats are numbers that may be fractional (a half beat is 0.5).
     *
     * @param  array<string, mixed>  $data
     */
    public static function number(array $data, string $key, string $path, ?float $min = null, ?float $max = null): float
    {
        $value = $data[$key] ?? null;

        if (! is_int($value) && ! is_float($value)) {
            throw InvalidScoreDocument::at(self::join($path, $key), 'expected a number');
        }

        self::range((float) $value, $min, $max, self::join($path, $key));

        return (float) $value;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function string(array $data, string $key, string $path, bool $allowEmpty = false): string
    {
        $value = $data[$key] ?? null;

        if (! is_string($value) || (! $allowEmpty && trim($value) === '')) {
            throw InvalidScoreDocument::at(self::join($path, $key), 'expected text');
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function optionalString(array $data, string $key, string $path): ?string
    {
        return ($data[$key] ?? null) === null ? null : self::string($data, $key, $path);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function bool(array $data, string $key, string $path, bool $default = false): bool
    {
        $value = $data[$key] ?? $default;

        if (! is_bool($value)) {
            throw InvalidScoreDocument::at(self::join($path, $key), 'expected true or false');
        }

        return $value;
    }

    /**
     * @template T of BackedEnum
     *
     * @param  array<string, mixed>  $data
     * @param  class-string<T>  $enum
     * @return T
     */
    public static function enum(array $data, string $key, string $path, string $enum, ?BackedEnum $default = null): BackedEnum
    {
        $value = $data[$key] ?? null;

        if ($value === null && $default instanceof $enum) {
            return $default;
        }

        $case = (is_string($value) || is_int($value)) ? $enum::tryFrom($value) : null;

        if ($case === null) {
            $allowed = implode(', ', array_map(fn (BackedEnum $c) => (string) $c->value, $enum::cases()));

            throw InvalidScoreDocument::at(self::join($path, $key), "expected one of: {$allowed}");
        }

        return $case;
    }

    public static function join(string $path, string|int $key): string
    {
        return $path === '' ? (string) $key : "{$path}.{$key}";
    }

    private static function range(int|float $value, int|float|null $min, int|float|null $max, string $path): void
    {
        if ($min !== null && $value < $min) {
            throw InvalidScoreDocument::at($path, "must be at least {$min}");
        }

        if ($max !== null && $value > $max) {
            throw InvalidScoreDocument::at($path, "must be at most {$max}");
        }
    }
}
