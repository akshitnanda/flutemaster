import fs from 'node:fs';
import path from 'node:path';

const DUMP_PATH = path.resolve('data/notesandsargam-dump.json');
const MIR_CACHE_PATH = path.resolve('data/mir-bpm-cache.json');
const OVERRIDES_PATH = path.resolve('data/song-overrides.json');
const OUT_DIR = path.resolve('public/data');
const OUT_PATH = path.join(OUT_DIR, 'library.json');

const dump = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8'));
const mirCache = fs.existsSync(MIR_CACHE_PATH)
  ? JSON.parse(fs.readFileSync(MIR_CACHE_PATH, 'utf8'))
  : {};
const songOverrides = fs.existsSync(OVERRIDES_PATH)
  ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'))
  : { postOverrides: {}, additionalSongs: [] };

const PITCH_TO_SCALE_ID = {
  D: 'D_BASS',
  'D#': 'D_SHARP_BASS',
  EB: 'D_SHARP_BASS',
  E: 'E_BASS',
  F: 'F_BASS',
  'F#': 'F_SHARP_MEDIUM',
  GB: 'F_SHARP_MEDIUM',
  G: 'G_BASS',
  'G#': 'G_SHARP_MEDIUM',
  AB: 'G_SHARP_MEDIUM',
  A: 'A_MEDIUM',
  'A#': 'A_SHARP_MEDIUM',
  BB: 'A_SHARP_MEDIUM',
  B: 'B_MEDIUM',
  C: 'C_MEDIUM',
  'C#': 'C_SHARP_MEDIUM',
  DB: 'C_SHARP_MEDIUM',
};

const SWARA_SEMI = {
  S: 0, Rk: 1, R: 2, Gk: 3, G: 4, M: 5, Mt: 6, P: 7, Dk: 8, D: 9, Nk: 10, N: 11,
};
const MANDRA_OK = new Set(['P', 'Dk', 'D', 'Nk', 'N']);
const TAAR_OK = new Set(['S', 'Rk', 'R', 'Gk', 'G', 'M', 'Mt', 'P']);

const CARNATIC_MAP = {
  R1: 'Rk', R2: 'R',
  G2: 'Gk', G3: 'G',
  M1: 'M', M2: 'Mt',
  D1: 'Dk', D2: 'D',
  N2: 'Nk', N3: 'N',
};

function toSemi(swara, octave) {
  return (SWARA_SEMI[swara] ?? 0) + (octave === 'mandra' ? -12 : octave === 'taar' ? 12 : 0);
}

/**
 * Normalizes notes outside the 6-hole Bansuri playable range [-5..19] (Mandra P .. Taar P)
 * BEFORE resolveOctaveContinuity runs so out-of-range markers never poison continuity:
 * - Any Taar D/Dk/N/Nk (>19) folds down to Madhya (+8..+11, sitting cleanly below Taar S').
 * - Any Taar P immediately adjacent to a folded Taar D/N on the same line also folds to Madhya P
 *   so ascending/descending P-D-N-S' runs stay stepwise with zero -10 cliffs.
 * - Any Mandra S..Mt (< -5) folds to Madhya (counted as clamped).
 */
function normalizeOutOfRangeBeforeContinuity(notes) {
  let clampedCount = 0;
  const normalizedHighIndices = new Set();
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.octave === 'taar' && SWARA_SEMI[n.swara] > 7) {
      n.octave = 'madhya';
      normalizedHighIndices.add(i);
    } else if (n.octave === 'mandra' && SWARA_SEMI[n.swara] < 7) {
      n.octave = 'madhya';
      clampedCount++;
    }
  }
  // Propagate Madhya fold to adjacent Taar P on the same line (e.g. P' D' N' S' -> P D N S')
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].octave === 'taar' && notes[i].swara === 'P') {
        const adjPrev =
          i > 0 &&
          notes[i - 1].lineIdx === notes[i].lineIdx &&
          normalizedHighIndices.has(i - 1);
        const adjNext =
          i + 1 < notes.length &&
          notes[i + 1].lineIdx === notes[i].lineIdx &&
          normalizedHighIndices.has(i + 1);
        if (adjPrev || adjNext) {
          notes[i].octave = 'madhya';
          normalizedHighIndices.add(i);
          changed = true;
        }
      }
    }
  }
  return clampedCount;
}

/**
 * Fixes missing octave markers within each vocal line:
 * 1) Prefix Mandra lookahead (up to 3 notes): if an unmarked line opens on D/Dk/N/Nk leading into S..R
 *    with >=7 semitone drop, anchor opening notes in Mandra (excluding P-D -> S ascents).
 * 2) Contextual 7-semitone P -> S' jump when followed on the same line by upper notes (>=7: P/D/N).
 * 3) Forward continuity: snaps unmarked notes away from >=8-semitone jumps to an adjacent octave within <=5 semitones.
 */
function resolveOctaveContinuity(notes) {
  let start = 0;
  while (start < notes.length) {
    const lineIdx = notes[start].lineIdx;
    let end = start;
    while (end < notes.length && notes[end].lineIdx === lineIdx) end++;

    // Up to 3-note prefix Mandra lookahead on unmarked D/Dk/N/Nk leading into Madhya S..R
    let k = start;
    while (
      k < end &&
      k - start < 3 &&
      !notes[k].explicitOctave &&
      notes[k].octave === 'madhya' &&
      (notes[k].swara === 'N' || notes[k].swara === 'Nk' || notes[k].swara === 'D' || notes[k].swara === 'Dk')
    ) {
      k++;
    }
    if (
      k > start &&
      k < end &&
      !notes[k].explicitOctave &&
      notes[k].octave === 'madhya' &&
      toSemi(notes[k].swara, 'madhya') <= 2 &&
      toSemi(notes[k - 1].swara, 'madhya') - toSemi(notes[k].swara, 'madhya') >= 7
    ) {
      for (let p = start; p < k; p++) {
        notes[p].octave = 'mandra';
      }
    }

    // Forward continuity within the current line only
    for (let i = start + 1; i < end; i++) {
      const cur = notes[i];
      const prev = notes[i - 1];
      if (cur.explicitOctave) continue;

      // Contextual 7-semitone P -> S' leap (e.g. "jiya dhadak": P P S' D D S' D D)
      if (
        prev.octave === 'madhya' &&
        prev.swara === 'P' &&
        cur.swara === 'S' &&
        cur.octave === 'madhya' &&
        i + 1 < end &&
        SWARA_SEMI[notes[i + 1].swara] >= 7 &&
        notes[i + 1].octave !== 'mandra'
      ) {
        cur.octave = 'taar';
        continue;
      }

      const prevSemi = toSemi(prev.swara, prev.octave);
      const curSemi = toSemi(cur.swara, cur.octave);
      const curDist = Math.abs(curSemi - prevSemi);
      if (curDist < 8) continue;

      let bestOct = cur.octave;
      let bestDist = curDist;
      const candidates = ['madhya'];
      if (MANDRA_OK.has(cur.swara)) candidates.push('mandra');
      if (TAAR_OK.has(cur.swara)) candidates.push('taar');

      for (const oct of candidates) {
        const d = Math.abs(toSemi(cur.swara, oct) - prevSemi);
        if (d < bestDist && d <= 5) {
          bestDist = d;
          bestOct = oct;
        }
      }
      cur.octave = bestOct;
    }

    start = end;
  }
}

/**
 * Final playable-range safety assertion after continuity (never shifts lines down by -12).
 */
function enforcePlayableRange(notes) {
  let clampedCount = 0;
  for (const n of notes) {
    const s = toSemi(n.swara, n.octave);
    if (s < -5 || s > 19) {
      n.octave = 'madhya';
      clampedCount++;
    }
  }
  return clampedCount;
}

/**
 * Recomputes ornament grace octaves AFTER resolveOctaveContinuity() & enforcePlayableRange()
 * so Meend glides match the settled previous note and redundant self-kans are stripped.
 */
function recomputeOrnaments(notes) {
  for (let i = 0; i < notes.length; i++) {
    const cur = notes[i];
    if (!cur.ornament) continue;
    const type = cur.ornament[0];
    if (type === 'meend' && i > 0) {
      const prev = notes[i - 1];
      cur.ornament = ['meend', prev.swara, prev.octave];
    } else if (type === 'kan') {
      const graceSwara = cur.ornament[1];
      if (!graceSwara) {
        cur.ornament = undefined;
        continue;
      }
      const mainSemi = toSemi(cur.swara, cur.octave);
      const candidates = ['madhya'];
      if (MANDRA_OK.has(graceSwara)) candidates.push('mandra');
      if (TAAR_OK.has(graceSwara)) candidates.push('taar');
      let bestOct = cur.ornament[2] || 'madhya';
      let bestDist = Infinity;
      for (const oct of candidates) {
        const d = Math.abs(toSemi(graceSwara, oct) - mainSemi);
        if (d < bestDist) {
          bestDist = d;
          bestOct = oct;
        }
      }
      if (graceSwara === cur.swara && bestOct === cur.octave) {
        cur.ornament = undefined;
      } else {
        cur.ornament = ['kan', graceSwara, bestOct];
      }
    }
  }
}

/**
 * Infers Hindustani Thaat from compiled pitch-class usage when a post lacks an explicit Raag header.
 */
function inferThaatFromNotes(rawNotes) {
  const total = Math.max(1, rawNotes.length);
  const counts = {};
  for (const n of rawNotes) {
    counts[n.swara] = (counts[n.swara] || 0) + 1;
  }
  const has = (sw) => (counts[sw] || 0) >= 3 || (counts[sw] || 0) / total >= 0.035;
  const freq = (sw) => (counts[sw] || 0) / total;

  const mixedPairs = [
    ['Rk', 'R'],
    ['Gk', 'G'],
    ['M', 'Mt'],
    ['Dk', 'D'],
    ['Nk', 'N'],
  ].filter(([a, b]) => freq(a) >= 0.05 && freq(b) >= 0.05);
  if (mixedPairs.length >= 2) return 'Mishra Thaat';

  const pick = (a, b) => (has(a) && (counts[a] || 0) >= (counts[b] || 0) * 0.55);
  const isRk = pick('Rk', 'R');
  const isGk = pick('Gk', 'G');
  const isMt = pick('Mt', 'M');
  const isDk = pick('Dk', 'D');
  const isNk = pick('Nk', 'N');

  if (isRk && isGk && !isMt && isDk && isNk) return 'Bhairavi Thaat';
  if (isRk && isGk && isMt && isDk && !isNk) return 'Todi Thaat';
  if (isRk && !isGk && !isMt && isDk && !isNk) return 'Bhairav Thaat';
  if (isRk && !isGk && isMt && isDk && !isNk) return 'Poorvi Thaat';
  if (isRk && !isGk && isMt && !isDk && !isNk) return 'Marwa Thaat';
  if (!isRk && isGk && !isMt && isDk && isNk) return 'Asavari Thaat';
  if (!isRk && isGk && !isMt && !isDk && isNk) return 'Kafi Thaat';
  if (!isRk && !isGk && (!isMt || freq('Mt') < 0.05) && isDk && isNk) return 'Charukesi';
  if (!isRk && !isGk && isMt && freq('Mt') >= 0.05 && !isDk && !isNk) return 'Kalyan Thaat';
  if (!isRk && !isGk && !isMt && !isDk && isNk) return 'Khamaj Thaat';
  if (!isRk && !isGk && !isMt && !isDk && !isNk) return 'Bilawal Thaat';
  if (isRk && !isGk && !isMt && !isDk && isNk) return 'Ahir Bhairav';
  if (isMt && freq('Mt') >= 0.05 && isNk && !isRk && !isGk) return 'Yaman / Khamaj';
  if (isGk && isDk && !isNk) return 'Keeravani';
  if (isGk && isMt && freq('Mt') >= 0.05) return 'Madhuvanti / Todi';
  if (isDk && isNk && !isGk && !isRk && !isMt) return 'Charukesi';
  return 'Mishra Thaat';
}

// Slugs already covered by our hand-crafted Studio Featured songs
const FEATURED_SLUGS = new Set([
  'tujhe-dekha-to-ye-jana-sanam',
  'lag-ja-gale',
  'roop-tera-mastana',
  'pal-pal-dil-ke-paas',
  'pehla-nasha-pehla-khumar',
  'kyuki-tum-hi-ho',
]);

// Known corrupted clone or broken source posts in the WP dump
const BROKEN_SOURCE_SLUGS = new Set([
  'aye-dil-mujhe-aisi-jagah-le-chal',
]);

// Confirmed false-positive OEM MIR matches (wrong song / non-OEM cover / sped-up)
const MIR_BLOCKLIST = new Set([
  'teri-galiyan',
  'he-gombhir-neel-anjano-ghono',
  'aa-jaane-ja',
  'o-ri-chiraiya',
  'roadies-theme',
  'titan-ad-theme-mozarts-symphony',
  'sanam-re-sanam-re',
  'kahe-chhed-chhed-mohe',
  'hum-aapke-hain-kaun',
  'gulabi-ankhen-jo-teri-dekhi',
  'neele-neele-ambar-par',
]);

const SLUG_OVERRIDES = {
  'flute-theme-of-movie-hero': { mPrimeIsTivra: true },
  'ye-moh-moh-ke-dhaage': { mPrimeIsTivra: true },
};

const catById = new Map();
for (const c of dump.categories) {
  catById.set(c.id, c);
}

const KNOWN_BPMS = {
  'kal-ho-na-ho-har-ghadi-badal-rahi-hai': { bpm: 82, tala: 'keherwa' },
  'chura-liya-hai-tumne-jo': { bpm: 80, tala: 'keherwa' },
  'mere-mehboob-qayamat-hogi': { bpm: 94, tala: 'keherwa' },
  'hothon-se-chhoo-lo-tum': { bpm: 99, tala: 'dadra' },
  'neele-neele-ambar-par': { bpm: 89, tala: 'keherwa' },
  'tu-mile-dil-khile': { bpm: 88, tala: 'keherwa' },
  'gulabi-ankhen-jo-teri-dekhi': { bpm: 105, tala: 'keherwa' },
  'ye-sham-mastani': { bpm: 102, tala: 'keherwa' },
  'kabhi-kabhi-mere-dil-me': { bpm: 78, tala: 'keherwa' },
  'chhoo-kar-mere-man-ko': { bpm: 96, tala: 'keherwa' },
  'tere-bina-zindagi-se': { bpm: 95, tala: 'keherwa' },
  'tere-bina-jiya-jaye-na': { bpm: 96, tala: 'dadra' },
  'pyar-diwana-hota-hai': { bpm: 102, tala: 'keherwa' },
  'o-mere-dil-ke-chain': { bpm: 98, tala: 'keherwa' },
  'ek-ladki-ko-dekha-to': { bpm: 92, tala: 'keherwa' },
  'bahut-pyar-karte-hai': { bpm: 96, tala: 'dadra' },
  'jeena-yahan-merna-yahan': { bpm: 100, tala: 'keherwa' },
  'kora-kagaz-tha-yeh-mann-mera': { bpm: 96, tala: 'keherwa' },
  'abhi-naa-jao-chhod-kar': { bpm: 96, tala: 'dadra' },
  'tum-itna-jo-muskura-rahe-ho': { bpm: 80, tala: 'keherwa' },
  'jana-gana-mana-indias-national-anthem': { bpm: 96, tala: 'keherwa' },
  'vande-mataram-anand-math': { bpm: 88, tala: 'keherwa' },
  'achyutam-keshavam': { bpm: 92, tala: 'keherwa' },
  'om-jai-jagdeesh-hare': { bpm: 96, tala: 'keherwa' },
  'ajeeb-dastaan-hai-ye': { bpm: 104, tala: 'dadra' },
  'aane-wala-pal-jane-wala-hai': { bpm: 107, tala: 'keherwa' },
  'kahin-door-jab-din-dhal-jaye': { bpm: 91, tala: 'dadra' },
  'tujhse-naraz-nahi-zindagi': { bpm: 97, tala: 'dadra' },
  'zindagi-kaisi-hai-paheli-haye': { bpm: 97, tala: 'keherwa' },
  'musafir-hu-yaro': { bpm: 104, tala: 'keherwa' },
  'rimjhim-gire-sawan': { bpm: 92, tala: 'keherwa' },
  'rimjhim-ke-geet-sawan-gaye': { bpm: 98, tala: 'dadra' },
  'neele-gagan-ke-tale': { bpm: 104, tala: 'dadra' },
  'oh-re-taal-mile': { bpm: 96, tala: 'keherwa' },
  'mere-rang-mein-rangne-wali': { bpm: 98, tala: 'keherwa' },
  'tumhen-apna-banane-ki-kasam': { bpm: 98, tala: 'keherwa' },
  'tu-hi-re': { bpm: 100, tala: 'keherwa' },
  'lukka-chuppi': { bpm: 104, tala: 'keherwa' },
  'mitwa-mere-man-ye-bata-de-tu': { bpm: 92, tala: 'keherwa' },
  'tum-se-hi-na-hai-ye-paana': { bpm: 65, tala: 'keherwa' },
  'saiyyan-heere-moti-main-na-chahu': { bpm: 86, tala: 'keherwa' },
  'pani-da-rang-wekh-ke': { bpm: 98, tala: 'keherwa' },
  'jeene-laga-hoon': { bpm: 90, tala: 'keherwa' },
  'sanam-re-sanam-re': { bpm: 74, tala: 'keherwa' },
  'janam-janam-janam': { bpm: 96, tala: 'keherwa' },
  'gerua-dhoop-se-nikal-ke': { bpm: 88, tala: 'keherwa' },
  'hawayein-le-jaye-jane-kaha': { bpm: 94, tala: 'keherwa' },
  'dil-diyan-gallan': { bpm: 84, tala: 'keherwa' },
  'banarasiya-rang-me-bhang-ya': { bpm: 91, tala: 'keherwa' },
  'kya-mausam-hai-chal-kahin-door-nikal-jaye': { bpm: 98, tala: 'keherwa' },
  'ranjish-hi-sahi': { bpm: 66, tala: 'dadra' },
  'sham-se-ankh-me-nami-si-hai': { bpm: 64, tala: 'dadra' },
  'koi-ye-kaise-bataaye': { bpm: 64, tala: 'keherwa' },
  'o-re-majhi-mere-sajan-hai-us-par': { bpm: 66, tala: 'keherwa' },
  'man-re-tu-kahe-na-dhir-dhare': { bpm: 68, tala: 'keherwa' },
  'suno-na-sange-marmar-ki': { bpm: 72, tala: 'keherwa' },
  'tujhe-dekh-dekh-sona': { bpm: 86, tala: 'keherwa' },
  'bheege-hont-tere': { bpm: 92, tala: 'keherwa' },
  'kisi-patthar-ki-murat-se': { bpm: 78, tala: 'keherwa' },
  'maine-tere-liye-hi-saat-rang-ke': { bpm: 84, tala: 'keherwa' },
  'hum-bewafa-hargeez-na-the': { bpm: 96, tala: 'keherwa' },
  'dil-ko-dekho-chehra-na-dekho': { bpm: 96, tala: 'keherwa' },
  'kahin-karti-hogi': { bpm: 76, tala: 'keherwa' },
  'woh-beete-din-yaad-hai': { bpm: 74, tala: 'keherwa' },
  'banjara-jaise-banjare-ko-ghar': { bpm: 82, tala: 'keherwa' },
  'koi-jab-tumhara-hriday-tod-de': { bpm: 76, tala: 'keherwa' },
  'na-tum-hame-jano': { bpm: 78, tala: 'keherwa' },
  'tum-mujhe-bhool-bhi-jao': { bpm: 76, tala: 'keherwa' },
  'kaash-aisa-koi-manzar-hota': { bpm: 72, tala: 'dadra' },
  'jhoomati-chali-hawa': { bpm: 78, tala: 'dadra' },
  'hame-tumse-pyaar-kitna': { bpm: 78, tala: 'keherwa' },
  'o-saiyyan-meri-adhuri-kahani': { bpm: 76, tala: 'keherwa' },
  'tujhe-suraj-kahu-ya-chanda': { bpm: 78, tala: 'keherwa' },
  'boro-asha-kore-esechhi': { bpm: 70, tala: 'keherwa' },
  'bajlo-tomar-alor-benu-mahalaya': { bpm: 76, tala: 'dadra' },
  'ye-raate-ye-mausam-ye-nadi-ka-kinara': { bpm: 88, tala: 'keherwa' },
  'jab-koi-baat-bigad-jaaye': { bpm: 92, tala: 'keherwa' },
  'tum-bin-jaun-kahan': { bpm: 88, tala: 'keherwa' },
  'mera-dil-ye-pukare-aja': { bpm: 84, tala: 'keherwa' },
  'santo-karam-ki-gati-nyari': { bpm: 78, tala: 'keherwa' },
  'sanwaar-loon': { bpm: 96, tala: 'keherwa' },
  'aate-jate-hanste-gaate': { bpm: 96, tala: 'keherwa' },
  'ye-jeevan-hai': { bpm: 90, tala: 'keherwa' },
  'bhigi-bhigi-rato-me': { bpm: 96, tala: 'keherwa' },
  'babuji-dheere-chalna': { bpm: 96, tala: 'keherwa' },
  'rang-barse-bhige-chunar-wali': { bpm: 98, tala: 'keherwa' },
  'pardesiya-ye-sach-hai-piya': { bpm: 104, tala: 'keherwa' },
  'kariye-na-kariye-na': { bpm: 104, tala: 'keherwa' },
  'ye-zameen-ga-rahi-hai': { bpm: 108, tala: 'keherwa' },
  'dekha-na-haay-re': { bpm: 108, tala: 'keherwa' },
  'aur-kya-aur-kya-tum-aaye-to': { bpm: 96, tala: 'keherwa' },
  'aha-rimjhim-ke-ye-pyare-pyare': { bpm: 92, tala: 'keherwa' },
  'jaane-kya-baat-hai': { bpm: 88, tala: 'keherwa' },
  'hai-duniya-usiki': { bpm: 92, tala: 'keherwa' },
  'tumane-mujhe-dekha': { bpm: 94, tala: 'keherwa' },
  'mushkil-hai-bahut-mushkil': { bpm: 78, tala: 'keherwa' },
  'zindagi-ka-safar': { bpm: 84, tala: 'keherwa' },
};

function matchPitchOnLine(line) {
  const patterns = [
    /(?:[Ff]lute|[Ss]cale|[Pp]itch|[Bb]ansuri|[Nn]otations?\s+on|FLUTE|SCALE|PITCH|BANSURI)[^:\n]{0,28}[:=\-\s]\s*(?:[Ss]cale\s+)?([A-G](?:#|b)?)(?![A-Za-z#b])/,
    /\b(?:[Uu]sed|USED|[Pp]layed\s+on)\s+([A-G](?:#|b)?)(?![A-Za-z#b])\s*(?:[Nn]atural|[Ss]harp|[Ff]lat|[Bb]ass|[Mm]edium|[Tt]une|[Ss]cale|[Ff]lute)?/,
    /\b([A-G](?:#|b)?)(?![A-Za-z#b])\s*(?:[Nn]atural|[Ss]harp|[Ff]lat|[Bb]ass|[Mm]edium|[Tt]une)?\s*(?:[Ff]lute|[Bb]ansuri|[Ss]cale|FLUTE|BANSURI|SCALE)\b/,
  ];
  for (const rx of patterns) {
    const m = line.match(rx);
    if (m && m[1]) {
      const raw = m[1].toUpperCase();
      if (PITCH_TO_SCALE_ID[raw]) return PITCH_TO_SCALE_ID[raw];
    }
  }
  return null;
}

function detectScaleId(lines, defaultScale = null) {
  const headerBlock = lines
    .slice(0, 30)
    .filter((l) => /(flute|scale|pitch|bansuri|notations?\s+on)/i.test(l));
  for (const line of headerBlock) {
    if (!/(used for notation|flute used|for sargam)/i.test(line)) continue;
    const hit = matchPitchOnLine(line);
    if (hit) return hit;
  }
  for (const line of headerBlock) {
    if (/original scale/i.test(line)) continue;
    const hit = matchPitchOnLine(line);
    if (hit) return hit;
  }
  for (const line of headerBlock) {
    const hit = matchPitchOnLine(line);
    if (hit) return hit;
  }
  return defaultScale;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8217;|&rsquo;|&#8216;|&lsquo;/gi, "'")
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/&#8230;/gi, '...')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function htmlToLines(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|pre)>/gi, '\n')
      .replace(/<\/t[dh]>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map((l) => l.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const WESTERN_SEMI = {
  C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6,
  G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11,
};
const SEMI_TO_SCALE_ID = [
  'C_MEDIUM', 'C_SHARP_MEDIUM', 'D_BASS', 'D_SHARP_BASS', 'E_BASS', 'F_BASS',
  'F_SHARP_MEDIUM', 'G_BASS', 'G_SHARP_MEDIUM', 'A_MEDIUM', 'A_SHARP_MEDIUM', 'B_MEDIUM',
];

function isWesternLine(line) {
  if (!line) return false;
  const t = line.trim();
  return /^[A-G][#b]?(?:[\s|~….,\-]+[A-G][#b]?){2,}$/.test(t);
}

/**
 * For posts that pair an uppercase Sargam line with a companion Western pitch line below it,
 * extracts the true Komal/Tivra swara mapping (e.g. D# vs Sa=C -> G maps to Gk).
 */
function detectWesternDualSwaraMap(lines) {
  const sargamVotes = { S: [], R: [], G: [], M: [], P: [], D: [], N: [] };
  const allWesternSemi = [];
  let pairCount = 0;

  for (let i = 0; i < lines.length - 1; i++) {
    if (isSargamLine(lines[i]) && isWesternLine(lines[i + 1])) {
      pairCount++;
      const sLetters = lines[i].match(/[SRGMPDN]/g) || [];
      const wTokens = lines[i + 1].match(/[A-G][#b]?/g) || [];
      for (const wt of wTokens) {
        const semi = WESTERN_SEMI[wt.toUpperCase()];
        if (semi !== undefined) allWesternSemi.push(semi);
      }
      if (sLetters.length >= 3 && sLetters.length === wTokens.length) {
        for (let k = 0; k < sLetters.length; k++) {
          const semi = WESTERN_SEMI[wTokens[k].toUpperCase()];
          if (semi !== undefined && sargamVotes[sLetters[k]]) {
            sargamVotes[sLetters[k]].push(semi);
          }
        }
      }
    }
  }
  if (pairCount < 2 || sargamVotes.S.length < 2) return null;

  const saCounts = {};
  for (const s of sargamVotes.S) saCounts[s] = (saCounts[s] || 0) + 1;
  const saPitch = Number(Object.entries(saCounts).sort((a, b) => b[1] - a[1])[0][0]);

  const intervalVotes = { R: {}, G: {}, M: {}, D: {}, N: {} };
  for (const deg of ['R', 'G', 'M', 'D', 'N']) {
    for (const p of sargamVotes[deg]) {
      const iv = (p - saPitch + 12) % 12;
      intervalVotes[deg][iv] = (intervalVotes[deg][iv] || 0) + 1;
    }
  }

  // Supplement from global pitch inventory relative to Sa when aligned counts are sparse
  const relSet = new Set(allWesternSemi.map((p) => (p - saPitch + 12) % 12));
  const map = {};
  const checkDeg = (deg, flatIv, flatSw, natIv, natSw) => {
    const fCount = intervalVotes[deg][flatIv] || 0;
    const nCount = intervalVotes[deg][natIv] || 0;
    if (fCount > nCount) map[deg] = flatSw;
    else if (nCount > fCount) map[deg] = natSw;
    else if (relSet.has(flatIv) && !relSet.has(natIv)) map[deg] = flatSw;
  };
  checkDeg('R', 1, 'Rk', 2, 'R');
  checkDeg('G', 3, 'Gk', 4, 'G');
  checkDeg('M', 6, 'Mt', 5, 'M');
  checkDeg('D', 8, 'Dk', 9, 'D');
  checkDeg('N', 10, 'Nk', 11, 'N');

  return {
    swaraMap: map,
    inferredScaleId: SEMI_TO_SCALE_ID[saPitch] || null,
  };
}

function isSargamLine(line) {
  if (!line || line.length < 3) return false;
  if (/^h+m+/i.test(line.trim()) || /hm{2,}/i.test(line)) return false;
  if (isWesternLine(line)) return false;
  if (
    /^(singer|singers|music|movie|film|lyrics|lyricist|raag|raga|scale|pitch|flute|note|notes|sthayi|mukhda|antara|charanam|pallavi|interlude|prel+ude|repeat|play|click|watch|video|http|based on|signs|symbols|this song|i used|for the|glass|piano|guitar|violin|voilin|melodica|trumpet|keyboard|saxophone|sax|sitar|santoor|harmonium|banjo|yoodling|yodelling|humming|whistle|accordion|mandolin|shehnai|aroh|avroh|thaat|pakad|vaadi|samvaadi)/i.test(
      line
    )
  ) {
    return false;
  }
  if (/\(\s*(?:aaroh|avroh|aroh)\s*\)/i.test(line)) return false;
  const cleaned = line
    .replace(/\(\s*[x×]\s*\d+\s*\)/gi, '')
    .replace(/\[\s*\d+\s*\]/g, '')
    .replace(/[\|\u0964\s,\.\'’\+\*\~\-\(\)\{\}\[\]…_#\/\^0-9:;!×]+/g, '');

  if (cleaned.length < 3) return false;
  const swaraChars = (cleaned.match(/[SRGMPDNrgmdnsp]/g) || []).length;
  if (swaraChars < 3) return false;
  const ratio = swaraChars / cleaned.length;
  if (ratio < 0.82) return false;
  if (
    /\b(man|ram|sam|dam|gam|mad|sad|dad|rag|sargam|gana|raga|raaga|sangam|pranam|param|madan|raman|naman|daman|sagar|magar|nagar|pagar|gagan|mard|dard|sard|rang|sang|mang|dang|gang|pang|nang|mand|sand|band|rand|gand|na|sa|re|ga|ma|pa|dha|ni)\b/i.test(
      line
    )
  ) {
    return false;
  }
  const distinctSwaras = new Set(cleaned.toUpperCase().match(/[SRGMPDN]/g) || []);
  if (distinctSwaras.size >= 2) return true;
  return (
    distinctSwaras.size === 1 &&
    !/^m+$/i.test(cleaned) &&
    (/[|'’,~{}()…\.]/.test(line) || /\b[SRGPDN]\s+[SRGPDN]\b/.test(line))
  );
}

const SECTION_KEYWORDS_RX =
  /^\s*[\(\[]?\s*(prelude|interlude|intro|music|trumpet|keyboard|saxophone|sax|sitar|santoor|harmonium|banjo|yoodling|yodelling|violins?|voilins?|humming|guitar|piano|flute|whistle|accordion|mandolin|shehnai|strings|glass|melodica|chorus|sthayi|mukhda|pallavi|antara|charanam|verse|anupallavi|base\s*guitar|bass\s*guitar|instrument(?:\s+unknown)?|opening)\b/i;

function isSectionHeader(line) {
  const t = line.trim();
  if (!t || t.includes('|') || t.includes('~') || t.includes('{')) return false;
  if (isSargamLine(t)) return false;
  if (/\b(used for|scale\s*:|pitch\s*:|of song)\b/i.test(t)) return false;
  const m = t.match(SECTION_KEYWORDS_RX);
  if (!m) return false;
  const kw = m[1].toLowerCase();
  const rest = t.slice(m[0].length);
  if (rest.length > 28) return false;
  if (kw === 'music') {
    return /^[\s:\-\(\[\)\]]*(?:piece|interlude|prelude|intro|tune|solo|part|saxophone|sax|guitar|violin|piano|flute|trumpet|keyboard|humming|×?\d+|x?\d+)?[\s\)\]\[:.\-\/×x\d]*$/i.test(
      rest
    );
  }
  return /^[\sA-Za-z0-9#():.\-\/×x\[\]]*$/i.test(rest);
}

function isLyricLine(line) {
  if (!line || line.length < 2) return false;
  const t = line.trim();
  if (isSargamLine(t)) return false;
  if (isWesternLine(t)) return false;
  if (/\(\s*(?:aaroh|avroh|aroh)\s*\)/i.test(t)) return false;
  if (/^[SRGMPDNrgmdn\s.,…'’|\u0964~{}()\-0-9#^\[\]×x]+$/.test(t)) return false;
  if (isSectionHeader(t)) return false;
  if (/^\s*[\(\[].*[\)\]]\s*[:.]*$/.test(t)) return false;
  if (
    /^(singer|singers|music|movie|film|lyrics|lyricist|raag|raga|scale|pitch|flute|based on|sargam|full sargam|notations|click here|watch|youtube|subscribe|note:|hint:|tip:|disclaimer|tags:|comment|share|repeat|play again|for beginners|i used|when at first|signs and symbols|piano|melodica|guitar|violin|voilin|glass|trumpet|keyboard|saxophone|sax|sitar|santoor|harmonium|banjo|yoodling|yodelling|humming|flute interlude|interlude|prel+ude|aroh|avroh|thaat|pakad|vaadi|samvaadi|base\s*guitar|bass\s*guitar|instrument)/i.test(
      t
    )
  ) {
    return false;
  }
  if (/\b(you can|play this|this tune|as follows|scale as|repeat for|same notations)\b/i.test(t)) {
    return false;
  }
  if (
    /\b(find song lyrics|stream albums|buy guitars|find guitars|take music lessons|learn music theory|see indian cinema|stream hindi hits|stream desi music|bottom of form)\b/i.test(
      t
    )
  ) {
    return false;
  }
  if (t.length > 92) return false;
  if (!/\p{L}/u.test(t)) return false;
  return true;
}

function isRealVocalLyricLine(line) {
  const t = line.trim();
  if (!isLyricLine(t)) return false;
  if (t.endsWith(':')) return false;
  if (
    /^\s*[\(\[]?\s*(prelude|interlude|intro|music|trumpet|keyboard|saxophone|sax|sitar|santoor|harmonium|banjo|yoodling|yodelling|violins?|voilins?|humming|guitar|piano|flute|whistle|accordion|mandolin|shehnai|strings|glass|melodica|chorus|base\s*guitar|bass\s*guitar|instrument)\b/i.test(
      t
    )
  ) {
    return false;
  }
  const words = t
    .replace(/[|\u0964.,!?()"'’\-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{M}]+$/u.test(w));
  return words.length >= 2;
}

function parseSargamSegment(segment, opts = {}) {
  const {
    maMode = 'M-is-shuddha',
    mPrimeIsTivra = false,
    carnatic = false,
    lowercaseShuddha = false,
    westernSwaraMap = null,
  } = opts;
  const tokens = [];
  // Collapse repeated commas, normalize infix suffix-comma/dot (e.g. N,S -> ,NS), and leading apostrophe
  const seg = segment
    .replace(/\(\s*[x×]\s*\d+\s*\)/gi, '')
    .replace(/,{2,}/g, ' ')
    .replace(/(?<![,.])([PDNdn])([,.])(?=[SRGMrgm])/g, ',$1')
    .replace(/(^|[\s|(])['’]([NDnd])/g, '$1,$2')
    .trim();
  if (!seg) return tokens;

  let i = 0;
  let pendingMeend = false;
  let pendingKan = null;
  let inMurki = false;
  let murkiHasGamak = false;

  const mapLetter = (ch, isSharpAfter) => {
    if (westernSwaraMap && !isSharpAfter && westernSwaraMap[ch]) {
      return westernSwaraMap[ch];
    }
    switch (ch) {
      case 'S':
      case 's':
        return 'S';
      case 'r':
        return lowercaseShuddha ? 'R' : 'Rk';
      case 'R':
        return 'R';
      case 'g':
        return lowercaseShuddha ? 'G' : 'Gk';
      case 'G':
        return 'G';
      case 'm':
        if (lowercaseShuddha) return 'M';
        return maMode === 'm-is-tivra' ? 'Mt' : 'M';
      case 'M':
        if (isSharpAfter) return 'Mt';
        return maMode === 'M-is-tivra' ? 'Mt' : 'M';
      case 'P':
      case 'p':
        return 'P';
      case 'd':
        return lowercaseShuddha ? 'D' : 'Dk';
      case 'D':
        return 'D';
      case 'n':
        return lowercaseShuddha ? 'N' : 'Nk';
      case 'N':
        return 'N';
      default:
        return null;
    }
  };

  while (i < seg.length) {
    const ch = seg[i];
    if (ch === '~') {
      pendingMeend = true;
      i++;
      continue;
    }
    if (ch === '{') {
      inMurki = true;
      murkiHasGamak = false;
      i++;
      continue;
    }
    if (ch === '}') {
      inMurki = false;
      i++;
      continue;
    }
    if (ch === '(') {
      const closeIdx = seg.indexOf(')', i);
      if (closeIdx > i && closeIdx - i <= 5) {
        const inner = seg.slice(i + 1, closeIdx).trim();
        const innerTokens = parseSargamSegment(inner, opts);
        if (innerTokens.length > 0) {
          pendingKan = { swara: innerTokens[0].swara, octave: innerTokens[0].octave };
          for (let m = 1; m < innerTokens.length; m++) {
            const extra = innerTokens[m];
            tokens.push({
              swara: extra.swara,
              octave: extra.octave,
              explicitOctave: extra.explicitOctave,
              sustainCount: 0,
              inMurki: true,
              ornament: undefined,
            });
          }
        }
        i = closeIdx + 1;
        continue;
      }
      i++;
      continue;
    }

    let octave = 'madhya';
    let explicitOctave = false;
    if ((ch === ',' || ch === '.') && i + 1 < seg.length && /[SRGMPDNrgmdn]/.test(seg[i + 1])) {
      const isSustainDots =
        ch === '.' && ((i > 0 && seg[i - 1] === '.') || (tokens.length > 0 && /[SRGMrgm]/.test(seg[i + 1])));
      if (!isSustainDots) {
        octave = 'mandra';
        explicitOctave = true;
        i++;
      } else {
        if (tokens.length > 0) tokens[tokens.length - 1].sustainCount += 1;
        i++;
        continue;
      }
    }

    const letter = seg[i];
    if (!/[SRGMPDNrgmdnsp]/.test(letter)) {
      if ((ch === '.' || ch === '…' || ch === '-') && tokens.length > 0) {
        tokens[tokens.length - 1].sustainCount += ch === '…' ? 2 : 1;
      }
      i++;
      continue;
    }
    i++;

    let carnaticSwara = null;
    if (carnatic && i < seg.length && /[123]/.test(seg[i])) {
      const key = letter.toUpperCase() + seg[i];
      if (CARNATIC_MAP[key]) {
        carnaticSwara = CARNATIC_MAP[key];
      }
      i++;
    }

    let isSharp = false;
    let isMPrimeTivra = false;
    while (i < seg.length) {
      const next = seg[i];
      if (next === '#' || next === '^') {
        isSharp = true;
        i++;
      } else if (next === "'" || next === '’' || next === '+' || next === '*') {
        if (mPrimeIsTivra && letter === 'M' && (next === "'" || next === '’')) {
          isMPrimeTivra = true;
          octave = 'madhya';
          explicitOctave = true;
        } else {
          octave = 'taar';
          explicitOctave = true;
        }
        i++;
      } else if (next === '_') {
        octave = 'mandra';
        explicitOctave = true;
        i++;
      } else {
        break;
      }
    }

    let sustainCount = 0;
    while (i < seg.length && (seg[i] === '.' || seg[i] === '…' || seg[i] === '-')) {
      if (
        seg[i] === '.' &&
        sustainCount === 0 &&
        i + 1 < seg.length &&
        /[SRGMPDNrgmdn]/.test(seg[i + 1]) &&
        (i + 2 >= seg.length || seg[i + 2] !== '.')
      ) {
        break;
      }
      sustainCount += seg[i] === '…' ? 2 : 1;
      i++;
    }

    const swara = isMPrimeTivra ? 'Mt' : carnaticSwara || mapLetter(letter, isSharp);
    if (!swara) continue;

    let ornament = undefined;
    if (pendingMeend && tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      ornament = ['meend', prev.swara, prev.octave];
    } else if (pendingKan) {
      ornament = ['kan', pendingKan.swara, pendingKan.octave];
    } else if (inMurki && !murkiHasGamak) {
      ornament = ['gamak'];
      murkiHasGamak = true;
    }

    tokens.push({ swara, octave, explicitOctave, sustainCount, inMurki, ornament });
    pendingMeend = false;
    pendingKan = null;
  }

  if (pendingKan) {
    if (tokens.length > 0 && !tokens[tokens.length - 1].ornament) {
      tokens[tokens.length - 1].ornament = ['kan', pendingKan.swara, pendingKan.octave];
    } else {
      tokens.push({
        swara: pendingKan.swara,
        octave: pendingKan.octave,
        explicitOctave: true,
        sustainCount: 0,
        inMurki: true,
        ornament: undefined,
      });
    }
  }

  return tokens;
}

function detectMaConvention(categoryIds, lines, sargamLines, ragaRaw = '') {
  const rawJoined = sargamLines.join(' ');
  const fullLower = lines.join('\n').toLowerCase();
  if (/m[#\^]/i.test(rawJoined)) return 'M-is-shuddha';
  if (/small\s*m\s*=\s*tivra|tivra[^.\n]{0,20}\bm\b/i.test(fullLower)) return 'm-is-tivra';
  if (/capital\s*m\s*=\s*tivra|small\s*m\s*=\s*shud|tivra[^.\n]{0,20}\bM\b/i.test(fullLower)) {
    return 'M-is-tivra';
  }

  const stripped = rawJoined.replace(/M[#\^'’]/g, '');
  const lowerMatches = stripped.match(/(?<![a-z])m(?![a-z])/g) || [];
  const upperMatches = stripped.match(/M/g) || [];
  const lowerCount = lowerMatches.length;
  const upperCount = upperMatches.length;
  const hasUpperM = upperCount > 0;
  const sameLineBoth = sargamLines.some(
    (l) => /(?<![a-z])m(?![a-z])/.test(l) && /M/.test(l.replace(/M[#\^'’]/g, ''))
  );

  if (upperCount >= 3 && lowerCount >= 3 && sameLineBoth) return 'M-is-tivra';

  const catInfo = (categoryIds || [])
    .map((id) => `${catById.get(id)?.slug || ''} ${catById.get(id)?.name || ''}`)
    .join(' ');
  const proseHeader = lines.slice(0, 15).join(' ');
  const ragaContext = `${ragaRaw} ${catInfo} ${proseHeader}`;
  const isTivraRaga = /\b(yaman|kalyan|marwa|puriya|multani|todi|madhuvanti|hameer|kamod|shuddh\s*kalyan)\b/i.test(
    ragaContext
  );
  if (hasUpperM && lowerCount === 0 && isTivraRaga) {
    return 'M-is-tivra';
  }
  return 'M-is-shuddha';
}

function cleanTitle(raw) {
  const cleaned = decodeHtmlEntities(raw)
    .replace(/\s*\(Sargam.*?\)/gi, '')
    .replace(/\s*Sargam Notations?/gi, '')
    .replace(/\s*Flute Notes?/gi, '')
    .replace(/\.\.\.\)$/, ')')
    .replace(/\.\.\.$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned === cleaned.toLowerCase()) {
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned;
}

function truncateAtWord(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  const cut = str.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxLen * 0.55)) {
    return cut.slice(0, lastSpace).replace(/[,;\-\s]+$/, '');
  }
  return cut.replace(/[,;\-\s]+$/, '');
}

function extractField(lines, regex) {
  for (const l of lines.slice(0, 14)) {
    const m = l.match(regex);
    if (m && m[1]) {
      const val = m[1].replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();
      if (!val || isSargamLine(val)) continue;
      return val;
    }
  }
  return null;
}

function inferEraAndYear(post, lines, movieRaw) {
  const catNames = post.categories.map((id) => catById.get(id)?.name || '');
  const catSlugs = post.categories.map((id) => catById.get(id)?.slug || '');

  let year = null;
  const headerStr = movieRaw || lines.slice(0, 10).join(' ');
  const parenYm = headerStr.match(/\(\s*(19[4-9]\d|20[0-2]\d)\s*\)/);
  const ym = parenYm || headerStr.match(/\b(19[4-9]\d|20[0-2]\d)\b/);
  if (ym) year = Number(ym[1]);

  if (!year) {
    if (catSlugs.includes('songs-from-1940-49')) year = 1948;
    else if (catSlugs.includes('songs-from-1950-59')) year = 1956;
    else if (catSlugs.includes('songs-from-1960-69')) year = 1966;
    else if (catSlugs.includes('songs-from-1970-79')) year = 1974;
    else if (catSlugs.includes('songs-from-1980-89')) year = 1985;
    else if (catSlugs.includes('songs-from-1990-99')) year = 1995;
    else if (catSlugs.includes('songs-of-2000-09')) year = 2005;
    else if (catSlugs.includes('songs-of-2010-19')) year = 2015;
    else year = 2000;
  }

  let era = 'Modern Bollywood';
  if (
    catSlugs.includes('devotional') ||
    catSlugs.includes('patriotic') ||
    catSlugs.includes('sargam-notation-for-popular-tunes')
  ) {
    era = 'Devotional & Tunes';
  } else if (year <= 1979) {
    era = 'Retro Classics';
  } else if (year <= 1999) {
    era = '90s Golden Era';
  } else {
    era = 'Modern Bollywood';
  }

  return { era, year, catNames, catSlugs };
}

const OCT_CODE = { mandra: 0, madhya: 1, taar: 2 };
const INLINE_INST_PREFIX_RX =
  /^(trumpet|keyboard|saxophone|sax|violins?|voilins?|guitar|piano|music|flute|sitar|santoor|harmonium|banjo|whistle|accordion|mandolin|shehnai|strings|glass|melodica|yoodling|yodelling|humming|prelude|interlude)\s*[:\-]/i;

let totalClampedNotes = 0;

function compileSongFromLines({
  slug,
  title,
  movie,
  year,
  composer,
  singers,
  era,
  scaleId,
  ragaRaw,
  maModeOverride = null,
  bpm,
  tala,
  url,
  ytId,
  categoryIds,
  lines,
}) {
  const sargamLineList = lines.filter(isSargamLine);
  if (sargamLineList.length < 3) return null;

  const maMode = maModeOverride || detectMaConvention(categoryIds, lines, sargamLineList, ragaRaw);
  const sargamJoined = sargamLineList.join(' ');
  const carnaticCount = (sargamJoined.match(/[SRGMPDNsrgmpdn][123]/g) || []).length;
  const carnatic = carnaticCount >= 3;
  const allSwaraLetters = sargamJoined.match(/[SRGMPDNsrgmpdn]/g) || [];
  const lowerSwaraLetters = sargamJoined.match(/[srgmpdn]/g) || [];
  const lowerRatio = lowerSwaraLetters.length / Math.max(1, allSwaraLetters.length);
  const lowercaseShuddha = lowerRatio >= 0.6 && /[sp]/.test(sargamJoined);
  const westernInfo = detectWesternDualSwaraMap(lines);
  const parseOpts = {
    maMode,
    mPrimeIsTivra: Boolean(SLUG_OVERRIDES[slug]?.mPrimeIsTivra),
    carnatic,
    lowercaseShuddha,
    westernSwaraMap: westernInfo?.swaraMap || null,
  };

  const beatsPerBar = tala === 'dadra' ? 6 : 8;

  const firstSthayiIdx = lines.findIndex((l) =>
    /^(sthayi|mukhda|pallavi)\s*[:.\-\d]*$/i.test(l.trim())
  );
  const firstVocalHeaderIdx =
    firstSthayiIdx > 0
      ? firstSthayiIdx
      : lines.findIndex((l) => /^chorus\s*[:.\-\d]*$/i.test(l.trim()));
  const scanStartIdx =
    firstVocalHeaderIdx > 0 && firstVocalHeaderIdx < lines.length - 4 ? firstVocalHeaderIdx : 0;

  const rawNotes = [];
  const sectionStarts = [];
  let inInterlude = false;
  let cursorBeat = 0;
  let pendingSectionLabel = null;
  let parsedLineIdx = 0;

  for (let idx = scanStartIdx; idx < lines.length; idx++) {
    const line = lines[idx];

    if (isSectionHeader(line)) {
      const isVocalHeader =
        /^(?:\s*[\(\[]?\s*)(sthayi|mukhda|pallavi|antara|charanam|verse|anupallavi|opening)\b/i.test(
          line.trim()
        );
      const isChorusWord = /^(?:\s*[\(\[]?\s*)chorus\b/i.test(line.trim());
      const isChorusVocal =
        isChorusWord && idx + 1 < lines.length && isRealVocalLyricLine(lines[idx + 1]);

      if (isVocalHeader || isChorusVocal) {
        inInterlude = false;
        const secLabel = /antara|charanam|verse/i.test(line)
          ? `Antara${sectionStarts.some((s) => s.name.startsWith('Antara')) ? ' 2' : ''}`
          : 'Mukhda';
        if (rawNotes.length > 0 && !sectionStarts.some((s) => s.name === secLabel)) {
          pendingSectionLabel = secLabel;
        }
      } else {
        inInterlude = true;
        pendingSectionLabel = null;
      }
      continue;
    }

    if (INLINE_INST_PREFIX_RX.test(line.trim())) {
      continue;
    }

    if (inInterlude && isRealVocalLyricLine(line) && idx + 1 < lines.length && isSargamLine(lines[idx + 1])) {
      inInterlude = false;
    }

    if (!isSargamLine(line)) continue;
    if (inInterlude) continue;
    if (rawNotes.length >= 320) break;

    const prevLine = idx > 0 ? lines[idx - 1] : '';
    const lyricLine = isLyricLine(prevLine) && !INLINE_INST_PREFIX_RX.test(prevLine.trim()) ? prevLine : '';

    const hasBarDelim = line.includes('|') || line.includes('\u0964');
    const slashCount = (line.match(/\//g) || []).length;
    const useSlashDelim = !hasBarDelim && slashCount >= 2;
    const sargamCells = hasBarDelim
      ? line
          .split(/[|\u0964]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : useSlashDelim
      ? line
          .split('/')
          .map((s) => s.trim())
          .filter(Boolean)
      : [line];
    const lyricCells =
      lyricLine && (lyricLine.includes('|') || lyricLine.includes('\u0964'))
        ? lyricLine
            .split(/[|\u0964]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : lyricLine && useSlashDelim && (lyricLine.match(/\//g) || []).length >= 2
        ? lyricLine
            .split('/')
            .map((s) => s.trim())
            .filter(Boolean)
        : lyricLine
        ? lyricLine.split(/\s+/).filter(Boolean)
        : [];

    const lineStartIdx = rawNotes.length;
    const phraseQuantum = tala === 'dadra' ? 6 : 4;
    let lineStartBeat = Math.round(cursorBeat / phraseQuantum) * phraseQuantum;
    if (lineStartBeat < cursorBeat - 0.001) {
      lineStartBeat = Math.ceil(cursorBeat / phraseQuantum) * phraseQuantum;
    }
    const lineBeatStart = lineStartBeat;
    cursorBeat = lineStartBeat;
    const currentLineIdx = parsedLineIdx++;

    if (pendingSectionLabel && rawNotes.length > 0) {
      sectionStarts.push({ name: pendingSectionLabel, startBeat: Number(lineBeatStart.toFixed(2)) });
      pendingSectionLabel = null;
    }

    const pushParsedGroup = (parsed, word) => {
      let cleanWord = (word || '')
        .replace(/^[A-Za-z ]+:\s*/, '')
        .replace(/[\(\[]\s*(?:avroh|aroh|music|interlude|flute)\s*[\)\]]/gi, '')
        .replace(/\s*\(\s*[x×]?\s*\d+\s*\)/gi, '')
        .replace(/~+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (
        cleanWord &&
        /^[SRGMPDNrgmdn\s.,…'’|~{}()\-0-9#^\[\]×x]+$/.test(cleanWord) &&
        (/[SRGMPDN]{2,}|[SRGMPDN]['’.,~]/.test(cleanWord))
      ) {
        cleanWord = '';
      }
      const baseDur = parsed.length === 1 ? 1.0 : 0.5;
      for (let k = 0; k < parsed.length; k++) {
        const tok = parsed[k];
        let dur = tok.inMurki ? 0.25 : baseDur;
        if (tok.sustainCount > 0) {
          dur += Math.min(2.0, Math.ceil(tok.sustainCount * 0.5) * 0.5);
        }
        dur = Math.min(3.0, Math.max(0.25, Math.round(dur * 4) / 4));

        rawNotes.push({
          swara: tok.swara,
          octave: tok.octave,
          explicitOctave: tok.explicitOctave,
          lineIdx: currentLineIdx,
          startBeat: Number(cursorBeat.toFixed(2)),
          durationBeats: dur,
          lyric: k === 0 ? cleanWord : '',
          breathAfter: false,
          ornament: tok.ornament,
        });
        cursorBeat += dur;
      }
    };

    const alignAndPush = (parsedGroups) => {
      const G = parsedGroups.length;
      const W = lyricCells.length;
      let prevWordIdx = -1;
      for (let g = 0; g < G; g++) {
        let word = '';
        if (W === G) {
          word = lyricCells[g] || '';
        } else if (W > 0 && W < G) {
          const wordIdx = Math.floor((g * W) / G);
          if (wordIdx !== prevWordIdx) {
            word = lyricCells[wordIdx] || '';
            prevWordIdx = wordIdx;
          }
        } else if (W > G) {
          const s0 = Math.floor((g * W) / G);
          const s1 = Math.floor(((g + 1) * W) / G);
          word = lyricCells.slice(s0, Math.max(s0 + 1, s1)).join(' ').slice(0, 24);
        }
        pushParsedGroup(parsedGroups[g], word);
      }
    };

    if (sargamCells.length > 1) {
      const parsedCells = [];
      for (let c = 0; c < sargamCells.length; c++) {
        const parsed = parseSargamSegment(sargamCells[c], parseOpts);
        if (parsed.length > 0) parsedCells.push(parsed);
      }
      alignAndPush(parsedCells);
    } else {
      const rawGroups = line.split(/\s+/).filter(Boolean);
      const cleanGroups = [];
      let carryMeend = false;
      for (const tok of rawGroups) {
        if (/^~+$/.test(tok)) {
          carryMeend = true;
          continue;
        }
        if (/^(?:-+|\(\s*[x×]?\s*\d+\s*\))$/.test(tok)) {
          continue;
        }
        cleanGroups.push(carryMeend ? `~${tok}` : tok);
        carryMeend = false;
      }

      const parsedGroups = [];
      for (const grp of cleanGroups) {
        const parsed = parseSargamSegment(grp, parseOpts);
        if (parsed.length > 0) parsedGroups.push(parsed);
      }
      alignAndPush(parsedGroups);
    }

    if (rawNotes.length > lineStartIdx) {
      const closingNote = rawNotes[rawNotes.length - 1];
      if (closingNote.durationBeats < 1.0) {
        closingNote.durationBeats = Number((closingNote.durationBeats + 0.5).toFixed(2));
        cursorBeat += 0.5;
      }

      const rawLineDur = cursorBeat - lineStartBeat;
      const desiredTotal = rawLineDur + 0.5;
      const targetSlot = Math.max(
        phraseQuantum,
        Math.ceil(desiredTotal / phraseQuantum) * phraseQuantum
      );

      const lastNote = rawNotes[rawNotes.length - 1];
      lastNote.breathAfter = true;
      cursorBeat = lineStartBeat + targetSlot;
    }
  }

  if (rawNotes.length < 18) return null;

  totalClampedNotes += normalizeOutOfRangeBeforeContinuity(rawNotes);
  resolveOctaveContinuity(rawNotes);
  totalClampedNotes += enforcePlayableRange(rawNotes);
  recomputeOrnaments(rawNotes);

  const finalRaga =
    ragaRaw === 'Hindustani Sargam' ? inferThaatFromNotes(rawNotes) : ragaRaw;

  const lastNoteEnd = rawNotes[rawNotes.length - 1].startBeat + rawNotes[rawNotes.length - 1].durationBeats;
  const totalBeats = Math.max(
    Math.ceil(cursorBeat / beatsPerBar) * beatsPerBar,
    Math.ceil(lastNoteEnd / beatsPerBar) * beatsPerBar
  );

  const sections = [];
  if (sectionStarts.length > 0 && sectionStarts[0].startBeat > 4) {
    const candidates = [['mukhda', 'Mukhda (Sthayi)', 0, sectionStarts[0].startBeat]];
    for (let s = 0; s < sectionStarts.length; s++) {
      const startB = sectionStarts[s].startBeat;
      const endB = s + 1 < sectionStarts.length ? sectionStarts[s + 1].startBeat : totalBeats;
      if (endB - startB >= 4) {
        candidates.push([`sec-${s}`, sectionStarts[s].name, startB, endB]);
      }
    }
    for (const sec of candidates) {
      if (rawNotes.some((n) => n.startBeat >= sec[2] - 0.001 && n.startBeat < sec[3] - 0.001)) {
        sections.push(sec);
      }
    }
  }
  if (sections.length === 0) {
    const mid = Math.floor(totalBeats / 2 / beatsPerBar) * beatsPerBar;
    if (
      mid >= beatsPerBar &&
      totalBeats - mid >= beatsPerBar &&
      rawNotes.some((n) => n.startBeat < mid - 0.001) &&
      rawNotes.some((n) => n.startBeat >= mid - 0.001)
    ) {
      sections.push(['mukhda', 'Mukhda (Part 1)', 0, mid]);
      sections.push(['antara', 'Antara (Part 2)', mid, totalBeats]);
    } else {
      sections.push(['full', 'Full Melody', 0, totalBeats]);
    }
  }

  const halfHoleCount = rawNotes.filter((n) => ['Rk', 'Gk', 'M', 'Dk', 'Nk'].includes(n.swara)).length;
  const komalCount = rawNotes.filter((n) => ['Rk', 'Gk', 'Dk', 'Nk', 'Mt'].includes(n.swara)).length;
  const taarCount = rawNotes.filter((n) => n.octave === 'taar').length;
  const komalRatio = komalCount / rawNotes.length;
  const halfRatio = halfHoleCount / rawNotes.length;

  let difficulty = 'Beginner';
  if (komalRatio > 0.24 || (komalRatio > 0.14 && taarCount >= 4)) {
    difficulty = 'Advanced';
  } else if (komalRatio > 0.06 || halfRatio > 0.2 || taarCount >= 3) {
    difficulty = 'Intermediate';
  }

  const compactNotes = rawNotes.map((n) => {
    const tuple = [n.swara, OCT_CODE[n.octave], n.startBeat, n.durationBeats, n.lyric, n.breathAfter ? 1 : 0];
    if (n.ornament) {
      tuple.push(n.ornament[0]);
      if (n.ornament[1]) tuple.push(n.ornament[1]);
      if (n.ornament[2]) tuple.push(OCT_CODE[n.ornament[2]]);
    }
    return tuple;
  });

  return {
    id: slug,
    t: title,
    m: truncateAtWord(movie, 46),
    y: year,
    c: truncateAtWord(composer, 38),
    sg: truncateAtWord(singers, 44),
    e: era,
    d: difficulty,
    sc: scaleId,
    r: truncateAtWord(finalRaga, 36),
    tl: tala,
    bpm,
    url,
    ...(ytId ? { yt: ytId } : {}),
    tb: totalBeats,
    sec: sections,
    n: compactNotes,
  };
}

function parsePostToCompactSong(post) {
  const slug = post.slug;
  if (FEATURED_SLUGS.has(slug)) return null;
  if (BROKEN_SOURCE_SLUGS.has(slug)) return null;

  const override = songOverrides.postOverrides?.[slug] || null;
  const title = override?.title || cleanTitle(post.title.rendered);
  const catSlugs = post.categories.map((id) => catById.get(id)?.slug || '');

  if (
    !override &&
    (catSlugs.includes('blog') ||
      catSlugs.includes('stories') ||
      /contest|instrumelodies|how to|tips|lesson|tutorial|quiz|scale chart|about us/i.test(title))
  ) {
    return null;
  }

  let lines = override?.customLines ? [...override.customLines] : htmlToLines(post.content.rendered);

  if (override?.stopBeforeRegex) {
    const stopRx = new RegExp(override.stopBeforeRegex, 'i');
    const stopIdx = lines.findIndex((l) => stopRx.test(l));
    if (stopIdx > 0) lines = lines.slice(0, stopIdx);
  }

  if (override?.sargamLineReplace || override?.lyricLineReplace) {
    lines = lines.map((l) => {
      let cur = l;
      if (override.sargamLineReplace && isSargamLine(cur)) {
        for (const [pat, rep] of override.sargamLineReplace) {
          cur = cur.replace(new RegExp(pat, 'g'), rep);
        }
      } else if (override.lyricLineReplace && isLyricLine(cur)) {
        for (const [pat, rep] of override.lyricLineReplace) {
          cur = cur.replace(new RegExp(pat, 'gi'), rep);
        }
      }
      return cur;
    });
  }

  const fullText = lines.join('\n');
  const sargamLineList = lines.filter(isSargamLine);
  if (sargamLineList.length < 3) return null;

  const ytMatch = post.content.rendered.match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  const ytId = ytMatch ? ytMatch[1] : undefined;

  const movieRaw = extractField(lines, /^(?:movie|film)\s*[:\-–]\s*(.+)$/i);
  const movie =
    override?.movie ||
    (movieRaw
      ? movieRaw.replace(/\(\s*\d{4}\s*\)/g, '').replace(/,\s*$/, '').trim()
      : catSlugs.includes('devotional')
      ? 'Traditional Bhajan'
      : catSlugs.includes('sargam-notation-for-popular-tunes')
      ? 'Popular Instrumental'
      : 'Bollywood Classic');

  const inferred = inferEraAndYear(post, lines, movieRaw);
  const year = override?.year ?? inferred.year;
  const era = override?.era ?? inferred.era;
  const catNames = inferred.catNames;

  const singerRaw =
    override?.singers ||
    extractField(lines, /^singers?\s*[:\-–]\s*(.+)$/i) ||
    catNames.find((n) =>
      /(Kishore|Lata|Rafi|Asha|Mukesh|Arijit|Sonu|Udit|Alka|Kumar Sanu|Jagjit|Hemant|Shreya|Manna|Talat|Yesudas)/i.test(
        n
      )
    ) ||
    'Classic Vocal';

  const composerRaw =
    override?.composer ||
    extractField(lines, /^music(?:\s*(?:director|by))?\s*[:\-–]\s*(.+)$/i) ||
    catNames.find((n) =>
      /(Burman|Laxmikant|Shankar|Madan Mohan|Kalyanji|Naushad|Rahman|Pritam|Jatin|Khayyam|Salil|Nadeem|Anu Malik|Vishal|Mithoon)/i.test(
        n
      )
    ) ||
    'Bollywood Composer';

  const ragaRaw =
    override?.raga ||
    extractField(lines, /^(?:based on\s*)?raa?g(?:a)?\s*[:\-–]\s*(.+)$/i) ||
    'Hindustani Sargam';

  const mir = mirCache[slug];
  const mirValid = !MIR_BLOCKLIST.has(slug) && mir && mir.status === 'ok' && mir.oemVerified === true;
  const explicitScale = override?.scaleId || detectScaleId(lines, null);
  const westernFallback = !explicitScale ? detectWesternDualSwaraMap(lines)?.inferredScaleId : null;
  const fallbackScale =
    era === 'Retro Classics' ? 'G_BASS' : era === 'Modern Bollywood' ? 'E_BASS' : 'C_MEDIUM';
  const scaleId = explicitScale || westernFallback || fallbackScale;

  const known = KNOWN_BPMS[slug];
  let bpm = override?.bpm ?? known?.bpm ?? 92;
  let tala = override?.tala ?? known?.tala ?? 'keherwa';
  if (!override?.bpm && !known) {
    const pipeLines = sargamLineList.filter((l) => l.includes('|'));
    const threeCellRatio =
      pipeLines.length >= 3
        ? pipeLines.filter((l) => {
            const c = l.split('|').filter((x) => x.trim()).length;
            return c === 3 || c === 6;
          }).length / pipeLines.length
        : 0;
    const textSaysDadra =
      /\b(dadra|waltz|6\/8|3\/4)\b/i.test(fullText) ||
      (catSlugs.includes('ghazal') && threeCellRatio >= 0.5);

    const isSlowCategory =
      catSlugs.includes('sad') || catSlugs.includes('ghazal') || catSlugs.includes('devotional');

    if (mirValid && mir.conf >= 0.32) {
      bpm = mir.bpm;
      tala = textSaysDadra || (mir.conf >= 0.45 && mir.tala === 'dadra') ? 'dadra' : 'keherwa';
      if (isSlowCategory && bpm >= 112) {
        bpm = Math.round(bpm / 2);
      } else if (catSlugs.includes('romantic') && bpm >= 120) {
        bpm = Math.round(bpm / 2);
      } else if (tala === 'keherwa' && bpm < 64 && mir.onsetDensity > 5.8) {
        bpm = Math.round(bpm * 2);
      }
      bpm = Math.max(60, Math.min(148, bpm));
    } else if (textSaysDadra) {
      tala = 'dadra';
      bpm = catSlugs.includes('ghazal') || catSlugs.includes('sad') ? 76 : 88;
    } else if (catSlugs.includes('sad') || catSlugs.includes('ghazal')) {
      bpm = 80;
    } else if (catSlugs.includes('romantic')) {
      bpm = 88;
    } else if (catSlugs.includes('devotional')) {
      bpm = 90;
    } else if (year >= 1990 && year <= 2005) {
      bpm = 94;
    } else {
      bpm = 92;
    }

    if (bpm > 136) {
      bpm = Math.max(60, Math.round(bpm / 2));
    }
  }

  return compileSongFromLines({
    slug,
    title,
    movie,
    year,
    composer: composerRaw,
    singers: singerRaw,
    era,
    scaleId,
    ragaRaw,
    maModeOverride: override?.maMode || null,
    bpm,
    tala,
    url: post.link,
    ytId,
    categoryIds: post.categories,
    lines,
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const compactSongs = [];
const seenSlugs = new Set();
const seenMelodyHashes = new Map();

const registerSong = (s) => {
  if (!s || seenSlugs.has(s.id)) return;
  const melHash = JSON.stringify(s.n.slice(0, 40).map((x) => [x[0], x[1]]));
  if (seenMelodyHashes.has(melHash)) {
    console.warn(`WARNING: Duplicate melody hash skipped: ${s.id} (matches ${seenMelodyHashes.get(melHash)})`);
    return;
  }
  seenMelodyHashes.set(melHash, s.id);
  seenSlugs.add(s.id);
  compactSongs.push(s);
};

for (const post of dump.posts) {
  registerSong(parsePostToCompactSong(post));
}

for (const add of songOverrides.additionalSongs || []) {
  const s = compileSongFromLines({
    slug: add.slug,
    title: add.title,
    movie: add.movie,
    year: add.year,
    composer: add.composer,
    singers: add.singers,
    era: add.era,
    scaleId: add.scaleId,
    ragaRaw: add.raga,
    bpm: add.bpm,
    tala: add.tala,
    url: add.url,
    ytId: add.ytId,
    categoryIds: [],
    lines: add.lines,
  });
  registerSong(s);
}

for (const k of Object.keys(KNOWN_BPMS)) {
  if (!seenSlugs.has(k)) {
    console.warn(`WARNING: KNOWN_BPMS key not matched in compiled output: ${k}`);
  }
}

compactSongs.sort((a, b) => {
  const ak = KNOWN_BPMS[a.id] ? 1 : 0;
  const bk = KNOWN_BPMS[b.id] ? 1 : 0;
  if (ak !== bk) return bk - ak;
  return a.t.localeCompare(b.t);
});

fs.writeFileSync(OUT_PATH, JSON.stringify(compactSongs), 'utf8');

const oldTmp = path.resolve('src/data/importedSongs.json');
if (fs.existsSync(oldTmp)) fs.unlinkSync(oldTmp);

const sizeKb = Math.round(fs.statSync(OUT_PATH).size / 1024);
console.log(`Built compact public/data/library.json: ${compactSongs.length} additional songs (${sizeKb} KB).`);
console.log(`Total out-of-range notes clamped to madhya: ${totalClampedNotes}`);
for (const s of compactSongs.slice(0, 10)) {
  console.log(`  - ${s.t} (${s.y}) | ${s.e} | ${s.d} | ${s.sc} | ${s.bpm} BPM | ${s.n.length} notes`);
}
