import React, { useMemo, useState } from 'react';
import { Difficulty, Song, SongEra } from '../types/music';
import { Disc, ExternalLink, Filter, Music, Search, Star, X } from 'lucide-react';

interface SongLibraryDrawerProps {
  open: boolean;
  songs: Song[];
  loadingExpanded?: boolean;
  activeSongId: string;
  onClose: () => void;
  onSelectSong: (song: Song) => void;
}

type EraFilter = 'All' | 'Featured' | SongEra;

const ERA_TABS: Array<{ id: EraFilter; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Featured', label: '★ Featured' },
  { id: 'Retro Classics', label: 'Retro (40s–70s)' },
  { id: '90s Golden Era', label: '80s–90s Era' },
  { id: 'Modern Bollywood', label: '2000s–Modern' },
  { id: 'Devotional & Tunes', label: 'Devotional & Tunes' },
];

const DIFFICULTIES: Array<'All' | Difficulty> = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const POPULAR_RAGAS = ['Pahadi', 'Yaman', 'Bhimpalasi', 'Bhairavi', 'Shivranjani', 'Khamaj'];

const PAGE_SIZE = 36;

export const SongLibraryDrawer: React.FC<SongLibraryDrawerProps> = ({
  open,
  songs,
  loadingExpanded = false,
  activeSongId,
  onClose,
  onSelectSong,
}) => {
  const [selectedEra, setSelectedEra] = useState<EraFilter>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | Difficulty>('All');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const eraCounts = useMemo(() => {
    const counts: Record<EraFilter, number> = {
      All: songs.length,
      Featured: 0,
      'Retro Classics': 0,
      '90s Golden Era': 0,
      'Modern Bollywood': 0,
      'Devotional & Tunes': 0,
    };
    for (const s of songs) {
      if (s.featured) counts.Featured++;
      counts[s.era] = (counts[s.era] || 0) + 1;
    }
    return counts;
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs.filter((s) => {
      if (selectedEra === 'Featured' && !s.featured) return false;
      if (selectedEra !== 'All' && selectedEra !== 'Featured' && s.era !== selectedEra) return false;
      if (selectedDifficulty !== 'All' && s.difficulty !== selectedDifficulty) return false;
      if (q) {
        const hay =
          `${s.title} ${s.movie} ${s.year} ${s.composer} ${s.singers} ${s.scale.name} ${s.raga}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [songs, selectedEra, selectedDifficulty, query]);

  const displayedSongs = useMemo(
    () => filteredSongs.slice(0, visibleCount),
    [filteredSongs, visibleCount]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="relative z-10 w-full max-w-lg h-full bg-[#161513] border-r border-[#d4a373]/25 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#d4a373]/15 border border-[#d4a373]/40 flex items-center justify-center text-[#d4a373]">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#f8f9fa]">
                  Bollywood &amp; Sargam Library
                </h2>
                <span className="px-1.5 py-0.5 rounded-full bg-[#2a9d8f]/20 border border-[#2a9d8f]/45 text-[10px] font-mono-tech font-semibold text-[#72efdd]">
                  {songs.length} songs
                </span>
              </div>
              <p className="text-[11px] text-[#a69f95]">
                Showing {filteredSongs.length} melodies
                {loadingExpanded ? ' · Loading full archive...' : ' · Reference: notesandsargam.com'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a69f95] hover:text-[#f8f9fa] hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close library"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-5 py-3 space-y-2.5 border-b border-white/8 bg-[#191715]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#a69f95] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Search title, singer (Kishore, Arijit), composer, Raag, or scale..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#121212] border border-white/10 focus:border-[#d4a373]/60 focus:outline-none text-xs text-[#f8f9fa] placeholder:text-[#a69f95]/60"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a69f95] hover:text-[#f8f9fa] cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Era Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {ERA_TABS.map((tab) => {
              const active = selectedEra === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedEra(tab.id);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    active
                      ? 'bg-[#d4a373] text-[#121212] font-semibold'
                      : 'bg-[#22201d] text-[#d0c8be] hover:bg-[#2a2723]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] font-mono-tech ${
                      active ? 'text-[#121212]/75' : 'text-[#a69f95]'
                    }`}
                  >
                    {eraCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Difficulty + Popular Raag Quick Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#a69f95] mr-0.5" />
              {DIFFICULTIES.map((diff) => {
                const active = selectedDifficulty === diff;
                return (
                  <button
                    key={diff}
                    onClick={() => {
                      setSelectedDifficulty(diff);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#2a9d8f]/25 border-[#2a9d8f] text-[#72efdd]'
                        : 'bg-[#121212] border-white/10 text-[#a69f95] hover:text-[#f8f9fa]'
                    }`}
                  >
                    {diff}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <span className="text-[10px] text-[#a69f95] shrink-0 mr-0.5">Raag:</span>
            {POPULAR_RAGAS.map((raag) => {
              const isMatched = query.toLowerCase() === raag.toLowerCase();
              return (
                <button
                  key={raag}
                  onClick={() => {
                    setQuery(isMatched ? '' : raag);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors cursor-pointer shrink-0 ${
                    isMatched
                      ? 'bg-[#e9c46a]/20 border-[#e9c46a] text-[#e9c46a] font-medium'
                      : 'bg-[#141311] border-white/8 text-[#b5aea5] hover:border-[#d4a373]/40 hover:text-[#f8f9fa]'
                  }`}
                >
                  {raag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Song List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {displayedSongs.length === 0 && (
            <div className="text-center py-12 text-xs text-[#a69f95]">
              No songs match your filter. Try clearing the search or era selection.
            </div>
          )}

          {displayedSongs.map((song) => {
            const isActive = song.id === activeSongId;
            return (
              <div
                key={song.id}
                onClick={() => {
                  onSelectSong(song);
                  onClose();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSong(song);
                    onClose();
                  }
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-[#2a9d8f]/15 border-[#2a9d8f] shadow-[0_0_18px_rgba(42,157,143,0.18)]'
                    : 'bg-[#1d1b18] border-white/8 hover:border-[#d4a373]/45 hover:bg-[#221f1c]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3
                        className={`text-sm font-semibold truncate ${
                          isActive ? 'text-[#72efdd]' : 'text-[#f8f9fa] group-hover:text-[#e9c46a]'
                        }`}
                      >
                        {song.title}
                      </h3>
                      {song.featured && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-[1px] rounded bg-[#d4a373]/20 border border-[#d4a373]/45 text-[9px] font-semibold text-[#e9c46a]">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Studio
                        </span>
                      )}
                      {isActive && (
                        <span className="px-1.5 py-[1px] rounded bg-[#2a9d8f] text-[#f8f9fa] text-[9px] uppercase font-bold tracking-wider">
                          Playing
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#a69f95] mt-0.5 truncate">
                      {song.movie} ({song.year}) · {song.singers}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 border ${
                      song.difficulty === 'Beginner'
                        ? 'bg-[#2a9d8f]/15 border-[#2a9d8f]/45 text-[#72efdd]'
                        : song.difficulty === 'Intermediate'
                        ? 'bg-[#d4a373]/15 border-[#d4a373]/45 text-[#e9c46a]'
                        : 'bg-[#f4a261]/15 border-[#f4a261]/50 text-[#f4a261]'
                    }`}
                  >
                    {song.difficulty}
                  </span>
                </div>

                {/* Metadata Footer Pills */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-white/6">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#26211a] border border-[#d4a373]/30 text-[10px] font-medium text-[#e9c46a]">
                      <Disc className="w-2.5 h-2.5" />
                      {song.scale.name} ({song.scale.rootNote})
                    </span>
                    {song.raga && song.raga !== 'Hindustani Sargam' && (
                      <span className="px-2 py-0.5 rounded-md bg-[#2a9d8f]/12 border border-[#2a9d8f]/30 text-[10px] text-[#72efdd]">
                        Raag {song.raga}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-[#a69f95]">
                      {song.bpm} BPM · {song.notes.length} notes
                    </span>
                  </div>

                  {song.sourceUrl && (
                    <a
                      href={song.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 text-[9px] text-[#a69f95]/75 hover:text-[#e9c46a] transition-colors"
                      title="Open original Sargam reference on notesandsargam.com"
                    >
                      <span>Ref</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {/* Load More Pagination Button for smooth 470+ song browsing */}
          {visibleCount < filteredSongs.length && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full py-2.5 rounded-xl bg-[#22201d] hover:bg-[#2a2723] border border-[#d4a373]/30 text-xs font-semibold text-[#e9c46a] transition-colors cursor-pointer"
            >
              Load more songs ({filteredSongs.length - visibleCount} remaining)
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};
