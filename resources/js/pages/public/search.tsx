import { Head, Link } from '@inertiajs/react';
import { PublicFooter, PublicTopBar, SongSearch, VoiceTags } from '@/components/public/public-chrome';
import { keyLabel } from '@/lib/music';
import { cn } from '@/lib/utils';
import type { PublicSearchProps, SearchMatch } from '@/types';

const VOICE_FILTERS: PublicSearchProps['filters']['voices'][] = ['any', 'SATB', 'SA', 'TB'];

function url(filters: PublicSearchProps['filters']): string {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.voices !== 'any') params.set('voices', filters.voices);
    if (filters.style) params.set('style', filters.style);
    const string = params.toString();

    return string ? `/songs?${string}` : '/songs';
}

/** Why a song came up: the title, the composer, or the words of a verse with the match marked. */
function MatchLine({ match }: { match: SearchMatch | null }) {
    if (!match || match.in === 'title') return null;

    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-[11px] leading-3.5 font-semibold tracking-[0.06em] text-pencil uppercase">{match.in}</span>
            <span className="truncate text-[13.5px] leading-4.5 text-pencil italic">
                {match.before}
                {match.match && <mark className="rounded-[3px] bg-marker px-0.75 text-ink">{match.match}</mark>}
                {match.after}
            </span>
        </span>
    );
}

/**
 * Search results (Paper W17): every word must match a title, a composer or
 * the words of a verse; filter by voices and style.
 */
export default function PublicSearch({ results, total, styles, filters, signed_in }: PublicSearchProps) {
    const heading = filters.q ? `“${filters.q}”` : filters.style ? filters.style : 'All songs';

    return (
        <>
            <Head title={filters.q ? `${filters.q} · Songs` : 'Songs'} />

            <div className="flex min-h-screen flex-col bg-paper">
                <PublicTopBar signedIn={signed_in} search={<SongSearch key={filters.q} initial={filters.q} size="sm" />} />

                <div className="flex flex-col gap-8 px-4 pt-8 sm:px-10 lg:flex-row lg:gap-10">
                    <aside className="flex shrink-0 flex-col gap-5.5 lg:w-55">
                        <div className="flex flex-col gap-2">
                            <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">VOICES</div>
                            <div className="flex flex-wrap gap-1.5">
                                {VOICE_FILTERS.map((voices) => (
                                    <Link
                                        key={voices}
                                        href={url({ ...filters, voices })}
                                        preserveScroll
                                        className={cn(
                                            'flex h-7.5 items-center rounded-full px-3 text-[12.5px] leading-4',
                                            filters.voices === voices ? 'bg-ink font-semibold text-paper' : 'border border-rule font-solfa text-ink hover:border-ink',
                                        )}
                                    >
                                        {voices === 'any' ? 'Any' : voices}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {styles.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <div className="pb-1 text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">STYLE</div>
                                {styles.map((style) => {
                                    const on = filters.style.toLowerCase() === style.name.toLowerCase();

                                    return (
                                        <Link
                                            key={style.name}
                                            href={url({ ...filters, style: on ? '' : style.name })}
                                            preserveScroll
                                            className="flex h-7.5 items-center justify-between gap-2 rounded-[6px] hover:bg-copy/60"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className={cn(
                                                        'flex size-4 items-center justify-center rounded-[4px] text-[10px] leading-3',
                                                        on ? 'bg-ink text-paper' : 'border-[1.5px] border-rule',
                                                    )}
                                                >
                                                    {on ? '✓' : ''}
                                                </span>
                                                <span className="text-[13.5px] leading-4.25 text-ink">{style.name}</span>
                                            </span>
                                            <span className="text-[12px] leading-3.5 text-pencil">{style.count}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}

                        <div className="hidden flex-col gap-1.5 lg:flex">
                            <div className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-pencil">MATCH IN</div>
                            <div className="text-[13.5px] leading-4.25 text-ink">Titles · Composers · Words</div>
                            <div className="text-[12px] leading-4.25 text-pencil">Words match anywhere in a verse, so you can search by the line you remember.</div>
                        </div>
                    </aside>

                    <main className="flex min-w-0 grow flex-col">
                        <div className="flex items-end justify-between border-b border-rule pb-3.5">
                            <h1 className="text-[15px] leading-5 text-ink">
                                <span className="font-bold">
                                    {total} {total === 1 ? 'song' : 'songs'}
                                </span>{' '}
                                {filters.q || filters.style ? `for ${heading}` : ''}
                            </h1>
                        </div>

                        {results.map((song) => (
                            <Link
                                key={song.slug}
                                href={`/p/${song.slug}`}
                                className="group flex items-center gap-4.5 border-b border-rule py-4.5 outline-none hover:bg-copy/40 focus-visible:bg-copy/60"
                            >
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-copy font-solfa text-[13px] leading-4 text-ink group-hover:bg-marker">
                                    {keyLabel(song.doh)}
                                </span>
                                <span className="flex min-w-0 grow flex-col gap-1.5">
                                    <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
                                        <span className="truncate font-display text-[18px] leading-5.5 font-bold tracking-[-0.01em] text-ink">{song.title}</span>
                                        <span className="truncate text-[13px] leading-4.25 text-pencil">
                                            {[song.composer, song.arranger ? `arr. ${song.arranger}` : null, song.style, song.owner].filter(Boolean).join(' · ')}
                                        </span>
                                    </span>
                                    <MatchLine match={song.match} />
                                </span>
                                <span className="hidden sm:flex">
                                    <VoiceTags voices={song.voices} />
                                </span>
                                <span className="flex h-10 shrink-0 items-center rounded-full bg-ink px-4 text-[13.5px] leading-4.5 font-semibold text-paper">Open</span>
                            </Link>
                        ))}

                        {results.length === 0 && (
                            <div className="flex flex-col items-start gap-2 py-10">
                                <div className="text-[15px] leading-5 font-semibold text-ink">No songs found</div>
                                <div className="text-[13.5px] leading-5 text-pencil">Try fewer words, or a line from the song as you remember it.</div>
                            </div>
                        )}
                    </main>
                </div>

                <PublicFooter />
            </div>
        </>
    );
}
