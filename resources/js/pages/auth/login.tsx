import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { AuthLayout } from '@/layouts/auth-layout';

type LoginForm = {
    identifier: string;
    password: string;
    remember: boolean;
};

export default function Login({ status }: { status?: string | null }) {
    const form = useForm<LoginForm>({
        identifier: '',
        password: '',
        remember: false,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.post('/login', {
            onFinish: () => form.reset('password'),
        });
    };

    return (
        <>
            <Head title="Sign in" />

            <AuthLayout>
                <div className="mb-8">
                    <p className="text-[10px] font-semibold tracking-[0.14em] text-pencil uppercase">
                        Welcome back
                    </p>
                    <h1 className="mt-2 font-display text-[40px] leading-[1.02] font-extrabold tracking-[-0.045em] text-ink">
                        Sign in
                    </h1>
                    <p className="mt-3 text-[13px] leading-5 text-pencil">
                        Pick up where you left off.
                    </p>
                </div>

                {status && (
                    <div className="mb-5 rounded-[10px] border border-rule bg-copy px-3.5 py-2.5 text-[12px] text-ink">
                        {status}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <FormField
                        id="identifier"
                        label="Email or phone"
                        value={form.data.identifier}
                        onChange={(value) => form.setData('identifier', value)}
                        error={form.errors.identifier}
                        type="text"
                        inputMode="email"
                        autoComplete="username"
                        autoFocus
                        required
                        placeholder="you@example.com or +233 24 123 4567"
                    />

                    <FormField
                        id="password"
                        label="Password"
                        value={form.data.password}
                        onChange={(value) => form.setData('password', value)}
                        error={form.errors.password}
                        type="password"
                        autoComplete="current-password"
                        required
                        placeholder="Your password"
                    />

                    <div className="flex items-center justify-between pt-1">
                        <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-pencil">
                            <input
                                type="checkbox"
                                checked={form.data.remember}
                                onChange={(event) =>
                                    form.setData(
                                        'remember',
                                        event.target.checked,
                                    )
                                }
                                className="size-4 cursor-pointer rounded-[4px] border-rule accent-ink"
                            />
                            Remember me
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={form.processing}
                        className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink text-[13.5px] font-semibold text-paper outline-none transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {form.processing ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-8 text-center text-[12.5px] text-pencil">
                    New to Sol-fa Studio?{' '}
                    <Link
                        href="/register"
                        className="font-semibold text-ink underline decoration-rule underline-offset-4 transition hover:decoration-ink"
                    >
                        Create an account
                    </Link>
                </p>
            </AuthLayout>
        </>
    );
}
