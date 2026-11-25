import React, { useState } from 'react';
import { InstrumentType, Song } from '../types/music';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Music,
  PlayCircle,
  Radio,
  X,
} from 'lucide-react';

interface YouTubeReferenceCardProps {
  open: boolean;
  song: Song;
  instrument: InstrumentType;
  baseBpm: number;
  isCustomBpm: boolean;
  onClose: () => void;
}

const INSTRUMENT_QUERY: Record<InstrumentType, { label: string; query: string }> = {
  bansuri: { label: 'Bansuri Cover', query: 'bansuri flute cover' },
  saxophone: { label: 'Saxophone Cover', query: 'saxophone instrumental cover' },
  harmonica: { label: 'Mouth Organ Cover', query: 'mouth organ chromatic harmonica cover' },
  ewi: { label: 'EWI Cover', query: 'ewi electronic wind instrument cover' },
};

export const YouTubeReferenceCard: React.FC<YouTubeReferenceCardProps> = ({
  open,
  song,
  instrument,
  baseBpm,
  isCustomBpm,
  onClose,
}) => {
  const [minimized, setMinimized] = useState(false);

  if (!open) return null;

  const activeInst = INSTRUMENT_QUERY[instrument] ?? INSTRUMENT_QUERY.bansuri;
  const searchBase = `${song.title} ${song.movie}`.trim();

  const buildSearchUrl = (suffix: string) =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(`${searchBase} ${suffix}`)}`;

  return (
    <aside
      className="fixed bottom-16 inset-x-3 sm:inset-x-auto sm:bottom-20 sm:right-4 z-[100] sm:w-[356px] rounded-[4px] bg-[#11100f] border border-[#2b2723] shadow-2xl overflow-hidden"
      aria-label="YouTube Reference Rendition"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#161513] border-b border-[#262320]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#e05a33] shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-semibold text-[#f2ede4] truncate">
                YouTube Reference
              </span>
              <span
                className={`px-1.5 py-[1px] rounded-[2px] text-[9px] font-mono-tech border shrink-0 ${
                  isCustomBpm
                    ? 'bg-[#251b14] border-[#e05a33]/65 text-[#f4a261]'
                    : 'bg-[#12221e] border-[#3ca38f]/50 text-[#5eead4]'
                }`}
              >
                {baseBpm} BPM · {song.tala === 'dadra' ? '6/8' : '4/4'}
              </span>
            </div>
            <p className="text-[10px] font-mono-tech text-[#8a8278] truncate">
              {song.title} · {song.scale.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setMinimized((v) => !v)}
            className="p-1 rounded-lg text-[#a69f95] hover:text-[#f8f9fa] hover:bg-white/10 transition-colors cursor-pointer"
            title={minimized ? 'Expand player' : 'Minimize player'}
          >
            {minimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#a69f95] hover:text-[#f8f9fa] hover:bg-white/10 transition-colors cursor-pointer"
            title="Close YouTube Reference"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {!minimized && (
        <div className="p-3 space-y-2.5">
          {song.youtubeId ? (
            <div className="space-y-1.5">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
                <iframe
                  key={song.youtubeId}
                  src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}?rel=0&modestbranding=1`}
                  title={song.youtubeTitle || `${song.title} Reference Rendition`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-[#a69f95]">
                <span className="truncate">
                  {song.youtubeTitle || `${song.title} — Reference Rendition`}
                </span>
                <a
                  href={`https://www.youtube.com/watch?v=${song.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#d4a373] hover:text-[#e9c46a] shrink-0"
                >
                  <span>Watch</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#131210] border border-white/8 p-3 text-center space-y-1.5">
              <Radio className="w-5 h-5 text-[#d4a373] mx-auto opacity-80" />
              <p className="text-[11px] text-[#d0c8be] font-medium">
                Open a live rendition on YouTube to compare phrasing &amp; feel
              </p>
              <p className="text-[10px] text-[#8d867d]">
                Use the <span className="text-[#e9c46a] font-semibold">Tap</span> tempo button in the
                bottom bar to lock the highway to any cover.
              </p>
            </div>
          )}

          {/* Pro Tip Banner */}
          <div className="px-2.5 py-1.5 rounded-lg bg-[#2a9d8f]/10 border border-[#2a9d8f]/25 text-[10px] text-[#a8e6dc] leading-snug">
            <strong className="text-[#72efdd]">Live Sync Tip:</strong> Play the reference audio and
            tap <span className="font-mono-tech text-[#e9c46a] font-semibold">Tap</span> on the
            bottom bar 4 times to match any YouTube cover&apos;s exact BPM.
          </div>

          {/* 1-Click Instrument-Specific & Original Song Launchers */}
          <div className="grid grid-cols-2 gap-1.5">
            <a
              href={buildSearchUrl(activeInst.query)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2a9d8f]/20 hover:bg-[#2a9d8f]/30 border border-[#2a9d8f]/45 text-[11px] font-medium text-[#72efdd] transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{activeInst.label}</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-75" />
            </a>
            <a
              href={buildSearchUrl('original song audio')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#22201d] hover:bg-[#2b2824] border border-white/10 text-[11px] font-medium text-[#e6dfd7] transition-colors"
            >
              <Music className="w-3.5 h-3.5 text-[#d4a373] shrink-0" />
              <span className="truncate">Original Song</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
            </a>
          </div>

          {/* Quick switches for other instrument covers + source notation */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/8 text-[10px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['bansuri', 'saxophone', 'harmonica', 'ewi'] as InstrumentType[])
                .filter((id) => id !== instrument)
                .map((id) => (
                  <a
                    key={id}
                    href={buildSearchUrl(INSTRUMENT_QUERY[id].query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/10 text-[#a69f95] hover:text-[#f8f9fa] transition-colors"
                  >
                    {INSTRUMENT_QUERY[id].label}
                  </a>
                ))}
            </div>
            {song.sourceUrl && (
              <a
                href={song.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d4a373] hover:text-[#e9c46a] whitespace-nowrap inline-flex items-center gap-0.5"
              >
                <span>Notation</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
