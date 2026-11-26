import {
  EwiAuxPad,
  EwiFingering,
  EwiFingeringMode,
  EwiSettings,
  EwiVoiceId,
  Octave,
  OrnamentType,
  SwaraId,
} from '../types/music';
import { SWARA_META } from './sargam';

export const DEFAULT_EWI_SETTINGS: EwiSettings = {
  fingeringMode: 'sax',
  voice: 'ewi-synth',
  breathLevel: 2,
  reverbLevel: 20,
  pitchBendEnabled: true,
  transposeMode: 'auto',
  manualTranspose: 0,
};

export interface EdaToneEntry {
  number: string;
  name: string;
  category: 'Woodwind' | 'Indian / Folk' | 'Brass' | 'Strings & Synth';
  bollywoodFit: string;
  recommended?: boolean;
}

/**
 * Full 27-Tone built-in directory of the Eastar EDA-100 Digital Aerophone (Donner Music),
 * annotated with Bollywood phrasing recommendations!
 */
export const EDA100_TONES: EdaToneEntry[] = [
  { number: '01', name: 'Alto Saxophone', category: 'Woodwind', bollywoodFit: 'Retro romantic solos (Roop Tera Mastana, Pehla Nasha)', recommended: true },
  { number: '02', name: 'Soprano Saxophone', category: 'Woodwind', bollywoodFit: 'Bright 90s leads & Kenny-G style melodies', recommended: true },
  { number: '03', name: 'Clarinet', category: 'Woodwind', bollywoodFit: 'Warm low-register retro interludes & ghazals' },
  { number: '04', name: 'Oboe', category: 'Woodwind', bollywoodFit: 'Expressive dramatic sad ballads' },
  { number: '05', name: 'Violin', category: 'Strings & Synth', bollywoodFit: 'DDLJ / Mohabbatein romantic string hooks' },
  { number: '06', name: 'Bamboo Flute', category: 'Indian / Folk', bollywoodFit: 'Best built-in Bansuri match (Lag Ja Gale, Tujhe Dekha To)', recommended: true },
  { number: '07', name: 'Concert Flute', category: 'Woodwind', bollywoodFit: 'Airy modern Bollywood melodies (Kesariya, Tum Hi Ho)', recommended: true },
  { number: '08', name: 'Electronic Flute', category: 'Strings & Synth', bollywoodFit: 'Silky modern EWI wind-synth lead with smooth glides', recommended: true },
  { number: '09', name: 'Erhu', category: 'Indian / Folk', bollywoodFit: 'Haunting bow-like pitch bends for emotional A. R. Rahman ballads', recommended: true },
  { number: '10', name: 'Cucurbit (Hulusi)', category: 'Indian / Folk', bollywoodFit: 'Mellow earthy bamboo reed tone for devotional & Pahadi raags', recommended: true },
  { number: '11', name: 'Xun', category: 'Indian / Folk', bollywoodFit: 'Deep meditative hollow clay flute for alaap & slow intros' },
  { number: '12', name: 'Panpipes', category: 'Indian / Folk', bollywoodFit: 'Breathy mountain-flute feel (Raag Pahadi classics)' },
  { number: '13', name: 'Sound Horn', category: 'Brass', bollywoodFit: 'Cinematic brass themes & heroic entries' },
  { number: '14', name: 'Harmonica', category: 'Indian / Folk', bollywoodFit: 'Classic R.D. Burman mouth organ songs (Sholay, Aradhana)', recommended: true },
  { number: '15', name: 'Morin Khuur', category: 'Indian / Folk', bollywoodFit: 'Rich low folk string textures' },
  { number: '16', name: 'Church Organ', category: 'Strings & Synth', bollywoodFit: 'Sustained chordal pads & dramatic intros' },
  { number: '17', name: 'Cello', category: 'Strings & Synth', bollywoodFit: 'Deep melancholic counter-melodies' },
  { number: '18', name: 'Accordion', category: 'Indian / Folk', bollywoodFit: 'Classic 60s–70s Raj Kapoor & S.D. Burman grooves', recommended: true },
  { number: '19', name: 'English Horn', category: 'Woodwind', bollywoodFit: 'Velvety alto reed ballads' },
  { number: '20', name: 'Copper Tube', category: 'Brass', bollywoodFit: 'Warm vintage brass flourishes' },
  { number: '21', name: 'Harp', category: 'Strings & Synth', bollywoodFit: 'Dreamy arpeggio backdrops' },
  { number: '22', name: 'Piccolo', category: 'Woodwind', bollywoodFit: 'High sparkling folk & upbeat dance riffs' },
  { number: '23', name: 'Uilleann Pipes', category: 'Indian / Folk', bollywoodFit: 'Folk bagpipe drone textures' },
  { number: '24', name: 'Jing Hu', category: 'Indian / Folk', bollywoodFit: 'Sharp expressive high folk string' },
  { number: '25', name: 'Trumpet', category: 'Brass', bollywoodFit: 'Upbeat retro brass punches & wedding classics' },
  { number: '26', name: 'Trombone', category: 'Brass', bollywoodFit: 'Warm jazz-band Bollywood backing' },
  { number: '27', name: 'Tuba', category: 'Brass', bollywoodFit: 'Deep basslines & rhythmic anchors' },
];

export const EWI_STUDIO_VOICES: Array<{
  id: EwiVoiceId;
  edaToneNum: string;
  label: string;
  shortLabel: string;
  desc: string;
}> = [
  {
    id: 'ewi-synth',
    edaToneNum: '08',
    label: '08 · Electronic Flute',
    shortLabel: '08 Synth',
    desc: 'Expressive monophonic EWI wind-synth lead with breath-tracked filter & silky pitch bend',
  },
  {
    id: 'bansuri',
    edaToneNum: '06',
    label: '06 · Bamboo Flute',
    shortLabel: '06 Bamboo',
    desc: 'Real Indian Assam Bamboo Bansuri studio tone with pure straight-tone Meends',
  },
  {
    id: 'saxophone',
    edaToneNum: '01',
    label: '01 · Alto Sax',
    shortLabel: '01 Sax',
    desc: 'Lush studio vibrato saxophone voice for classic Bollywood horn phrasing',
  },
  {
    id: 'harmonica',
    edaToneNum: '14',
    label: '14 · Harmonica',
    shortLabel: '14 Mouth Organ',
    desc: 'Real Hohner Super 64 chromatic harmonica reed tone',
  },
];

export const EWI_PAD_LABELS = [
  { index: 0, code: 'L1', finger: 'Left Index Touch Pad' },
  { index: 1, code: 'L2', finger: 'Left Middle Touch Pad' },
  { index: 2, code: 'L3', finger: 'Left Ring Touch Pad' },
  { index: 3, code: 'R1', finger: 'Right Index Touch Pad' },
  { index: 4, code: 'R2', finger: 'Right Middle Touch Pad' },
  { index: 5, code: 'R3', finger: 'Right Ring Touch Pad' },
];

/**
 * Semitone offsets of each Bansuri scale relative to Written G (Sa = L1+L2+L3 closed).
 * Dialing this exact number into the Eastar EDA-100 "Trans" button (-12..+12) lets you play
 * EVERY SINGLE ONE of the 472 Bollywood songs in the exact concert key using one familiar fingering!
 */
const SCALE_TO_SEMITONE_FROM_G: Record<string, number> = {
  D_BASS: -5,
  D_SHARP_BASS: -4,
  E_BASS: -3,
  F_BASS: -2,
  F_SHARP_MEDIUM: -1,
  G_BASS: 0,
  G_SHARP_MEDIUM: 1,
  A_MEDIUM: 2,
  A_SHARP_MEDIUM: 3,
  B_MEDIUM: 4,
  C_MEDIUM: 5,
  C_SHARP_MEDIUM: 6,
};

export function getRecommendedEdaTranspose(scaleId: string): number {
  return SCALE_TO_SEMITONE_FROM_G[scaleId] ?? 0;
}

export function formatTranspose(semitones: number): string {
  if (semitones === 0) return '0 (G)';
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}

/**
 * Computes exact Eastar EDA-100 touch-pad fingerings for BOTH built-in fingering modes:
 * - Mode 01 (Saxophone): Sa = Written G (L1-L3), rear Left-Thumb Octave Pads (-1 / 0 / +1),
 *   chromatic touch pads (G#, Side Bb, Eb, Cross R2) — ZERO half-holes!
 * - Mode 02 (Flute): Bansuri/Flute intuitive layout (L1-L3 = Sa, lift up for R/G/M/Mt,
 *   seal all 6 for Pa, rear Octave Pads handle Mandra/Madhya/Taar without overblowing,
 *   and dedicated capacitive +½ Sharp / -½ Flat side pads replace tricky half-holes!).
 */
export function getEwiFingering(
  swara: SwaraId,
  octave: Octave,
  mode: EwiFingeringMode = 'sax',
  activeOrnament?: OrnamentType,
  pitchBendEnabled = true
): EwiFingering {
  const pitchBendActive =
    pitchBendEnabled && (activeOrnament === 'meend' || activeOrnament === 'gamak');

  if (mode === 'flute') {
    // Eastar EDA-100 Mode 02 (Flute Fingering):
    // Mirrors Bansuri/Flute intuition (L1-L3 = Sa) while replacing half-holes with clean touch pads!
    let octaveShift: -1 | 0 | 1 = octave === 'mandra' ? -1 : octave === 'taar' ? 1 : 0;
    let mainPads: [boolean, boolean, boolean, boolean, boolean, boolean] = [
      true,
      true,
      true,
      false,
      false,
      false,
    ];
    let auxPads: EwiAuxPad[] = [];
    let writtenNote = 'G4';
    let coachingTip: string | null = null;

    switch (swara) {
      case 'S':
        mainPads = [true, true, true, false, false, false];
        writtenNote = octave === 'taar' ? 'G5' : 'G4';
        break;
      case 'Rk':
        mainPads = [true, true, true, false, false, false];
        auxPads = ['Sharp'];
        writtenNote = octave === 'taar' ? 'G#5' : 'G#4';
        coachingTip = 'Komal Re (Mode 02): Touch L1–L3 + Left Pinky +½ Sharp pad (no half-hole needed!).';
        break;
      case 'R':
        mainPads = [true, true, false, false, false, false];
        writtenNote = octave === 'taar' ? 'A5' : 'A4';
        break;
      case 'Gk':
        mainPads = [true, true, false, false, false, false];
        auxPads = ['Flat'];
        writtenNote = octave === 'taar' ? 'Bb5' : 'Bb4';
        coachingTip = 'Komal Ga (Mode 02): Touch L1–L2 + Right Side +½ pad cleanly.';
        break;
      case 'G':
        mainPads = [true, false, false, false, false, false];
        writtenNote = octave === 'taar' ? 'B5' : 'B4';
        break;
      case 'M':
        mainPads = [false, true, false, false, false, false];
        writtenNote = octave === 'taar' ? 'C6' : 'C5';
        coachingTip = 'Shuddha Ma (Mode 02): Touch L2 alone — effortless clean C without Bansuri half-holing.';
        break;
      case 'Mt':
        mainPads = [false, false, false, false, false, false];
        writtenNote = octave === 'taar' ? 'C#6' : 'C#5';
        coachingTip = 'Tivra Ma (Mode 02): Lift all 6 main touch pads (open C#).';
        break;
      case 'P':
        mainPads = [true, true, true, true, true, true];
        // Mandra Pa sits in lower octave (-1), Madhya Pa sits at neutral (0), Taar Pa at (+1)
        octaveShift = octave === 'mandra' ? -1 : octave === 'taar' ? 1 : 0;
        writtenNote = octave === 'mandra' ? 'D4' : octave === 'taar' ? 'D6' : 'D5';
        break;
      case 'Dk':
        mainPads = [true, true, true, true, true, true];
        auxPads = ['Eb'];
        writtenNote = octave === 'mandra' ? 'Eb4' : 'Eb5';
        coachingTip = 'Komal Dha (Mode 02): All 6 touch pads + Right Pinky Eb (+½) pad.';
        break;
      case 'D':
        mainPads = [true, true, true, true, true, false];
        writtenNote = octave === 'mandra' ? 'E4' : 'E5';
        break;
      case 'Nk':
        mainPads = [true, true, true, true, false, false];
        writtenNote = octave === 'mandra' ? 'F4' : 'F5';
        break;
      case 'N':
        mainPads = [true, true, true, false, true, false];
        writtenNote = octave === 'mandra' ? 'F#4' : 'F#5';
        coachingTip = 'Shuddha Ni (Mode 02): L1–L3 + R2 cross-touch (lift R1).';
        break;
    }

    if (pitchBendActive) {
      coachingTip =
        activeOrnament === 'meend'
          ? 'Meend Glide: Press/roll Right-Thumb Pitch Bend pad gently while changing touch keys!'
          : 'Gamak Vibrato: Pulse Right-Thumb Pitch Bend pad softly with steady airflow.';
    } else if (!coachingTip && octaveShift !== 0) {
      coachingTip =
        octaveShift === 1
          ? 'Taar Saptak: Roll Left Thumb UP onto OCT+ rear pad — keep airflow light & relaxed.'
          : 'Mandra Saptak: Roll Left Thumb DOWN onto OCT− rear pad for warm bass notes.';
    }

    const parts: string[] = [];
    if (octaveShift === 1) parts.push('OCT+');
    else if (octaveShift === -1) parts.push('OCT-');
    if (auxPads.length > 0) parts.push(auxPads[0] === 'Sharp' ? '+½' : auxPads[0] === 'Flat' ? 'Bb' : auxPads[0]);
    if (pitchBendActive) parts.push('PB');

    return {
      octaveShift,
      mainPads,
      auxPads,
      pitchBendActive,
      writtenNote,
      highwayTag: parts.length > 0 ? parts.join('·') : null,
      coachingTip,
    };
  }

  // Eastar EDA-100 Mode 01 (Saxophone Fingering — Factory Default):
  // Mirrors real Alto Saxophone fingerings with noiseless touch sensors & rear Octave Pads!
  // On real sax, Mandra P..N (written D4..F#4) sit in the neutral register (octaveShift = 0).
  const semi = SWARA_META[swara].semitonesFromSa;
  let octaveShift: -1 | 0 | 1 = 0;
  if (octave === 'taar' || (octave === 'madhya' && semi >= 7)) {
    octaveShift = 1;
  }

  if (octave === 'taar' && swara === 'P') {
    return {
      octaveShift: 1,
      mainPads: [false, false, false, false, false, false],
      auxPads: ['PalmD'],
      pitchBendActive,
      writtenNote: 'D6',
      highwayTag: pitchBendActive ? 'OCT+·D·PB' : 'OCT+·D',
      coachingTip: 'Taar Pa (Mode 01): Hold Left Thumb OCT+ pad + Left Palm D touch pad.',
    };
  }

  let mainPads: [boolean, boolean, boolean, boolean, boolean, boolean] = [
    true,
    true,
    true,
    false,
    false,
    false,
  ];
  let auxPads: EwiAuxPad[] = [];
  let writtenNote = 'G4';
  let coachingTip: string | null = null;

  switch (swara) {
    case 'S':
      mainPads = [true, true, true, false, false, false];
      writtenNote = octave === 'taar' ? 'G5' : 'G4';
      break;
    case 'Rk':
      mainPads = [true, true, true, false, false, false];
      auxPads = ['G#'];
      writtenNote = octave === 'taar' ? 'G#5' : 'G#4';
      coachingTip = 'Komal Re (Mode 01): Lightly touch L1–L3 + Left Pinky G# pad.';
      break;
    case 'R':
      mainPads = [true, true, false, false, false, false];
      writtenNote = octave === 'taar' ? 'A5' : 'A4';
      break;
    case 'Gk':
      mainPads = [true, false, false, false, false, false];
      auxPads = ['Bb'];
      writtenNote = octave === 'taar' ? 'Bb5' : 'Bb4';
      coachingTip = 'Komal Ga (Mode 01): Touch L1 + Right Side Bb touch sensor cleanly.';
      break;
    case 'G':
      mainPads = [true, false, false, false, false, false];
      writtenNote = octave === 'taar' ? 'B5' : 'B4';
      break;
    case 'M':
      mainPads = [false, true, false, false, false, false];
      writtenNote = octave === 'taar' ? 'C6' : 'C5';
      coachingTip = 'Shuddha Ma (Mode 01): Touch L2 alone (lift L1) — crisp capacitive C.';
      break;
    case 'Mt':
      mainPads = [false, false, false, false, false, false];
      writtenNote = octave === 'taar' ? 'C#6' : 'C#5';
      coachingTip = 'Tivra Ma (Mode 01): Open touch — lift all 6 fingers lightly off the pads.';
      break;
    case 'P':
      mainPads = [true, true, true, true, true, true];
      writtenNote = octave === 'mandra' ? 'D4' : 'D5';
      break;
    case 'Dk':
      mainPads = [true, true, true, true, true, true];
      auxPads = ['Eb'];
      writtenNote = octave === 'mandra' ? 'Eb4' : 'Eb5';
      coachingTip = 'Komal Dha (Mode 01): Touch all 6 main pads + Right Pinky Eb pad.';
      break;
    case 'D':
      mainPads = [true, true, true, true, true, false];
      writtenNote = octave === 'mandra' ? 'E4' : 'E5';
      break;
    case 'Nk':
      mainPads = [true, true, true, true, false, false];
      writtenNote = octave === 'mandra' ? 'F4' : 'F5';
      break;
    case 'N':
      mainPads = [true, true, true, false, true, false];
      writtenNote = octave === 'mandra' ? 'F#4' : 'F#5';
      coachingTip = 'Shuddha Ni (Mode 01): Touch L1–L3 + R2 (lift R1).';
      break;
  }

  if (pitchBendActive) {
    coachingTip =
      activeOrnament === 'meend'
        ? 'Meend Glide: Press the Right-Thumb Pitch Bend button smoothly while moving between notes!'
        : 'Gamak Expression: Gently pulse the Pitch Bend button + breath pressure for vocal vibrato.';
  } else if (!coachingTip && octaveShift === 1) {
    coachingTip = 'Upper Register: Rest Left Thumb on rear OCT+ pad (zero overblowing needed!).';
  }

  const parts: string[] = [];
  if (octaveShift === 1) parts.push('OCT+');
  if (auxPads.length > 0) parts.push(auxPads[0]);
  if (pitchBendActive) parts.push('PB');

  return {
    octaveShift,
    mainPads,
    auxPads,
    pitchBendActive,
    writtenNote,
    highwayTag: parts.length > 0 ? parts.join('·') : null,
    coachingTip,
  };
}
