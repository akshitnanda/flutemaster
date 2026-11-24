import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Headphones,
  Music,
  Sliders,
  Sparkles,
  Usb,
  Volume2,
  Wind,
  Wrench,
  X,
} from 'lucide-react';
import { EwiSettings, LiveMidiState, Song, SwaraId } from '../types/music';
import {
  EDA100_TONES,
  EdaToneEntry,
  formatTranspose,
  getEwiFingering,
  getRecommendedEdaTranspose,
} from '../data/ewi';
import { BANSURI_SCALES, SWARA_META } from '../data/sargam';
import { SwaraSymbol } from './SwaraSymbol';

interface EwiTutorialModalProps {
  open: boolean;
  onClose: () => void;
  song: Song;
  ewiSettings: EwiSettings;
  onUpdateSettings: (patch: Partial<EwiSettings>) => void;
  liveMidi: LiveMidiState;
  onToggleMidi: () => void;
}

type GuideTab = 'setup' | 'settings' | 'playstyle' | 'tones';

const ALL_SWARAS: SwaraId[] = ['S', 'Rk', 'R', 'Gk', 'G', 'M', 'Mt', 'P', 'Dk', 'D', 'Nk', 'N'];

export const EwiTutorialModal: React.FC<EwiTutorialModalProps> = ({
  open,
  onClose,
  song,
  ewiSettings,
  onUpdateSettings,
  liveMidi,
  onToggleMidi,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('setup');
  const [toneFilter, setToneFilter] = useState<'recommended' | 'All' | EdaToneEntry['category']>(
    'recommended'
  );

  const recommendedTrans = useMemo(
    () => getRecommendedEdaTranspose(song.scale.id),
    [song.scale.id]
  );

  const filteredTones = useMemo(() => {
    if (toneFilter === 'recommended') return EDA100_TONES.filter((t) => t.recommended);
    if (toneFilter === 'All') return EDA100_TONES;
    return EDA100_TONES.filter((t) => t.category === toneFilter);
  }, [toneFilter]);

  if (!open) return null;

  const tabs: Array<{ id: GuideTab; label: string; icon: React.ReactNode }> = [
    { id: 'setup', label: 'Setup & Controls', icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Bollywood Settings', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'playstyle', label: 'Play Style & Keys', icon: <Wind className="w-3.5 h-3.5" /> },
    { id: 'tones', label: 'All 27 Tones & Routine', icon: <Music className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#181614] border border-[#72efdd]/30 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#141311]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2a9d8f]/30 to-[#72efdd]/15 border border-[#72efdd]/40 flex items-center justify-center text-[#72efdd]">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[#f8f9fa] flex items-center gap-2">
                Eastar EDA-100 Digital Aerophone · Complete Guide
                <span className="hidden sm:inline-block text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-[#2a9d8f]/20 border border-[#72efdd]/35 text-[#72efdd]">
                  27 Tones · Dual Fingering · USB/BT MIDI
                </span>
              </h2>
              <p className="text-xs text-[#a69f95]">
                Hardware setup, Bollywood Transpose &amp; Reverb tuning, capacitive play style &amp;
                12-Swara key charts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a69f95] hover:text-[#f8f9fa] hover:bg-white/10 cursor-pointer"
            title="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-white/8 bg-[#1a1816] overflow-x-auto">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer border outline-none focus-visible:ring-1 focus-visible:ring-[#72efdd]/60 ${
                  active
                    ? 'bg-[#2a9d8f]/25 border-[#72efdd]/50 text-[#72efdd] shadow-sm'
                    : 'bg-transparent border-transparent text-[#a69f95] hover:text-[#f8f9fa] hover:bg-white/5'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* ==============================================================
              TAB 1: SETUP & HARDWARE CONTROLS
              ============================================================== */}
          {activeTab === 'setup' && (
            <>
              {/* Quick Unboxing & First-5-Minutes Checklist */}
              <div className="rounded-xl bg-[#201e1b] border border-[#72efdd]/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-[#72efdd]">
                    First 5 Minutes Out of the Box (Eastar EDA-100)
                  </h3>
                  <span className="text-[10px] font-mono-tech text-[#a69f95]">
                    ~14 oz · 5h Rechargeable Battery · 3W Hi-Fi Speaker
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    [
                      '1. Charge & Fit Silicone Mouthpiece',
                      'Charge via USB-C first. Firmly seat one of the 2 included soft removable silicone mouthpieces (washable with warm water after practice).',
                    ],
                    [
                      '2. Power On & Choose Output',
                      'Hold Power button (~2s) until the OLED screen lights up. Practice aloud with the built-in 3W speaker or plug 3.5mm wired headphones in for zero-noise late-night practice.',
                    ],
                    [
                      '3. Pick Your Fingering Mode (Fingering Button)',
                      'Press Fingering: "01" = Alto Saxophone layout (factory default, great if you play Sax or want standard EWI muscle memory); "02" = Flute layout (closest to Bansuri!).',
                    ],
                    [
                      '4. Dial Tone 06 (Bamboo Flute) or 08 (Electronic Flute)',
                      'Press Tone + Up/Down to select 06 Bamboo Flute, 01 Alto Sax, 08 Electronic Flute, or 09 Erhu. Set Reverb to 20 and Breath to 01 (Light) or 02 (Medium).',
                    ],
                  ].map(([title, desc]) => (
                    <div
                      key={title}
                      className="p-3 rounded-lg bg-[#161412] border border-white/6 space-y-1"
                    >
                      <div className="font-semibold text-[#f8f9fa] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2a9d8f] shrink-0" />
                        {title}
                      </div>
                      <p className="text-[#a69f95] leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complete Hardware Control Map */}
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373] mb-2.5">
                  Physical EDA-100 Controls &amp; Rear Touch Sensors
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    ['Tone (01–27)', 'Cycles all 27 built-in acoustic & synth voices (Sax, Bamboo Flute, Erhu, Hulusi, Harmonica, Trumpet…).'],
                    ['Fingering (01 / 02)', 'Switches between 01 Saxophone mode and 02 Flute mode — match this with the FluteMaster EWI top bar!'],
                    ['Trans (−12 to +12)', 'Instantly shifts pitch in semitones so one single fingering plays ANY Bollywood song scale in concert key!'],
                    ['Breath (01 / 02 / 03)', '01 = Lightest airflow (easiest for beginners), 02 = Balanced dynamic control, 03 = Heavy/expressive swells.'],
                    ['Reverb (00–30)', 'Built-in hall ambience (default 20). Set 20–24 for soulful Bollywood flute/ballads, 10–14 for crisp fast songs.'],
                    ['Volume (00–12)', 'Controls built-in 3W speaker & 3.5mm headphone level independently of breath dynamics.'],
                    ['Rear Left-Thumb Octave Pads', '3 capacitive touch zones (OCT− / 0 / OCT+). Slide/roll Left Thumb up or down to jump octaves effortlessly — no overblowing!'],
                    ['Right-Thumb Pitch Bend', 'Dedicated Pitch Bend button/pad next to the right thumb rest — smoothly bends pitch for authentic Indian Meend & Gamak!'],
                    ['Noiseless Touch Keys', 'Zero mechanical spring clicks! Capacitive metallic sensors fire instantly on light skin contact (dry/clean fingertips work best).'],
                  ].map(([name, info]) => (
                    <div
                      key={name}
                      className="p-3 rounded-xl bg-[#201e1b] border border-white/6 space-y-1"
                    >
                      <div className="font-semibold text-[#e9c46a] font-mono-tech text-[11px]">
                        {name}
                      </div>
                      <p className="text-[#a69f95] leading-relaxed">{info}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sensor Self-Test + USB/Bluetooth MIDI Connect Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#1f1a15] border border-[#f4a261]/30 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-[#f4a261]">
                    <Wrench className="w-4 h-4" />
                    Built-In EDA-100 Sensor Self-Test &amp; Care
                  </div>
                  <p className="text-[#d0c8be] leading-relaxed">
                    If any touch pad ever feels overly sensitive or sticky:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[#a69f95]">
                    <li>
                      Press <strong className="text-[#f8f9fa]">Fingering + Breath</strong> together
                      for 2 seconds to enter <strong className="text-[#f4a261]">Sensor Test</strong>{' '}
                      mode and verify each metallic touch pad &amp; breath trigger.
                    </li>
                    <li>
                      Keep fingers &amp; capacitive keys dry (moisture bridges adjacent touch pads).
                    </li>
                    <li>
                      Store upright after playing so condensation drains cleanly out of the bottom
                      port.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#132022] border border-[#72efdd]/30 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-[#72efdd]">
                      <Usb className="w-4 h-4" />
                      Connect Your Real EDA-100 via MIDI
                    </div>
                    <span
                      className={`text-[10px] font-mono-tech px-2 py-0.5 rounded-full border ${
                        liveMidi.connected
                          ? 'bg-[#2a9d8f]/25 border-[#72efdd]/50 text-[#72efdd]'
                          : 'bg-white/5 border-white/10 text-[#a69f95]'
                      }`}
                    >
                      {liveMidi.connected ? 'CONNECTED' : 'READY'}
                    </span>
                  </div>
                  <p className="text-[#d0c8be] leading-relaxed">
                    Plug your Eastar EDA-100 into this computer using its{' '}
                    <strong className="text-[#f8f9fa]">USB-C cable</strong> (or pair via Bluetooth
                    MIDI in Windows/macOS). FluteMaster will read your live played Swaras, Breath
                    CC#2 meter, and Pitch Bend in real time!
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={onToggleMidi}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                        liveMidi.connected
                          ? 'bg-red-500/15 border-red-400/40 text-red-200 hover:bg-red-500/25'
                          : 'bg-[#2a9d8f] border-[#72efdd]/50 text-[#f8f9fa] hover:bg-[#31b2a3]'
                      }`}
                    >
                      {liveMidi.connected
                        ? `Disconnect (${liveMidi.deviceName ?? 'MIDI'})`
                        : liveMidi.supported
                        ? 'Connect EDA-100 (Web MIDI)'
                        : 'Web MIDI Requires Chrome / Edge'}
                    </button>
                    {liveMidi.connected && liveMidi.activeSwaraLabel && (
                      <span className="font-mono-tech text-xs text-[#e9c46a]">
                        Live: {liveMidi.activeSwaraLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ==============================================================
              TAB 2: BOLLYWOOD SETTINGS & AUTO-TRANSPOSE GUIDE
              ============================================================== */}
          {activeTab === 'settings' && (
            <>
              {/* Live Per-Song Cheat Sheet */}
              <div className="rounded-xl bg-gradient-to-br from-[#192424] to-[#1d1915] border border-[#72efdd]/35 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono-tech uppercase tracking-wider text-[#72efdd]">
                      Live Settings Cheat Sheet for Current Song
                    </div>
                    <h3 className="text-base font-semibold text-[#f8f9fa] mt-0.5">
                      {song.title}{' '}
                      <span className="text-xs font-normal text-[#a69f95]">
                        ({song.scale.name} · {song.bpm} BPM · {song.raga})
                      </span>
                    </h3>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-[#121619] border border-[#e9c46a]/45 text-center">
                    <div className="text-[9px] font-mono-tech uppercase text-[#a69f95]">
                      Dial EDA-100 Trans
                    </div>
                    <div className="text-base font-bold font-mono-tech text-[#e9c46a]">
                      {formatTranspose(recommendedTrans)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-[#141311]/90 border border-white/8">
                    <div className="text-[10px] text-[#a69f95]">Tone on EDA-100</div>
                    <div className="font-mono-tech font-semibold text-[#f8f9fa] mt-0.5">
                      06 Bamboo / 08 Synth
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#141311]/90 border border-white/8">
                    <div className="text-[10px] text-[#a69f95]">Fingering Mode</div>
                    <div className="font-mono-tech font-semibold text-[#72efdd] mt-0.5">
                      {ewiSettings.fingeringMode === 'sax' ? '01 · Saxophone' : '02 · Flute'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#141311]/90 border border-white/8">
                    <div className="text-[10px] text-[#a69f95]">Breath Sensitivity</div>
                    <div className="font-mono-tech font-semibold text-[#e9c46a] mt-0.5">
                      0{ewiSettings.breathLevel} ·{' '}
                      {ewiSettings.breathLevel === 1
                        ? 'Light'
                        : ewiSettings.breathLevel === 2
                        ? 'Medium'
                        : 'Heavy'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#141311]/90 border border-white/8">
                    <div className="text-[10px] text-[#a69f95]">Reverb Depth</div>
                    <div className="font-mono-tech font-semibold text-[#f4a261] mt-0.5">
                      {ewiSettings.reverbLevel} / 30
                    </div>
                  </div>
                </div>
              </div>

              {/* 1-Click Studio Presets */}
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373] mb-2">
                  One-Click Bollywood Studio Presets (Syncs App + Recommended Hardware Dial)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() =>
                      onUpdateSettings({
                        fingeringMode: 'flute',
                        voice: 'bansuri',
                        breathLevel: 1,
                        reverbLevel: 24,
                        pitchBendEnabled: true,
                        transposeMode: 'auto',
                      })
                    }
                    className="text-left p-3.5 rounded-xl bg-[#201e1b] hover:bg-[#272420] border border-white/10 hover:border-[#72efdd]/50 transition-all cursor-pointer space-y-1"
                  >
                    <div className="font-semibold text-[#72efdd]">
                      Bollywood Bansuri Feel (Tone 06)
                    </div>
                    <div className="text-[11px] font-mono-tech text-[#e9c46a]">
                      Fing 02 Flute · Breath 01 · Rev 24 · PB On
                    </div>
                    <p className="text-[#a69f95]">
                      Best for Bansuri players moving to EWI. Ultra-easy airflow &amp; lush ballad
                      reverb for Lag Ja Gale &amp; Tujhe Dekha To.
                    </p>
                  </button>

                  <button
                    onClick={() =>
                      onUpdateSettings({
                        fingeringMode: 'sax',
                        voice: 'ewi-synth',
                        breathLevel: 2,
                        reverbLevel: 20,
                        pitchBendEnabled: true,
                        transposeMode: 'auto',
                      })
                    }
                    className="text-left p-3.5 rounded-xl bg-[#201e1b] hover:bg-[#272420] border border-white/10 hover:border-[#72efdd]/50 transition-all cursor-pointer space-y-1"
                  >
                    <div className="font-semibold text-[#e9c46a]">
                      Modern EWI Synth Lead (Tone 08)
                    </div>
                    <div className="text-[11px] font-mono-tech text-[#72efdd]">
                      Fing 01 Sax · Breath 02 · Rev 20 · PB On
                    </div>
                    <p className="text-[#a69f95]">
                      Signature expressive EWI wind-synth tone with smooth filter swells &amp; vocal
                      Pitch Bend Meends (Tum Hi Ho, Kesariya).
                    </p>
                  </button>

                  <button
                    onClick={() =>
                      onUpdateSettings({
                        fingeringMode: 'sax',
                        voice: 'saxophone',
                        breathLevel: 2,
                        reverbLevel: 18,
                        pitchBendEnabled: true,
                        transposeMode: 'auto',
                      })
                    }
                    className="text-left p-3.5 rounded-xl bg-[#201e1b] hover:bg-[#272420] border border-white/10 hover:border-[#72efdd]/50 transition-all cursor-pointer space-y-1"
                  >
                    <div className="font-semibold text-[#f4a261]">
                      Retro Bollywood Sax (Tone 01)
                    </div>
                    <div className="text-[11px] font-mono-tech text-[#e9c46a]">
                      Fing 01 Sax · Breath 02 · Rev 18 · PB On
                    </div>
                    <p className="text-[#a69f95]">
                      Warm R.D. Burman &amp; 90s saxophone solos (Roop Tera Mastana, Pehla Nasha)
                      with crisp vibrato phrasing.
                    </p>
                  </button>
                </div>
              </div>

              {/* Master Bollywood Scale -> EDA-100 Trans Table */}
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373] mb-2">
                  The EDA-100 Superpower: Instant Transpose Chart for All 472 Songs
                </h3>
                <p className="text-[#a69f95] mb-2.5 leading-relaxed">
                  On a wooden Bansuri you need 6 different bamboo flutes to play different Bollywood
                  keys. On your Eastar EDA-100, keep{' '}
                  <strong className="text-[#f8f9fa]">Sa = L1+L2+L3 (Written G)</strong> forever and
                  just tap the <strong className="text-[#e9c46a]">Trans</strong> button to match
                  the song scale below:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.values(BANSURI_SCALES).map((sc) => {
                    const tr = getRecommendedEdaTranspose(sc.id);
                    const isCurrent = sc.id === song.scale.id;
                    return (
                      <div
                        key={sc.id}
                        className={`p-2.5 rounded-lg border text-center ${
                          isCurrent
                            ? 'bg-[#2a9d8f]/20 border-[#72efdd]/60'
                            : 'bg-[#201e1b] border-white/8'
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-[#f8f9fa]">{sc.name}</div>
                        <div className="text-sm font-mono-tech font-bold text-[#e9c46a] mt-0.5">
                          Trans {formatTranspose(tr)}
                        </div>
                        <div className="text-[9px] text-[#a69f95]">{sc.rootNote}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ==============================================================
              TAB 3: PLAY STYLE & COMPLETE 12-SWARA FINGERING CHART
              ============================================================== */}
          {activeTab === 'playstyle' && (
            <>
              {/* 4 Play Style Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3.5 rounded-xl bg-[#201e1b] border border-[#72efdd]/20 space-y-1">
                  <div className="font-semibold text-[#72efdd]">
                    1. Feather-Light Capacitive Touch (Don&apos;t Squeeze!)
                  </div>
                  <p className="text-[#a69f95] leading-relaxed">
                    Unlike a saxophone or Bansuri, EDA-100 pads have zero physical travel. Rest
                    fingertips lightly and lift open fingers cleanly ~3–5mm away so you never trigger
                    ghost notes. Keep your thumbs anchored on the rear rests!
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#201e1b] border border-[#f4a261]/20 space-y-1">
                  <div className="font-semibold text-[#f4a261]">
                    2. Left-Thumb Octave Rolling (Zero Overblowing)
                  </div>
                  <p className="text-[#a69f95] leading-relaxed">
                    Keep your airflow relaxed across all 3 octaves. Simply roll your Left Thumb DOWN
                    onto <strong className="text-[#72efdd]">OCT−</strong> for Mandra Saptak, center{' '}
                    <strong className="text-[#f8f9fa]">0</strong> for Madhya, and UP onto{' '}
                    <strong className="text-[#f4a261]">OCT+</strong> for Taar Saptak.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#201e1b] border border-[#e9c46a]/20 space-y-1">
                  <div className="font-semibold text-[#e9c46a]">
                    3. Right-Thumb Pitch Bend = Authentic Bollywood Meend
                  </div>
                  <p className="text-[#a69f95] leading-relaxed">
                    What separates robotic EWI playing from soulful Bollywood flute/violin is the{' '}
                    <strong className="text-[#e9c46a]">Pitch Bend pad</strong>. Watch for golden{' '}
                    <strong className="text-[#e9c46a]">PB</strong> badges on the Sargam Highway:
                    gently bend up into a Swara for a vocal <em>Meend</em>, or softly pulse it for{' '}
                    <em>Gamak</em> vibrato!
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#201e1b] border border-[#2a9d8f]/25 space-y-1">
                  <div className="font-semibold text-[#38bfa9]">
                    4. Soft &ldquo;Doo&rdquo; Tonguing vs Continuous Legato Slurs
                  </div>
                  <p className="text-[#a69f95] leading-relaxed">
                    Take the mouthpiece ~1 cm into your mouth with relaxed lips (never bite). Start
                    each Bollywood lyric phrase with a soft &ldquo;Doo&rdquo; tongue tap, then keep
                    one steady stream of air flowing across connected notes until the teal Breath
                    marker!
                  </p>
                </div>
              </div>

              {/* Interactive Dual-Mode 12-Swara Key Chart */}
              <div className="rounded-xl bg-[#1a1816] border border-white/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373]">
                      Complete 12-Swara Touch-Pad Chart (Madhya Saptak)
                    </h3>
                    <p className="text-[11px] text-[#a69f95]">
                      Compare Eastar EDA-100&apos;s two built-in modes — zero awkward half-holes!
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg bg-[#121110] p-0.5 border border-white/10">
                    <button
                      onClick={() => onUpdateSettings({ fingeringMode: 'sax' })}
                      className={`px-3 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-all ${
                        ewiSettings.fingeringMode === 'sax'
                          ? 'bg-[#2a9d8f] text-[#f8f9fa]'
                          : 'text-[#a69f95] hover:text-[#f8f9fa]'
                      }`}
                    >
                      Mode 01 · Saxophone
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ fingeringMode: 'flute' })}
                      className={`px-3 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-all ${
                        ewiSettings.fingeringMode === 'flute'
                          ? 'bg-[#2a9d8f] text-[#f8f9fa]'
                          : 'text-[#a69f95] hover:text-[#f8f9fa]'
                      }`}
                    >
                      Mode 02 · Flute
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {ALL_SWARAS.map((sw) => {
                    const f = getEwiFingering(sw, 'madhya', ewiSettings.fingeringMode);
                    const meta = SWARA_META[sw];
                    return (
                      <div
                        key={sw}
                        className="p-2.5 rounded-lg bg-[#211f1c] border border-white/6 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#f8f9fa]">
                              <SwaraSymbol swara={sw} octave="madhya" notationStyle="short" size="sm" />
                            </span>
                            <span className="text-[10px] text-[#a69f95]">
                              {meta.isKomal ? `Komal ${meta.fullBase}` : meta.isTivra ? `Tivra ${meta.fullBase}` : meta.fullBase}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono-tech text-[#72efdd]">
                            {f.writtenNote}
                          </span>
                        </div>

                        {/* 6 Touch Pad Mini Visual */}
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            {f.mainPads.slice(0, 3).map((on, i) => (
                              <span
                                key={i}
                                className={`w-3 h-3 rounded-full border ${
                                  on
                                    ? 'bg-[#2a9d8f] border-[#72efdd]'
                                    : 'bg-transparent border-white/25'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-white/20 text-[9px]">|</span>
                          <div className="flex items-center gap-1">
                            {f.mainPads.slice(3, 6).map((on, i) => (
                              <span
                                key={i}
                                className={`w-3 h-3 rounded-full border ${
                                  on
                                    ? 'bg-[#2a9d8f] border-[#72efdd]'
                                    : 'bg-transparent border-white/25'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 min-h-[16px]">
                          {f.octaveShift === 1 && (
                            <span className="px-1.5 py-[1px] rounded text-[9px] font-mono-tech bg-[#f4a261]/20 border border-[#f4a261]/45 text-[#f4a261]">
                              OCT+
                            </span>
                          )}
                          {f.auxPads.map((aux) => (
                            <span
                              key={aux}
                              className="px-1.5 py-[1px] rounded text-[9px] font-mono-tech bg-[#e9c46a]/15 border border-[#e9c46a]/45 text-[#e9c46a]"
                            >
                              +{aux}
                            </span>
                          ))}
                          {f.octaveShift === 0 && f.auxPads.length === 0 && (
                            <span className="text-[9px] text-[#7a746c]">Clean touch</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ==============================================================
              TAB 4: ALL 27 BUILT-IN EDA-100 TONES & 15-MIN DAILY ROUTINE
              ============================================================== */}
          {activeTab === 'tones' && (
            <>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373]">
                      Eastar EDA-100 Complete 27-Tone Built-In Library
                    </h3>
                    <p className="text-[11px] text-[#a69f95]">
                      Every built-in tone number on your physical instrument with Bollywood pairing
                      ideas.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ['recommended', '★ Bollywood Picks (9)'],
                        ['All', 'All 27'],
                        ['Indian / Folk', 'Indian / Folk'],
                        ['Woodwind', 'Woodwind'],
                        ['Strings & Synth', 'Strings & Synth'],
                        ['Brass', 'Brass'],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => setToneFilter(val)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium cursor-pointer border transition-all ${
                          toneFilter === val
                            ? 'bg-[#2a9d8f]/25 border-[#72efdd]/50 text-[#72efdd]'
                            : 'bg-[#201e1b] border-white/8 text-[#a69f95] hover:text-[#f8f9fa]'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredTones.map((tone) => (
                    <div
                      key={tone.number}
                      className={`p-2.5 rounded-xl border ${
                        tone.recommended
                          ? 'bg-[#1c2322] border-[#2a9d8f]/40'
                          : 'bg-[#201e1b] border-white/6'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-[#121212] border border-white/12 font-mono-tech text-[11px] font-bold text-[#e9c46a]">
                            {tone.number}
                          </span>
                          <span className="font-semibold text-[#f8f9fa]">{tone.name}</span>
                        </div>
                        {tone.recommended && (
                          <span className="text-[9px] font-mono-tech text-[#72efdd]">★ TOP</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#a69f95] mt-1 leading-snug">
                        {tone.bollywoodFit}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 15-Minute Daily EDA-100 Practice Plan */}
              <div className="rounded-xl bg-[#201e1b] border border-[#d4a373]/25 p-4 space-y-2.5">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#e9c46a] flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5" />
                  15-Minute Daily Eastar EDA-100 Bollywood Practice Routine
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {[
                    [
                      'Min 0–3 · Breath & Long Sa',
                      'Set Breath 02, Tone 06. Hold steady Madhya Sa (L1–L3) for 8 counts with Tanpura on — practice soft fade-in and fade-out.',
                    ],
                    [
                      'Min 3–6 · Octave Thumb Roll',
                      'Play Sa–Re–Ga–Ma–Pa–Dha–Ni–Ṡa slowly, focusing on smooth Left-Thumb rolls between 0 and OCT+ with zero finger glitch.',
                    ],
                    [
                      'Min 6–10 · Pitch Bend Meend',
                      'Load Lag Ja Gale at 0.75× speed in Step Mode. Practice rolling the Right-Thumb Pitch Bend pad into every golden PB note.',
                    ],
                    [
                      'Min 10–15 · Full Song Jam',
                      'Dial the song’s exact Trans value on your EDA-100, unmute Tabla + Tanpura (mute app lead!), and perform with the scrolling highway!',
                    ],
                  ].map(([head, body]) => (
                    <div key={head} className="p-2.5 rounded-lg bg-[#151412] border border-white/6">
                      <div className="font-semibold text-[#f8f9fa] text-[11px] mb-1">{head}</div>
                      <p className="text-[11px] text-[#a69f95] leading-relaxed">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Tip */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#141311] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#a69f95]">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-[#2a9d8f]" />
            <span>
              Pro Tip: Mute the app&apos;s <strong className="text-[#f8f9fa]">Lead</strong> track in
              the Studio Mixer while leaving <strong className="text-[#d4a373]">Tanpura</strong> +{' '}
              <strong className="text-[#f4a261]">Tabla</strong> on so YOUR physical Eastar EDA-100
              is the star!
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2a9d8f] hover:bg-[#31b2a3] text-[#f8f9fa] font-semibold cursor-pointer"
          >
            Back to Studio
          </button>
        </div>
      </div>
    </div>
  );
};
