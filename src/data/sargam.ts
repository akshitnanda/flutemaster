import { BansuriScale, BreathLevel, HolePattern, Octave, SwaraId } from '../types/music';

export const BANSURI_SCALES: Record<string, BansuriScale> = {
  D_BASS: {
    id: 'D_BASS',
    name: 'D Bass',
    rootNote: 'D4',
    rootHz: 293.66,
    lengthInches: 33,
    character: 'Ultra-deep, resonant concert bass Bansuri for meditative melodies',
  },
  D_SHARP_BASS: {
    id: 'D_SHARP_BASS',
    name: 'D# / Eb Bass',
    rootNote: 'D#4',
    rootHz: 311.13,
    lengthInches: 31.5,
    character: 'Warm concert bass-Eb scale bridging deep D Bass and lyrical E Bass',
  },
  E_BASS: {
    id: 'E_BASS',
    name: 'E Bass',
    rootNote: 'E4',
    rootHz: 329.63,
    lengthInches: 30,
    character: 'Deep, soulful & meditative — iconic for romantic Bollywood ballads',
  },
  F_BASS: {
    id: 'F_BASS',
    name: 'F Bass',
    rootNote: 'F4',
    rootHz: 349.23,
    lengthInches: 28,
    character: 'Rich warm bass scale balancing deep lows with expressive upper octaves',
  },
  F_SHARP_MEDIUM: {
    id: 'F_SHARP_MEDIUM',
    name: 'F# Bass',
    rootNote: 'F#4',
    rootHz: 369.99,
    lengthInches: 26,
    character: 'Sweet singing bass-medium scale popular in classic ghazals & retro hits',
  },
  G_BASS: {
    id: 'G_BASS',
    name: 'G Bass',
    rootNote: 'G4',
    rootHz: 392.0,
    lengthInches: 25,
    character: 'Warm, velvety concert scale — versatile across 70s & 90s classics',
  },
  G_SHARP_MEDIUM: {
    id: 'G_SHARP_MEDIUM',
    name: 'G# Medium',
    rootNote: 'G#4',
    rootHz: 415.3,
    lengthInches: 23.5,
    character: 'Lyrical concert medium Bansuri beloved for 90s romantic melodies',
  },
  A_MEDIUM: {
    id: 'A_MEDIUM',
    name: 'A Natural Medium',
    rootNote: 'A4',
    rootHz: 440.0,
    lengthInches: 22,
    character: 'Balanced mid-register brilliance with effortless finger stretch',
  },
  A_SHARP_MEDIUM: {
    id: 'A_SHARP_MEDIUM',
    name: 'A# / Bb Medium',
    rootNote: 'A#4',
    rootHz: 466.16,
    lengthInches: 21,
    character: 'Crisp vocal-friendly medium Bansuri suited for agile Bollywood phrasing',
  },
  B_MEDIUM: {
    id: 'B_MEDIUM',
    name: 'B Natural Medium',
    rootNote: 'B4',
    rootHz: 493.88,
    lengthInches: 20,
    character: 'Bright medium-scale Bansuri (Safed 7) common across classic & 90s hits',
  },
  C_MEDIUM: {
    id: 'C_MEDIUM',
    name: 'C Natural Medium',
    rootNote: 'C5',
    rootHz: 523.25,
    lengthInches: 19,
    character: 'Bright, crisp beginner-friendly Bansuri with comfortable hole spacing',
  },
  C_SHARP_MEDIUM: {
    id: 'C_SHARP_MEDIUM',
    name: 'C# Medium',
    rootNote: 'C#5',
    rootHz: 554.37,
    lengthInches: 18,
    character: 'Classic Indian studio scale (Kali 1) widely used on notesandsargam.com',
  },
};

export interface SwaraMeta {
  id: SwaraId;
  shortBase: string;
  fullBase: string;
  hindiName: string;
  semitonesFromSa: number;
  isKomal: boolean;
  isTivra: boolean;
  /** Base 6+1 fingering in Madhya Saptak */
  holes: HolePattern;
  halfHoleIndex: number | null; // 0..5 index if note uses a half-hole
  pitchTip?: string;
}

/**
 * Authentic North Indian Hindustani Bansuri fingerings
 * Convention: Top 3 holes (L1, L2, L3) closed = Madhya Sa
 * Holes order: [L1 Index, L2 Middle, L3 Ring, R1 Index, R2 Middle, R3 Ring, R4 Pinky/Tuning]
 */
export const SWARA_META: Record<SwaraId, SwaraMeta> = {
  S: {
    id: 'S',
    shortBase: 'S',
    fullBase: 'Sa',
    hindiName: 'सा',
    semitonesFromSa: 0,
    isKomal: false,
    isTivra: false,
    holes: [1, 1, 1, 0, 0, 0, 0],
    halfHoleIndex: null,
  },
  Rk: {
    id: 'Rk',
    shortBase: 'R',
    fullBase: 'Re',
    hindiName: 'रे',
    semitonesFromSa: 1,
    isKomal: true,
    isTivra: false,
    holes: [1, 1, 0.5, 0, 0, 0, 0],
    halfHoleIndex: 2,
    pitchTip: 'Slide Left Ring finger (Hole 3) 50% back; angle flute gently inward if sharp.',
  },
  R: {
    id: 'R',
    shortBase: 'R',
    fullBase: 'Re',
    hindiName: 'रे',
    semitonesFromSa: 2,
    isKomal: false,
    isTivra: false,
    holes: [1, 1, 0, 0, 0, 0, 0],
    halfHoleIndex: null,
  },
  Gk: {
    id: 'Gk',
    shortBase: 'G',
    fullBase: 'Ga',
    hindiName: 'ग',
    semitonesFromSa: 3,
    isKomal: true,
    isTivra: false,
    holes: [1, 0.5, 0, 0, 0, 0, 0],
    halfHoleIndex: 1,
    pitchTip: 'Slide Left Middle finger (Hole 2) halfway open; keep steady gentle air column.',
  },
  G: {
    id: 'G',
    shortBase: 'G',
    fullBase: 'Ga',
    hindiName: 'ग',
    semitonesFromSa: 4,
    isKomal: false,
    isTivra: false,
    holes: [1, 0, 0, 0, 0, 0, 0],
    halfHoleIndex: null,
  },
  M: {
    id: 'M',
    shortBase: 'M',
    fullBase: 'Ma',
    hindiName: 'म',
    semitonesFromSa: 5,
    isKomal: false,
    isTivra: false,
    holes: [0.5, 0, 0, 0, 0, 0, 0],
    halfHoleIndex: 0,
    pitchTip: 'Half-cover Hole 1 (Left Index) carefully — Shuddha Ma needs exact 50% shading.',
  },
  Mt: {
    id: 'Mt',
    shortBase: 'M',
    fullBase: 'Ma',
    hindiName: 'म',
    semitonesFromSa: 6,
    isKomal: false,
    isTivra: true,
    holes: [0, 0, 0, 0, 0, 0, 0],
    halfHoleIndex: null,
    pitchTip: 'All 6 holes open for Tivra Ma — balance bamboo gently with thumbs & steady embouchure.',
  },
  P: {
    id: 'P',
    shortBase: 'P',
    fullBase: 'Pa',
    hindiName: 'प',
    semitonesFromSa: 7,
    isKomal: false,
    isTivra: false,
    holes: [1, 1, 1, 1, 1, 1, 0],
    halfHoleIndex: null,
  },
  Dk: {
    id: 'Dk',
    shortBase: 'D',
    fullBase: 'Dha',
    hindiName: 'ध',
    semitonesFromSa: 8,
    isKomal: true,
    isTivra: false,
    holes: [1, 1, 1, 1, 1, 0.5, 0],
    halfHoleIndex: 5,
    pitchTip: 'Slide Right Ring finger (Hole 6) halfway off to keep Komal Dha resonant & in tune.',
  },
  D: {
    id: 'D',
    shortBase: 'D',
    fullBase: 'Dha',
    hindiName: 'ध',
    semitonesFromSa: 9,
    isKomal: false,
    isTivra: false,
    holes: [1, 1, 1, 1, 1, 0, 0],
    halfHoleIndex: null,
  },
  Nk: {
    id: 'Nk',
    shortBase: 'N',
    fullBase: 'Ni',
    hindiName: 'नि',
    semitonesFromSa: 10,
    isKomal: true,
    isTivra: false,
    holes: [1, 1, 1, 1, 0.5, 0, 0],
    halfHoleIndex: 4,
    pitchTip: 'Slide Right Middle finger (Hole 5) halfway back; avoid over-blowing Komal Ni.',
  },
  N: {
    id: 'N',
    shortBase: 'N',
    fullBase: 'Ni',
    hindiName: 'नि',
    semitonesFromSa: 11,
    isKomal: false,
    isTivra: false,
    holes: [1, 1, 1, 1, 0, 0, 0],
    halfHoleIndex: null,
  },
};

export const HOLE_LABELS = [
  { index: 0, code: 'L1', finger: 'Left Index', hand: 'left' as const },
  { index: 1, code: 'L2', finger: 'Left Middle', hand: 'left' as const },
  { index: 2, code: 'L3', finger: 'Left Ring', hand: 'left' as const },
  { index: 3, code: 'R1', finger: 'Right Index', hand: 'right' as const },
  { index: 4, code: 'R2', finger: 'Right Middle', hand: 'right' as const },
  { index: 5, code: 'R3', finger: 'Right Ring', hand: 'right' as const },
  { index: 6, code: 'R4', finger: 'Pinky / Tune', hand: 'right' as const },
];

export interface NoteFingering {
  holes: HolePattern;
  breath: BreathLevel;
  breathLabel: string;
  halfHoleIndex: number | null;
  pitchWarning: string | null;
  isTivra: boolean;
  isKomal: boolean;
}

/**
 * Returns authentic Bansuri hole states + breath pressure for any Swara & Octave
 */
export function getFingering(swara: SwaraId, octave: Octave): NoteFingering {
  const meta = SWARA_META[swara];
  let holes: HolePattern = [...meta.holes] as HolePattern;
  let breath: BreathLevel = 'medium';

  if (octave === 'mandra') {
    breath = 'soft';
    // Mandra Ma uses 7th pinky hole if ever requested
    if (swara === 'M') {
      holes = [1, 1, 1, 1, 1, 1, 1];
    }
  } else if (octave === 'madhya') {
    // On Bansuri, Madhya Pa through Ni require firmer overblown air compared to Mandra Pa-Ni
    if (meta.semitonesFromSa >= 7) {
      breath = 'medium';
    } else {
      breath = 'soft';
    }
  } else {
    // Taar Saptak requires focused high-velocity air stream
    breath = 'strong';
    if (swara === 'P') {
      // Standard Taar Pa cracks open Hole 1 to help stabilize upper octave harmonic
      holes = [0, 1, 1, 1, 1, 1, 0];
    }
  }

  const breathLabel =
    breath === 'soft'
      ? 'Gentle Air (Low Register)'
      : breath === 'medium'
      ? 'Focused Air (Mid Register)'
      : 'Fast Focused Air (Taar Octave)';

  const halfIdx = holes.findIndex((h) => h === 0.5);
  const halfHoleIndex = halfIdx >= 0 ? halfIdx : null;

  let pitchWarning: string | null = null;
  if (halfHoleIndex !== null) {
    pitchWarning =
      meta.pitchTip ??
      `Half-hole on ${HOLE_LABELS[halfHoleIndex].code}: slide finger 50% back for pitch accuracy.`;
  } else if (meta.isTivra) {
    pitchWarning = meta.pitchTip ?? 'Tivra Ma (all open): steady embouchure for crisp intonation.';
  }

  return {
    holes,
    breath,
    breathLabel,
    halfHoleIndex,
    pitchWarning,
    isTivra: meta.isTivra,
    isKomal: meta.isKomal,
  };
}

/**
 * Computes exact concert frequency (Hz) relative to the song's Bansuri tonic Sa
 */
export function getFrequencyHz(swara: SwaraId, octave: Octave, scaleRootHz: number): number {
  const meta = SWARA_META[swara];
  let semitones = meta.semitonesFromSa;
  if (octave === 'mandra') semitones -= 12;
  if (octave === 'taar') semitones += 12;
  return scaleRootHz * Math.pow(2, semitones / 12);
}

/**
 * Returns numeric pitch index for vertical note layout on the Sargam Highway
 * Mandra Pa (-5) -> Madhya Sa (0) -> Taar Pa (+19)
 */
export function getPitchIndex(swara: SwaraId, octave: Octave): number {
  const base = SWARA_META[swara].semitonesFromSa;
  if (octave === 'mandra') return base - 12;
  if (octave === 'taar') return base + 12;
  return base;
}

export function getOctaveLabel(octave: Octave): string {
  switch (octave) {
    case 'mandra':
      return 'Mandra Saptak (Lower)';
    case 'madhya':
      return 'Madhya Saptak (Middle)';
    case 'taar':
      return 'Taar Saptak (Upper)';
  }
}

export const INTERACTIVE_SCALE_NOTES: Array<{ swara: SwaraId; octave: Octave }> = [
  { swara: 'P', octave: 'mandra' },
  { swara: 'Dk', octave: 'mandra' },
  { swara: 'D', octave: 'mandra' },
  { swara: 'Nk', octave: 'mandra' },
  { swara: 'N', octave: 'mandra' },
  { swara: 'S', octave: 'madhya' },
  { swara: 'Rk', octave: 'madhya' },
  { swara: 'R', octave: 'madhya' },
  { swara: 'Gk', octave: 'madhya' },
  { swara: 'G', octave: 'madhya' },
  { swara: 'M', octave: 'madhya' },
  { swara: 'Mt', octave: 'madhya' },
  { swara: 'P', octave: 'madhya' },
  { swara: 'Dk', octave: 'madhya' },
  { swara: 'D', octave: 'madhya' },
  { swara: 'Nk', octave: 'madhya' },
  { swara: 'N', octave: 'madhya' },
  { swara: 'S', octave: 'taar' },
  { swara: 'R', octave: 'taar' },
  { swara: 'G', octave: 'taar' },
];
