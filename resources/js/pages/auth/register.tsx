import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { AuthLayout } from '@/layouts/auth-layout';

type RegisterForm = {
    name: string;
    identifier: string;
    password: string;
    password_confirmation: string;
};

export default function Register() {
    const form = useForm<RegisterForm>({
        name: '',
        identifier: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.post('/register', {
            onFinish: () => form.reset('password', 'password_confirmation'),
        });
    };

    return (
        <>
            <Head title="Create an account" />

            <AuthLayout>
                <div className="mb-8">
                    <p className="text-[10px] font-semibold tracking-[0.14em] text-pencil uppercase">
                        Start your library
                    </p>
                    <h1 className="mt-2 font-display text-[38px] leading-[1.02] font-extrabold tracking-[-0.045em] text-ink">
                        Create an account
                    </h1>
                    <p className="mt-3 text-[13px] leading-5 text-pencil">
                        One quiet place for every score you write.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <FormField
                        id="name"
                        label="Your name"
                        value={form.data.name}
                        onChange={(value) => form.setData('name', value)}
                        error={form.errors.name}
                        type="text"
                        autoComplete="name"
                        autoFocus
                        required
                        placeholder="Blessdaraah"
                    />

                    <FormField
                        id="identifier"
                        label="Email or phone"
                        value={form.data.identifier}
                        onChange={(value) => form.setData('identifier', value)}
                        error={form.errors.identifier}
                        type="text"
                        autoComplete="username"
                        required
                        placeholder="you@example.com or +233 24 123 4567"
                        hint="Use whichever your choir knows you by."
                    />

                    <FormField
                        id="password"
                        label="Password"
                        value={form.data.password}
                        onChange={(value) => form.setData('password', value)}
                        error={form.errors.password}
                        type="password"
                        autoComplete="new-password"
                        required
                        placeholder="At least 8 characters"
                    />

                    <FormField
                        id="password_confirmation"
                        label="Confirm password"
                        value={form.data.password_confirmation}
                        onChange={(value) =>
                            form.setData('password_confirmation', value)
                        }
                        type="password"
                        autoComplete="new-password"
                        required
                        placeholder="Repeat your password"
                    />

                    <button
                        type="submit"
                        disabled={form.processing}
                        className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink text-[13.5px] font-semibold text-paper outline-none transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {form.processing
                            ? 'Creating your account…'
                            : 'Create account'}
                    </button>
                </form>

                <p className="mt-8 text-center text-[12.5px] text-pencil">
                    Already have an account?{' '}
                    <Link
                        href="/login"
                        className="font-semibold text-ink underline decoration-rule underline-offset-4 transition hover:decoration-ink"
                    >
                        Sign in
                    </Link>
                </p>
            </AuthLayout>
        </>
    );
}
