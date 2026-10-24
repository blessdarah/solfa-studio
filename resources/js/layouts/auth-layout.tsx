import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

export function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
            <aside className="relative hidden overflow-hidden border-r border-rule bg-copy lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
                <Logo />

                <div className="relative z-10 max-w-[430px]">
                    <div className="mb-7 h-1.5 w-16 rounded-full bg-marker" />
                    <p className="font-display text-[52px] leading-[0.96] font-extrabold tracking-[-0.05em] text-ink xl:text-[60px]">
                        Write what
                        <br />
                        you hear.
                    </p>
                    <p className="mt-6 max-w-[330px] text-[13.5px] leading-6 text-pencil">
                        A quiet workbench for sol-fa scores — transcribe,
                        correct, and share with your choir.
                    </p>
                    <div className="mt-10 flex items-center gap-3 font-solfa text-[13px] tracking-[0.3em] text-ink/70">
                        <span>d</span>
                        <span>r</span>
                        <span>m</span>
                        <span>f</span>
                        <span>s</span>
                        <span>l</span>
                        <span>t</span>
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-between text-[9.5px] font-medium tracking-[0.16em] text-pencil uppercase">
                    <span>Darah-B Studios</span>
                    <span>2026</span>
                </div>

                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -bottom-32 font-display text-[360px] leading-none font-extrabold text-ink/[0.035] select-none"
                >
                    d
                </span>
            </aside>

            <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
                <div className="w-full max-w-[400px]">
                    <div className="mb-12 lg:hidden">
                        <Logo />
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
}
