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
    audioEngine.setScaleHz(activeSong.scale.rootHz);
    ewiMidiBridge.setScaleRootHz(activeSong.scale.rootHz);
  }, [activeSong.scale.rootHz]);

  useEffect(() => {
    audioEngine.setEwiSettings(ewiSettings);
  }, [ewiSettings]);

  // Manage Tanpura Drone lifecycle
  useEffect(() => {
    if (isPlaying || tanpuraHold) {
      audioEngine.startTanpura(activeSong.scale.rootHz).catch(() => {});
    } else {
      audioEngine.stopTanpura();
    }
  }, [isPlaying, tanpuraHold, activeSong.scale.rootHz]);

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
    <div className="h-screen w-screen flex flex-col bg-[#121212] text-[#f8f9fa] overflow-hidden">
      {/* ====================================================================
          STUDIO TOP NAVIGATION BAR (Brand · 3-Instrument Switcher · Song · Guide)
          ==================================================================== */}
      <header className="h-13 px-3.5 flex items-center justify-between gap-2.5 bg-[#171513] border-b border-[#d4a373]/18 shrink-0 z-30">
        {/* Brand Identity */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#9b6a38] flex items-center justify-center shadow-[0_0_16px_rgba(212,163,115,0.3)]">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 text-[#121212]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M3 15L21 9" strokeLinecap="round" />
              <circle cx="8" cy="13.3" r="1.1" fill="currentColor" />
              <circle cx="11.5" cy="12.1" r="1.1" fill="currentColor" />
              <circle cx="15" cy="11" r="1.1" fill="currentColor" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-[#f8f9fa]">FluteMaster</span>
              <span className="hidden xl:inline-block px-1.5 py-[1px] rounded bg-[#d4a373]/15 border border-[#d4a373]/35 text-[9px] font-semibold uppercase tracking-wider text-[#e9c46a]">
                Wind Studio
              </span>
            </div>
            <p className="hidden lg:block text-[10px] text-[#a69f95] truncate max-w-[215px]">
              {instMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Sleek 4-Instrument Studio Switcher (Bansuri · Saxophone · Mouth Organ · EWI) */}
        <div
          className="flex items-center p-0.5 rounded-xl bg-[#121212] border border-[#d4a373]/25 shrink-0"
          role="tablist"
          aria-label="Choose 3D Wind Instrument"
        >
          {(
            [
              { id: 'bansuri', label: 'Bansuri' },
              { id: 'saxophone', label: 'Saxophone' },
              { id: 'harmonica', label: 'Mouth Organ' },
              { id: 'ewi', label: 'EWI' },
            ] as const
          ).map((item) => {
            const active = instrument === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectInstrument(item.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  active
                    ? 'bg-[#2a9d8f] text-[#f8f9fa] font-semibold shadow-[0_0_12px_rgba(42,157,143,0.45)]'
                    : 'text-[#b5aea5] hover:text-[#f8f9fa] hover:bg-white/[0.05]'
                }`}
                title={`Switch 3D Instrument to ${item.label} (Key I to cycle)`}
              >
                {item.id === 'ewi' && (
                  <Sparkles className={`w-3 h-3 ${active ? 'text-[#e9c46a]' : 'text-[#72efdd]/80'}`} />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Song Selector Pill (Opens Curated Song Library) */}
        <button
          onClick={() => setLibraryOpen(true)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#201e1b] hover:bg-[#272420] border border-[#d4a373]/28 hover:border-[#d4a373]/55 transition-all cursor-pointer max-w-sm min-w-0 group"
          title="Browse Bollywood Song Library (Shortcut: L)"
        >
          <Library className="w-4 h-4 text-[#d4a373] shrink-0" />
          <div className="text-left min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-semibold text-[#f8f9fa] truncate group-hover:text-[#e9c46a] transition-colors">
                {activeSong.title}
              </span>
              <span
                className={`hidden md:inline-block px-1.5 py-[1px] rounded text-[9px] font-medium shrink-0 border ${
                  bpmOverride !== null
                    ? 'bg-[#e9c46a]/20 border-[#e9c46a]/55 text-[#e9c46a]'
                    : 'bg-[#2a9d8f]/20 border-[#2a9d8f]/45 text-[#72efdd]'
                }`}
              >
                {Math.round(baseBpm * tempoRate)} BPM
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-[#a69f95] truncate">
              <span>
                {activeSong.movie} ({activeSong.year})
              </span>
              <span>·</span>
              <span>{activeSong.scale.name}</span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-[#a69f95] group-hover:text-[#f8f9fa] shrink-0" />
          <span className="hidden xl:inline-block px-1.5 py-0.5 rounded-md bg-[#d4a373]/15 border border-[#d4a373]/35 text-[10px] font-mono-tech font-semibold text-[#e9c46a] shrink-0">
            {allSongs.length}
          </span>
        </button>

        {/* Right Utility Actions: YouTube Reference + Guide */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setYoutubeRefOpen((v) => !v)}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer shrink-0 ${
              youtubeRefOpen
                ? 'bg-rose-500/20 border-rose-400/55 text-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.22)]'
                : 'bg-[#201e1b] hover:bg-[#2a2723] border-white/10 text-[#d0c8be] hover:text-[#f8f9fa]'
            }`}
            title="Open real YouTube rendition & cover comparison player"
          >
            <PlayCircle className={`w-3.5 h-3.5 ${youtubeRefOpen ? 'text-rose-400' : 'text-rose-400/90'}`} />
            <span className="hidden md:inline">YouTube Ref</span>
            {activeSong.youtubeId && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#2a9d8f]"
                title="Embedded rendition available"
              />
            )}
          </button>

          <button
            onClick={() => setGuideOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#201e1b] hover:bg-[#2a2723] border border-white/10 text-xs text-[#d0c8be] hover:text-[#f8f9fa] transition-colors cursor-pointer shrink-0"
            title="Sargam, Instrument Technique & Practice Guide"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#d4a373]" />
            <span className="hidden sm:inline">Guide</span>
          </button>
        </div>
      </header>

      {/* ====================================================================
          EASTAR EDA-100 HARDWARE CONTROL BAR (Only visible when EWI is active!)
          ==================================================================== */}
      {instrument === 'ewi' && (
        <div className="px-3.5 py-1.5 bg-[#121719] border-b border-[#72efdd]/22 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0 z-20">
          <div className="flex flex-wrap items-center gap-2">
            {/* Fingering Mode (01 Sax / 02 Flute) */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono-tech uppercase text-[#8ea5ab]">Fingering</span>
              <div className="flex rounded-md bg-[#0b0e10] p-0.5 border border-white/10">
                {(
                  [
                    { id: 'sax', label: '01 Sax' },
                    { id: 'flute', label: '02 Flute' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleUpdateEwiSettings({ fingeringMode: m.id })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-semibold cursor-pointer transition-all ${
                      ewiSettings.fingeringMode === m.id
                        ? 'bg-[#2a9d8f] text-[#f8f9fa]'
                        : 'text-[#9aa8b0] hover:text-[#f8f9fa]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Studio Voice (matches EDA-100 Tone slots) */}
            <div className="flex items-center gap-1 pl-2 border-l border-white/10">
              <span className="text-[10px] font-mono-tech uppercase text-[#8ea5ab]">Tone</span>
              <div className="flex rounded-md bg-[#0b0e10] p-0.5 border border-white/10">
                {EWI_STUDIO_VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleUpdateEwiSettings({ voice: v.id })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono-tech cursor-pointer transition-all whitespace-nowrap ${
                      ewiSettings.voice === v.id
                        ? 'bg-[#e9c46a] text-[#121212] font-bold'
                        : 'text-[#9aa8b0] hover:text-[#f8f9fa]'
                    }`}
                    title={v.desc}
                  >
                    {v.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Breath Sensitivity (01 / 02 / 03) */}
            <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-white/10">
              <span className="text-[10px] font-mono-tech uppercase text-[#8ea5ab]">Breath</span>
              <div className="flex rounded-md bg-[#0b0e10] p-0.5 border border-white/10">
                {([1, 2, 3] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => handleUpdateEwiSettings({ breathLevel: lvl })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tech cursor-pointer ${
                      ewiSettings.breathLevel === lvl
                        ? 'bg-[#72efdd]/25 text-[#72efdd] font-bold'
                        : 'text-[#9aa8b0] hover:text-[#f8f9fa]'
                    }`}
                    title={`EDA-100 Breath Sensitivity 0${lvl}`}
                  >
                    0{lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Reverb Depth (0-30) */}
            <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-white/10">
              <span className="text-[10px] font-mono-tech uppercase text-[#8ea5ab]">
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
                className="studio-slider studio-slider-jade w-16"
                aria-label="EDA-100 Reverb Level"
              />
            </div>

            {/* Pitch Bend Toggle */}
            <button
              onClick={() =>
                handleUpdateEwiSettings({ pitchBendEnabled: !ewiSettings.pitchBendEnabled })
              }
              className={`px-2 py-0.5 rounded-md border text-[10px] font-mono-tech font-semibold cursor-pointer transition-all ${
                ewiSettings.pitchBendEnabled
                  ? 'bg-[#e9c46a]/18 border-[#e9c46a]/55 text-[#e9c46a]'
                  : 'bg-[#0b0e10] border-white/10 text-[#9aa8b0]'
              }`}
              title="Toggle Right-Thumb Pitch Bend for Meend & Gamak"
            >
              PB {ewiSettings.pitchBendEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Right side: Auto-Transpose Readout + Web MIDI + Complete EDA-100 Guide */}
          <div className="flex items-center gap-2">
            {/* Live Per-Song Transpose Indicator */}
            <div
              className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1a1813] border border-[#e9c46a]/35 text-[10px] font-mono-tech"
              title="Dial this exact Transpose value on your physical Eastar EDA-100 to play this song in concert key"
            >
              <span className="text-[#a69f95]">EDA Trans:</span>
              <span className="font-bold text-[#e9c46a]">
                {formatTranspose(effectiveEwiTranspose)}
              </span>
            </div>

            {/* USB / BT MIDI Connect */}
            <button
              onClick={handleToggleMidi}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-mono-tech font-semibold cursor-pointer transition-all ${
                liveMidi.connected
                  ? 'bg-[#2a9d8f]/25 border-[#72efdd]/60 text-[#72efdd]'
                  : 'bg-[#171e20] border-white/12 text-[#b8cbd0] hover:border-[#72efdd]/45 hover:text-[#f8f9fa]'
              }`}
              title="Connect your physical Eastar EDA-100 via USB-C or Bluetooth MIDI"
            >
              <Usb className="w-3 h-3" />
              <span>{liveMidi.connected ? `MIDI: ${liveMidi.activeSwaraLabel ?? 'Live'}` : 'Connect MIDI'}</span>
            </button>

            {/* Full Interactive Eastar EDA-100 Tutorial Button */}
            <button
              onClick={() => setEwiGuideOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2a9d8f]/22 hover:bg-[#2a9d8f]/35 border border-[#72efdd]/50 text-[#72efdd] text-[11px] font-semibold cursor-pointer transition-all shadow-[0_0_12px_rgba(114,239,221,0.18)]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#e9c46a]" />
              <span>EDA-100 Tutorial &amp; Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          UPPER HALF (~54%): 3D INTERACTIVE INSTRUMENT STAGE (Bansuri / Sax / Mouth Organ / EWI)
          ==================================================================== */}
      <section className="relative isolate z-0 flex-[54] min-h-[250px] w-full">
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
          LOWER HALF (~34%): SCROLLING SARGAM NOTE HIGHWAY + INSTRUMENT TABS
          ==================================================================== */}
      <section className="relative flex-[34] min-h-[200px] w-full">
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
