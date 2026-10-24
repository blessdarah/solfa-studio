import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { AvatarMenu } from '@/components/avatar-menu';
import { Logo } from '@/components/logo';
import { PlusIcon, SearchIcon } from '@/components/icons';
import type { User } from '@/types';

type TopBarProps = {
    user: User;
    breadcrumb?: ReactNode;
    search?: {
        value: string;
        onChange: (value: string) => void;
    };
    onNewScore?: () => void;
};

export function TopBar({
    user,
    breadcrumb,
    search,
    onNewScore,
}: TopBarProps) {
    return (
        <header className="sticky top-0 z-40 h-[60px] border-b border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
            <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-4">
                    <Link
                        href="/dashboard"
                        aria-label="Sol-fa Studio — your scores"
                        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
                    >
                        <Logo />
                    </Link>

                    <div className="hidden h-4 items-center gap-2 text-[12px] font-medium text-pencil sm:flex">
                        <span className="h-3.5 w-px bg-rule" />
                        {breadcrumb ?? 'Library'}
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {search && (
                        <label className="relative hidden w-[250px] md:block xl:w-[280px]">
                            <span className="sr-only">Search scores</span>
                            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-pencil" />
                            <input
                                id="score-search"
                                data-score-search
                                value={search.value}
                                onChange={(event) =>
                                    search.onChange(event.target.value)
                                }
                                placeholder="Search scores"
                                autoComplete="off"
                                className="h-9 w-full rounded-full border border-transparent bg-copy pr-12 pl-9 text-[12.5px] text-ink outline-none transition placeholder:text-pencil/70 focus:border-rule focus:bg-paper"
                            />
                            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-[5px] border border-rule bg-paper px-1.5 py-0.5 font-solfa text-[9.5px] text-pencil">
                                ⌘K
                            </span>
                        </label>
                    )}

                    {onNewScore && (
                        <button
                            type="button"
                            onClick={onNewScore}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3 text-[12.5px] font-semibold text-paper outline-none transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-2 sm:px-4"
                        >
                            <PlusIcon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">New score</span>
                            <span className="sr-only sm:hidden">New score</span>
                        </button>
                    )}

                    <AvatarMenu user={user} />
                </div>
            </div>
        </header>
    );
}
