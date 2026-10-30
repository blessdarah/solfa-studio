import { Head, Link } from '@inertiajs/react';
import { PublicFooter, PublicTopBar, SongCardView, SongSearch } from '@/components/public/public-chrome';
import { ArrowRightIcon } from '@/components/icons';
import { formatBar } from '@/lib/music';
import { cn } from '@/lib/utils';
import type { PublicHomeProps } from '@/types';

const TRY = ['Hallelujah', 'Christmas', 'Hymn', 'Highlife', 'Amen'];

/**
 * The public home page (Paper W16): search for a song, browse by style,
 * newly published songs — no account needed.
 */
export default function PublicHome({ songs, styles, total, signed_in }: PublicHomeProps) {
    return (
        <>
            <Head title="Find a song in sol-fa" />

            <div className="flex min-h-screen flex-col bg-paper">
                <PublicTopBar signedIn={signed_in} />

                <section className="flex flex-col items-center gap-5.5 bg-copy px-4 pt-14 pb-11 sm:px-10">
                    <div className="font-solfa text-[13px] leading-4 tracking-[0.3em] text-pencil">d r m f s l t d'</div>
                    <h1 className="max-w-225 text-center font-display text-[40px] leading-11 font-extrabold tracking-[-0.035em] text-ink sm:text-[64px] sm:leading-16.5">
                        Find a song. Sing your part.
                    </h1>
                    <p className="max-w-150 text-center text-[16px] leading-6 text-pencil sm:text-[17px] sm:leading-6.25">
                        Choir music in tonic sol-fa, free to read, play and print. Pick your part and practise along — no account needed.
                    </p>
                    <SongSearch autoFocus />
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="text-[13px] leading-4 text-pencil">Try</span>
                        {TRY.map((term) => (
                            <Link
                                key={term}
                                href={`/songs?q=${encodeURIComponent(term)}`}
                                className="flex h-7.5 items-center rounded-full border border-rule bg-paper px-3 text-[13px] leading-4 text-ink hover:border-ink"
                            >
                                {term}
                            </Link>
                        ))}
                    </div>
                </section>

                {styles.length > 0 && (
                    <section className="flex flex-col gap-4.5 px-4 pt-10 sm:px-20">
                        <h2 className="font-display text-[22px] leading-6.5 font-extrabold tracking-[-0.02em] text-ink">Browse by style</h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            {styles.map((style, i) => (
                                <Link
                                    key={style.name}
                                    href={`/songs?style=${encodeURIComponent(style.name)}`}
                                    className={cn(
                                        'flex h-24 flex-col justify-between rounded-[14px] p-4 outline-none hover:ring-[1.5px] hover:ring-ink focus-visible:ring-2 focus-visible:ring-ink/30',
                                        i === 0 ? 'bg-ink' : i === 1 ? 'bg-marker' : 'bg-copy',
                                    )}
                                >
                                    <span className={cn('truncate font-solfa text-[12px] leading-3.5 whitespace-pre', i === 0 ? 'text-marker' : i === 1 ? 'text-ink' : 'text-pencil')}>
                                        {style.sample ? formatBar(style.sample.notes, style.sample.beats) : ''}
                                    </span>
                                    <span className="flex items-end justify-between gap-2">
                                        <span className={cn('truncate text-[15px] leading-4.5 font-semibold', i === 0 ? 'text-paper' : 'text-ink')}>{style.name}</span>
                                        <span className={cn('text-[12px] leading-3.5', i === 0 ? 'text-paper/50' : i === 1 ? 'text-ink/50' : 'text-pencil')}>{style.count}</span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                <section className="flex flex-col gap-4.5 px-4 pt-8 sm:px-20">
                    <div className="flex items-end justify-between">
                        <h2 className="font-display text-[22px] leading-6.5 font-extrabold tracking-[-0.02em] text-ink">Newly published</h2>
                        {total > songs.length && (
                            <Link href="/songs" className="flex items-center gap-1.5 text-[14px] leading-4.5 font-semibold text-ink hover:underline">
                                See all {total} songs <ArrowRightIcon />
                            </Link>
                        )}
                    </div>
                    {songs.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {songs.map((song) => (
                                <SongCardView key={song.slug} song={song} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-rule px-6 py-10 text-center text-[14px] leading-5 text-pencil">
                            No songs published yet. Choir directors: write a score and press Publish to put it here.
                        </div>
                    )}
                </section>

                <section className="mx-4 mt-10 flex flex-col items-start justify-between gap-5 rounded-lg bg-ink px-6 py-8 sm:mx-20 sm:flex-row sm:items-center sm:px-9">
                    <div className="flex flex-col gap-2">
                        <h2 className="font-display text-[26px] leading-8 font-extrabold tracking-[-0.02em] text-paper sm:text-[28px]">Lead a choir? Put your music here.</h2>
                        <p className="max-w-140 text-[15px] leading-5.5 text-paper/70">
                            Write or scan your scores in sol-fa, then publish them. Your singers open one link, pick their part and practise at home.
                        </p>
                    </div>
                    <Link
                        href={signed_in ? '/dashboard' : '/register'}
                        className="flex h-12 shrink-0 items-center rounded-full bg-marker px-5.5 text-[15px] leading-4.5 font-bold text-ink hover:bg-[#EADF12]"
                    >
                        {signed_in ? 'Go to your library' : 'Start free'}
                    </Link>
                </section>

                <PublicFooter />
            </div>
        </>
    );
}
