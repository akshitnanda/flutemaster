import React from 'react';
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
  const effectiveBpm = Math.round(baseBpm * tempoRate);
  const hasLoopBounds = loopStart !== null && loopEnd !== null && loopEnd > loopStart;

  return (
    <div className="w-full bg-[#181614] border-t border-[#d4a373]/20 px-3.5 py-2.5 shrink-0 select-none">
      <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
        {/* ==================================================================
            1. PLAYBACK TRANSPORT & STEP-BY-STEP ("WAIT FOR ME") MODE
            ================================================================== */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Play / Pause Primary Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center justify-center gap-2 px-4 h-10 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
              isPlaying
                ? 'bg-[#2a9d8f] text-[#f8f9fa] shadow-[0_0_20px_rgba(42,157,143,0.5)] hover:bg-[#33b0a1]'
                : 'bg-[#d4a373] text-[#121212] shadow-[0_0_16px_rgba(212,163,115,0.3)] hover:bg-[#e3b78a]'
            }`}
            title="Play / Pause (Spacebar)"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Restart */}
          <button
            onClick={onRestart}
            className="w-9 h-10 rounded-xl bg-[#22201d] border border-white/10 text-[#d0c8be] hover:text-[#f8f9fa] hover:border-[#d4a373]/40 flex items-center justify-center transition-colors cursor-pointer"
            title="Restart song from beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Wait for Me / Step-by-Step Mode Toggle */}
          <div className="flex items-center gap-1.5 pl-1 border-l border-white/10">
            <button
              onClick={onToggleStepMode}
              className={`flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                stepMode
                  ? 'bg-[#e9c46a]/20 border-[#e9c46a] text-[#e9c46a] shadow-[0_0_14px_rgba(233,196,106,0.22)]'
                  : 'bg-[#22201d] border-white/10 text-[#d0c8be] hover:border-[#d4a373]/45 hover:text-[#f8f9fa]'
              }`}
              title="Wait for Me Mode: pauses on each note so you can inspect 3D fingerings and press Next"
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Step Mode</span>
            </button>

            {stepMode && (
              <div className="flex items-center gap-1 bg-[#221f1a] p-1 rounded-xl border border-[#e9c46a]/35">
                <button
                  onClick={onStepPrev}
                  disabled={activeNoteIndex <= 0}
                  className="p-1.5 rounded-lg text-[#f8f9fa] hover:bg-white/10 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  title="Previous note (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={onStepReplay}
                  className="px-2 py-1 rounded-lg text-[11px] font-mono-tech text-[#e9c46a] hover:bg-white/10 cursor-pointer"
                  title="Replay current note audio"
                >
                  {Math.max(1, activeNoteIndex + 1)}/{song.notes.length}
                </button>
                <button
                  onClick={onStepNext}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#e9c46a] text-[#121212] text-xs font-bold hover:bg-[#f0d284] transition-colors cursor-pointer"
                  title="Advance to next note (Right Arrow)"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ==================================================================
            2. TEMPO SCALING (0.5x – 1.0x PITCH-PRESERVED) & A-B LOOP
            ================================================================== */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-3 py-1.5 rounded-xl bg-[#1f1d1a] border border-white/8">
          {/* Tempo Slider + Live Tap Tempo */}
          <div className="flex flex-col gap-1 min-w-[205px]">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#a69f95] font-medium">Tempo</span>
                <button
                  onClick={onTapTempo}
                  className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded border text-[9px] font-mono-tech font-semibold transition-all cursor-pointer active:scale-95 ${
                    tapPulse > 0
                      ? 'bg-[#2a9d8f]/25 border-[#72efdd]/60 text-[#72efdd]'
                      : 'bg-[#141311] border-[#d4a373]/30 text-[#d4a373] hover:border-[#e9c46a] hover:text-[#e9c46a]'
                  }`}
                  title="Tap rhythmically along to any YouTube cover to lock the BPM live"
                >
                  <Activity className="w-2.5 h-2.5" />
                  <span>Tap</span>
                </button>
                {isCustomBpm && (
                  <button
                    onClick={onResetBpm}
                    className="px-1 py-[1px] rounded bg-[#e9c46a]/15 border border-[#e9c46a]/40 text-[9px] font-mono-tech text-[#e9c46a] hover:bg-[#e9c46a]/25 transition-colors cursor-pointer"
                    title={`Reset custom BPM back to studio default (${song.bpm} BPM)`}
                  >
                    Reset
                  </button>
                )}
              </div>
              <span
                className={`font-mono-tech font-semibold ${
                  isCustomBpm ? 'text-[#72efdd]' : 'text-[#d4a373]'
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
              <div className="flex items-center gap-0.5">
                {[0.5, 0.75, 1.0].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onTempoChange(preset)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono-tech cursor-pointer transition-colors ${
                      Math.abs(tempoRate - preset) < 0.01
                        ? 'bg-[#d4a373] text-[#121212] font-bold'
                        : 'text-[#a69f95] hover:bg-white/8'
                    }`}
                  >
                    {preset === 1 ? '1x' : `${preset}x`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* A-B Loop Controls */}
          <div className="flex flex-col gap-1 pl-3 border-l border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#a69f95] font-medium mr-0.5">A-B Loop</span>
              <button
                onClick={onSetLoopA}
                className={`px-2 py-0.5 rounded text-[10px] font-mono-tech border transition-colors cursor-pointer ${
                  loopStart !== null
                    ? 'bg-[#e9c46a]/20 border-[#e9c46a]/60 text-[#e9c46a] font-semibold'
                    : 'bg-[#141311] border-white/10 text-[#d0c8be] hover:border-[#d4a373]/40'
                }`}
                title="Set Loop Start (A) at current playhead"
              >
                {loopStart !== null ? `A:${loopStart.toFixed(0)}b` : 'Set A'}
              </button>
              <button
                onClick={onSetLoopB}
                className={`px-2 py-0.5 rounded text-[10px] font-mono-tech border transition-colors cursor-pointer ${
                  loopEnd !== null
                    ? 'bg-[#e9c46a]/20 border-[#e9c46a]/60 text-[#e9c46a] font-semibold'
                    : 'bg-[#141311] border-white/10 text-[#d0c8be] hover:border-[#d4a373]/40'
                }`}
                title="Set Loop End (B) at current playhead"
              >
                {loopEnd !== null ? `B:${loopEnd.toFixed(0)}b` : 'Set B'}
              </button>
              <button
                onClick={onToggleLoop}
                disabled={!hasLoopBounds}
                className={`p-1 rounded border transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                  loopEnabled && hasLoopBounds
                    ? 'bg-[#2a9d8f] border-[#72efdd] text-[#f8f9fa]'
                    : 'bg-[#141311] border-white/10 text-[#d0c8be] hover:border-[#2a9d8f]/50'
                }`}
                title="Toggle A-B Loop Playback"
              >
                <Repeat className="w-3 h-3" />
              </button>
              {(loopStart !== null || loopEnd !== null) && (
                <button
                  onClick={onClearLoop}
                  className="p-1 rounded text-[#a69f95] hover:text-[#f8f9fa] hover:bg-white/10 cursor-pointer"
                  title="Clear A-B Loop"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 1-Click Song Section Loop Presets */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-[230px]">
              {song.sections.map((sec) => {
                const isSelected =
                  loopEnabled && loopStart === sec.startBeat && loopEnd === sec.endBeat;
                return (
                  <button
                    key={sec.id}
                    onClick={() => onSelectSectionLoop(sec.startBeat, sec.endBeat)}
                    className={`px-1.5 py-[1px] rounded text-[9px] whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#2a9d8f]/30 text-[#72efdd] border border-[#2a9d8f]/60 font-medium'
                        : 'bg-white/[0.04] text-[#a69f95] hover:text-[#f8f9fa] hover:bg-white/10'
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

        {/* ==================================================================
            3. INDEPENDENT 3-LAYER AUDIO MIXER (Flute · Tanpura · Tabla)
            ================================================================== */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#1f1d1a] border border-white/8">
          {/* Layer 1: Active Instrument Lead */}
          <AudioChannelSlider
            label={(INSTRUMENT_META[instrument] ?? INSTRUMENT_META.bansuri).mixerLabel}
            icon={<Music2 className="w-3.5 h-3.5 text-[#38bfa9]" />}
            value={volumes.flute}
            muted={mutes.flute}
            accent="jade"
            onChange={(v) => onVolumeChange('flute', v)}
            onToggleMute={() => onToggleMute('flute')}
          />

          {/* Layer 2: Tanpura Drone */}
          <div className="pl-2.5 border-l border-white/10 flex items-center gap-2">
            <AudioChannelSlider
              label={`Tanpura (${song.scale.rootNote.replace(/\d/, '')})`}
              icon={<Disc3 className={`w-3.5 h-3.5 text-[#d4a373] ${tanpuraHold || isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '9s' }} />}
              value={volumes.tanpura}
              muted={mutes.tanpura}
              accent="amber"
              onChange={(v) => onVolumeChange('tanpura', v)}
              onToggleMute={() => onToggleMute('tanpura')}
            />
            <button
              onClick={onToggleTanpuraHold}
              className={`px-1.5 py-1 rounded-md text-[9px] uppercase tracking-wider font-semibold border transition-colors cursor-pointer ${
                tanpuraHold
                  ? 'bg-[#d4a373]/25 border-[#d4a373]/70 text-[#e9c46a]'
                  : 'bg-[#141311] border-white/10 text-[#a69f95] hover:text-[#f8f9fa]'
              }`}
              title="Keep Tanpura Sa-Pa drone humming continuously even while paused"
            >
              Hold
            </button>
          </div>

          {/* Layer 3: Backing Tabla Beat */}
          <div className="pl-2.5 border-l border-white/10">
            <AudioChannelSlider
              label="Tabla Beat"
              icon={<Drum className="w-3.5 h-3.5 text-[#f4a261]" />}
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
    <div className="flex flex-col gap-1 w-[108px]">
      <div className="flex items-center justify-between gap-1 text-[10px]">
        <span className="flex items-center gap-1 text-[#d0c8be] truncate">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <button
          onClick={onToggleMute}
          className={`p-0.5 rounded transition-colors cursor-pointer ${
            muted ? 'text-[#f4a261]' : 'text-[#a69f95] hover:text-[#f8f9fa]'
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
