<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'identifier' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'identifier' => 'email or phone',
        ];
    }

    /**
     * Try to sign the person in with either an email or a phone number.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        [$field, $value] = $this->credentials();

        $authenticated = Auth::attempt(
            [$field => $value, 'password' => (string) $this->input('password')],
            $this->boolean('remember'),
        );

        if (! $authenticated) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'identifier' => __('These credentials do not match our records.'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * The column and value the identifier points at.
     *
     * @return array{0: string, 1: string}
     */
    private function credentials(): array
    {
        $identifier = trim((string) $this->input('identifier'));

        if (filter_var($identifier, FILTER_VALIDATE_EMAIL) !== false) {
            return ['email', Str::lower($identifier)];
        }

        return ['phone', $this->normalisePhone($identifier)];
    }

    private function normalisePhone(string $phone): string
    {
        return preg_replace('/[\s\-().]/', '', $phone) ?? $phone;
    }

    /**
     * @throws ValidationException
     */
    private function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'identifier' => __('Too many login attempts. Try again in :seconds seconds.', ['seconds' => $seconds]),
        ]);
    }

    private function throttleKey(): string
    {
        $identifier = Str::lower(trim((string) $this->input('identifier')));

        return Str::transliterate($identifier.'|'.$this->ip());
    }
}
