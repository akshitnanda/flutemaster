import {
  HarmonicaTab,
  InstrumentType,
  Octave,
  SaxAuxKey,
  SaxFingering,
  SwaraId,
} from '../types/music';
import { SWARA_META } from './sargam';

export interface InstrumentMeta {
  id: InstrumentType;
  name: string;
  shortName: string;
  subtitle: string;
  mixerLabel: string;
  scalePrefix: string;
  badgeDetail: string;
}

export const INSTRUMENT_META: Record<InstrumentType, InstrumentMeta> = {
  bansuri: {
    id: 'bansuri',
    name: 'Bansuri',
    shortName: 'Bansuri',
    subtitle: '3D Bansuri & Bollywood Sargam',
    mixerLabel: 'Flute Lead',
    scalePrefix: 'Bansuri',
    badgeDetail: '6+1 Hole Bamboo',
  },
  saxophone: {
    id: 'saxophone',
    name: 'Saxophone',
    shortName: 'Saxophone',
    subtitle: '3D Alto Sax & Bollywood Sargam',
    mixerLabel: 'Sax Lead',
    scalePrefix: 'Alto Sax',
    badgeDetail: 'Sa = Written G',
  },
  harmonica: {
    id: 'harmonica',
    name: 'Mouth Organ',
    shortName: 'Mouth Organ',
    subtitle: '3D Chromatic Mouth Organ Studio',
    mixerLabel: 'Mouth Organ',
    scalePrefix: 'Chromatic 12H',
    badgeDetail: 'Solo-Tuned Chromatic',
  },
  ewi: {
    id: 'ewi',
    name: 'EWI (EDA-100)',
    shortName: 'EWI',
    subtitle: '3D Eastar EDA-100 Digital Wind Studio',
    mixerLabel: 'EWI Lead',
    scalePrefix: 'Eastar EDA-100',
    badgeDetail: '27 Tones · USB/BT MIDI',
  },
};

export const SAX_KEY_LABELS = [
  { index: 0, code: 'L1', finger: 'Left Index (B)' },
  { index: 1, code: 'L2', finger: 'Left Middle (A)' },
  { index: 2, code: 'L3', finger: 'Left Ring (G)' },
  { index: 3, code: 'R1', finger: 'Right Index (F)' },
  { index: 4, code: 'R2', finger: 'Right Middle (E)' },
  { index: 5, code: 'R3', finger: 'Right Ring (D)' },
];

/**
 * Authentic Alto Saxophone Fingerings using Bollywood Sargam convention (Sa = Written G4):
 * - Top 3 pearls (L1, L2, L3) = Sa (mirrors Bansuri intuition!)
 * - Left Thumb Octave Key engages naturally at the real saxophone octave break (D5 = Madhya Pa)
 * - Real mechanical chromatic keys handle Komal/Tivra swaras (G# Left Pinky, Side Bb, Eb Right Pinky, R2 F#)
 */
export function getSaxFingering(swara: SwaraId, octave: Octave): SaxFingering {
  const isUpper = octave === 'taar' || (octave === 'madhya' && SWARA_META[swara].semitonesFromSa >= 7);
  const octaveKey = isUpper;

  // Special extreme high Taar Pa (D6 -> Octave + Palm D)
  if (octave === 'taar' && swara === 'P') {
    return {
      octaveKey: true,
      mainKeys: [false, false, false, false, false, false],
      auxKeys: ['PalmD'],
      writtenNote: 'D6',
      highwayTag: 'OCT·D',
      coachingTip: 'Taar Pa: Press Left Thumb Octave Key + Left Palm D key with firm embouchure.',
    };
  }

  let mainKeys: [boolean, boolean, boolean, boolean, boolean, boolean] = [
    true,
    true,
    true,
    false,
    false,
    false,
  ];
  let auxKeys: SaxAuxKey[] = [];
  let writtenNote = 'G';
  let coachingTip: string | null = null;

  switch (swara) {
    case 'S': // G
      mainKeys = [true, true, true, false, false, false];
      writtenNote = octave === 'taar' ? 'G5' : 'G4';
      if (octave === 'taar') coachingTip = 'Taar Sa: Hold Left Thumb Octave Key + top 3 pearl keys (L1–L3).';
      break;
    case 'Rk': // G# / Ab
      mainKeys = [true, true, true, false, false, false];
      auxKeys = ['G#'];
      writtenNote = octave === 'taar' ? 'G#5' : 'G#4';
      coachingTip = 'Komal Re: Hold L1–L3 and press the Left Pinky G# table key.';
      break;
    case 'R': // A
      mainKeys = [true, true, false, false, false, false];
      writtenNote = octave === 'taar' ? 'A5' : 'A4';
      if (octave === 'taar') coachingTip = 'Taar Re: Octave Key + L1 & L2 with bright air support.';
      break;
    case 'Gk': // Bb
      mainKeys = [true, false, false, false, false, false];
      auxKeys = ['Bb'];
      writtenNote = octave === 'taar' ? 'Bb5' : 'Bb4';
      coachingTip = 'Komal Ga: Press L1 (Index) + Right Side Bb lever key cleanly together.';
      break;
    case 'G': // B
      mainKeys = [true, false, false, false, false, false];
      writtenNote = octave === 'taar' ? 'B5' : 'B4';
      if (octave === 'taar') coachingTip = 'Taar Ga: Octave Key + L1 only.';
      break;
    case 'M': // C
      mainKeys = [false, true, false, false, false, false];
      writtenNote = octave === 'taar' ? 'C6' : 'C5';
      coachingTip = 'Shuddha Ma: Press Left Middle pearl (L2) alone (lift L1).';
      break;
    case 'Mt': // C#
      mainKeys = [false, false, false, false, false, false];
      writtenNote = octave === 'taar' ? 'C#6' : 'C#5';
      coachingTip = 'Tivra Ma: Open fingering — lift all 6 main keys & keep steady reed pressure.';
      break;
    case 'P': // D
      mainKeys = [true, true, true, true, true, true];
      writtenNote = octave === 'mandra' ? 'D4' : 'D5';
      coachingTip =
        octave === 'mandra'
          ? 'Mandra Pa: Seal all 6 pearl keys (Octave Key OFF) with warm relaxed jaw.'
          : 'Madhya Pa: Engage Left Thumb Octave Key + all 6 pearl keys.';
      break;
    case 'Dk': // Eb
      mainKeys = [true, true, true, true, true, true];
      auxKeys = ['Eb'];
      writtenNote = octave === 'mandra' ? 'Eb4' : 'Eb5';
      coachingTip = 'Komal Dha: Press all 6 pearls + Right Pinky Eb spatula key.';
      break;
    case 'D': // E
      mainKeys = [true, true, true, true, true, false];
      writtenNote = octave === 'mandra' ? 'E4' : 'E5';
      break;
    case 'Nk': // F
      mainKeys = [true, true, true, true, false, false];
      writtenNote = octave === 'mandra' ? 'F4' : 'F5';
      coachingTip = 'Komal Ni: Top 3 pearls (L1–L3) + Right Index (R1).';
      break;
    case 'N': // F#
      mainKeys = [true, true, true, false, true, false];
      writtenNote = octave === 'mandra' ? 'F#4' : 'F#5';
      coachingTip = 'Shuddha Ni: Cross-finger L1–L3 + Right Middle (R2) with R1 lifted.';
      break;
  }

  let highwayTag: string | null = null;
  if (auxKeys.length > 0) {
    highwayTag = octaveKey ? `OCT·${auxKeys[0]}` : auxKeys[0];
  } else if (octaveKey) {
    highwayTag = 'OCT';
  }

  return {
    octaveKey,
    mainKeys,
    auxKeys,
    writtenNote,
    highwayTag,
    coachingTip,
  };
}

/**
 * Authentic 12-Hole Solo-Tuned Chromatic Harmonica (Mouth Organ) mapping:
 * - Holes 1–4: Mandra Saptak (Lower Octave)
 * - Holes 5–8: Madhya Saptak (Middle Octave)
 * - Holes 9–12: Taar Saptak (Upper Octave)
 * Every Komal (R̲, G̲, D̲, N̲) and Tivra Ma (M̍) engages the right-side Chromatic Slide Button (+1 semitone)!
 */
export function getHarmonicaTab(swara: SwaraId, octave: Octave): HarmonicaTab {
  const octaveBase = octave === 'mandra' ? 1 : octave === 'madhya' ? 5 : 9;

  let holeOffset = 0;
  let action: 'blow' | 'draw' = 'blow';
  let slide = false;

  switch (swara) {
    case 'S':
      holeOffset = 0;
      action = 'blow';
      slide = false;
      break;
    case 'Rk':
      holeOffset = 0;
      action = 'blow';
      slide = true;
      break;
    case 'R':
      holeOffset = 0;
      action = 'draw';
      slide = false;
      break;
    case 'Gk':
      holeOffset = 0;
      action = 'draw';
      slide = true;
      break;
    case 'G':
      holeOffset = 1;
      action = 'blow';
      slide = false;
      break;
    case 'M':
      holeOffset = 1;
      action = 'draw';
      slide = false;
      break;
    case 'Mt':
      holeOffset = 1;
      action = 'draw';
      slide = true;
      break;
    case 'P':
      holeOffset = 2;
      action = 'blow';
      slide = false;
      break;
    case 'Dk':
      holeOffset = 2;
      action = 'blow';
      slide = true;
      break;
    case 'D':
      holeOffset = 2;
      action = 'draw';
      slide = false;
      break;
    case 'Nk':
      holeOffset = 2;
      action = 'draw';
      slide = true;
      break;
    case 'N':
      holeOffset = 3;
      action = 'draw';
      slide = false;
      break;
  }

  const hole = Math.min(12, Math.max(1, octaveBase + holeOffset));
  const arrow = action === 'blow' ? '↑' : '↓';
  const compactTab = `${hole}${arrow}${slide ? '●' : ''}`;

  let coachingTip: string | null = null;
  if (slide) {
    coachingTip = `Press Right Slide Button IN while ${
      action === 'blow' ? 'blowing gently into' : 'drawing smoothly from'
    } Hole ${hole}.`;
  } else if (action === 'draw') {
    coachingTip = `Hole ${hole} Draw (↓): Inhale gently with a relaxed open throat — let the brass reed speak.`;
  }

  return {
    hole,
    action,
    slide,
    compactTab,
    coachingTip,
  };
}
