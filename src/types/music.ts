export type SwaraId =
  | 'S'
  | 'Rk'
  | 'R'
  | 'Gk'
  | 'G'
  | 'M'
  | 'Mt'
  | 'P'
  | 'Dk'
  | 'D'
  | 'Nk'
  | 'N';

export type Octave = 'mandra' | 'madhya' | 'taar';

/** 0 = Open, 0.5 = Half-hole (Komal / Ma pitch control), 1 = Fully closed */
export type HoleState = 0 | 0.5 | 1;

/** 6 primary playing holes (L1, L2, L3, R1, R2, R3) + 7th pinky/tuning hole */
export type HolePattern = [
  HoleState,
  HoleState,
  HoleState,
  HoleState,
  HoleState,
  HoleState,
  HoleState
];

export type BreathLevel = 'soft' | 'medium' | 'strong';

export type OrnamentType = 'meend' | 'kan' | 'gamak';

export interface OrnamentInfo {
  type: OrnamentType;
  /** Source or grace swara for Meend/Kan */
  graceSwara?: SwaraId;
  graceOctave?: Octave;
  label?: string;
}

export interface SongNote {
  id: string;
  swara: SwaraId;
  octave: Octave;
  startBeat: number;
  durationBeats: number;
  lyric: string;
  hindi?: string;
  /** Natural breath pause immediately following this note */
  breathAfter?: boolean;
  ornament?: OrnamentInfo;
}

export interface SongSection {
  id: string;
  name: string;
  startBeat: number;
  endBeat: number;
}

export type SongEra =
  | 'Retro Classics'
  | '90s Golden Era'
  | 'Modern Bollywood'
  | 'Devotional & Tunes';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type TalaType = 'keherwa' | 'dadra';

export interface BansuriScale {
  id: string;
  name: string;
  rootNote: string;
  /** Frequency in Hz of Madhya Sa (top 3 holes closed) */
  rootHz: number;
  lengthInches: number;
  character: string;
}

export interface Song {
  id: string;
  title: string;
  movie: string;
  year: number;
  composer: string;
  singers: string;
  era: SongEra;
  difficulty: Difficulty;
  scale: BansuriScale;
  raga: string;
  tala: TalaType;
  talaLabel: string;
  beatsPerBar: number;
  bpm: number;
  description: string;
  featured?: boolean;
  sourceUrl?: string;
  youtubeId?: string;
  youtubeTitle?: string;
  sections: SongSection[];
  notes: SongNote[];
  totalBeats: number;
}

export type InstrumentType = 'bansuri' | 'saxophone' | 'harmonica' | 'ewi';

export type CameraView = 'first-person' | 'front-facing' | 'close-up';

export type EwiFingeringMode = 'sax' | 'flute';

export type EwiVoiceId = 'ewi-synth' | 'bansuri' | 'saxophone' | 'harmonica';

export type EwiAuxPad = 'G#' | 'Bb' | 'Eb' | 'PalmD' | 'Sharp' | 'Flat';

export interface EwiSettings {
  /** Eastar EDA-100 Fingering Mode: 'sax' (01) or 'flute' (02) */
  fingeringMode: EwiFingeringMode;
  /** Active Studio Voice matching EDA-100 Tone slots */
  voice: EwiVoiceId;
  /** Eastar EDA-100 3-Stage Breath Sensitivity (1=Light, 2=Medium, 3=Heavy) */
  breathLevel: 1 | 2 | 3;
  /** Eastar EDA-100 Reverb depth (0-30, default 20) */
  reverbLevel: number;
  /** Enable Pitch Bend thumb pad for Bollywood Meend / Gamak expression */
  pitchBendEnabled: boolean;
  /** Transpose setting: 'auto' locks to song scale, or manual -12..+12 semitones */
  transposeMode: 'auto' | 'manual';
  manualTranspose: number;
}

export interface EwiFingering {
  /** Rear Left-Thumb Octave Pad: -1 (OCT-), 0 (Neutral), +1 (OCT+) */
  octaveShift: -1 | 0 | 1;
  /** 6 main noiseless capacitive touch pads: [L1, L2, L3, R1, R2, R3] */
  mainPads: [boolean, boolean, boolean, boolean, boolean, boolean];
  /** Chromatic auxiliary touch pads */
  auxPads: EwiAuxPad[];
  /** Right-thumb Pitch Bend pad engages on Meend / Gamak */
  pitchBendActive: boolean;
  /** Written fingered note label */
  writtenNote: string;
  /** Compact badge for Sargam Highway pills */
  highwayTag: string | null;
  /** Actionable EDA-100 coaching hint */
  coachingTip: string | null;
}

export interface LiveMidiState {
  supported: boolean;
  connected: boolean;
  deviceName: string | null;
  activeMidiNote: number | null;
  activeSwaraLabel: string | null;
  breathCC: number; // 0..127 (CC#2 / CC#11)
  pitchBend: number; // -1..+1
}

export type SaxAuxKey = 'G#' | 'Bb' | 'Eb' | 'PalmD';

export interface SaxFingering {
  /** Left thumb octave register key on the rear upper neck */
  octaveKey: boolean;
  /** 6 main mother-of-pearl keys: [L1, L2, L3, R1, R2, R3] */
  mainKeys: [boolean, boolean, boolean, boolean, boolean, boolean];
  /** Chromatic auxiliary / pinky / side keys */
  auxKeys: SaxAuxKey[];
  /** Compact written sax note label (G = Sa convention) */
  writtenNote: string;
  /** Short badge for Sargam Highway pills */
  highwayTag: string | null;
  /** Actionable technique hint when octave or chromatic keys engage */
  coachingTip: string | null;
}

export interface HarmonicaTab {
  /** 12-Hole Solo-Tuned Chromatic Harmonica hole number (1..12) */
  hole: number;
  /** Blow (exhale) vs Draw (inhale) */
  action: 'blow' | 'draw';
  /** Right-side chromatic slide button pressed (+1 semitone) */
  slide: boolean;
  /** Compact tab symbol e.g. "5↑", "6↓", "7↑●" */
  compactTab: string;
  /** Clear coaching tip for beginners */
  coachingTip: string | null;
}

export interface AudioVolumes {
  flute: number;
  tanpura: number;
  tabla: number;
}

export interface AudioMutes {
  flute: boolean;
  tanpura: boolean;
  tabla: boolean;
}
