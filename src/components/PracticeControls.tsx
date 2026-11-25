import React, { useState } from 'react';
import { AudioMutes, AudioVolumes, InstrumentType, Song } from '../types/music';
import { INSTRUMENT_META } from '../data/instruments';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Drum,
  Footprints,
  Music2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface PracticeControlsProps {
  instrument: InstrumentType;
  song: Song;
  baseBpm: number;
  isCustomBpm: boolean;
  tapPulse: number;
  isPlaying: boolean;
  stepMode: boolean;
  activeNoteIndex: number;
  tempoRate: number;
  loopStart: number | null;
  loopEnd: number | null;
  loopEnabled: boolean;
  volumes: AudioVolumes;
  mutes: AudioMutes;
  tanpuraHold: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onToggleStepMode: () => void;
  onStepPrev: () => void;
  onStepReplay: () => void;
  onStepNext: () => void;
  onTempoChange: (rate: number) => void;
  onTapTempo: () => void;
  onResetBpm: () => void;
  onSetLoopA: () => void;
  onSetLoopB: () => void;
  onToggleLoop: () => void;
  onClearLoop: () => void;
  onSelectSectionLoop: (startBeat: number, endBeat: number) => void;
  onVolumeChange: (layer: keyof AudioVolumes, value: number) => void;
  onToggleMute: (layer: keyof AudioMutes) => void;
  onToggleTanpuraHold: () => void;
}

export const PracticeControls: React.FC<PracticeControlsProps> = ({
  instrument = 'bansuri',
  song,
  baseBpm,
  isCustomBpm,
  tapPulse,
  isPlaying,
  stepMode,
  activeNoteIndex,
  tempoRate,
  loopStart,
  loopEnd,
  loopEnabled,
  volumes,
  mutes,
  tanpuraHold,
  onTogglePlay,
  onRestart,
  onToggleStepMode,
  onStepPrev,
  onStepReplay,
  onStepNext,
  onTempoChange,
  onTapTempo,
  onResetBpm,
  onSetLoopA,
  onSetLoopB,
  onToggleLoop,
  onClearLoop,
  onSelectSectionLoop,
  onVolumeChange,
  onToggleMute,
  onToggleTanpuraHold,
}) => {
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const effectiveBpm = Math.round(baseBpm * tempoRate);
  const hasLoopBounds = loopStart !== null && loopEnd !== null && loopEnd > loopStart;

  const cycleTempoPreset = () => {
    const next = tempoRate >= 0.99 ? 0.5 : tempoRate < 0.7 ? 0.75 : 1.0;
    onTempoChange(next);
  };

  return (
    <div className="w-full bg-[#11100f] border-t border-[#262320] px-2.5 sm:px-3.5 py-2 shrink-0 select-none pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* Responsive Console Grid:
          - Mobile (< md): Compact sticky-ready Transport row + collapsible Mixer & Loop drawer
          - Tablet / Small Laptop (md..xl): Clean 2-row studio dock (Transport+Tempo/Loop, full-width 3-col Mixer)
          - Wide Desktop (xl+): Single hairline-divided horizontal hardware bar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 xl:gap-3">
        {/* ROW 1 (on md..lg) / LEFT+CENTER (on xl+): TRANSPORT + TEMPO/LOOP */}
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between xl:justify-start gap-2 sm:gap-2.5 min-w-0">
          {/* ==================================================================
              1. PLAYBACK TRANSPORT & STEP-BY-STEP ("WAIT FOR ME") MODE
              ================================================================== */}
          <div className="flex items-center justify-between md:justify-start gap-1.5 sm:gap-2 w-full md:w-auto shrink-0">
            <div className="flex items-center gap-1.5">
              {/* Play / Pause Primary Keycap */}
              <button
                onClick={onTogglePlay}
                className={`flex items-center justify-center gap-1.5 px-3.5 sm:px-4 h-9 rounded-[3px] font-semibold text-xs sm:text-[13px] border transition-colors cursor-pointer ${
                  isPlaying
                    ? 'bg-[#e05a33] border-[#f07b58] text-[#0c0c0b]'
                    : 'bg-[#f2ede4] border-[#f2ede4] text-[#0c0c0b] hover:bg-[#e5dfd4]'
                }`}
                title="Play / Pause (Spacebar)"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              {/* Restart */}
              <button
                onClick={onRestart}
                className="w-9 h-9 rounded-[2px] bg-[#161513] border border-[#262320] text-[#b8b0a5] hover:text-[#f2ede4] hover:border-[#c9a25e]/60 flex items-center justify-center transition-colors cursor-pointer"
                title="Restart song from beginning"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Wait for Me / Step-by-Step Mode Toggle */}
              <div className="flex items-center gap-1 pl-1.5 border-l border-[#262320]">
                <button
                  onClick={onToggleStepMode}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 h-9 rounded-[2px] text-xs font-medium border transition-colors cursor-pointer ${
                    stepMode
                      ? 'bg-[#251e14] border-[#c9a25e] text-[#c9a25e]'
                      : 'bg-[#161513] border-[#262320] text-[#b8b0a5] hover:border-[#c9a25e]/55 hover:text-[#f2ede4]'
                  }`}
                  title="Wait for Me Mode: pauses on each note so you can inspect 3D fingerings and press Next"
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Step Mode</span>
                  <span className="sm:hidden">Step</span>
                </button>

                {stepMode && (
                  <div className="flex items-center bg-[#0d0c0b] rounded-[2px] border border-[#c9a25e]/45 divide-x divide-[#262320] h-9">
                    <button
                      onClick={onStepPrev}
                      disabled={activeNoteIndex <= 0}
                      className="px-1.5 h-full text-[#f2ede4] hover:bg-[#1a1815] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                      title="Previous note (Left Arrow)"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={onStepReplay}
                      className="px-2 h-full text-[10px] sm:text-[11px] font-mono-tech text-[#c9a25e] hover:bg-[#1a1815] cursor-pointer"
                      title="Replay current note audio"
                    >
                      {Math.max(1, activeNoteIndex + 1)}/{song.notes.length}
                    </button>
                    <button
                      onClick={onStepNext}
                      className="flex items-center gap-0.5 px-2 sm:px-2.5 h-full bg-[#c9a25e] text-[#0c0c0b] text-xs font-bold hover:bg-[#d8b473] transition-colors cursor-pointer"
                      title="Advance to next note (Right Arrow)"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Quick Tempo Chip + Expandable Mixer/Loop Button */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              {!stepMode && (
                <button
                  onClick={cycleTempoPreset}
                  className="px-2 h-9 rounded-[2px] bg-[#161513] border border-[#262320] text-[11px] font-mono-tech font-semibold text-[#c9a25e] cursor-pointer"
                  title="Cycle Tempo Speed (0.5x / 0.75x / 1x)"
                >
                  {tempoRate === 1 ? '1x' : `${tempoRate}x`}
                </button>
              )}
              <button
                onClick={() => setMobilePanelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 h-9 rounded-[2px] border text-xs font-medium cursor-pointer transition-colors ${
                  mobilePanelOpen || loopEnabled
                    ? 'bg-[#172824] border-[#3ca38f] text-[#f2ede4]'
                    : 'bg-[#161513] border-[#262320] text-[#b8b0a5]'
                }`}
                aria-expanded={mobilePanelOpen}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Mixer</span>
              </button>
            </div>
          </div>

          {/* ==================================================================
              2. TEMPO SCALING (0.5x – 1.0x PITCH-PRESERVED) & A-B LOOP
              ================================================================== */}
          <div
            className={`${
              mobilePanelOpen ? 'flex' : 'hidden md:flex'
            } flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 pt-2 md:pt-0 xl:pl-3 border-t md:border-t-0 xl:border-l border-[#262320] w-full md:w-auto md:flex-1 xl:flex-none min-w-0`}
          >
            {/* Tempo Slider + Live Tap Tempo */}
            <div className="flex flex-col gap-1 flex-1 sm:min-w-[185px] xl:min-w-[200px]">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#8a8278] font-mono-tech uppercase text-[10px] tracking-wider">
                    Tempo
                  </span>
                  <button
                    onClick={onTapTempo}
                    className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded-[2px] border text-[9px] font-mono-tech font-semibold transition-colors cursor-pointer active:scale-95 ${
                      tapPulse > 0
                        ? 'bg-[#e05a33] border-[#e05a33] text-[#0c0c0b]'
                        : 'bg-[#161513] border-[#262320] text-[#c9a25e] hover:border-[#c9a25e]/70'
                    }`}
                    title="Tap rhythmically along to any YouTube cover to lock the BPM live"
                  >
                    <Activity className="w-2.5 h-2.5" />
                    <span>Tap</span>
                  </button>
                  {isCustomBpm && (
                    <button
                      onClick={onResetBpm}
                      className="px-1 py-[1px] rounded-[2px] bg-[#251b14] border border-[#e05a33]/55 text-[9px] font-mono-tech text-[#f4a261] hover:border-[#e05a33] transition-colors cursor-pointer"
                      title={`Reset custom BPM back to studio default (${song.bpm} BPM)`}
                    >
                      Reset
                    </button>
                  )}
                </div>
                <span
                  className={`font-mono-tech font-semibold whitespace-nowrap ${
                    isCustomBpm ? 'text-[#3ca38f]' : 'text-[#c9a25e]'
                  }`}
                >
                  {tempoRate.toFixed(2)}x · {effectiveBpm} BPM
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.5}
                  max={1.0}
                  step={0.05}
                  value={tempoRate}
                  onChange={(e) => onTempoChange(parseFloat(e.target.value))}
                  className="studio-slider flex-1"
                  aria-label="Playback Tempo (Pitch Preserved)"
                />
                <div className="flex items-center rounded-[2px] bg-[#0a0a09] border border-[#262320] divide-x divide-[#262320] shrink-0">
                  {[0.5, 0.75, 1.0].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onTempoChange(preset)}
                      className={`px-1.5 py-0.5 text-[9px] font-mono-tech cursor-pointer transition-colors ${
                        Math.abs(tempoRate - preset) < 0.01
                          ? 'bg-[#c9a25e] text-[#0c0c0b] font-bold'
                          : 'text-[#8a8278] hover:text-[#f2ede4]'
                      }`}
                    >
                      {preset === 1 ? '1x' : `${preset}x`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* A-B Loop Controls */}
            <div className="flex flex-col gap-1 pt-2 sm:pt-0 sm:pl-3 border-t sm:border-t-0 sm:border-l border-[#262320] min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono-tech uppercase tracking-wider text-[#8a8278] mr-0.5 whitespace-nowrap">
                  Loop
                </span>
                <button
                  onClick={onSetLoopA}
                  className={`px-2 py-0.5 rounded-[2px] text-[10px] font-mono-tech border transition-colors cursor-pointer ${
                    loopStart !== null
                      ? 'bg-[#251e14] border-[#c9a25e] text-[#c9a25e] font-semibold'
                      : 'bg-[#161513] border-[#262320] text-[#b8b0a5] hover:border-[#c9a25e]/55'
                  }`}
                  title="Set Loop Start (A) at current playhead"
                >
                  {loopStart !== null ? `A:${loopStart.toFixed(0)}b` : 'Set A'}
                </button>
                <button
                  onClick={onSetLoopB}
                  className={`px-2 py-0.5 rounded-[2px] text-[10px] font-mono-tech border transition-colors cursor-pointer ${
                    loopEnd !== null
                      ? 'bg-[#251e14] border-[#c9a25e] text-[#c9a25e] font-semibold'
                      : 'bg-[#161513] border-[#262320] text-[#b8b0a5] hover:border-[#c9a25e]/55'
                  }`}
                  title="Set Loop End (B) at current playhead"
                >
                  {loopEnd !== null ? `B:${loopEnd.toFixed(0)}b` : 'Set B'}
                </button>
                <button
                  onClick={onToggleLoop}
                  disabled={!hasLoopBounds}
                  className={`p-1 rounded-[2px] border transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                    loopEnabled && hasLoopBounds
                      ? 'bg-[#3ca38f] border-[#3ca38f] text-[#0c0c0b]'
                      : 'bg-[#161513] border-[#262320] text-[#b8b0a5] hover:border-[#3ca38f]/60'
                  }`}
                  title="Toggle A-B Loop Playback"
                >
                  <Repeat className="w-3 h-3" />
                </button>
                {(loopStart !== null || loopEnd !== null) && (
                  <button
                    onClick={onClearLoop}
                    className="p-1 rounded-[2px] text-[#8a8278] hover:text-[#f2ede4] hover:bg-[#1c1a17] cursor-pointer"
                    title="Clear A-B Loop"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 1-Click Song Section Loop Presets */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full sm:max-w-[215px]">
                {song.sections.map((sec) => {
                  const isSelected =
                    loopEnabled && loopStart === sec.startBeat && loopEnd === sec.endBeat;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => onSelectSectionLoop(sec.startBeat, sec.endBeat)}
                      className={`px-1.5 py-[1px] rounded-[2px] text-[9px] font-mono-tech whitespace-nowrap transition-colors cursor-pointer shrink-0 border ${
                        isSelected
                          ? 'bg-[#152823] text-[#5eead4] border-[#3ca38f]/65 font-medium'
                          : 'bg-[#161513] text-[#8a8278] border-[#262320] hover:text-[#f2ede4]'
                      }`}
                      title={`Loop section: ${sec.name}`}
                    >
                      {sec.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================================
            3. INDEPENDENT 3-LAYER HARDWARE AUDIO MIXER (Lead · Tanpura · Tabla)
            ================================================================== */}
        <div
          className={`${
            mobilePanelOpen ? 'grid' : 'hidden md:grid'
          } grid-cols-1 sm:grid-cols-3 xl:flex items-center gap-2.5 sm:gap-3 pt-2 md:pt-1.5 xl:pt-0 xl:pl-3 border-t xl:border-t-0 xl:border-l border-[#262320] w-full xl:w-auto shrink-0`}
        >
          {/* Layer 1: Active Instrument Lead */}
          <AudioChannelSlider
            label={(INSTRUMENT_META[instrument] ?? INSTRUMENT_META.bansuri).mixerLabel}
            icon={<Music2 className="w-3.5 h-3.5 text-[#3ca38f] shrink-0" />}
            value={volumes.flute}
            muted={mutes.flute}
            accent="jade"
            onChange={(v) => onVolumeChange('flute', v)}
            onToggleMute={() => onToggleMute('flute')}
          />

          {/* Layer 2: Tanpura Drone */}
          <div className="pt-2 sm:pt-0 sm:pl-2.5 border-t sm:border-t-0 sm:border-l border-[#262320] flex items-center gap-2 min-w-0">
            <AudioChannelSlider
              label={`Tanpura (${song.scale.rootNote.replace(/\d/, '')})`}
              icon={
                <Disc3
                  className={`w-3.5 h-3.5 text-[#c9a25e] shrink-0 ${
                    tanpuraHold || isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: '9s' }}
                />
              }
              value={volumes.tanpura}
              muted={mutes.tanpura}
              accent="amber"
              onChange={(v) => onVolumeChange('tanpura', v)}
              onToggleMute={() => onToggleMute('tanpura')}
            />
            <button
              onClick={onToggleTanpuraHold}
              className={`px-1.5 py-1 rounded-[2px] text-[9px] font-mono-tech uppercase tracking-wider font-semibold border transition-colors cursor-pointer shrink-0 ${
                tanpuraHold
                  ? 'bg-[#251e14] border-[#c9a25e] text-[#c9a25e]'
                  : 'bg-[#161513] border-[#262320] text-[#8a8278] hover:text-[#f2ede4]'
              }`}
              title="Keep Tanpura Sa-Pa drone humming continuously even while paused"
            >
              Hold
            </button>
          </div>

          {/* Layer 3: Backing Tabla Beat */}
          <div className="pt-2 sm:pt-0 sm:pl-2.5 border-t sm:border-t-0 sm:border-l border-[#262320] min-w-0">
            <AudioChannelSlider
              label="Tabla Beat"
              icon={<Drum className="w-3.5 h-3.5 text-[#e05a33] shrink-0" />}
              value={volumes.tabla}
              muted={mutes.tabla}
              accent="amber"
              onChange={(v) => onVolumeChange('tabla', v)}
              onToggleMute={() => onToggleMute('tabla')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface AudioChannelSliderProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  muted: boolean;
  accent: 'jade' | 'amber';
  onChange: (value: number) => void;
  onToggleMute: () => void;
}

const AudioChannelSlider: React.FC<AudioChannelSliderProps> = ({
  label,
  icon,
  value,
  muted,
  accent,
  onChange,
  onToggleMute,
}) => {
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0 xl:w-[108px] xl:flex-none">
      <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tech">
        <span className="flex items-center gap-1 text-[#b8b0a5] truncate">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <button
          onClick={onToggleMute}
          className={`p-0.5 rounded-[2px] transition-colors cursor-pointer ${
            muted ? 'text-[#e05a33]' : 'text-[#8a8278] hover:text-[#f2ede4]'
          }`}
          title={muted ? `Unmute ${label}` : `Mute ${label}`}
        >
          {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={muted ? 0 : value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`studio-slider ${accent === 'jade' ? 'studio-slider-jade' : ''} w-full`}
        aria-label={`${label} Volume`}
      />
    </div>
  );
};
