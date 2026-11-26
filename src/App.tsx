import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioMutes,
  AudioVolumes,
  CameraView,
  EwiSettings,
  InstrumentType,
  LiveMidiState,
  Octave,
  Song,
  SwaraId,
} from './types/music';
import { SONGS } from './data/songs';
import { loadExpandedLibrary } from './data/libraryLoader';
import { INSTRUMENT_META } from './data/instruments';
import {
  DEFAULT_EWI_SETTINGS,
  EWI_STUDIO_VOICES,
  formatTranspose,
  getRecommendedEdaTranspose,
} from './data/ewi';
import { audioEngine } from './audio/BansuriAudioEngine';
import { ewiMidiBridge } from './audio/ewiMidi';
import { BansuriScene } from './components/three/BansuriScene';
import { SargamHighway } from './components/SargamHighway';
import { PracticeControls } from './components/PracticeControls';
import { StudioErrorBoundary } from './components/StudioErrorBoundary';
import { BookOpen, ChevronDown, Library, PlayCircle, Sparkles, Usb } from 'lucide-react';

// Code-split secondary drawers/modals (Vercel React Best Practices: bundle-dynamic-imports)
const SongLibraryDrawer = lazy(() =>
  import('./components/SongLibraryDrawer').then((m) => ({ default: m.SongLibraryDrawer }))
);
const NotationGuideModal = lazy(() =>
  import('./components/NotationGuideModal').then((m) => ({ default: m.NotationGuideModal }))
);
const EwiTutorialModal = lazy(() =>
  import('./components/EwiTutorialModal').then((m) => ({ default: m.EwiTutorialModal }))
);
const YouTubeReferenceCard = lazy(() =>
  import('./components/YouTubeReferenceCard').then((m) => ({ default: m.YouTubeReferenceCard }))
);

const INSTRUMENT_LIST: InstrumentType[] = ['bansuri', 'saxophone', 'harmonica', 'ewi'];

export function App() {
  // Instrument, Song & Expanded Library state
  const [instrument, setInstrument] = useState<InstrumentType>('bansuri');
  const [allSongs, setAllSongs] = useState<Song[]>(SONGS);
  const [loadingLibrary, setLoadingLibrary] = useState<boolean>(true);
  const [activeSong, setActiveSong] = useState<Song>(SONGS[0]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [ewiGuideOpen, setEwiGuideOpen] = useState(false);
  const [youtubeRefOpen, setYoutubeRefOpen] = useState(false);
  const [ewiSettings, setEwiSettings] = useState<EwiSettings>({ ...DEFAULT_EWI_SETTINGS });
  const [liveMidi, setLiveMidi] = useState<LiveMidiState>(() => ewiMidiBridge.getState());

  // Hydrate the 460+ notesandsargam.com expanded catalog cleanly in background
  useEffect(() => {
    let active = true;
    loadExpandedLibrary().then((imported) => {
      if (!active) return;
      if (imported.length > 0) {
        setAllSongs([...SONGS, ...imported]);
      }
      setLoadingLibrary(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Playback & Practice state
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepMode, setStepMode] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number>(SONGS[0].notes[0]?.startBeat ?? 0);
  const [tempoRate, setTempoRate] = useState<number>(1.0);
  const [bpmOverride, setBpmOverride] = useState<number | null>(null);
  const [tapPulse, setTapPulse] = useState<number>(0);
  const tapTimesRef = useRef<number[]>([]);
  const baseBpm = bpmOverride ?? activeSong.bpm;

  // A-B Loop state
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);

  // Visual / View preferences
  const [cameraView, setCameraView] = useState<CameraView>('front-facing');
  const [notationStyle, setNotationStyle] = useState<'short' | 'full'>('full');

  // Interactive sandbox override (when user tests individual swaras while paused)
  const [sandboxSwara, setSandboxSwara] = useState<{ swara: SwaraId; octave: Octave } | null>(null);

  // 3-Layer Audio Mixer state
  const [volumes, setVolumes] = useState<AudioVolumes>({
    flute: 0.85,
    tanpura: 0.45,
    tabla: 0.5,
  });
  const [mutes, setMutes] = useState<AudioMutes>({
    flute: false,
    tanpura: false,
    tabla: false,
  });
  const [tanpuraHold, setTanpuraHold] = useState<boolean>(false);

  // Mutable animation clock refs for jitter-free 60fps sync
  const beatRef = useRef<number>(currentBeat);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastTriggeredNoteIdRef = useRef<string | null>(null);
  const lastTablaBeatRef = useRef<number>(-999);
  const instrumentRef = useRef<InstrumentType>(instrument);

  useEffect(() => {
    instrumentRef.current = instrument;
  }, [instrument]);

  // Keep audio engine mixer & scale synced
  useEffect(() => {
    audioEngine.setVolumes(volumes, mutes);
  }, [volumes, mutes]);

  useEffect(() => {
    audioEngine.setScaleHz(activeSong.scale.rootHz, activeSong.droneSwara);
    ewiMidiBridge.setScaleRootHz(activeSong.scale.rootHz);
  }, [activeSong.scale.rootHz, activeSong.droneSwara]);

  useEffect(() => {
    audioEngine.setEwiSettings(ewiSettings);
  }, [ewiSettings]);

  // Manage Tanpura Drone lifecycle
  useEffect(() => {
    if (isPlaying || tanpuraHold) {
      audioEngine.startTanpura(activeSong.scale.rootHz, activeSong.droneSwara).catch(() => {});
    } else {
      audioEngine.stopTanpura();
    }
  }, [isPlaying, tanpuraHold, activeSong.scale.rootHz, activeSong.droneSwara]);

  useEffect(() => {
    return () => {
      audioEngine.stopCurrentFluteNote();
      audioEngine.stopTanpura();
      ewiMidiBridge.disconnect();
    };
  }, []);

  // Derive active note index & whether playhead is currently in a natural breath pause
  const { activeNoteIndex, isInNote, isBreathPause } = useMemo(() => {
    const notes = activeSong.notes;
    if (notes.length === 0) {
      return { activeNoteIndex: 0, isInNote: false, isBreathPause: false };
    }

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (currentBeat >= n.startBeat && currentBeat < n.startBeat + n.durationBeats) {
        return { activeNoteIndex: i, isInNote: true, isBreathPause: false };
      }
    }

    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (currentBeat >= n.startBeat + n.durationBeats) {
        const nextIdx = Math.min(i + 1, notes.length - 1);
        const breath = Boolean(n.breathAfter && currentBeat < notes[nextIdx].startBeat);
        return {
          activeNoteIndex: breath ? i : nextIdx,
          isInNote: false,
          isBreathPause: breath,
        };
      }
    }

    return { activeNoteIndex: 0, isInNote: false, isBreathPause: false };
  }, [activeSong.notes, currentBeat]);

  const activeNote = activeSong.notes[activeNoteIndex] ?? activeSong.notes[0];
  const displaySwara: SwaraId = sandboxSwara?.swara ?? activeNote?.swara ?? 'S';
  const displayOctave: Octave = sandboxSwara?.octave ?? activeNote?.octave ?? 'madhya';
  const displayOrnament = sandboxSwara ? undefined : isInNote ? activeNote?.ornament?.type : undefined;

  // Core 60fps Playback & Audio Scheduler Loop
  useEffect(() => {
    if (!isPlaying || stepMode) {
      lastFrameTimeRef.current = null;
      return;
    }

    let rafId = 0;
    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const deltaSec = Math.min((now - lastFrameTimeRef.current) / 1000, 0.1);
      lastFrameTimeRef.current = now;

      const beatsPerSec = (baseBpm * tempoRate) / 60;
      let nextBeat = beatRef.current + deltaSec * beatsPerSec;

      const loopReady = loopEnabled && loopStart !== null && loopEnd !== null && loopEnd > loopStart;
      if (loopReady && nextBeat >= loopEnd!) {
        nextBeat = loopStart!;
        lastTriggeredNoteIdRef.current = null;
        lastTablaBeatRef.current = Math.floor(nextBeat) - 1;
      } else if (nextBeat >= activeSong.totalBeats) {
        beatRef.current = activeSong.notes[0]?.startBeat ?? 0;
        setCurrentBeat(beatRef.current);
        setIsPlaying(false);
        audioEngine.stopCurrentFluteNote();
        return;
      }

      beatRef.current = nextBeat;
      setCurrentBeat(nextBeat);

      // Trigger Tabla Beat on integer matra boundaries
      const currentIntBeat = Math.floor(nextBeat);
      if (currentIntBeat > lastTablaBeatRef.current && currentIntBeat >= 0) {
        lastTablaBeatRef.current = currentIntBeat;
        audioEngine.triggerTablaBeat(activeSong, currentIntBeat);
      }

      // Trigger Active Instrument Lead voice when crossing note startBeat
      const notes = activeSong.notes;
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (nextBeat >= note.startBeat && nextBeat < note.startBeat + note.durationBeats) {
          if (lastTriggeredNoteIdRef.current !== note.id) {
            lastTriggeredNoteIdRef.current = note.id;
            const prevNote = i > 0 ? notes[i - 1] : null;
            const durSec = note.durationBeats / beatsPerSec;
            audioEngine.playLeadNote(
              note,
              activeSong.scale.rootHz,
              durSec,
              instrumentRef.current,
              prevNote
            );
          }
          break;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, stepMode, activeSong, baseBpm, tempoRate, loopEnabled, loopStart, loopEnd]);

  /* ========================================================================
     INTERACTIVE HANDLERS
     ======================================================================== */
  const handleUpdateEwiSettings = useCallback(
    (patch: Partial<EwiSettings>) => {
      setEwiSettings((prev) => {
        const next = { ...prev, ...patch };
        audioEngine.setEwiSettings(next);
        if (patch.voice && !isPlaying && instrumentRef.current === 'ewi') {
          audioEngine
            .playSingleSwaraPreview(displaySwara, displayOctave, activeSong.scale.rootHz, 'ewi')
            .catch(() => {});
        }
        return next;
      });
    },
    [isPlaying, displaySwara, displayOctave, activeSong.scale.rootHz]
  );

  const handleToggleMidi = useCallback(async () => {
    if (liveMidi.connected) {
      ewiMidiBridge.disconnect();
      return;
    }
    await ewiMidiBridge.connect({
      onStateChange: (state) => setLiveMidi(state),
      onNoteOn: (_midiNote, _vel, swara, octave) => {
        if (!isPlaying) {
          setSandboxSwara({ swara, octave });
        }
      },
    });
  }, [liveMidi.connected, isPlaying]);

  const effectiveEwiTranspose =
    ewiSettings.transposeMode === 'auto'
      ? getRecommendedEdaTranspose(activeSong.scale.id)
      : ewiSettings.manualTranspose;

  const handleSelectInstrument = useCallback(
    (next: InstrumentType) => {
      instrumentRef.current = next;
      audioEngine.stopCurrentFluteNote(0.02);
      setInstrument(next);
      lastTriggeredNoteIdRef.current = null;
      // When paused, immediately audition the current note in the newly chosen instrument's acoustic voice!
      if (!isPlaying) {
        audioEngine
          .playSingleSwaraPreview(displaySwara, displayOctave, activeSong.scale.rootHz, next)
          .catch(() => {});
      }
    },
    [isPlaying, displaySwara, displayOctave, activeSong.scale.rootHz]
  );

  const handleSelectSong = useCallback((song: Song) => {
    audioEngine.stopCurrentFluteNote();
    setIsPlaying(false);
    setSandboxSwara(null);
    setBpmOverride(null);
    tapTimesRef.current = [];
    setActiveSong(song);
    const startB = song.notes[0]?.startBeat ?? 0;
    beatRef.current = startB;
    setCurrentBeat(startB);
    setLoopStart(null);
    setLoopEnd(null);
    setLoopEnabled(false);
    lastTriggeredNoteIdRef.current = null;
    lastTablaBeatRef.current = -999;
  }, []);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const prev = tapTimesRef.current;
    const recent = prev.length > 0 && now - prev[prev.length - 1] < 2200 ? [...prev, now].slice(-5) : [now];
    tapTimesRef.current = recent;

    setTapPulse((p) => p + 1);
    window.setTimeout(() => setTapPulse((p) => Math.max(0, p - 1)), 220);

    if (recent.length >= 2) {
      let sumIntervals = 0;
      for (let i = 1; i < recent.length; i++) {
        sumIntervals += recent[i] - recent[i - 1];
      }
      const avgMs = sumIntervals / (recent.length - 1);
      if (avgMs > 180) {
        const computedBpm = Math.max(45, Math.min(180, Math.round(60000 / avgMs)));
        setBpmOverride(computedBpm);
      }
    }
  }, []);

  const handleResetBpm = useCallback(() => {
    setBpmOverride(null);
    tapTimesRef.current = [];
  }, []);

  const handleTogglePlay = useCallback(async () => {
    await audioEngine.ensureStarted(instrumentRef.current);
    setSandboxSwara(null);
    if (isPlaying) {
      setIsPlaying(false);
      audioEngine.stopCurrentFluteNote();
    } else {
      if (stepMode) {
        setStepMode(false);
      }
      if (
        loopEnabled &&
        loopStart !== null &&
        loopEnd !== null &&
        (beatRef.current < loopStart || beatRef.current >= loopEnd)
      ) {
        beatRef.current = loopStart;
        setCurrentBeat(loopStart);
      }
      lastTriggeredNoteIdRef.current = null;
      lastTablaBeatRef.current = Math.floor(beatRef.current) - 1;
      setIsPlaying(true);
    }
  }, [isPlaying, stepMode, loopEnabled, loopStart, loopEnd]);

  const handleRestart = useCallback(() => {
    audioEngine.stopCurrentFluteNote();
    setSandboxSwara(null);
    const targetBeat =
      loopEnabled && loopStart !== null ? loopStart : activeSong.notes[0]?.startBeat ?? 0;
    beatRef.current = targetBeat;
    setCurrentBeat(targetBeat);
    lastTriggeredNoteIdRef.current = null;
    lastTablaBeatRef.current = Math.floor(targetBeat) - 1;
  }, [activeSong, loopEnabled, loopStart]);

  const jumpToNoteAndPreview = useCallback(
    async (index: number, shouldPreviewAudio: boolean) => {
      const clamped = Math.max(0, Math.min(activeSong.notes.length - 1, index));
      const note = activeSong.notes[clamped];
      if (!note) return;

      setSandboxSwara(null);
      beatRef.current = note.startBeat + 0.01;
      setCurrentBeat(note.startBeat + 0.01);
      lastTriggeredNoteIdRef.current = note.id;
      lastTablaBeatRef.current = Math.floor(note.startBeat);

      if (shouldPreviewAudio) {
        await audioEngine.ensureStarted(instrumentRef.current);
        const prev = clamped > 0 ? activeSong.notes[clamped - 1] : null;
        const durSec = Math.max(0.65, (note.durationBeats * 60) / (baseBpm * tempoRate));
        audioEngine.playLeadNote(note, activeSong.scale.rootHz, durSec, instrumentRef.current, prev);
      }
    },
    [activeSong, baseBpm, tempoRate]
  );

  const handleToggleStepMode = useCallback(() => {
    setStepMode((prev) => {
      const next = !prev;
      if (next) {
        setIsPlaying(false);
        jumpToNoteAndPreview(activeNoteIndex, true);
      }
      return next;
    });
  }, [activeNoteIndex, jumpToNoteAndPreview]);

  const handleStepNext = useCallback(() => {
    const notes = activeSong.notes;
    let nextIdx = activeNoteIndex + 1;
    if (loopEnabled && loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
      if (nextIdx >= notes.length || notes[nextIdx].startBeat >= loopEnd) {
        const firstInLoop = notes.findIndex((n) => n.startBeat >= loopStart - 0.05);
        nextIdx = firstInLoop >= 0 ? firstInLoop : 0;
      }
    } else if (nextIdx >= notes.length) {
      nextIdx = 0;
    }
    jumpToNoteAndPreview(nextIdx, true);
  }, [activeSong.notes, activeNoteIndex, loopEnabled, loopStart, loopEnd, jumpToNoteAndPreview]);

  const handleStepPrev = useCallback(() => {
    jumpToNoteAndPreview(Math.max(0, activeNoteIndex - 1), true);
  }, [activeNoteIndex, jumpToNoteAndPreview]);

  const handleStepReplay = useCallback(() => {
    jumpToNoteAndPreview(activeNoteIndex, true);
  }, [activeNoteIndex, jumpToNoteAndPreview]);

  const handleSeekToBeat = useCallback(
    (beat: number) => {
      setSandboxSwara(null);
      const clamped = Math.max(0, Math.min(activeSong.totalBeats - 0.2, beat));
      beatRef.current = clamped;
      setCurrentBeat(clamped);
      lastTriggeredNoteIdRef.current = null;
      lastTablaBeatRef.current = Math.floor(clamped) - 1;
    },
    [activeSong.totalBeats]
  );

  const handleSelectNote = useCallback(
    (noteIdx: number) => {
      jumpToNoteAndPreview(noteIdx, !isPlaying || stepMode);
    },
    [isPlaying, stepMode, jumpToNoteAndPreview]
  );

  const handleSetLoopA = useCallback(() => {
    const a = Number(currentBeat.toFixed(2));
    setLoopStart(a);
    if (loopEnd !== null && loopEnd <= a) {
      setLoopEnd(Math.min(activeSong.totalBeats, a + 8));
    }
  }, [currentBeat, loopEnd, activeSong.totalBeats]);

  const handleSetLoopB = useCallback(() => {
    const b = Number(Math.max(currentBeat, (loopStart ?? 0) + 1).toFixed(2));
    const start = loopStart ?? activeSong.notes[0]?.startBeat ?? 0;
    setLoopStart(start);
    setLoopEnd(b);
    setLoopEnabled(true);
  }, [currentBeat, loopStart, activeSong.notes]);

  const handleSelectSectionLoop = useCallback((startBeat: number, endBeat: number) => {
    setLoopStart(startBeat);
    setLoopEnd(endBeat);
    setLoopEnabled(true);
    beatRef.current = startBeat;
    setCurrentBeat(startBeat);
    lastTriggeredNoteIdRef.current = null;
    lastTablaBeatRef.current = Math.floor(startBeat) - 1;
  }, []);

  const handleClearLoop = useCallback(() => {
    setLoopStart(null);
    setLoopEnd(null);
    setLoopEnabled(false);
  }, []);

  const handleVolumeChange = useCallback((layer: keyof AudioVolumes, value: number) => {
    setVolumes((prev) => ({ ...prev, [layer]: value }));
    if (value > 0.01) {
      setMutes((prev) => (prev[layer] ? { ...prev, [layer]: false } : prev));
    }
  }, []);

  const handleToggleMute = useCallback((layer: keyof AudioMutes) => {
    setMutes((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleToggleTanpuraHold = useCallback(async () => {
    await audioEngine.ensureStarted();
    setTanpuraHold((v) => !v);
  }, []);

  const handlePreviewSwara = useCallback(
    (swara: SwaraId, octave: Octave) => {
      if (isPlaying) setIsPlaying(false);
      setSandboxSwara({ swara, octave });
      audioEngine.playSingleSwaraPreview(
        swara,
        octave,
        activeSong.scale.rootHz,
        instrumentRef.current
      );
    },
    [isPlaying, activeSong.scale.rootHz]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement
      ) {
        if (e.code !== 'Space') return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (!stepMode) setStepMode(true);
        setIsPlaying(false);
        handleStepNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (!stepMode) setStepMode(true);
        setIsPlaying(false);
        handleStepPrev();
      } else if (e.key === '1') {
        setCameraView('first-person');
      } else if (e.key === '2') {
        setCameraView('front-facing');
      } else if (e.key === '3') {
        setCameraView('close-up');
      } else if (e.key.toLowerCase() === 'i' && !e.metaKey && !e.ctrlKey) {
        const nextIdx = (INSTRUMENT_LIST.indexOf(instrumentRef.current) + 1) % INSTRUMENT_LIST.length;
        handleSelectInstrument(INSTRUMENT_LIST[nextIdx]);
      } else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey) {
        setLibraryOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handleStepNext, handleStepPrev, handleSelectInstrument, stepMode]);

  const instMeta = INSTRUMENT_META[instrument];

  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] w-full flex flex-col bg-[#0c0c0b] text-[#f2ede4] lg:overflow-hidden">
      {/* ====================================================================
          STUDIO TOP CONSOLE RAIL (Architectural hairline tabs · responsive 2-tier on < md)
          ==================================================================== */}
      <header className="px-2.5 sm:px-3.5 py-2 md:py-0 md:h-12 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 bg-[#11100f] border-b border-[#262320] shrink-0 z-30">
        {/* Brand Identity */}
        <div className="order-1 flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[3px] bg-[#181613] border border-[#c9a25e]/45 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-4.5 h-4.5 text-[#c9a25e]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
            >
              <path d="M3 15L21 9" strokeLinecap="round" />
              <circle cx="8" cy="13.3" r="1.1" fill="#f2ede4" stroke="none" />
              <circle cx="11.5" cy="12.1" r="1.1" fill="#f2ede4" stroke="none" />
              <circle cx="15" cy="11" r="1.1" fill="#e05a33" stroke="none" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-semibold text-sm sm:text-base tracking-tight text-[#f2ede4]">
                FluteMaster
              </span>
              <span className="hidden xl:inline text-[10px] font-mono-tech uppercase tracking-widest text-[#8a8278]">
                v1.1
              </span>
            </div>
            <p className="hidden xl:block text-[10px] text-[#8a8278] truncate max-w-[205px]">
              {instMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Flush 4-Instrument Selector Rail (vermilion bottom indicator bar, zero glow pills) */}
        <div
          className="order-4 md:order-2 grid grid-cols-4 md:flex items-stretch border border-[#262320] md:border-y-0 md:h-12 bg-[#0a0a09] md:bg-transparent w-full md:w-auto shrink-0 divide-x divide-[#262320] md:divide-x-0"
          role="tablist"
          aria-label="Choose 3D Wind Instrument"
        >
          {(
            [
              { id: 'bansuri', label: 'Bansuri', short: 'Bansuri' },
              { id: 'saxophone', label: 'Saxophone', short: 'Sax' },
              { id: 'harmonica', label: 'Mouth Organ', short: 'Organ' },
              { id: 'ewi', label: 'EWI', short: 'EWI' },
            ] as const
          ).map((item) => {
            const active = instrument === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectInstrument(item.id)}
                className={`relative px-2 lg:px-3.5 py-1.5 md:py-0 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 border-b-2 ${
                  active
                    ? 'border-[#e05a33] bg-[#191715] text-[#f2ede4] font-semibold'
                    : 'border-transparent text-[#8a8278] hover:text-[#f2ede4] hover:bg-[#151412]'
                }`}
                title={`Switch 3D Instrument to ${item.label} (Key I to cycle)`}
              >
                {item.id === 'ewi' && (
                  <Sparkles className={`w-3 h-3 shrink-0 ${active ? 'text-[#e05a33]' : 'text-[#3ca38f]'}`} />
                )}
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Song Selector (Recessed matte well, Fraunces title + mono count) */}
        <button
          onClick={() => setLibraryOpen(true)}
          className="order-2 md:order-3 flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-[3px] bg-[#0a0a09] hover:bg-[#151412] border border-[#262320] hover:border-[#c9a25e]/60 transition-colors cursor-pointer flex-1 md:flex-initial md:max-w-[235px] lg:max-w-xs xl:max-w-sm min-w-0 group"
          title="Browse Bollywood Song Library (Shortcut: L)"
        >
          <Library className="w-3.5 h-3.5 text-[#c9a25e] shrink-0" />
          <div className="text-left min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs sm:text-[13px] font-semibold text-[#f2ede4] truncate group-hover:text-[#c9a25e] transition-colors">
                {activeSong.title}
              </span>
              <span
                className={`hidden lg:inline-block font-mono-tech text-[10px] shrink-0 ${
                  bpmOverride !== null ? 'text-[#e05a33]' : 'text-[#3ca38f]'
                }`}
              >
                {Math.round(baseBpm * tempoRate)} BPM
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#8a8278] truncate">
              <span className="truncate">
                {activeSong.movie} ({activeSong.year})
              </span>
              <span>·</span>
              <span className="shrink-0 font-mono-tech">{activeSong.scale.name}</span>
            </div>
          </div>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-[2px] bg-[#161513] border border-[#262320] text-[10px] font-mono-tech text-[#c9a25e] shrink-0">
            {allSongs.length}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#8a8278] group-hover:text-[#f2ede4] shrink-0" />
        </button>

        {/* Right Utility Switches */}
        <div className="order-3 md:order-4 flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setYoutubeRefOpen((v) => !v)}
            className={`relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-[2px] border text-xs transition-colors cursor-pointer shrink-0 ${
              youtubeRefOpen
                ? 'bg-[#2a1814] border-[#e05a33]/70 text-[#f2ede4]'
                : 'bg-[#161513] hover:bg-[#1d1b18] border-[#262320] text-[#b8b0a5] hover:text-[#f2ede4]'
            }`}
            title="Open real YouTube rendition & cover comparison player"
          >
            <PlayCircle className={`w-3.5 h-3.5 ${youtubeRefOpen ? 'text-[#e05a33]' : 'text-[#c9a25e]'}`} />
            <span className="hidden lg:inline">YouTube Ref</span>
            {activeSong.youtubeId && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#e05a33]"
                title="Embedded rendition available"
              />
            )}
          </button>

          <button
            onClick={() => setGuideOpen(true)}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-[2px] bg-[#161513] hover:bg-[#1d1b18] border border-[#262320] text-xs text-[#b8b0a5] hover:text-[#f2ede4] transition-colors cursor-pointer shrink-0"
            title="Sargam, Instrument Technique & Practice Guide"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#c9a25e]" />
            <span className="hidden lg:inline">Guide</span>
          </button>
        </div>
      </header>

      {/* ====================================================================
          EASTAR EDA-100 HARDWARE RACK STRIP (Recessed tactile switches · swipeable on mobile)
          ==================================================================== */}
      {instrument === 'ewi' && (
        <div className="px-2.5 sm:px-3.5 py-1.5 bg-[#090908] border-b border-[#242321] flex items-center justify-between gap-1.5 xl:gap-2 text-[11px] shrink-0 z-20 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            {/* Fingering Mode (01 Sax / 02 Flute) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="hidden xl:inline text-[10px] font-mono-tech uppercase tracking-wider text-[#8a8278]">
                Fingering
              </span>
              <div className="flex rounded-[2px] bg-[#131210] border border-[#262320] divide-x divide-[#262320]">
                {(
                  [
                    { id: 'sax', label: '01 Sax' },
                    { id: 'flute', label: '02 Flute' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleUpdateEwiSettings({ fingeringMode: m.id })}
                    className={`px-2 py-0.5 text-[10px] font-mono-tech cursor-pointer transition-colors whitespace-nowrap ${
                      ewiSettings.fingeringMode === m.id
                        ? 'bg-[#3ca38f] text-[#0c0c0b] font-semibold'
                        : 'text-[#8a8278] hover:text-[#f2ede4]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Studio Voice (matches EDA-100 Tone slots) */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#262320] shrink-0">
              <span className="hidden xl:inline text-[10px] font-mono-tech uppercase tracking-wider text-[#8a8278]">
                Tone
              </span>
              <div className="flex rounded-[2px] bg-[#131210] border border-[#262320] divide-x divide-[#262320]">
                {EWI_STUDIO_VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleUpdateEwiSettings({ voice: v.id })}
                    className={`px-1.5 xl:px-2 py-0.5 text-[10px] font-mono-tech cursor-pointer transition-colors whitespace-nowrap ${
                      ewiSettings.voice === v.id
                        ? 'bg-[#c9a25e] text-[#0c0c0b] font-semibold'
                        : 'text-[#8a8278] hover:text-[#f2ede4]'
                    }`}
                    title={v.desc}
                  >
                    {v.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Breath Sensitivity (01 / 02 / 03) */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#262320] shrink-0">
              <span className="text-[10px] font-mono-tech uppercase text-[#8a8278]">
                <span className="xl:hidden">BR</span>
                <span className="hidden xl:inline">Breath</span>
              </span>
              <div className="flex rounded-[2px] bg-[#131210] border border-[#262320] divide-x divide-[#262320]">
                {([1, 2, 3] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => handleUpdateEwiSettings({ breathLevel: lvl })}
                    className={`px-1.5 py-0.5 text-[10px] font-mono-tech cursor-pointer transition-colors ${
                      ewiSettings.breathLevel === lvl
                        ? 'bg-[#f2ede4] text-[#0c0c0b] font-semibold'
                        : 'text-[#8a8278] hover:text-[#f2ede4]'
                    }`}
                    title={`EDA-100 Breath Sensitivity 0${lvl}`}
                  >
                    0{lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Reverb Depth (0-30) */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#262320] shrink-0">
              <span className="text-[10px] font-mono-tech uppercase text-[#8a8278] whitespace-nowrap">
                Rev {String(ewiSettings.reverbLevel).padStart(2, '0')}
              </span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={ewiSettings.reverbLevel}
                onChange={(e) =>
                  handleUpdateEwiSettings({ reverbLevel: parseInt(e.target.value, 10) })
                }
                className="studio-slider studio-slider-jade w-14 sm:w-16"
                aria-label="EDA-100 Reverb Level"
              />
            </div>

            {/* Pitch Bend Toggle */}
            <button
              onClick={() =>
                handleUpdateEwiSettings({ pitchBendEnabled: !ewiSettings.pitchBendEnabled })
              }
              className={`px-2 py-0.5 rounded-[2px] border text-[10px] font-mono-tech font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                ewiSettings.pitchBendEnabled
                  ? 'bg-[#2a1a12] border-[#e05a33]/65 text-[#f2ede4]'
                  : 'bg-[#131210] border-[#262320] text-[#8a8278]'
              }`}
              title="Toggle Right-Thumb Pitch Bend for Meend & Gamak"
            >
              PB {ewiSettings.pitchBendEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Right side: Auto-Transpose Readout + Web MIDI + Complete EDA-100 Guide */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#131210] border border-[#262320] text-[10px] font-mono-tech whitespace-nowrap shrink-0"
              title="Dial this exact Transpose value on your physical Eastar EDA-100 to play this song in concert key"
            >
              <span className="text-[#8a8278]">Trans:</span>
              <span className="font-semibold text-[#c9a25e]">
                {formatTranspose(effectiveEwiTranspose)}
              </span>
            </div>

            <button
              onClick={handleToggleMidi}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] border text-[10px] font-mono-tech font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                liveMidi.connected
                  ? 'bg-[#172b26] border-[#3ca38f] text-[#f2ede4]'
                  : 'bg-[#131210] border-[#262320] text-[#b8b0a5] hover:border-[#c9a25e]/60 hover:text-[#f2ede4]'
              }`}
              title="Connect your physical Eastar EDA-100 via USB-C or Bluetooth MIDI"
            >
              <Usb className="w-3 h-3 shrink-0 text-[#3ca38f]" />
              <span>{liveMidi.connected ? `MIDI: ${liveMidi.activeSwaraLabel ?? 'Live'}` : 'MIDI'}</span>
            </button>

            <button
              onClick={() => setEwiGuideOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#181613] hover:bg-[#201d19] border border-[#c9a25e]/50 text-[#f2ede4] text-[10px] font-mono-tech font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3 h-3 text-[#c9a25e] shrink-0" />
              <span className="xl:hidden">EDA Guide</span>
              <span className="hidden xl:inline">EDA-100 Guide</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          UPPER STAGE: 3D INTERACTIVE INSTRUMENT (Responsive dvh on mobile · flex-[54] on lg+)
          ==================================================================== */}
      <section className="relative isolate z-0 h-[44dvh] min-h-[260px] sm:h-[47dvh] lg:h-auto lg:flex-[54] lg:min-h-[240px] w-full">
        <StudioErrorBoundary variant="stage">
          <BansuriScene
            instrument={instrument}
            ewiSettings={ewiSettings}
            liveMidi={liveMidi}
            song={activeSong}
            activeSwara={displaySwara}
            activeOctave={displayOctave}
            activeOrnament={displayOrnament}
            isPlaying={isPlaying}
            isBreathPause={isBreathPause && !sandboxSwara}
            cameraView={cameraView}
            onCameraViewChange={setCameraView}
            notationStyle={notationStyle}
            onPreviewSwara={handlePreviewSwara}
          />
        </StudioErrorBoundary>
      </section>

      {/* ====================================================================
          LOWER STAGE: SCROLLING SARGAM NOTE HIGHWAY + INSTRUMENT TABS
          ==================================================================== */}
      <section className="relative h-[220px] sm:h-[235px] lg:h-auto lg:flex-[34] lg:min-h-[195px] w-full">
        <SargamHighway
          instrument={instrument}
          ewiSettings={ewiSettings}
          song={activeSong}
          currentBeat={currentBeat}
          activeNoteIndex={activeNoteIndex}
          isPlaying={isPlaying}
          stepMode={stepMode}
          loopStart={loopStart}
          loopEnd={loopEnd}
          loopEnabled={loopEnabled}
          notationStyle={notationStyle}
          onNotationStyleChange={setNotationStyle}
          onSeekToBeat={handleSeekToBeat}
          onSelectNote={handleSelectNote}
        />
      </section>

      {/* ====================================================================
          BOTTOM DOCK: INTERACTIVE PRACTICE & AUDIO MIXER CONTROLS
          ==================================================================== */}
      <PracticeControls
        instrument={instrument}
        song={activeSong}
        baseBpm={baseBpm}
        isCustomBpm={bpmOverride !== null}
        tapPulse={tapPulse}
        isPlaying={isPlaying}
        stepMode={stepMode}
        activeNoteIndex={activeNoteIndex}
        tempoRate={tempoRate}
        loopStart={loopStart}
        loopEnd={loopEnd}
        loopEnabled={loopEnabled}
        volumes={volumes}
        mutes={mutes}
        tanpuraHold={tanpuraHold}
        onTogglePlay={handleTogglePlay}
        onRestart={handleRestart}
        onToggleStepMode={handleToggleStepMode}
        onStepPrev={handleStepPrev}
        onStepReplay={handleStepReplay}
        onStepNext={handleStepNext}
        onTempoChange={setTempoRate}
        onTapTempo={handleTapTempo}
        onResetBpm={handleResetBpm}
        onSetLoopA={handleSetLoopA}
        onSetLoopB={handleSetLoopB}
        onToggleLoop={() => setLoopEnabled((v) => !v)}
        onClearLoop={handleClearLoop}
        onSelectSectionLoop={handleSelectSectionLoop}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleTanpuraHold={handleToggleTanpuraHold}
      />

      {/* Lazy-Loaded Studio Overlays, Library & Hardware Guides */}
      <Suspense fallback={null}>
        {youtubeRefOpen && (
          <YouTubeReferenceCard
            open={youtubeRefOpen}
            song={activeSong}
            instrument={instrument}
            baseBpm={baseBpm}
            isCustomBpm={bpmOverride !== null}
            onClose={() => setYoutubeRefOpen(false)}
          />
        )}

        {libraryOpen && (
          <SongLibraryDrawer
            open={libraryOpen}
            songs={allSongs}
            loadingExpanded={loadingLibrary}
            activeSongId={activeSong.id}
            onClose={() => setLibraryOpen(false)}
            onSelectSong={handleSelectSong}
          />
        )}

        {guideOpen && (
          <NotationGuideModal
            open={guideOpen}
            onClose={() => setGuideOpen(false)}
            onOpenEwiGuide={() => setEwiGuideOpen(true)}
          />
        )}

        {ewiGuideOpen && (
          <EwiTutorialModal
            open={ewiGuideOpen}
            onClose={() => setEwiGuideOpen(false)}
            song={activeSong}
            ewiSettings={ewiSettings}
            onUpdateSettings={handleUpdateEwiSettings}
            liveMidi={liveMidi}
            onToggleMidi={handleToggleMidi}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
