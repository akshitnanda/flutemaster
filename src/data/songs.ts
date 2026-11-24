import { Octave, OrnamentInfo, Song, SongNote, SwaraId } from '../types/music';
import { BANSURI_SCALES } from './sargam';

interface NoteDraft {
  swara: SwaraId;
  octave?: Octave;
  beats: number;
  lyric: string;
  hindi?: string;
  /** Natural breath pause (in beats) immediately following this note */
  breath?: number;
  ornament?: OrnamentInfo;
}

function buildNotes(
  songId: string,
  drafts: NoteDraft[],
  startOffset = 0
): { notes: SongNote[]; totalBeats: number } {
  let cursor = startOffset;
  const notes: SongNote[] = drafts.map((d, idx) => {
    const note: SongNote = {
      id: `${songId}-n${idx}`,
      swara: d.swara,
      octave: d.octave ?? 'madhya',
      startBeat: Number(cursor.toFixed(3)),
      durationBeats: d.beats,
      lyric: d.lyric,
      hindi: d.hindi,
      breathAfter: d.breath !== undefined && d.breath > 0,
      ornament: d.ornament,
    };
    cursor += d.beats + (d.breath ?? 0);
    return note;
  });

  return { notes, totalBeats: Math.round(cursor) };
}

/* ==========================================================================
   1. TUJHE DEKHA TO (1995 — 90s Golden Era · E Bass · 97 BPM · Keherwa 8)
      Verified DDLJ E Minor / Asavari melody: S S | S P | M | P | g M | d P
   ========================================================================== */
const tujheDekhaSeq = buildNotes('tujhe-dekha-to', [
  // Bar 1 (0 -> 8, 4.95s): Tujhe dekha to yeh jaana sanam
  { swara: 'S', beats: 0.5, lyric: 'Tu-', hindi: 'तु-' },
  { swara: 'S', beats: 0.5, lyric: '-jhe', hindi: '-झे' },
  { swara: 'S', beats: 0.5, lyric: 'de-', hindi: 'दे-' },
  { swara: 'P', beats: 1.0, lyric: '-kha', hindi: '-खा', ornament: { type: 'meend', graceSwara: 'S', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'M', beats: 0.5, lyric: 'to', hindi: 'तो' },
  { swara: 'P', beats: 0.5, lyric: 'yeh', hindi: 'ये' },
  { swara: 'Gk', beats: 0.5, lyric: 'jaa-', hindi: 'जा-' },
  { swara: 'M', beats: 0.5, lyric: '-na', hindi: '-ना' },
  { swara: 'Dk', beats: 0.5, lyric: 'sa-', hindi: 'स-' },
  { swara: 'P', beats: 2.0, lyric: '-nam', hindi: '-नम', breath: 1.0 },

  // Bar 2 (8 -> 16, 4.95s): Pyaar hota hai deewana sanam
  { swara: 'S', beats: 0.5, lyric: 'Pyaar', hindi: 'प्यार' },
  { swara: 'S', beats: 0.5, lyric: 'ho-', hindi: 'हो-' },
  { swara: 'P', beats: 1.25, lyric: '-ta', hindi: '-ता', ornament: { type: 'meend', graceSwara: 'S', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'M', beats: 0.5, lyric: 'hai', hindi: 'है' },
  { swara: 'P', beats: 0.5, lyric: 'dee-', hindi: 'दी-' },
  { swara: 'Gk', beats: 0.5, lyric: '-waa-', hindi: '-वा-' },
  { swara: 'M', beats: 0.5, lyric: '-na', hindi: '-ना' },
  { swara: 'Gk', beats: 0.75, lyric: 'sa-', hindi: 'स-', ornament: { type: 'kan', graceSwara: 'M', graceOctave: 'madhya', label: 'Kan' } },
  { swara: 'R', beats: 2.0, lyric: '-nam', hindi: '-नम', breath: 1.0 },

  // Bar 3 (16 -> 24, 4.95s): Ab yahaan se kahaan jaayein hum
  { swara: 'S', beats: 0.5, lyric: 'Ab', hindi: 'अब' },
  { swara: 'R', beats: 0.75, lyric: 'ya-', hindi: 'य-' },
  { swara: 'Nk', octave: 'mandra', beats: 0.75, lyric: '-haan', hindi: '-हाँ' },
  { swara: 'S', beats: 0.5, lyric: 'se', hindi: 'से' },
  { swara: 'R', beats: 0.75, lyric: 'ka-', hindi: 'क-' },
  { swara: 'Nk', octave: 'mandra', beats: 0.75, lyric: '-haan', hindi: '-हाँ' },
  { swara: 'S', beats: 0.75, lyric: 'jaa-', hindi: 'जा-' },
  { swara: 'Gk', beats: 0.75, lyric: '-yein', hindi: '-एं' },
  { swara: 'R', beats: 1.75, lyric: 'hum', hindi: 'हम', breath: 0.75 },

  // Bar 4 (24 -> 32, 4.95s): Teri baahon mein mar jaayein hum
  { swara: 'R', beats: 0.5, lyric: 'Te-', hindi: 'ते-' },
  { swara: 'Gk', beats: 0.5, lyric: '-ri', hindi: '-री' },
  { swara: 'M', beats: 0.5, lyric: 'baa-', hindi: 'बा-' },
  { swara: 'P', beats: 0.75, lyric: '-hon', hindi: '-हों' },
  { swara: 'Nk', beats: 0.5, lyric: 'mein', hindi: 'में' },
  { swara: 'Dk', beats: 0.5, lyric: 'mar', hindi: 'मर' },
  { swara: 'P', beats: 0.75, lyric: 'jaa-', hindi: 'जा-' },
  { swara: 'Gk', beats: 0.5, lyric: '-yein', hindi: '-एं' },
  { swara: 'M', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'Gk', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'S', beats: 1.25, lyric: 'hum', hindi: 'हम', ornament: { type: 'gamak', label: 'Gamak' }, breath: 0.75 },
]);

/* ==========================================================================
   2. LAG JA GALE (1964 — Retro Classics · E Bass · 128 BPM · Dadra Waltz 6)
      True 1-2-3 4-5-6 Dadra waltz pulse (2.81s/bar, 11.25s opening Mukhda)
      Verified against Lata Mangeshkar, Rajesh Cherthala (wriuhEC9B5A) & notesandsargam.com
   ========================================================================== */
const lagJaGaleSeq = buildNotes('lag-ja-gale', [
  // Bar 1 (0 -> 6): Lag (1) ja (2) ga-(3) -le...(4-5-6)
  { swara: 'P', octave: 'mandra', beats: 1.0, lyric: 'Lag', hindi: 'लग' },
  { swara: 'P', octave: 'mandra', beats: 1.0, lyric: 'ja', hindi: 'जा' },
  { swara: 'G', beats: 1.0, lyric: 'ga-', hindi: 'ग-', ornament: { type: 'meend', graceSwara: 'P', graceOctave: 'mandra', label: 'Meend' } },
  { swara: 'R', beats: 0.5, lyric: '-le', hindi: '-ले' },
  { swara: 'G', beats: 2.0, lyric: '...', hindi: '', breath: 0.5 },

  // Bar 2 (6 -> 12): ke phir ye haseen
  { swara: 'G', beats: 0.5, lyric: 'ke', hindi: 'के' },
  { swara: 'R', beats: 0.5, lyric: 'phir', hindi: 'फिर', ornament: { type: 'meend', graceSwara: 'G', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'R', beats: 0.5, lyric: 'ye', hindi: 'ये' },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: 'ha-', hindi: 'ह-' },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 1.0, lyric: '-seen', hindi: '-सीं' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 1.5, lyric: '...', hindi: '' },

  // Bar 3 (12 -> 18): raat ho na ho...
  { swara: 'M', beats: 0.5, lyric: 'raat', hindi: 'रात', ornament: { type: 'gamak', label: 'Gamak' } },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'S', beats: 1.0, lyric: '...', hindi: '' },
  { swara: 'S', beats: 1.0, lyric: 'ho', hindi: 'हो' },
  { swara: 'R', beats: 1.0, lyric: 'na', hindi: 'न' },
  { swara: 'R', beats: 1.5, lyric: 'ho', hindi: 'हो', ornament: { type: 'kan', graceSwara: 'G', graceOctave: 'madhya', label: 'Kan' } },

  // Bar 4 (18 -> 24): ...ooo (,N ,D ,P)
  { swara: 'R', beats: 1.5, lyric: '...', hindi: '' },
  { swara: 'N', octave: 'mandra', beats: 1.0, lyric: '...', hindi: '' },
  { swara: 'D', octave: 'mandra', beats: 1.0, lyric: '...', hindi: '' },
  { swara: 'P', octave: 'mandra', beats: 1.5, lyric: '...', hindi: '', breath: 1.0 },

  // Bar 5 (24 -> 30): Shayad phir is janam mein
  { swara: 'P', octave: 'mandra', beats: 0.75, lyric: 'Shaa-', hindi: 'शा-' },
  { swara: 'D', octave: 'mandra', beats: 1.0, lyric: '-yad', hindi: '-यद' },
  { swara: 'D', octave: 'mandra', beats: 0.75, lyric: 'phir', hindi: 'फिर' },
  { swara: 'D', octave: 'mandra', beats: 0.5, lyric: 'is', hindi: 'इस' },
  { swara: 'D', octave: 'mandra', beats: 0.5, lyric: 'ja-', hindi: 'ज-' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '-nam', hindi: '-नम' },
  { swara: 'R', beats: 0.75, lyric: '...', hindi: '', ornament: { type: 'meend', graceSwara: 'N', graceOctave: 'mandra', label: 'Meend' } },
  { swara: 'D', octave: 'mandra', beats: 0.5, lyric: 'mein', hindi: 'में' },
  { swara: 'P', octave: 'mandra', beats: 0.75, lyric: '...', hindi: '' },

  // Bar 6 (30 -> 36): Mulakaat ho na ho
  { swara: 'P', octave: 'mandra', beats: 0.75, lyric: 'mu-', hindi: 'मु-' },
  { swara: 'P', beats: 1.25, lyric: '-laa-', hindi: '-ला-', ornament: { type: 'meend', graceSwara: 'P', graceOctave: 'mandra', label: 'Meend' } },
  { swara: 'D', beats: 0.75, lyric: '-kaat', hindi: '-कात' },
  { swara: 'M', beats: 0.75, lyric: 'ho', hindi: 'हो' },
  { swara: 'P', beats: 0.5, lyric: 'na', hindi: 'न' },
  { swara: 'M', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 1.0, lyric: 'ho', hindi: 'हो', breath: 0.5 },

  // Bars 7-9 (36 -> 54): Antara — Humko mili hai aaj ye ghadiyaan naseeb se
  { swara: 'S', beats: 1.0, lyric: 'Hum-', hindi: 'हम-' },
  { swara: 'P', beats: 1.25, lyric: '-ko', hindi: '-को', ornament: { type: 'meend', graceSwara: 'S', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'M', beats: 0.75, lyric: 'mi-', hindi: 'मि-' },
  { swara: 'P', beats: 1.0, lyric: '-li', hindi: '-ली' },
  { swara: 'P', beats: 0.75, lyric: 'hai', hindi: 'हैं' },
  { swara: 'S', octave: 'taar', beats: 1.25, lyric: 'aaj', hindi: 'आज' },

  { swara: 'D', beats: 1.0, lyric: 'ye', hindi: 'ये' },
  { swara: 'P', beats: 0.75, lyric: '...', hindi: '' },
  { swara: 'M', beats: 1.25, lyric: 'gha-', hindi: 'घ-' },
  { swara: 'S', beats: 0.75, lyric: '-di-', hindi: '-डि-' },
  { swara: 'M', beats: 1.5, lyric: '-yaan', hindi: '-याँ', breath: 0.75 },

  { swara: 'D', beats: 1.0, lyric: 'na-', hindi: 'न-' },
  { swara: 'P', beats: 1.0, lyric: '-seeb', hindi: '-सीब', ornament: { type: 'gamak', label: 'Gamak' } },
  { swara: 'M', beats: 1.0, lyric: 'se', hindi: 'से' },
  { swara: 'G', beats: 2.0, lyric: '...', hindi: '...', breath: 1.0 },
]);

/* ==========================================================================
   3. ROOP TERA MASTANA (1969 — Retro Classics · A Medium · 84 BPM · Keherwa 8)
      True syncopated S.D. Burman / Kishore Kumar vocal phrasing
   ========================================================================== */
const roopTeraSeq = buildNotes('roop-tera-mastana', [
  // Bar 1 (0 -> 8, 5.71s): Roop tera mastana (4b) · Pyaar mera deewana (4b)
  { swara: 'R', beats: 0.75, lyric: 'Roop', hindi: 'रूप' },
  { swara: 'R', beats: 0.25, lyric: 'te-', hindi: 'ते-' },
  { swara: 'S', beats: 0.5, lyric: '-ra', hindi: '-रा' },
  { swara: 'R', beats: 0.5, lyric: 'mas-', hindi: 'मस-' },
  { swara: 'S', beats: 0.25, lyric: '-taa-', hindi: '-ता-' },
  { swara: 'R', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'S', beats: 0.5, lyric: '...', hindi: '', ornament: { type: 'meend', graceSwara: 'R', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'D', octave: 'mandra', beats: 0.75, lyric: '-na', hindi: '-ना', ornament: { type: 'meend', graceSwara: 'S', graceOctave: 'madhya', label: 'Meend' }, breath: 0.25 },

  { swara: 'R', beats: 0.75, lyric: 'Pyaar', hindi: 'प्यार' },
  { swara: 'R', beats: 0.25, lyric: 'me-', hindi: 'मे-' },
  { swara: 'S', beats: 0.25, lyric: '-ra', hindi: '-रा' },
  { swara: 'R', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.5, lyric: 'dee-', hindi: 'दी-' },
  { swara: 'R', beats: 0.5, lyric: '-waa-', hindi: '-वा-' },
  { swara: 'S', beats: 0.5, lyric: '...', hindi: '', ornament: { type: 'meend', graceSwara: 'R', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'D', octave: 'mandra', beats: 0.75, lyric: '-na', hindi: '-ना', ornament: { type: 'meend', graceSwara: 'S', graceOctave: 'madhya', label: 'Meend' }, breath: 0.25 },

  // Bar 2 (8 -> 16, 5.71s): Bhool koi humse na ho jaaye
  { swara: 'R', beats: 0.75, lyric: 'Bhool', hindi: 'भूल' },
  { swara: 'R', beats: 0.25, lyric: 'ko-', hindi: 'को-' },
  { swara: 'S', beats: 0.5, lyric: '-i', hindi: '-ई' },
  { swara: 'R', beats: 0.5, lyric: 'hum-', hindi: 'हम-' },
  { swara: 'R', beats: 0.5, lyric: '-se', hindi: '-से' },
  { swara: 'S', beats: 0.5, lyric: 'na', hindi: 'न' },
  { swara: 'R', beats: 0.75, lyric: 'ho', hindi: 'हो' },
  { swara: 'R', beats: 0.25, lyric: 'jaa-', hindi: 'जा-' },
  { swara: 'S', beats: 0.75, lyric: '...', hindi: '', ornament: { type: 'meend', graceSwara: 'R', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'P', octave: 'mandra', beats: 0.75, lyric: '-ye', hindi: '-ए' },
  { swara: 'D', octave: 'mandra', beats: 1.5, lyric: '...', hindi: '', ornament: { type: 'gamak', label: 'Gamak' }, breath: 1.0 },

  // Bar 3 (16 -> 24, 5.71s): Antara — Raat nasheeli mast sama hai
  { swara: 'D', beats: 0.5, lyric: 'Raat', hindi: 'रात' },
  { swara: 'S', octave: 'taar', beats: 1.0, lyric: 'na-', hindi: 'न-' },
  { swara: 'D', beats: 0.5, lyric: '-shee-', hindi: '-शी-' },
  { swara: 'S', octave: 'taar', beats: 0.5, lyric: '-li', hindi: '-ली' },
  { swara: 'S', octave: 'taar', beats: 0.5, lyric: 'mast', hindi: 'मस्त' },
  { swara: 'R', octave: 'taar', beats: 0.75, lyric: 'sa-', hindi: 'स-' },
  { swara: 'S', octave: 'taar', beats: 0.75, lyric: '-maa', hindi: '-मा' },
  { swara: 'N', beats: 1.0, lyric: 'hai', hindi: 'है' },
  { swara: 'P', beats: 1.5, lyric: '...', hindi: '', ornament: { type: 'meend', graceSwara: 'N', graceOctave: 'madhya', label: 'Meend' }, breath: 1.0 },

  // Bar 4 (24 -> 32, 5.71s): Aaj nashe mein saara jahaan hai
  { swara: 'D', beats: 0.5, lyric: 'Aaj', hindi: 'आज' },
  { swara: 'S', octave: 'taar', beats: 1.0, lyric: 'na-', hindi: 'न-' },
  { swara: 'D', beats: 0.5, lyric: '-she', hindi: '-शे' },
  { swara: 'S', octave: 'taar', beats: 1.0, lyric: 'mein', hindi: 'में' },
  { swara: 'G', beats: 0.5, lyric: 'saa-', hindi: 'सा-' },
  { swara: 'R', beats: 0.5, lyric: '-ra', hindi: '-रा' },
  { swara: 'G', beats: 0.5, lyric: 'ja-', hindi: 'ज-' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.5, lyric: '-haan', hindi: '-हाँ' },
  { swara: 'M', beats: 1.25, lyric: 'hai', hindi: 'है', ornament: { type: 'meend', graceSwara: 'G', graceOctave: 'madhya', label: 'Meend' }, breath: 0.75 },
]);

/* ==========================================================================
   4. PAL PAL DIL KE PAAS (1973 — Retro Classics · G Bass · 121 BPM · Keherwa 8)
      Exact Kishore Kumar 121 BPM 4/4 phrasing + true rising "Jeevan meethi pyaas" (G M P D P)
   ========================================================================== */
const palPalSeq = buildNotes('pal-pal-dil-ke-paas', [
  // Bars 1-2 (0 -> 16, 7.93s): Pal pal dil ke paas, tum rehti ho
  { swara: 'D', octave: 'mandra', beats: 1.5, lyric: 'Pal', hindi: 'पल' },
  { swara: 'N', octave: 'mandra', beats: 1.5, lyric: 'pal', hindi: 'पल' },
  { swara: 'S', beats: 2.0, lyric: 'dil', hindi: 'दिल' },
  { swara: 'G', beats: 0.5, lyric: 'ke', hindi: 'के' },
  { swara: 'R', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'R', beats: 3.0, lyric: 'paas', hindi: 'पास' },

  { swara: 'D', octave: 'mandra', beats: 1.0, lyric: 'tum', hindi: 'तुम', ornament: { type: 'meend', graceSwara: 'R', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'D', octave: 'mandra', beats: 0.5, lyric: 'reh-', hindi: 'रह-' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '-ti', hindi: '-ती' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'S', beats: 3.5, lyric: 'ho', hindi: 'हो', breath: 1.0 },

  // Bars 3-4 (16 -> 32, 7.93s): Jeevan meethi pyaas, yeh kehti ho (TRUE G-M-P-D-P melody!)
  { swara: 'G', beats: 1.5, lyric: 'Jee-', hindi: 'जी-' },
  { swara: 'M', beats: 1.5, lyric: '-van', hindi: '-वन' },
  { swara: 'P', beats: 2.0, lyric: 'mee-', hindi: 'मी-' },
  { swara: 'D', beats: 0.5, lyric: '-thi', hindi: '-ठी' },
  { swara: 'P', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'D', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'P', beats: 3.0, lyric: 'pyaas', hindi: 'प्यास', ornament: { type: 'kan', graceSwara: 'D', graceOctave: 'madhya', label: 'Kan' } },

  { swara: 'R', beats: 1.0, lyric: 'yeh', hindi: 'ये' },
  { swara: 'R', beats: 0.5, lyric: 'keh-', hindi: 'कह-' },
  { swara: 'G', beats: 0.5, lyric: '-ti', hindi: '-ती' },
  { swara: 'P', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'M', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'G', beats: 2.5, lyric: 'ho', hindi: 'हो' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'S', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '...', hindi: '', breath: 0.5 },
]);

/* ==========================================================================
   5. PEHLA NASHA (1992 — 90s Golden Era · G# Medium · 76 BPM · Slow Keherwa 8)
      Dreamy Udit Narayan phrasing: G G P...{PD}P... m G R ,P
   ========================================================================== */
const pehlaNashaSeq = buildNotes('pehla-nasha', [
  // Bar 1 (0 -> 8, 6.32s): Pehla nasha, pehla khumaar
  { swara: 'G', beats: 0.5, lyric: 'Peh-', hindi: 'पह-' },
  { swara: 'G', beats: 0.5, lyric: '-la', hindi: '-ला' },
  { swara: 'P', beats: 2.0, lyric: 'na-', hindi: 'न-', ornament: { type: 'meend', graceSwara: 'G', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'D', beats: 0.25, lyric: '-shaa', hindi: '-शा' },
  { swara: 'P', beats: 1.25, lyric: '...', hindi: '', breath: 0.5 },

  { swara: 'M', beats: 0.5, lyric: 'peh-', hindi: 'पह-' },
  { swara: 'G', beats: 0.5, lyric: '-la', hindi: '-ला' },
  { swara: 'R', beats: 0.5, lyric: 'khu-', hindi: 'ख़ु-' },
  { swara: 'P', octave: 'mandra', beats: 1.0, lyric: '-maar', hindi: '-मार', breath: 0.5 },

  // Bar 2 (8 -> 16, 6.32s): Naya pyaar hai, naya intezaar
  { swara: 'G', beats: 0.5, lyric: 'Na-', hindi: 'न-' },
  { swara: 'G', beats: 0.5, lyric: '-ya', hindi: '-या' },
  { swara: 'P', beats: 2.0, lyric: 'pyaar', hindi: 'प्यार' },
  { swara: 'D', beats: 0.25, lyric: 'hai', hindi: 'है', ornament: { type: 'kan', graceSwara: 'P', graceOctave: 'madhya', label: 'Kan' } },
  { swara: 'P', beats: 1.25, lyric: '...', hindi: '', breath: 0.5 },

  { swara: 'M', beats: 0.5, lyric: 'na-', hindi: 'न-' },
  { swara: 'G', beats: 0.5, lyric: '-ya', hindi: '-या' },
  { swara: 'R', beats: 0.5, lyric: 'in-', hindi: 'इं-' },
  { swara: 'G', beats: 0.5, lyric: '-te-', hindi: '-त-' },
  { swara: 'R', beats: 0.5, lyric: '-zaar', hindi: '-ज़ार', breath: 0.5 },

  // Bar 3 (16 -> 24, 6.32s): Kar loon main kya apna haal, aye dil-e-beqaraar
  { swara: 'S', beats: 0.5, lyric: 'Kar', hindi: 'कर' },
  { swara: 'Nk', octave: 'mandra', beats: 0.5, lyric: 'loon', hindi: 'लूँ' },
  { swara: 'D', octave: 'mandra', beats: 0.5, lyric: 'main', hindi: 'मैं' },
  { swara: 'Nk', octave: 'mandra', beats: 0.5, lyric: 'kya', hindi: 'क्या' },
  { swara: 'S', beats: 1.5, lyric: 'ap-', hindi: 'अप-' },
  { swara: 'M', beats: 0.5, lyric: '-na', hindi: '-ना' },
  { swara: 'G', beats: 0.5, lyric: 'haal', hindi: 'हाल', breath: 0.5 },

  { swara: 'S', beats: 0.25, lyric: 'aye', hindi: 'ऐ' },
  { swara: 'Nk', octave: 'mandra', beats: 0.25, lyric: 'dil-', hindi: 'दिल-' },
  { swara: 'D', octave: 'mandra', beats: 0.25, lyric: '-e-', hindi: '-ए-' },
  { swara: 'Nk', octave: 'mandra', beats: 0.25, lyric: 'be-', hindi: 'बे-' },
  { swara: 'S', beats: 0.5, lyric: '-ka-', hindi: '-क़-' },
  { swara: 'M', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.75, lyric: '-raar', hindi: '-रार' },

  // Bar 4 (24 -> 32, 6.32s): Udta hi phiroon in hawaaon mein kahin
  { swara: 'S', octave: 'taar', beats: 0.75, lyric: 'Ud-', hindi: 'उड़-' },
  { swara: 'Nk', beats: 0.5, lyric: '-ta', hindi: '-ता' },
  { swara: 'S', octave: 'taar', beats: 0.5, lyric: 'hi', hindi: 'ही' },
  { swara: 'P', beats: 1.5, lyric: 'phi-', hindi: 'फि-', ornament: { type: 'meend', graceSwara: 'S', graceOctave: 'taar', label: 'Meend' } },
  { swara: 'D', beats: 0.5, lyric: '-roon', hindi: '-रूँ' },
  { swara: 'Nk', beats: 0.5, lyric: 'in', hindi: 'इन' },
  { swara: 'D', beats: 0.75, lyric: 'ha-', hindi: 'ह-' },
  { swara: 'P', beats: 0.5, lyric: '-waa-', hindi: '-वा-' },
  { swara: 'M', beats: 0.5, lyric: '-on', hindi: '-ओं' },
  { swara: 'R', beats: 0.75, lyric: 'mein', hindi: 'में' },
  { swara: 'D', beats: 0.25, lyric: 'ka-', hindi: 'क-' },
  { swara: 'P', beats: 0.5, lyric: '-hin', hindi: '-हीं', breath: 0.5 },
]);

/* ==========================================================================
   6. CHURA KE DIL MERA (1994 — 90s Golden Era · C Medium · 122 BPM · Keherwa 8)
      OEM 122 BPM exact (Main Khiladi Tu Anari, Kumar Sanu & Alka Yagnik)
      True spacious 122 BPM groove: "Chura ke dil mera" (8b) + "goriya chali" (8b)
   ========================================================================== */
const churaKeDilSeq = buildNotes('chura-ke-dil-mera', [
  // Bars 1-2 (0 -> 16, 7.87s at 122 BPM): Chura ke dil mera (8b), goriya chali (8b)
  { swara: 'S', octave: 'taar', beats: 0.75, lyric: 'Chu-', hindi: 'चु-' },
  { swara: 'D', beats: 0.75, lyric: '-ra', hindi: '-रा' },
  { swara: 'G', beats: 0.75, lyric: 'ke', hindi: 'के' },
  { swara: 'G', beats: 0.75, lyric: 'dil', hindi: 'दिल' },
  { swara: 'R', beats: 0.75, lyric: 'me-', hindi: 'मे-' },
  { swara: 'G', beats: 1.25, lyric: '-ra', hindi: '-रा' },
  { swara: 'P', beats: 0.5, lyric: '...', hindi: '', ornament: { type: 'kan', graceSwara: 'G', graceOctave: 'madhya', label: 'Kan' } },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'S', beats: 1.0, lyric: '...', hindi: '', breath: 0.5 },

  { swara: 'S', beats: 0.75, lyric: 'go-', hindi: 'गो-' },
  { swara: 'R', beats: 0.75, lyric: '-ri-', hindi: '-रि-' },
  { swara: 'G', beats: 1.0, lyric: '-ya', hindi: '-या' },
  { swara: 'S', beats: 1.0, lyric: 'cha-', hindi: 'च-' },
  { swara: 'R', beats: 3.0, lyric: '-li', hindi: '-ली', breath: 1.5 },

  // Bars 3-4 (16 -> 32, 7.87s at 122 BPM): Paagal hua, deewana hua, kaisi yeh dil ki lagi
  { swara: 'N', beats: 0.75, lyric: 'Paa-', hindi: 'पा-' },
  { swara: 'N', beats: 0.75, lyric: '-gal', hindi: '-गल' },
  { swara: 'R', octave: 'taar', beats: 1.25, lyric: 'hu-', hindi: 'हु-', ornament: { type: 'meend', graceSwara: 'N', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'N', beats: 0.5, lyric: '-a', hindi: '-आ' },
  { swara: 'P', beats: 0.75, lyric: '...', hindi: '' },
  { swara: 'D', beats: 0.75, lyric: 'dee-', hindi: 'दी-' },
  { swara: 'D', beats: 0.75, lyric: '-waa-', hindi: '-वा-' },
  { swara: 'S', octave: 'taar', beats: 1.25, lyric: '-na', hindi: '-ना', ornament: { type: 'gamak', label: 'Gamak' } },
  { swara: 'D', beats: 0.75, lyric: 'hua', hindi: 'हुआ', breath: 0.5 },

  { swara: 'G', beats: 0.5, lyric: 'Kai-', hindi: 'कै-' },
  { swara: 'G', beats: 0.5, lyric: '-si', hindi: '-सी' },
  { swara: 'G', beats: 0.5, lyric: 'yeh', hindi: 'ये' },
  { swara: 'G', beats: 0.5, lyric: 'dil', hindi: 'दिल' },
  { swara: 'M', beats: 0.5, lyric: 'ki', hindi: 'की' },
  { swara: 'P', beats: 0.5, lyric: 'la-', hindi: 'ल-' },
  { swara: 'D', beats: 1.0, lyric: '-gi', hindi: '-गी' },
  { swara: 'G', beats: 1.5, lyric: '...', hindi: '' },
  { swara: 'S', octave: 'taar', beats: 1.5, lyric: 'ooh', hindi: 'ओ', ornament: { type: 'meend', graceSwara: 'G', graceOctave: 'madhya', label: 'Meend' }, breath: 1.0 },
]);

/* ==========================================================================
   7. TUM HI HO (2013 — Modern Bollywood · A Medium · 94 BPM · Keherwa 8)
      Verified syncopated Arijit Singh verse & "Kyunki tum hi ho" chorus
   ========================================================================== */
const tumHiHoSeq = buildNotes('tum-hi-ho', [
  // Bar 1 (0 -> 8, 5.11s): Hum tere bin ab reh nahi sakte
  { swara: 'G', beats: 0.5, lyric: 'Hum', hindi: 'हम' },
  { swara: 'D', beats: 0.75, lyric: 'te-', hindi: 'ते-', ornament: { type: 'meend', graceSwara: 'G', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'P', beats: 0.5, lyric: '-re', hindi: '-रे' },
  { swara: 'P', beats: 0.5, lyric: 'bin', hindi: 'बिन' },
  { swara: 'M', beats: 0.5, lyric: 'ab', hindi: 'अब' },
  { swara: 'M', beats: 0.5, lyric: 'reh', hindi: 'रह' },
  { swara: 'G', beats: 0.5, lyric: 'na-', hindi: 'न-' },
  { swara: 'R', beats: 0.5, lyric: '-hi', hindi: '-हीं' },
  { swara: 'S', beats: 0.5, lyric: 'sak-', hindi: 'सक-' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'M', beats: 0.5, lyric: '-te', hindi: '-ते' },
  { swara: 'G', beats: 1.5, lyric: '...', hindi: '', breath: 0.75 },

  // Bar 2 (8 -> 16, 5.11s): Tere bina kya wajood mera
  { swara: 'R', beats: 0.5, lyric: 'Te-', hindi: 'ते-' },
  { swara: 'R', beats: 0.5, lyric: '-re', hindi: '-रे' },
  { swara: 'S', beats: 0.5, lyric: 'bi-', hindi: 'बि-' },
  { swara: 'R', beats: 0.75, lyric: '-na', hindi: '-ना' },
  { swara: 'R', beats: 0.5, lyric: 'kya', hindi: 'क्या' },
  { swara: 'S', beats: 0.5, lyric: 'wa-', hindi: 'व-' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '-jood', hindi: '-जूद' },
  { swara: 'D', octave: 'mandra', beats: 0.75, lyric: 'me-', hindi: 'मे-' },
  { swara: 'P', octave: 'mandra', beats: 0.75, lyric: '-ra', hindi: '-रा' },
  { swara: 'D', octave: 'mandra', beats: 1.75, lyric: '...', hindi: '', breath: 1.0 },

  // Bar 3 (16 -> 24, 5.11s): Chorus — Kyunki tum hi ho, ab tum hi ho
  { swara: 'S', beats: 0.25, lyric: 'Kyun-', hindi: 'क्यों-' },
  { swara: 'R', beats: 0.25, lyric: '-ki', hindi: '-कि' },
  { swara: 'G', beats: 1.0, lyric: 'tum', hindi: 'तुम', ornament: { type: 'meend', graceSwara: 'R', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'S', beats: 0.5, lyric: 'hi', hindi: 'ही' },
  { swara: 'R', beats: 1.5, lyric: 'ho', hindi: 'हो', breath: 0.5 },

  { swara: 'S', beats: 0.25, lyric: 'Ab', hindi: 'अब' },
  { swara: 'R', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'G', beats: 1.0, lyric: 'tum', hindi: 'तुम', ornament: { type: 'kan', graceSwara: 'M', graceOctave: 'madhya', label: 'Kan' } },
  { swara: 'S', beats: 0.5, lyric: 'hi', hindi: 'ही' },
  { swara: 'R', beats: 1.5, lyric: 'ho', hindi: 'हो', breath: 0.5 },

  // Bar 4 (24 -> 32, 5.11s): Zindagi ab tum hi ho
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: 'Zin-', hindi: 'ज़िं-' },
  { swara: 'R', beats: 0.75, lyric: '-da-', hindi: '-द-' },
  { swara: 'S', beats: 0.75, lyric: '-gi', hindi: '-गी' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: 'ab', hindi: 'अब' },
  { swara: 'D', octave: 'mandra', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: 'tum', hindi: 'तुम' },
  { swara: 'P', octave: 'mandra', beats: 0.75, lyric: 'hi', hindi: 'ही' },
  { swara: 'D', octave: 'mandra', beats: 2.75, lyric: 'ho', hindi: 'हो', ornament: { type: 'gamak', label: 'Gamak' }, breath: 1.0 },

  // Bar 5 (32 -> 40, 5.11s): Chain bhi, mera dard bhi, meri aashiqui ab tum hi ho
  { swara: 'G', beats: 0.75, lyric: 'Chain', hindi: 'चैन' },
  { swara: 'S', beats: 0.5, lyric: 'bhi', hindi: 'भी' },
  { swara: 'R', beats: 0.75, lyric: '...', hindi: '' },
  { swara: 'S', beats: 0.25, lyric: 'me-', hindi: 'मे-' },
  { swara: 'R', beats: 0.25, lyric: '-ra', hindi: '-रा' },
  { swara: 'G', beats: 0.75, lyric: 'dard', hindi: 'दर्द' },
  { swara: 'S', beats: 0.5, lyric: 'bhi', hindi: 'भी' },
  { swara: 'R', beats: 0.75, lyric: 'aashiqui', hindi: 'आशिक़ी' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: 'ab', hindi: 'अब' },
  { swara: 'S', beats: 0.5, lyric: 'tum', hindi: 'तुम' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: 'hi', hindi: 'ही' },
  { swara: 'P', octave: 'mandra', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'D', octave: 'mandra', beats: 0.75, lyric: 'ho', hindi: 'हो', breath: 0.25 },
]);

/* ==========================================================================
   8. KESARIYA (2022 — Modern Bollywood · C Medium · 94 BPM · Keherwa 8)
      Verified Pritam / Arijit Singh chorus: S... G R G R S ,N | P P P D P M G R
   ========================================================================== */
const kesariyaSeq = buildNotes('kesariya', [
  // Bar 1 (0 -> 8, 5.11s): Kesariya tera ishq hai piya
  { swara: 'S', beats: 1.0, lyric: 'Ke-', hindi: 'के-' },
  { swara: 'G', beats: 0.5, lyric: '-sa-', hindi: '-स-' },
  { swara: 'R', beats: 0.5, lyric: '-ri-', hindi: '-रि-' },
  { swara: 'G', beats: 0.5, lyric: '-ya', hindi: '-या' },
  { swara: 'R', beats: 0.5, lyric: 'te-', hindi: 'ते-' },
  { swara: 'S', beats: 0.5, lyric: '-ra', hindi: '-रा' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '...', hindi: '' },

  { swara: 'P', beats: 0.5, lyric: 'ishq', hindi: 'इश्क़', ornament: { type: 'meend', graceSwara: 'S', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'P', beats: 0.5, lyric: 'hai', hindi: 'है' },
  { swara: 'P', beats: 0.5, lyric: 'pi-', hindi: 'पि-' },
  { swara: 'D', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'P', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'M', beats: 0.5, lyric: '-ya', hindi: '-या' },
  { swara: 'G', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '', breath: 0.5 },

  // Bar 2 (8 -> 16, 5.11s): Rang jaaun jo main haath lagaaun
  { swara: 'R', beats: 0.5, lyric: 'Rang', hindi: 'रंग' },
  { swara: 'R', beats: 0.5, lyric: 'jaa-', hindi: 'जा-' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '-un', hindi: '-ऊँ' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: 'jo', hindi: 'जो' },
  { swara: 'R', beats: 0.5, lyric: 'main', hindi: 'मैं' },
  { swara: 'R', beats: 0.5, lyric: 'haath', hindi: 'हाथ' },
  { swara: 'R', beats: 0.5, lyric: 'la-', hindi: 'ल-' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '-gaa-', hindi: '-गा-' },
  { swara: 'R', beats: 0.75, lyric: '-un', hindi: '-ऊँ' },
  { swara: 'G', beats: 0.75, lyric: '...', hindi: '' },
  { swara: 'M', beats: 1.5, lyric: '...', hindi: '', breath: 1.0 },

  // Bar 3 (16 -> 24, 5.11s): Din beete saara teri fikr mein
  { swara: 'S', beats: 1.0, lyric: 'Din', hindi: 'दिन' },
  { swara: 'G', beats: 0.5, lyric: 'bee-', hindi: 'बी-' },
  { swara: 'R', beats: 0.5, lyric: '-te', hindi: '-ते' },
  { swara: 'G', beats: 0.5, lyric: 'saa-', hindi: 'सा-' },
  { swara: 'R', beats: 0.5, lyric: '-ra', hindi: '-रा' },
  { swara: 'S', beats: 0.5, lyric: 'te-', hindi: 'ते-' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '-ri', hindi: '-री' },

  { swara: 'P', beats: 0.5, lyric: 'fi-', hindi: 'फ़ि-' },
  { swara: 'P', beats: 0.5, lyric: '-kr', hindi: '-क्र' },
  { swara: 'P', beats: 0.5, lyric: 'mein', hindi: 'में' },
  { swara: 'D', beats: 0.5, lyric: '...', hindi: '', ornament: { type: 'kan', graceSwara: 'P', graceOctave: 'madhya', label: 'Kan' } },
  { swara: 'P', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'M', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '', breath: 0.5 },

  // Bar 4 (24 -> 32, 5.11s): Rain saari teri khair manaaun
  { swara: 'R', beats: 0.5, lyric: 'Rain', hindi: 'रैन' },
  { swara: 'R', beats: 0.5, lyric: 'saa-', hindi: 'सा-' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '-ri', hindi: '-री' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: 'te-', hindi: 'ते-' },
  { swara: 'R', beats: 0.5, lyric: '-ri', hindi: '-री' },
  { swara: 'R', beats: 0.5, lyric: 'khair', hindi: 'ख़ैर' },
  { swara: 'R', beats: 0.5, lyric: 'ma-', hindi: 'म-' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: '-naa-', hindi: '-ना-' },
  { swara: 'R', beats: 0.75, lyric: '-un', hindi: '-ऊँ' },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'M', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'S', beats: 0.75, lyric: '...', hindi: '', ornament: { type: 'gamak', label: 'Gamak' }, breath: 0.5 },
]);

/* ==========================================================================
   9. AGAR TUM SAATH HO (2015 — Modern Bollywood · E Bass · 62 BPM · Slow 4/4)
      Verified A.R. Rahman melody: G R G R G M | G G R S ,N S + Gar tum saath ho
   ========================================================================== */
const agarTumSaathSeq = buildNotes('agar-tum-saath-ho', [
  // Bar 1 (0 -> 8, 7.74s): Pal bhar thahar jaao, dil ye sambhal jaaye
  { swara: 'G', beats: 0.5, lyric: 'Pal', hindi: 'पल' },
  { swara: 'R', beats: 0.5, lyric: 'bhar', hindi: 'भर' },
  { swara: 'G', beats: 0.5, lyric: 'tha-', hindi: 'ठ-' },
  { swara: 'R', beats: 0.5, lyric: '-har', hindi: '-हर' },
  { swara: 'G', beats: 0.5, lyric: 'jaa-', hindi: 'जा-' },
  { swara: 'M', beats: 1.0, lyric: '-o', hindi: '-ओ', ornament: { type: 'meend', graceSwara: 'G', graceOctave: 'madhya', label: 'Meend' }, breath: 0.5 },

  { swara: 'G', beats: 0.5, lyric: 'dil', hindi: 'दिल' },
  { swara: 'G', beats: 0.5, lyric: 'ye', hindi: 'ये' },
  { swara: 'R', beats: 0.5, lyric: 'sam-', hindi: 'सं-' },
  { swara: 'S', beats: 0.5, lyric: '-bhal', hindi: '-भल' },
  { swara: 'N', octave: 'mandra', beats: 0.5, lyric: 'jaa-', hindi: 'जा-' },
  { swara: 'S', beats: 1.0, lyric: '-ye', hindi: '-ए', breath: 0.5 },

  // Bar 2 (8 -> 16, 7.74s): Kaise tumhe roka karun
  { swara: 'G', beats: 0.5, lyric: 'Kai-', hindi: 'कै-' },
  { swara: 'R', beats: 0.5, lyric: '-se', hindi: '-से' },
  { swara: 'R', beats: 0.5, lyric: 'tum-', hindi: 'तुम-' },
  { swara: 'P', beats: 0.75, lyric: '-he', hindi: '-हें', ornament: { type: 'meend', graceSwara: 'R', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'P', beats: 0.5, lyric: 'ro-', hindi: 'रो-' },
  { swara: 'P', beats: 0.5, lyric: '-ka', hindi: '-का' },
  { swara: 'P', beats: 0.5, lyric: 'ka-', hindi: 'क-' },
  { swara: 'D', beats: 0.5, lyric: '-run', hindi: '-रूँ', ornament: { type: 'kan', graceSwara: 'P', graceOctave: 'madhya', label: 'Kan' } },
  { swara: 'P', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'M', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'P', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'M', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.5, lyric: '...', hindi: '', breath: 0.25 },

  // Bar 3 (16 -> 24, 7.74s): Gar tum saath ho... agar tum saath ho
  { swara: 'S', beats: 0.5, lyric: 'Gar', hindi: 'गर' },
  { swara: 'R', beats: 0.5, lyric: 'tum', hindi: 'तुम' },
  { swara: 'R', beats: 0.5, lyric: 'saath', hindi: 'साथ' },
  { swara: 'M', beats: 0.75, lyric: 'ho', hindi: 'हो', ornament: { type: 'meend', graceSwara: 'R', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'M', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.75, lyric: '...', hindi: '', breath: 0.5 },

  { swara: 'S', beats: 0.25, lyric: 'a-', hindi: 'अ-' },
  { swara: 'S', beats: 0.25, lyric: '-gar', hindi: '-गर' },
  { swara: 'R', beats: 0.5, lyric: 'tum', hindi: 'तुम' },
  { swara: 'P', beats: 0.75, lyric: 'saath', hindi: 'साथ', ornament: { type: 'meend', graceSwara: 'R', graceOctave: 'madhya', label: 'Meend' } },
  { swara: 'M', beats: 0.5, lyric: 'ho', hindi: 'हो' },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '' },
  { swara: 'R', beats: 0.25, lyric: '...', hindi: '' },
  { swara: 'G', beats: 0.5, lyric: '...', hindi: '', ornament: { type: 'gamak', label: 'Gamak' }, breath: 0.5 },
]);

export const SONGS: Song[] = [
  {
    id: 'tujhe-dekha-to',
    title: 'Tujhe Dekha To',
    movie: 'Dilwale Dulhania Le Jayenge',
    year: 1995,
    composer: 'Jatin–Lalit',
    singers: 'Kumar Sanu & Lata Mangeshkar',
    era: '90s Golden Era',
    difficulty: 'Intermediate',
    scale: BANSURI_SCALES.E_BASS,
    raga: 'Asavari Thaat (E Minor)',
    tala: 'keherwa',
    talaLabel: 'Keherwa (8 beats)',
    beatsPerBar: 8,
    bpm: 97,
    featured: true,
    sourceUrl: 'https://notesandsargam.com/tujhe-dekha-to-ye-jana-sanam/',
    youtubeId: 'd0tLdHD692g',
    youtubeTitle: 'Tujhe Dekha To Ye Jana Sanam — Bansuri Flute Lesson & Rendition',
    description:
      'Authentic 97 BPM DDLJ melody in E Minor / Asavari (Komal Ga, Dha, Ni) with signature Sa-to-Pa Meend leaps.',
    sections: [
      { id: 'mukhda', name: 'Mukhda (Chorus)', startBeat: 0, endBeat: 16 },
      { id: 'bridge', name: 'Refrain (Ab Yahaan)', startBeat: 16, endBeat: 32 },
    ],
    notes: tujheDekhaSeq.notes,
    totalBeats: tujheDekhaSeq.totalBeats,
  },
  {
    id: 'lag-ja-gale',
    title: 'Lag Ja Gale',
    movie: 'Woh Kaun Thi?',
    year: 1964,
    composer: 'Madan Mohan',
    singers: 'Lata Mangeshkar',
    era: 'Retro Classics',
    difficulty: 'Intermediate',
    scale: BANSURI_SCALES.E_BASS,
    raga: 'Pahadi',
    tala: 'dadra',
    talaLabel: 'Dadra Waltz (6 beats)',
    beatsPerBar: 6,
    bpm: 98,
    featured: true,
    sourceUrl: 'https://notesandsargam.com/lag-ja-gale/',
    youtubeId: 'wriuhEC9B5A',
    youtubeTitle: 'Lag Ja Gale — Flute Cover by Rajesh Cherthala (Tribute to Lata Mangeshkar)',
    description:
      'Timeless Raag Pahadi waltz ear-synced directly to Lata Mangeshkar’s 1964 recording & Rajesh Cherthala’s classic rendition.',
    sections: [
      { id: 'mukhda', name: 'Mukhda (Lag Ja Gale)', startBeat: 0, endBeat: 24 },
      { id: 'shayad', name: 'Shayad Phir', startBeat: 24, endBeat: 36 },
      { id: 'antara', name: 'Antara (Hum Ko Mili)', startBeat: 36, endBeat: 54 },
    ],
    notes: lagJaGaleSeq.notes,
    totalBeats: lagJaGaleSeq.totalBeats,
  },
  {
    id: 'roop-tera-mastana',
    title: 'Roop Tera Mastana',
    movie: 'Aradhana',
    year: 1969,
    composer: 'S. D. Burman',
    singers: 'Kishore Kumar',
    era: 'Retro Classics',
    difficulty: 'Beginner',
    scale: BANSURI_SCALES.A_MEDIUM,
    raga: 'Khamaj / Bhupali',
    tala: 'keherwa',
    talaLabel: 'Keherwa (8 beats)',
    beatsPerBar: 8,
    bpm: 83,
    featured: true,
    sourceUrl: 'https://notesandsargam.com/roop-tera-mastana/',
    youtubeId: 'rCQ9fYk7UE0',
    youtubeTitle: 'Roop Tera Mastana — Bansuri Cover (Flute Madley)',
    description:
      'OEM 83 BPM Aradhana (1969) groove with Kishore Kumar’s authentic syncopated phrasing and Re-Sa-Dha Meend glides.',
    sections: [
      { id: 'mukhda', name: 'Mukhda (Roop Tera)', startBeat: 0, endBeat: 16 },
      { id: 'antara', name: 'Antara (Raat Nasheeli)', startBeat: 16, endBeat: 32 },
    ],
    notes: roopTeraSeq.notes,
    totalBeats: roopTeraSeq.totalBeats,
  },
  {
    id: 'pal-pal-dil-ke-paas',
    title: 'Pal Pal Dil Ke Paas',
    movie: 'Blackmail',
    year: 1973,
    composer: 'Kalyanji–Anandji',
    singers: 'Kishore Kumar',
    era: 'Retro Classics',
    difficulty: 'Beginner',
    scale: BANSURI_SCALES.G_BASS,
    raga: 'Bilawal Thaat',
    tala: 'keherwa',
    talaLabel: 'Keherwa (8 beats)',
    beatsPerBar: 8,
    bpm: 121,
    featured: true,
    sourceUrl: 'https://notesandsargam.com/pal-pal-dil-ke-paas/',
    youtubeId: '2IwYry73vQE',
    youtubeTitle: 'Pal Pal Dil Ke Paas — Flute Rendition (Anurag Rastogi)',
    description:
      'Evergreen 121 BPM Kishore Kumar classic synced to authentic vocal holds and the rising G–M–P–D–P "Jeevan meethi pyaas" answer.',
    sections: [
      { id: 'mukhda', name: 'Mukhda (Pal Pal)', startBeat: 0, endBeat: 16 },
      { id: 'jeevan', name: 'Answer (Jeevan Meethi)', startBeat: 16, endBeat: 32 },
    ],
    notes: palPalSeq.notes,
    totalBeats: palPalSeq.totalBeats,
  },
  {
    id: 'pehla-nasha',
    title: 'Pehla Nasha',
    movie: 'Jo Jeeta Wohi Sikandar',
    year: 1992,
    composer: 'Jatin–Lalit',
    singers: 'Udit Narayan & Sadhana Sargam',
    era: '90s Golden Era',
    difficulty: 'Intermediate',
    scale: BANSURI_SCALES.G_SHARP_MEDIUM,
    raga: 'Khamaj / Bilawal',
    tala: 'keherwa',
    talaLabel: 'Slow Keherwa (8 beats)',
    beatsPerBar: 8,
    bpm: 76,
    featured: true,
    sourceUrl: 'https://notesandsargam.com/pehla-nasha-pehla-khumar/',
    youtubeId: 'hVaHSgoCbPU',
    youtubeTitle: 'Pehla Nasha — Flute Cover (S. D. Aloka)',
    description:
      'Dreamy 76 BPM ballad on G# scale synced to Udit Narayan’s held Ga-Ga-Pa glides and Komal Ni turns.',
    sections: [
      { id: 'mukhda', name: 'Mukhda (Pehla Nasha)', startBeat: 0, endBeat: 16 },
      { id: 'antara', name: 'Antara (Kar Loon Main)', startBeat: 16, endBeat: 32 },
    ],
    notes: pehlaNashaSeq.notes,
    totalBeats: pehlaNashaSeq.totalBeats,
  },
  {
    id: 'chura-ke-dil-mera',
    title: 'Chura Ke Dil Mera',
    movie: 'Main Khiladi Tu Anari',
    year: 1994,
    composer: 'Anu Malik',
    singers: 'Kumar Sanu & Alka Yagnik',
    era: '90s Golden Era',
    difficulty: 'Beginner',
    scale: BANSURI_SCALES.C_MEDIUM,
    raga: 'Bilawal Thaat',
    tala: 'keherwa',
    talaLabel: 'Keherwa (8 beats)',
    beatsPerBar: 8,
    bpm: 122,
    featured: true,
    youtubeId: '2OytdBhe1x4',
    youtubeTitle: 'Chura Ke Dil Mera — Flute Instrumental Cover',
    description:
      'OEM 122 BPM Main Khiladi Tu Anari (1994) hook (S’–D–G–G–R–G–P–G–R–S | S–R–G–S–R) synced to the original groove.',
    sections: [
      { id: 'mukhda', name: 'Mukhda (Chura Ke Dil)', startBeat: 0, endBeat: 16 },
      { id: 'antara', name: 'Bridge (Paagal Hua)', startBeat: 16, endBeat: 32 },
    ],
    notes: churaKeDilSeq.notes,
    totalBeats: churaKeDilSeq.totalBeats,
  },
  {
    id: 'tum-hi-ho',
    title: 'Tum Hi Ho',
    movie: 'Aashiqui 2',
    year: 2013,
    composer: 'Mithoon',
    singers: 'Arijit Singh',
    era: 'Modern Bollywood',
    difficulty: 'Beginner',
    scale: BANSURI_SCALES.A_MEDIUM,
    raga: 'Asavari / Relative Bilawal',
    tala: 'keherwa',
    talaLabel: 'Keherwa (8 beats)',
    beatsPerBar: 8,
    bpm: 94,
    featured: true,
    sourceUrl: 'https://notesandsargam.com/kyuki-tum-hi-ho/',
    youtubeId: 'e4X-3dkLb9M',
    youtubeTitle: 'Tum Hi Ho — Flute Cover (Siddhi Prasanna)',
    description:
      'Soulful 94 BPM modern anthem synced to Arijit Singh’s syncopated "Kyunki tum hi ho" chorus in relative Dha tonic.',
    sections: [
      { id: 'verse', name: 'Verse (Hum Tere Bin)', startBeat: 0, endBeat: 16 },
      { id: 'chorus', name: 'Chorus (Tum Hi Ho)', startBeat: 16, endBeat: 40 },
    ],
    notes: tumHiHoSeq.notes,
    totalBeats: tumHiHoSeq.totalBeats,
  },
  {
    id: 'kesariya',
    title: 'Kesariya',
    movie: 'Brahmāstra',
    year: 2022,
    composer: 'Pritam',
    singers: 'Arijit Singh',
    era: 'Modern Bollywood',
    difficulty: 'Beginner',
    scale: BANSURI_SCALES.C_MEDIUM,
    raga: 'Bilawal Thaat',
    tala: 'keherwa',
    talaLabel: 'Keherwa (8 beats)',
    beatsPerBar: 8,
    bpm: 94,
    featured: true,
    youtubeId: 'boPEg7QGOqA',
    youtubeTitle: 'Kesariya (Brahmāstra) — Bansuri Flute Cover',
    description:
      'Authentic 94 BPM Pritam/Arijit chorus hook (S–G–R–G–R–S–,N | P–P–P–D–P–M–G–R) on C Natural Medium.',
    sections: [
      { id: 'mukhda', name: 'Hook (Kesariya Tera)', startBeat: 0, endBeat: 16 },
      { id: 'antara', name: 'Verse (Din Beete)', startBeat: 16, endBeat: 32 },
    ],
    notes: kesariyaSeq.notes,
    totalBeats: kesariyaSeq.totalBeats,
  },
  {
    id: 'agar-tum-saath-ho',
    title: 'Agar Tum Saath Ho',
    movie: 'Tamasha',
    year: 2015,
    composer: 'A. R. Rahman',
    singers: 'Alka Yagnik & Arijit Singh',
    era: 'Modern Bollywood',
    difficulty: 'Intermediate',
    scale: BANSURI_SCALES.E_BASS,
    raga: 'Bilawal / Khamaj',
    tala: 'keherwa',
    talaLabel: 'Slow Ballad (8 beats)',
    beatsPerBar: 8,
    bpm: 62,
    featured: true,
    youtubeId: 'HuvsCviovI0',
    youtubeTitle: 'Agar Tum Saath Ho — Flute Instrumental (Flute Siva)',
    description:
      'Authentic 62 BPM A. R. Rahman ballad synced to Alka Yagnik’s "Pal bhar thahar jaao" and "Gar tum saath ho" melody.',
    sections: [
      { id: 'mukhda', name: 'Mukhda (Pal Bhar)', startBeat: 0, endBeat: 8 },
      { id: 'antara', name: 'Line 2 (Kaise Tumhe)', startBeat: 8, endBeat: 16 },
      { id: 'climax', name: 'Chorus (Tum Saath Ho)', startBeat: 16, endBeat: 24 },
    ],
    notes: agarTumSaathSeq.notes,
    totalBeats: agarTumSaathSeq.totalBeats,
  },
];
