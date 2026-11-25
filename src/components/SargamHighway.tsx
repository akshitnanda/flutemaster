import React, { useMemo, useRef, useEffect, useState } from 'react';
import { EwiSettings, InstrumentType, Song, SongNote } from '../types/music';
import { getFingering, getPitchIndex, SWARA_META } from '../data/sargam';
import { getHarmonicaTab, getSaxFingering } from '../data/instruments';
import { DEFAULT_EWI_SETTINGS, getEwiFingering } from '../data/ewi';
import { SwaraSymbol } from './SwaraSymbol';
import { Languages, Sparkles, Wind } from 'lucide-react';

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
  const [viewportHeight, setViewportHeight] = useState(196);
  const [showDevanagari, setShowDevanagari] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportWidth(entry.contentRect.width);
        if (entry.contentRect.height > 60) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth || 1100);
    if (el.clientHeight > 60) setViewportHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Responsive dynamic scale: mobile sees ~3 full beats ahead; tall desktops expand the melody lane!
  const pixelsPerBeat = viewportWidth < 480 ? 92 : viewportWidth < 860 ? 112 : 136;
  const noteLaneHeight = Math.max(96, Math.min(164, Math.round(viewportHeight - 62)));
  const playheadX =
    viewportWidth < 480
      ? 72
      : viewportWidth < 768
      ? 102
      : Math.max(126, Math.min(260, viewportWidth * 0.22));
  const trackWidth = Math.max(viewportWidth, (song.totalBeats + 6) * pixelsPerBeat);
  const translateX = playheadX - currentBeat * pixelsPerBeat;

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
    const topPad = 22;
    const bottomPad = 22;
    return topPad + (1 - normalized) * (noteLaneHeight - topPad - bottomPad);
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
    <div className="flex flex-col w-full h-full bg-[#0d0c0b] border-t border-[#262320] select-none overflow-hidden">
      {/* ====================================================================
          TOP MINI HEADER & SONG SCRUBBER WITH A-B LOOP OVERLAY
          ==================================================================== */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-4 py-1.5 bg-[#121110] border-b border-[#262320] shrink-0">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-mono-tech uppercase tracking-widest font-semibold text-[#c9a25e]">
            <span className="sm:hidden">Highway</span>
            <span className="hidden sm:inline">Sargam Highway</span>
          </span>
          {activeSection && (
            <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-[2px] bg-[#14231f] border border-[#3ca38f]/45 text-[10px] font-mono-tech text-[#5eead4] truncate">
              {activeSection.name}
            </span>
          )}
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] text-[#8a8278] font-mono-tech">
            <span>{song.talaLabel}</span>
            <span className="text-[#3a352f]">/</span>
            <span className={beatInBar === 1 ? 'text-[#e05a33] font-semibold' : ''}>
              Matra {beatInBar}/{song.beatsPerBar}
              {beatInBar === 1 ? ' (Sam)' : ''}
            </span>
          </span>
        </div>

        {/* Interactive Song Timeline Scrubber */}
        <div className="flex-1 max-w-md mx-1 sm:mx-2 flex items-center gap-1.5 sm:gap-2 min-w-[80px]">
          <div
            onClick={handleScrubClick}
            className="relative flex-1 h-1.5 rounded-[1px] bg-[#1f1c19] border border-[#2b2723] cursor-pointer overflow-hidden group"
            title="Click anywhere to jump along the song"
          >
            {/* A-B Loop Highlight inside scrubber */}
            {loopStart !== null && loopEnd !== null && loopEnd > loopStart && (
              <div
                className={`absolute inset-y-0 transition-opacity ${
                  loopEnabled
                    ? 'bg-[#c9a25e]/35 border-x border-[#c9a25e]'
                    : 'bg-[#c9a25e]/15 border-x border-[#c9a25e]/40'
                }`}
                style={{
                  left: `${(loopStart / song.totalBeats) * 100}%`,
                  width: `${((loopEnd - loopStart) / song.totalBeats) * 100}%`,
                }}
              />
            )}

            {/* Playback Fill */}
            <div
              className="absolute inset-y-0 left-0 bg-[#3ca38f]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="hidden sm:inline text-[10px] font-mono-tech text-[#8a8278] w-14 text-right shrink-0">
            {Math.min(song.totalBeats, Math.max(0, currentBeat)).toFixed(1)}/{song.totalBeats}b
          </span>
        </div>

        {/* Notation Display Toggles */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded-[2px] bg-[#0a0a09] border border-[#262320] divide-x divide-[#262320] text-[10px] font-mono-tech">
            <button
              onClick={() => onNotationStyleChange('full')}
              className={`px-2 py-0.5 transition-colors cursor-pointer ${
                notationStyle === 'full'
                  ? 'bg-[#f2ede4] text-[#0c0c0b] font-semibold'
                  : 'text-[#8a8278] hover:text-[#f2ede4]'
              }`}
              title="Display full Sargam names (Sa Re Ga Ma Pa Dha Ni)"
            >
              Sa Re
            </button>
            <button
              onClick={() => onNotationStyleChange('short')}
              className={`px-2 py-0.5 transition-colors cursor-pointer ${
                notationStyle === 'short'
                  ? 'bg-[#f2ede4] text-[#0c0c0b] font-semibold'
                  : 'text-[#8a8278] hover:text-[#f2ede4]'
              }`}
              title="Display compact Sargam symbols (S R G M P D N)"
            >
              S R G
            </button>
          </div>
          <button
            onClick={() => setShowDevanagari((v) => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] border transition-colors cursor-pointer ${
              showDevanagari
                ? 'bg-[#251e14] border-[#c9a25e]/55 text-[#c9a25e]'
                : 'bg-[#0a0a09] border-[#262320] text-[#8a8278]'
            }`}
            title="Toggle Hindi Devanagari lyrics alongside Romanized lyrics"
          >
            <Languages className="w-3 h-3" />
            <span className="hidden sm:inline font-hindi">हिन्दी</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          SCROLLING SARGAM SEQUENCER HIGHWAY + LYRIC/BREATH TRACK
          ==================================================================== */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full overflow-hidden bg-[#0c0b0a]"
      >
        {/* Subtle Register Horizontal Guide Lines (Taar / Madhya / Mandra) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: `${noteLaneHeight}px` }}
        >
          <div className="absolute top-[22%] inset-x-0 border-t border-dashed border-white/[0.04]" />
          <div className="absolute top-[52%] inset-x-0 border-t border-white/[0.06]" />
          <div className="absolute top-[82%] inset-x-0 border-t border-dashed border-white/[0.04]" />
        </div>

        {/* Left-edge gradient mask + clean Register Rail */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-14 sm:w-24 z-20"
          style={{
            background:
              'linear-gradient(90deg, #0c0b0a 0%, rgba(12,11,10,0.92) 56%, rgba(12,11,10,0) 100%)',
          }}
        >
          <div className="relative w-full" style={{ height: `${noteLaneHeight}px` }}>
            <span className="absolute left-1.5 sm:left-2.5 top-2 text-[8px] sm:text-[9px] font-mono-tech uppercase tracking-wider text-[#c9a25e]/75">
              Taar
            </span>
            <span className="absolute left-1.5 sm:left-2.5 top-[50%] -translate-y-1/2 text-[8px] sm:text-[9px] font-mono-tech uppercase tracking-wider text-[#8a8278]/80">
              <span className="sm:hidden">Mid</span>
              <span className="hidden sm:inline">Madhya</span>
            </span>
            <span className="absolute left-1.5 sm:left-2.5 bottom-2 text-[8px] sm:text-[9px] font-mono-tech uppercase tracking-wider text-[#3ca38f]/80">
              <span className="sm:hidden">Low</span>
              <span className="hidden sm:inline">Mandra</span>
            </span>
          </div>
          <div className="px-1.5 sm:px-2.5 pt-2 text-[8px] sm:text-[9px] font-mono-tech uppercase tracking-wider text-[#6e675e]">
            Lyrics
          </div>
        </div>

        {/* Lyric & Breath Lane Divider */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-[#262320] bg-[#100f0d]"
          style={{ top: `${noteLaneHeight}px`, bottom: 0 }}
        />

        {/* Surgical Vermilion Playhead Needle */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-20 flex flex-col items-center"
          style={{ left: `${playheadX}px` }}
        >
          <div
            className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#e05a33]"
          />
          <div
            className={`w-[1.5px] flex-1 ${
              isPlaying
                ? 'bg-[#e05a33]'
                : stepMode
                ? 'bg-[#c9a25e]'
                : 'bg-[#e05a33]/75'
            }`}
          />
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
                style={{ left: `${b * pixelsPerBeat}px` }}
              >
                {isSam && b > 0 && (
                  <span
                    className="absolute left-1.5 text-[9px] font-mono-tech text-[#d4a373]/40 whitespace-nowrap"
                    style={{ top: `${noteLaneHeight - 14}px` }}
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
                left: `${loopStart * pixelsPerBeat}px`,
                width: `${(loopEnd - loopStart) * pixelsPerBeat}px`,
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
            height={noteLaneHeight}
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
              const xStart = note.startBeat * pixelsPerBeat;
              const width = Math.max(54, note.durationBeats * pixelsPerBeat - 8);
              const yCurr = getNoteY(note);

              // MEEND: Smooth Bezier glide curve connecting source pitch to destination note
              if (note.ornament.type === 'meend') {
                const prev = idx > 0 ? song.notes[idx - 1] : null;
                const xFrom = prev
                  ? Math.min(
                      xStart - 6,
                      (prev.startBeat + prev.durationBeats) * pixelsPerBeat - 12
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
            const x = note.startBeat * pixelsPerBeat;
            const width = Math.max(54, note.durationBeats * pixelsPerBeat - 8);
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
            const breathCenterX = (breathBeatPos + gapBeats * 0.5) * pixelsPerBeat;
            const showBreathLabel = gapBeats >= 0.72;
            const isBreathNear =
              Math.abs(currentBeat - (breathBeatPos + gapBeats * 0.4)) < 0.85 &&
              currentBeat >= breathBeatPos - 0.35;

            return (
              <React.Fragment key={note.id}>
                {/* Interactive Sequencer Sargam Note Block (architectural border-l-[3px], zero neon pill bloat) */}
                <button
                  onClick={() => onSelectNote(idx)}
                  style={{
                    left: `${x}px`,
                    top: `${yCenter - 18}px`,
                    width: `${width}px`,
                  }}
                  className={`absolute h-[36px] rounded-[3px] px-2 flex items-center justify-between gap-1 border border-l-[3px] transition-colors cursor-pointer z-10 ${
                    isActive
                      ? isSpecialAlert
                        ? 'bg-[#301e14] text-[#fff2e6] border-[#e05a33] border-l-[#f4a261] z-30'
                        : isHarmDraw
                        ? 'bg-[#122638] text-[#f2ede4] border-[#38bdf8] border-l-[#7dd3fc] z-30'
                        : 'bg-[#18302b] text-[#f2ede4] border-[#3ca38f] border-l-[#5eead4] z-30'
                      : isSpecialAlert
                      ? isPast
                        ? 'bg-[#181310]/75 text-[#8a6a55] border-[#261d17] border-l-[#e05a33]/35'
                        : 'bg-[#1f1713] text-[#f4a261] border-[#3a281d] border-l-[#e05a33] hover:border-[#e05a33]'
                      : isHarmDraw
                      ? isPast
                        ? 'bg-[#11171c]/75 text-[#628599] border-[#1c262e] border-l-[#38bdf8]/35'
                        : 'bg-[#131e28] text-[#7dd3fc] border-[#233a4d] border-l-[#38bdf8] hover:border-[#38bdf8]'
                      : isPast
                      ? 'bg-[#11100f]/80 text-[#6d665e] border-[#1f1d1a] border-l-[#2b2723]'
                      : 'bg-[#161513] text-[#e6dfd5] border-[#2b2723] border-l-[#c9a25e]/70 hover:border-[#c9a25e]'
                  }`}
                  title={`Jump to ${SWARA_META[note.swara].fullBase} (${note.octave}) — "${note.lyric}"`}
                >
                  <SwaraSymbol
                    swara={note.swara}
                    octave={note.octave}
                    notationStyle={notationStyle}
                    size="sm"
                  />

                  {/* Instrument-Aware Micro-Indicator inside every note block */}
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    {instrument === 'bansuri' && isSpecialAlert && (
                      <span
                        className={`relative w-2.5 h-2.5 rounded-full border overflow-hidden shrink-0 ${
                          isActive ? 'border-[#f4a261]' : 'border-[#e05a33]'
                        }`}
                        title="Half-hole note"
                      >
                        <span
                          className={`absolute inset-y-0 left-0 w-1/2 ${
                            isActive ? 'bg-[#f4a261]' : 'bg-[#e05a33]'
                          }`}
                        />
                      </span>
                    )}

                    {instrument === 'saxophone' && saxInfo?.highwayTag && (
                      <span
                        className={`px-1 py-[1px] rounded-[2px] text-[8px] font-mono-tech font-semibold leading-none ${
                          isActive
                            ? 'bg-black/30 text-current'
                            : saxInfo.auxKeys.length > 0
                            ? 'bg-[#2a1812] text-[#f4a261]'
                            : 'bg-[#1e1b15] text-[#c9a25e]'
                        }`}
                      >
                        {saxInfo.highwayTag}
                      </span>
                    )}

                    {instrument === 'harmonica' && harmInfo && (
                      <span
                        className={`px-1 py-[1px] rounded-[2px] text-[9px] font-mono-tech font-semibold leading-none ${
                          isActive
                            ? 'bg-black/30 text-current'
                            : harmInfo.slide
                            ? 'bg-[#2a1812] text-[#f4a261]'
                            : harmInfo.action === 'draw'
                            ? 'bg-[#122638] text-[#7dd3fc]'
                            : 'bg-[#14231f] text-[#5eead4]'
                        }`}
                        title={`Hole ${harmInfo.hole} ${harmInfo.action.toUpperCase()}${harmInfo.slide ? ' + Slide IN' : ''}`}
                      >
                        {harmInfo.compactTab}
                      </span>
                    )}

                    {instrument === 'ewi' && ewiInfo?.highwayTag && (
                      <span
                        className={`px-1 py-[1px] rounded-[2px] text-[8px] font-mono-tech font-semibold leading-none ${
                          isActive
                            ? 'bg-black/30 text-current'
                            : ewiInfo.pitchBendActive
                            ? 'bg-[#251e14] text-[#c9a25e]'
                            : ewiInfo.auxPads.length > 0
                            ? 'bg-[#2a1812] text-[#f4a261]'
                            : ewiInfo.octaveShift === -1
                            ? 'bg-[#14231f] text-[#5eead4]'
                            : 'bg-[#1e1b15] text-[#c9a25e]'
                        }`}
                      >
                        {ewiInfo.highwayTag}
                      </span>
                    )}

                    {note.ornament && !isSpecialAlert && instrument === 'bansuri' && (
                      <Sparkles
                        className={`w-3 h-3 shrink-0 ${
                          isActive ? 'text-[#5eead4]' : 'text-[#c9a25e]/80'
                        }`}
                      />
                    )}
                  </div>
                </button>

                {/* Synchronized Lyric Syllable directly beneath the Swara */}
                <div
                  style={{
                    left: `${x}px`,
                    top: `${noteLaneHeight + 7}px`,
                    minWidth: `${width}px`,
                  }}
                  className="absolute flex flex-col items-start px-1 pointer-events-none"
                >
                  <span
                    className={`text-xs font-medium tracking-wide whitespace-nowrap transition-colors ${
                      isActive
                        ? 'text-[#5eead4] font-semibold'
                        : isPast
                        ? 'text-[#6d665e]'
                        : 'text-[#e6dfd5]'
                    }`}
                  >
                    {note.lyric}
                  </span>
                  {showDevanagari && note.hindi && (
                    <span
                      className={`font-hindi text-[11px] leading-tight whitespace-nowrap transition-colors ${
                        isActive
                          ? 'text-[#c9a25e]'
                          : isPast
                          ? 'text-[#6d665e]/60'
                          : 'text-[#8a8278]'
                      }`}
                    >
                      {note.hindi}
                    </span>
                  )}
                </div>

                {/* Crisp Architectural Phrasing Breath Tag */}
                {note.breathAfter && (
                  <div
                    style={{
                      left: `${breathCenterX}px`,
                      top: `${noteLaneHeight + 10}px`,
                    }}
                    className={`absolute -translate-x-1/2 flex items-center gap-1 px-1.5 py-[1px] rounded-[2px] border text-[9px] font-mono-tech uppercase whitespace-nowrap transition-colors ${
                      isBreathNear
                        ? 'bg-[#152823] border-[#3ca38f] text-[#5eead4]'
                        : 'bg-[#131514] border-[#262a28] text-[#6d9d92]'
                    }`}
                    title="Natural phrasing pause — take a relaxed breath"
                  >
                    <Wind className="w-2.5 h-2.5" />
                    {showBreathLabel && <span>Breath</span>}
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
