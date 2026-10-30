import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SearchIcon, XIcon } from '@/components/icons';
import { Logo } from '@/components/logo';
import { formatBar, keyLabel } from '@/lib/music';
import { cn } from '@/lib/utils';
import type { SongCard as Song } from '@/types';

/** The search box on the public pages: big on the home page, compact in the top bar. */
export function SongSearch({ initial = '', size = 'lg', autoFocus = false }: { initial?: string; size?: 'lg' | 'sm'; autoFocus?: boolean }) {
    const [q, setQ] = useState(initial);
    const large = size === 'lg';

    return (
        <form
            role="search"
            onSubmit={(event) => {
                event.preventDefault();
                router.get('/songs', q.trim() !== '' ? { q: q.trim() } : {});
            }}
            className={cn(
                'flex w-full items-center rounded-full bg-paper shadow-[0_0_0_1.5px_#111111]',
                large ? 'h-16 max-w-180 gap-3 pr-2 pl-5.5 shadow-[0_0_0_1.5px_#111111,0_14px_36px_#0000001A]' : 'h-11.5 max-w-160 gap-2.5 pr-1.5 pl-4',
            )}
        >
            <SearchIcon size={large ? 20 : 17} strokeWidth={1.8} className="text-ink" />
            <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                autoFocus={autoFocus}
                aria-label="Search songs"
                placeholder={large ? 'Song title, composer or first words — “Onyame ye”' : 'Search songs'}
                className={cn('min-w-0 grow bg-transparent text-ink outline-none placeholder:text-[#9A9A94]', large ? 'text-[17px] leading-5.5' : 'text-[15px] leading-5')}
            />
            {q !== '' && !large && (
                <button type="button" onClick={() => setQ('')} aria-label="Clear" className="flex size-6 items-center justify-center text-pencil hover:text-ink">
                    <XIcon />
                </button>
            )}
            <button
                type="submit"
                className={cn(
                    'flex shrink-0 items-center rounded-full bg-marker font-bold text-ink outline-none hover:bg-[#EADF12] focus-visible:ring-2 focus-visible:ring-ink/30',
                    large ? 'h-12 px-5.5 text-[15px] leading-4.5' : 'h-9 px-4 text-[14px] leading-4.5',
                )}
            >
                Search
            </button>
        </form>
    );
}

/** Top bar of every public page: logo, optional search, and the way in for directors. */
export function PublicTopBar({ signedIn, search, children }: { signedIn: boolean; search?: ReactNode; children?: ReactNode }) {
    return (
        <header className="flex h-16 shrink-0 items-center gap-6 border-b border-rule bg-paper px-4 sm:px-10">
            <Link href="/" className="shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ink/20">
                <Logo className="max-sm:[&>span:last-child]:hidden" />
            </Link>
            {search && <div className="flex min-w-0 grow">{search}</div>}
            <div className="ml-auto flex shrink-0 items-center gap-3">
                {children}
                {signedIn ? (
                    <Link href="/dashboard" className="flex h-9.5 items-center rounded-full bg-ink px-4 text-[14px] leading-4.5 font-semibold text-paper hover:bg-ink/90">
                        Your library
                    </Link>
                ) : (
                    <>
                        <Link href="/login" className="hidden text-[14px] leading-4.5 font-semibold text-ink hover:underline sm:block">
                            Sign in
                        </Link>
                        <Link href="/register" className="flex h-9.5 items-center rounded-full bg-ink px-4 text-[14px] leading-4.5 font-semibold text-paper hover:bg-ink/90">
                            Write your own
                        </Link>
                    </>
                )}
            </div>
        </header>
    );
}

/** S A T B chips: black for parts with music, pale for parts the song doesn't have. */
export function VoiceTags({ voices }: { voices: string[] }) {
    return (
        <span className="flex gap-1">
            {['S', 'A', 'T', 'B'].map((voice) => (
                <span
                    key={voice}
                    className={cn(
                        'flex h-5 w-5.5 items-center justify-center rounded-[4px] font-solfa text-[9.5px] leading-3',
                        voices.includes(voice) ? 'bg-ink text-paper' : 'bg-copy text-faint',
                    )}
                >
                    {voice}
                </span>
            ))}
        </span>
    );
}

/** The first bar or two in sol-fa, as on a song card. */
export function FirstBars({ song }: { song: Song }) {
    const first = song.preview[0];

    return (
        <span className="flex flex-col gap-0.75 rounded-[10px] bg-copy px-3 py-2.5">
            <span className="truncate font-solfa text-[13px] leading-4.25 whitespace-pre text-ink">{first ? formatBar(first.notes, first.beats) : '—'}</span>
            {song.first_words && <span className="truncate text-[12.5px] leading-4 text-pencil italic">{song.first_words}</span>}
        </span>
    );
}

/** A song on the home page (Paper W16). */
export function SongCardView({ song }: { song: Song }) {
    return (
        <Link
            href={`/p/${song.slug}`}
            className="group flex min-w-0 flex-col gap-3.5 rounded-lg border border-rule p-4.5 outline-none hover:border-ink focus-visible:ring-2 focus-visible:ring-ink/20"
        >
            <span className="flex items-start justify-between">
                <span className="flex size-9.5 items-center justify-center rounded-[9px] bg-copy font-solfa text-[12.5px] leading-4 text-ink group-hover:bg-marker">
                    {keyLabel(song.doh)}
                </span>
                <span className="flex size-9.5 items-center justify-center rounded-full bg-ink" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 16 16">
                        <path d="M5 3.5 12 8l-7 4.5z" fill="#FFFFFF" />
                    </svg>
                </span>
            </span>
            <span className="flex min-w-0 flex-col gap-0.75">
                <span className="truncate font-display text-[18px] leading-5.5 font-bold tracking-[-0.01em] text-ink">{song.title}</span>
                <span className="truncate text-[13px] leading-4.25 text-pencil">
                    {[song.composer, song.arranger ? `arr. ${song.arranger}` : null, song.style].filter(Boolean).join(' · ')}
                </span>
            </span>
            <FirstBars song={song} />
            <span className="flex items-center justify-between gap-2">
                <VoiceTags voices={song.voices} />
                <span className="truncate text-[12px] leading-4 text-pencil">{song.owner}</span>
            </span>
        </Link>
    );
}

export function PublicFooter() {
    return (
        <footer className="mt-12 flex flex-col justify-between gap-2 border-t border-rule px-4 py-8 sm:flex-row sm:px-20">
            <span className="text-[13px] leading-4 text-pencil">© {new Date().getFullYear()} Sol-fa Studio · Music stays with the people who wrote it.</span>
            <span className="font-solfa text-[13px] leading-4 text-pencil">d r m f s l t</span>
        </footer>
    );
}
