<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class RegisterRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:80'],
            'identifier' => ['required', 'string', 'max:255'],
            'password' => ['required', 'confirmed', Password::defaults()],
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

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name')),
            'identifier' => trim((string) $this->input('identifier')),
        ]);
    }

    /**
     * Check the identifier's shape, then make sure it is still free.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $identifier = (string) $this->input('identifier');

            if ($identifier === '') {
                return;
            }

            $field = $this->identifierField();
            $value = $this->identifierValue();

            if ($field === 'phone' && preg_match('/^\+?\d{7,15}$/', $value) !== 1) {
                $validator->errors()->add('identifier', 'Enter a valid email address or phone number.');

                return;
            }

            if (User::query()->where($field, $value)->exists()) {
                $validator->errors()->add(
                    'identifier',
                    $field === 'email'
                        ? 'That email is already registered.'
                        : 'That phone number is already registered.',
                );
            }
        });
    }

    public function identifierField(): string
    {
        $identifier = trim((string) $this->input('identifier'));

        return filter_var($identifier, FILTER_VALIDATE_EMAIL) !== false ? 'email' : 'phone';
    }

    public function identifierValue(): string
    {
        $identifier = trim((string) $this->input('identifier'));

        return $this->identifierField() === 'email'
            ? Str::lower($identifier)
            : $this->normalisePhone($identifier);
    }

    private function normalisePhone(string $phone): string
    {
        return preg_replace('/[\s\-().]/', '', $phone) ?? $phone;
    }
}
