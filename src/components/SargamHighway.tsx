import React, { useMemo, useRef, useEffect, useState } from 'react';
import { EwiSettings, InstrumentType, Song, SongNote } from '../types/music';
import { getFingering, getPitchIndex, SWARA_META } from '../data/sargam';
import { getHarmonicaTab, getSaxFingering } from '../data/instruments';
import { DEFAULT_EWI_SETTINGS, getEwiFingering } from '../data/ewi';
import { SwaraSymbol } from './SwaraSymbol';
import { Languages, Sparkles } from 'lucide-react';

interface SargamHighwayProps {
  instrument: InstrumentType;
  ewiSettings?: EwiSettings;
  song: Song;
  currentBeat: number;
  activeNoteIndex: number;
  isPlaying: boolean;
  stepMode: boolean;
  loopStart: number | null;
  loopEnd: number | null;
  loopEnabled: boolean;
  notationStyle: 'short' | 'full';
  onNotationStyleChange: (style: 'short' | 'full') => void;
  onSeekToBeat: (beat: number) => void;
  onSelectNote: (noteIndex: number) => void;
}

const PIXELS_PER_BEAT = 136;
const NOTE_LANE_HEIGHT = 118;

export const SargamHighway: React.FC<SargamHighwayProps> = ({
  instrument,
  ewiSettings = DEFAULT_EWI_SETTINGS,
  song,
  currentBeat,
  activeNoteIndex,
  isPlaying,
  stepMode,
  loopStart,
  loopEnd,
  loopEnabled,
  notationStyle,
  onNotationStyleChange,
  onSeekToBeat,
  onSelectNote,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(1100);
  const [showDevanagari, setShowDevanagari] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth || 1100);
    return () => ro.disconnect();
  }, []);

  const playheadX = Math.max(130, Math.min(260, viewportWidth * 0.22));
  const trackWidth = Math.max(viewportWidth, (song.totalBeats + 6) * PIXELS_PER_BEAT);
  const translateX = playheadX - currentBeat * PIXELS_PER_BEAT;

  // Compute vertical pitch bounds for this song so melody contour uses the lane nicely
  const { minPitch, maxPitch } = useMemo(() => {
    let min = 99;
    let max = -99;
    for (const n of song.notes) {
      const p = getPitchIndex(n.swara, n.octave);
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { minPitch: Math.min(min, -2), maxPitch: Math.max(max, 12) };
  }, [song.notes]);

  const getNoteY = (note: SongNote): number => {
    const p = getPitchIndex(note.swara, note.octave);
    const range = Math.max(8, maxPitch - minPitch);
    const normalized = (p - minPitch) / range; // 0 = lowest, 1 = highest
    const topPad = 24;
    const bottomPad = 24;
    return topPad + (1 - normalized) * (NOTE_LANE_HEIGHT - topPad - bottomPad);
  };

  // Current Tala beat counter (1..beatsPerBar)
  const beatInBar = (Math.floor(Math.max(0, currentBeat)) % song.beatsPerBar) + 1;
  const activeSection = song.sections.find(
    (s) => currentBeat >= s.startBeat - 0.5 && currentBeat < s.endBeat
  );

  // Beat grid markers
  const beatMarks = useMemo(() => {
    const arr: number[] = [];
    const total = Math.ceil(song.totalBeats) + 2;
    for (let b = 0; b <= total; b++) {
      arr.push(b);
    }
    return arr;
  }, [song.totalBeats]);

  // Scrub bar handler
  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeekToBeat(ratio * song.totalBeats);
  };

  const progressPct = Math.max(0, Math.min(100, (currentBeat / song.totalBeats) * 100));

  return (
    <div className="flex flex-col w-full h-full bg-[#151412] border-t border-[#d4a373]/18 select-none overflow-hidden">
      {/* ====================================================================
          TOP MINI HEADER & SONG SCRUBBER WITH A-B LOOP OVERLAY
          ==================================================================== */}
      <div className="flex items-center justify-between gap-3 px-4 py-1.5 bg-[#191715] border-b border-white/6 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#d4a373]">
            Sargam Highway
          </span>
          {activeSection && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-[#2a9d8f]/15 border border-[#2a9d8f]/35 text-[10px] font-medium text-[#72efdd] truncate">
              {activeSection.name}
            </span>
          )}
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-[#a69f95] font-mono-tech">
            <span>{song.talaLabel}</span>
            <span className="text-[#d4a373]/30">·</span>
            <span className={beatInBar === 1 ? 'text-[#e9c46a] font-semibold' : ''}>
              Matra {beatInBar}/{song.beatsPerBar}
              {beatInBar === 1 ? ' (Sam)' : ''}
            </span>
          </span>
        </div>

        {/* Interactive Song Timeline Scrubber */}
        <div className="flex-1 max-w-md mx-2 flex items-center gap-2">
          <div
            onClick={handleScrubClick}
            className="relative flex-1 h-2.5 rounded-full bg-[#25221e] border border-white/8 cursor-pointer overflow-hidden group"
            title="Click anywhere to jump along the song"
          >
            {/* A-B Loop Highlight inside scrubber */}
            {loopStart !== null && loopEnd !== null && loopEnd > loopStart && (
              <div
                className={`absolute inset-y-0 transition-opacity ${
                  loopEnabled
                    ? 'bg-[#e9c46a]/35 border-x border-[#e9c46a]'
                    : 'bg-[#d4a373]/18 border-x border-[#d4a373]/40'
                }`}
                style={{
                  left: `${(loopStart / song.totalBeats) * 100}%`,
                  width: `${((loopEnd - loopStart) / song.totalBeats) * 100}%`,
                }}
              />
            )}

            {/* Playback Fill */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2a9d8f]/85 to-[#38bfa9] rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono-tech text-[#a69f95] w-14 text-right shrink-0">
            {Math.min(song.totalBeats, Math.max(0, currentBeat)).toFixed(1)}/{song.totalBeats}b
          </span>
        </div>

        {/* Notation Display Toggles */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded-lg bg-[#121212] p-0.5 border border-white/10 text-[10px]">
            <button
              onClick={() => onNotationStyleChange('full')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                notationStyle === 'full'
                  ? 'bg-[#d4a373] text-[#121212] font-semibold'
                  : 'text-[#a69f95] hover:text-[#f8f9fa]'
              }`}
              title="Display full Sargam names (Sa Re Ga Ma Pa Dha Ni)"
            >
              Sa Re
            </button>
            <button
              onClick={() => onNotationStyleChange('short')}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                notationStyle === 'short'
                  ? 'bg-[#d4a373] text-[#121212] font-semibold'
                  : 'text-[#a69f95] hover:text-[#f8f9fa]'
              }`}
              title="Display compact Sargam symbols (S R G M P D N)"
            >
              S R G
            </button>
          </div>
          <button
            onClick={() => setShowDevanagari((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border transition-colors cursor-pointer ${
              showDevanagari
                ? 'bg-[#d4a373]/15 border-[#d4a373]/35 text-[#e9c46a]'
                : 'bg-[#121212] border-white/10 text-[#a69f95]'
            }`}
            title="Toggle Hindi Devanagari lyrics alongside Romanized lyrics"
          >
            <Languages className="w-3 h-3" />
            <span className="hidden sm:inline font-hindi">हिन्दी</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          SCROLLING GUITAR HERO-STYLE SARGAM NOTE HIGHWAY + LYRIC/BREATH TRACK
          ==================================================================== */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full overflow-hidden bg-gradient-to-b from-[#151412] via-[#131210] to-[#11100e]"
      >
        {/* Subtle Register Horizontal Guide Lines (Taar / Madhya / Mandra) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: `${NOTE_LANE_HEIGHT}px` }}
        >
          <div className="absolute top-[22%] inset-x-0 border-t border-dashed border-white/[0.05]" />
          <div className="absolute top-[52%] inset-x-0 border-t border-white/[0.06]" />
          <div className="absolute top-[82%] inset-x-0 border-t border-dashed border-white/[0.05]" />
        </div>

        {/* Left-edge gradient mask + clean Register Rail so notes glide smoothly behind labels */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-20"
          style={{
            background:
              'linear-gradient(90deg, #151412 0%, rgba(21,20,18,0.92) 52%, rgba(21,20,18,0) 100%)',
          }}
        >
          <div className="relative w-full" style={{ height: `${NOTE_LANE_HEIGHT}px` }}>
            <span className="absolute left-2.5 top-2 text-[9px] font-mono-tech uppercase tracking-wider text-[#d4a373]/75">
              Taar
            </span>
            <span className="absolute left-2.5 top-[50%] -translate-y-1/2 text-[9px] font-mono-tech uppercase tracking-wider text-[#a69f95]/75">
              Madhya
            </span>
            <span className="absolute left-2.5 bottom-2 text-[9px] font-mono-tech uppercase tracking-wider text-[#8ecae6]/70">
              Mandra
            </span>
          </div>
          <div className="px-2.5 pt-2 text-[9px] font-mono-tech uppercase tracking-wider text-[#a69f95]/55">
            Lyrics
          </div>
        </div>

        {/* Lyric & Breath Lane Divider */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-[#d4a373]/15 bg-[#181614]/70"
          style={{ top: `${NOTE_LANE_HEIGHT}px`, bottom: 0 }}
        />

        {/* Fixed Glowing Jade Playhead Hit-Line */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-20 flex flex-col items-center"
          style={{ left: `${playheadX}px` }}
        >
          <div className="w-3 h-2 bg-[#2a9d8f] rounded-b-sm shadow-[0_0_12px_#2a9d8f]" />
          <div
            className={`w-[2px] flex-1 transition-all ${
              isPlaying
                ? 'bg-gradient-to-b from-[#38bfa9] via-[#2a9d8f] to-[#2a9d8f]/35 shadow-[0_0_16px_rgba(42,157,143,0.9)]'
                : stepMode
                ? 'bg-gradient-to-b from-[#e9c46a] via-[#d4a373] to-[#d4a373]/30 shadow-[0_0_14px_rgba(212,163,115,0.7)]'
                : 'bg-[#2a9d8f]/65'
            }`}
          />
          <div className="w-2.5 h-2 bg-[#2a9d8f]/80 rounded-t-sm" />
        </div>

        {/* ==================================================================
            TRANSLATING TIMELINE STAGE (Moves smoothly right-to-left at 60fps)
            ================================================================== */}
        <div
          className="absolute top-0 bottom-0 left-0 will-change-transform"
          style={{
            width: `${trackWidth}px`,
            transform: `translate3d(${translateX}px, 0, 0)`,
          }}
        >
          {/* Beat & Tala Measure Grid Lines */}
          {beatMarks.map((b) => {
            const isSam = b % song.beatsPerBar === 0;
            return (
              <div
                key={`beat-${b}`}
                className={`pointer-events-none absolute top-0 bottom-0 ${
                  isSam ? 'border-l border-[#d4a373]/22' : 'border-l border-white/[0.04]'
                }`}
                style={{ left: `${b * PIXELS_PER_BEAT}px` }}
              >
                {isSam && b > 0 && (
                  <span
                    className="absolute left-1.5 text-[9px] font-mono-tech text-[#d4a373]/40 whitespace-nowrap"
                    style={{ top: `${NOTE_LANE_HEIGHT - 14}px` }}
                  >
                    Bar {b / song.beatsPerBar + 1}
                  </span>
                )}
              </div>
            );
          })}

          {/* A-B Loop Visual Shaded Bracket on the Highway */}
          {loopStart !== null && loopEnd !== null && loopEnd > loopStart && (
            <div
              className={`pointer-events-none absolute top-0 bottom-0 transition-colors ${
                loopEnabled
                  ? 'bg-[#e9c46a]/[0.07] border-x-2 border-[#e9c46a]/75'
                  : 'bg-[#d4a373]/[0.03] border-x border-dashed border-[#d4a373]/35'
              }`}
              style={{
                left: `${loopStart * PIXELS_PER_BEAT}px`,
                width: `${(loopEnd - loopStart) * PIXELS_PER_BEAT}px`,
              }}
            >
              <span className="absolute top-1 left-1.5 px-1.5 py-[1px] rounded bg-[#e9c46a] text-[#121212] text-[9px] font-bold">
                A
              </span>
              <span className="absolute top-1 right-1.5 px-1.5 py-[1px] rounded bg-[#e9c46a] text-[#121212] text-[9px] font-bold">
                B
              </span>
            </div>
          )}

          {/* ================================================================
              ORNAMENTATION (ALANKAR) SVG CURVES: Meend · Kan · Gamak (Above notes at z-30)
              ================================================================ */}
          <svg
            className="pointer-events-none absolute top-0 left-0 overflow-visible z-30"
            width={trackWidth}
            height={NOTE_LANE_HEIGHT}
          >
            <defs>
              <linearGradient id="meendGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d4a373" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#e9c46a" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="gamakGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bfa9" />
                <stop offset="50%" stopColor="#e9c46a" />
                <stop offset="100%" stopColor="#38bfa9" />
              </linearGradient>
            </defs>

            {song.notes.map((note, idx) => {
              if (!note.ornament) return null;
              const xStart = note.startBeat * PIXELS_PER_BEAT;
              const width = Math.max(54, note.durationBeats * PIXELS_PER_BEAT - 8);
              const yCurr = getNoteY(note);

              // MEEND: Smooth Bezier glide curve connecting source pitch to destination note
              if (note.ornament.type === 'meend') {
                const prev = idx > 0 ? song.notes[idx - 1] : null;
                const xFrom = prev
                  ? Math.min(
                      xStart - 6,
                      (prev.startBeat + prev.durationBeats) * PIXELS_PER_BEAT - 12
                    )
                  : xStart - 44;
                const yFrom = prev ? getNoteY(prev) : yCurr + 18;
                const cx1 = xFrom + (xStart - xFrom) * 0.45;
                const cx2 = xStart - 16;
                const labelX = (xFrom + xStart) / 2;
                const labelY = Math.max(12, Math.min(yFrom, yCurr) - 21);

                return (
                  <g key={`orn-${note.id}`}>
                    <path
                      d={`M ${xFrom} ${yFrom} C ${cx1} ${yFrom}, ${cx2} ${yCurr}, ${xStart + 4} ${yCurr}`}
                      fill="none"
                      stroke="url(#meendGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx={xStart + 4} cy={yCurr} r="3.2" fill="#e9c46a" />
                    <rect
                      x={labelX - 20}
                      y={labelY - 8}
                      width="40"
                      height="12"
                      rx="4"
                      fill="#181614"
                      fillOpacity="0.92"
                      stroke="#e9c46a"
                      strokeOpacity="0.5"
                      strokeWidth="0.8"
                    />
                    <text
                      x={labelX}
                      y={labelY + 1}
                      fill="#e9c46a"
                      fontSize="7.5"
                      fontWeight="700"
                      textAnchor="middle"
                      letterSpacing="0.06em"
                    >
                      MEEND
                    </text>
                  </g>
                );
              }

              // KAN: Crisp curved grace-note flick arc leading into the main swara
              if (note.ornament.type === 'kan') {
                const xGrace = xStart - 22;
                const yGrace = Math.max(18, yCurr - 20);
                return (
                  <g key={`orn-${note.id}`}>
                    <path
                      d={`M ${xGrace} ${yGrace} Q ${xStart - 10} ${yGrace - 5}, ${xStart + 4} ${yCurr - 6}`}
                      fill="none"
                      stroke="#72efdd"
                      strokeWidth="2"
                      strokeDasharray="3 2"
                    />
                    <circle cx={xGrace} cy={yGrace} r="3.2" fill="#2a9d8f" stroke="#72efdd" strokeWidth="1" />
                    <rect
                      x={xGrace - 20}
                      y={Math.max(2, yGrace - 16)}
                      width="40"
                      height="12"
                      rx="4"
                      fill="#181614"
                      fillOpacity="0.92"
                      stroke="#72efdd"
                      strokeOpacity="0.5"
                      strokeWidth="0.8"
                    />
                    <text
                      x={xGrace}
                      y={Math.max(10, yGrace - 7)}
                      fill="#72efdd"
                      fontSize="7.5"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      Kan{note.ornament.graceSwara ? ` ${SWARA_META[note.ornament.graceSwara].shortBase}` : ''}
                    </text>
                  </g>
                );
              }

              // GAMAK: Wavy oscillation sinusoid spanning the note pill
              if (note.ornament.type === 'gamak') {
                const segments = Math.max(4, Math.floor(width / 16));
                const stepW = (width - 12) / segments;
                const waveY = Math.max(14, yCurr - 23);
                let d = `M ${xStart + 6} ${waveY}`;
                for (let s = 0; s < segments; s++) {
                  const sx = xStart + 6 + s * stepW;
                  const peakY = s % 2 === 0 ? waveY - 5 : waveY + 5;
                  d += ` Q ${sx + stepW * 0.5} ${peakY}, ${sx + stepW} ${waveY}`;
                }
                const labelX = xStart + width / 2;
                const labelY = Math.max(9, waveY - 10);
                return (
                  <g key={`orn-${note.id}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke="url(#gamakGrad)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <rect
                      x={labelX - 20}
                      y={labelY - 7}
                      width="40"
                      height="11"
                      rx="4"
                      fill="#181614"
                      fillOpacity="0.92"
                      stroke="#38bfa9"
                      strokeOpacity="0.55"
                      strokeWidth="0.8"
                    />
                    <text
                      x={labelX}
                      y={labelY + 1}
                      fill="#72efdd"
                      fontSize="7.5"
                      fontWeight="700"
                      textAnchor="middle"
                      letterSpacing="0.06em"
                    >
                      GAMAK
                    </text>
                  </g>
                );
              }

              return null;
            })}
          </svg>

          {/* ================================================================
              SARGAM NOTE PILLS + ALIGNED LYRICS + BREATH (🌬️) MARKERS
              ================================================================ */}
          {song.notes.map((note, idx) => {
            const x = note.startBeat * PIXELS_PER_BEAT;
            const width = Math.max(54, note.durationBeats * PIXELS_PER_BEAT - 8);
            const yCenter = getNoteY(note);
            const isActive = idx === activeNoteIndex;
            const isPast = idx < activeNoteIndex;
            const fingering = getFingering(note.swara, note.octave);
            const saxInfo = instrument === 'saxophone' ? getSaxFingering(note.swara, note.octave) : null;
            const harmInfo = instrument === 'harmonica' ? getHarmonicaTab(note.swara, note.octave) : null;
            const ewiInfo =
              instrument === 'ewi'
                ? getEwiFingering(
                    note.swara,
                    note.octave,
                    ewiSettings.fingeringMode,
                    note.ornament?.type,
                    ewiSettings.pitchBendEnabled
                  )
                : null;

            const isSpecialAlert =
              instrument === 'bansuri'
                ? fingering.halfHoleIndex !== null
                : instrument === 'saxophone'
                ? Boolean(saxInfo && saxInfo.auxKeys.length > 0)
                : instrument === 'ewi'
                ? Boolean(ewiInfo && (ewiInfo.auxPads.length > 0 || ewiInfo.pitchBendActive))
                : Boolean(harmInfo?.slide);
            const isHarmDraw = instrument === 'harmonica' && harmInfo?.action === 'draw';

            // Breath icon positioned squarely at the midpoint of the phrasing rest gap so it NEVER overlaps adjacent lyrics
            const breathBeatPos = note.startBeat + note.durationBeats;
            const nextNote = idx < song.notes.length - 1 ? song.notes[idx + 1] : null;
            const gapBeats = nextNote ? Math.max(0.5, nextNote.startBeat - breathBeatPos) : 1.0;
            const breathCenterX = (breathBeatPos + gapBeats * 0.5) * PIXELS_PER_BEAT;
            const showBreathLabel = gapBeats >= 0.72;
            const isBreathNear =
              Math.abs(currentBeat - (breathBeatPos + gapBeats * 0.4)) < 0.85 &&
              currentBeat >= breathBeatPos - 0.35;

            return (
              <React.Fragment key={note.id}>
                {/* Interactive Sargam Note Pill */}
                <button
                  onClick={() => onSelectNote(idx)}
                  style={{
                    left: `${x}px`,
                    top: `${yCenter - 19}px`,
                    width: `${width}px`,
                  }}
                  className={`absolute h-[38px] rounded-xl px-2 flex items-center justify-between gap-1 border transition-all cursor-pointer z-10 ${
                    isActive
                      ? isSpecialAlert
                        ? 'bg-[#f4a261] text-[#121212] border-[#fff0d9] shadow-[0_0_24px_rgba(244,162,97,0.75)] scale-[1.04] z-30'
                        : isHarmDraw
                        ? 'bg-[#38bdf8] text-[#121212] border-[#e0f2fe] shadow-[0_0_24px_rgba(56,189,248,0.75)] scale-[1.04] z-30'
                        : 'bg-[#2a9d8f] text-[#f8f9fa] border-[#72efdd] shadow-[0_0_24px_rgba(42,157,143,0.78)] scale-[1.04] z-30'
                      : isSpecialAlert
                      ? isPast
                        ? 'bg-[#2a2018]/75 text-[#f4a261]/60 border-[#f4a261]/20'
                        : 'bg-[#281d14] text-[#f4a261] border-[#f4a261]/45 hover:border-[#f4a261]'
                      : isHarmDraw
                      ? isPast
                        ? 'bg-[#172128]/75 text-[#7dd3fc]/55 border-[#38bdf8]/20'
                        : 'bg-[#152430] text-[#7dd3fc] border-[#38bdf8]/40 hover:border-[#38bdf8]'
                      : isPast
                      ? 'bg-[#1f1e1c]/80 text-[#a69f95]/65 border-white/8'
                      : 'bg-[#23201c] text-[#f8f9fa] border-[#d4a373]/30 hover:border-[#d4a373]/75 hover:bg-[#2b2722]'
                  }`}
                  title={`Jump to ${SWARA_META[note.swara].fullBase} (${note.octave}) — "${note.lyric}"`}
                >
                  <SwaraSymbol
                    swara={note.swara}
                    octave={note.octave}
                    notationStyle={notationStyle}
                    size="sm"
                  />

                  {/* Instrument-Aware Micro-Indicator inside every note pill */}
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    {instrument === 'bansuri' && isSpecialAlert && (
                      <span
                        className={`relative w-2.5 h-2.5 rounded-full border overflow-hidden shrink-0 ${
                          isActive ? 'border-[#121212]' : 'border-[#f4a261]'
                        }`}
                        title="Half-hole note"
                      >
                        <span
                          className={`absolute inset-y-0 left-0 w-1/2 ${
                            isActive ? 'bg-[#121212]' : 'bg-[#f4a261]'
                          }`}
                        />
                      </span>
                    )}

                    {instrument === 'saxophone' && saxInfo?.highwayTag && (
                      <span
                        className={`px-1 py-[1px] rounded text-[8px] font-mono-tech font-bold leading-none ${
                          isActive
                            ? 'bg-[#121212]/25 text-current'
                            : saxInfo.auxKeys.length > 0
                            ? 'bg-[#f4a261]/20 text-[#f4a261]'
                            : 'bg-[#d4a373]/18 text-[#e9c46a]'
                        }`}
                      >
                        {saxInfo.highwayTag}
                      </span>
                    )}

                    {instrument === 'harmonica' && harmInfo && (
                      <span
                        className={`px-1 py-[1px] rounded text-[9px] font-mono-tech font-bold leading-none ${
                          isActive
                            ? 'bg-[#121212]/25 text-current'
                            : harmInfo.slide
                            ? 'bg-[#f4a261]/22 text-[#f4a261]'
                            : harmInfo.action === 'draw'
                            ? 'bg-[#38bdf8]/20 text-[#7dd3fc]'
                            : 'bg-[#2a9d8f]/20 text-[#72efdd]'
                        }`}
                        title={`Hole ${harmInfo.hole} ${harmInfo.action.toUpperCase()}${harmInfo.slide ? ' + Slide IN' : ''}`}
                      >
                        {harmInfo.compactTab}
                      </span>
                    )}

                    {instrument === 'ewi' && ewiInfo?.highwayTag && (
                      <span
                        className={`px-1 py-[1px] rounded text-[8px] font-mono-tech font-bold leading-none ${
                          isActive
                            ? 'bg-[#121212]/25 text-current'
                            : ewiInfo.pitchBendActive
                            ? 'bg-[#e9c46a]/25 text-[#e9c46a]'
                            : ewiInfo.auxPads.length > 0
                            ? 'bg-[#f4a261]/22 text-[#f4a261]'
                            : ewiInfo.octaveShift === -1
                            ? 'bg-[#72efdd]/20 text-[#72efdd]'
                            : 'bg-[#d4a373]/18 text-[#e9c46a]'
                        }`}
                      >
                        {ewiInfo.highwayTag}
                      </span>
                    )}

                    {note.ornament && !isSpecialAlert && instrument === 'bansuri' && (
                      <Sparkles
                        className={`w-3 h-3 shrink-0 ${
                          isActive ? 'text-[#f8f9fa]' : 'text-[#e9c46a]/80'
                        }`}
                      />
                    )}
                  </div>
                </button>

                {/* Synchronized Lyric Syllable directly beneath the Swara */}
                <div
                  style={{
                    left: `${x}px`,
                    top: `${NOTE_LANE_HEIGHT + 7}px`,
                    minWidth: `${width}px`,
                  }}
                  className="absolute flex flex-col items-start px-1 pointer-events-none"
                >
                  <span
                    className={`text-xs font-medium tracking-wide whitespace-nowrap transition-colors ${
                      isActive
                        ? 'text-[#38bfa9] font-semibold'
                        : isPast
                        ? 'text-[#a69f95]/55'
                        : 'text-[#f8f9fa]/90'
                    }`}
                  >
                    {note.lyric}
                  </span>
                  {showDevanagari && note.hindi && (
                    <span
                      className={`font-hindi text-[11px] leading-tight whitespace-nowrap transition-colors ${
                        isActive
                          ? 'text-[#e9c46a]'
                          : isPast
                          ? 'text-[#a69f95]/40'
                          : 'text-[#d4a373]/75'
                      }`}
                    >
                      {note.hindi}
                    </span>
                  )}
                </div>

                {/* Natural Phrasing Breath Pause Indicator (🌬️) */}
                {note.breathAfter && (
                  <div
                    style={{
                      left: `${breathCenterX}px`,
                      top: `${NOTE_LANE_HEIGHT + 9}px`,
                    }}
                    className={`absolute -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] whitespace-nowrap transition-all ${
                      isBreathNear
                        ? 'bg-[#2a9d8f]/30 border-[#72efdd] text-[#72efdd] shadow-[0_0_14px_rgba(42,157,143,0.45)] animate-breath-pulse'
                        : 'bg-[#1b1f1e]/92 border-[#2a9d8f]/35 text-[#8ecae6]'
                    }`}
                    title="Natural phrasing pause — take a relaxed breath"
                  >
                    <span role="img" aria-label="Breath pause">
                      🌬️
                    </span>
                    {showBreathLabel && (
                      <span className="text-[9px] font-medium tracking-wide">Breath</span>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
