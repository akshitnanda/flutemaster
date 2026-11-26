import fs from 'node:fs';
import path from 'node:path';

const DUMP_PATH = path.resolve('data/notesandsargam-dump.json');
const MIR_CACHE_PATH = path.resolve('data/mir-bpm-cache.json');
const OUT_DIR = path.resolve('public/data');
const OUT_PATH = path.join(OUT_DIR, 'library.json');

const dump = JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8'));
const mirCache = fs.existsSync(MIR_CACHE_PATH)
  ? JSON.parse(fs.readFileSync(MIR_CACHE_PATH, 'utf8'))
  : {};

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

function semiToSwaraOct(semi) {
  let oct = 'madhya';
  let local = semi;
  if (semi < 0) {
    oct = 'mandra';
    local = semi + 12;
  } else if (semi >= 12) {
    oct = 'taar';
    local = semi - 12;
  }
  const entry = Object.entries(SWARA_SEMI).find(([, v]) => v === local);
  return entry ? { swara: entry[0], octave: oct } : null;
}

/**
 * Fixes missing octave markers in text Sargam within each vocal line by snapping unmarked notes
 * away from unnatural >=8-semitone jumps when an adjacent playable flute octave is within <=5 semitones.
 * Resets at every line boundary so cross-line jumps never poison entire verses.
 */
function resolveOctaveContinuity(notes) {
  for (let i = 1; i < notes.length; i++) {
    const cur = notes[i];
    const prev = notes[i - 1];
    if (cur.lineIdx !== prev.lineIdx) continue;
    if (cur.explicitOctave) continue;

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
}

/**
 * Handles notes outside 6-hole Bansuri playable range [-5..19] (Mandra P .. Taar P) AFTER continuity.
 * If shifting an entire line by +/-12 brings all its notes inside [-5, 19], shifts the line coherently
 * to preserve melodic contour; otherwise clamps only the offending notes.
 */
function enforcePlayableRange(notes) {
  let clampedCount = 0;
  let start = 0;
  while (start < notes.length) {
    const lineIdx = notes[start].lineIdx;
    let end = start;
    while (end < notes.length && notes[end].lineIdx === lineIdx) end++;

    const lineNotes = notes.slice(start, end);
    const semis = lineNotes.map((n) => toSemi(n.swara, n.octave));
    const minS = Math.min(...semis);
    const maxS = Math.max(...semis);

    if (minS < -5 || maxS > 19) {
      const shift = minS < -5 ? 12 : -12;
      const canShiftWholeLine = lineNotes.every((n) => {
        const s = toSemi(n.swara, n.octave) + shift;
        return s >= -5 && s <= 19;
      });
      if (canShiftWholeLine) {
        for (const n of lineNotes) {
          const nextOct =
            shift === 12
              ? n.octave === 'mandra'
                ? 'madhya'
                : 'taar'
              : n.octave === 'taar'
              ? 'madhya'
              : 'mandra';
          n.octave = nextOct;
        }
      } else {
        for (const n of lineNotes) {
          const s = toSemi(n.swara, n.octave);
          if (s < -5 || s > 19) {
            n.octave = 'madhya';
            clampedCount++;
          }
        }
      }
    }
    start = end;
  }
  return clampedCount;
}

/**
 * Recomputes ornament grace octaves AFTER resolveOctaveContinuity() & enforcePlayableRange()
 * so Meend glides always start from the settled previous note and Kan grace notes sit in the closest octave.
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
      if (!graceSwara) continue;
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
      cur.ornament = ['kan', graceSwara, bestOct];
    }
  }
}

// Slugs already covered by our hand-crafted Studio Featured songs (with Devanagari lyrics)
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
  'aye-dil-mujhe-aisi-jagah-le-chal', // WP dump post contains verbatim copy of chhoti-si-ye-zindgani-re
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

// OEM-verified original studio BPMs & Talas (cross-referenced against Tunebat, SongBPM & original classic recordings)
const KNOWN_BPMS = {
  'kal-ho-na-ho-har-ghadi-badal-rahi-hai': { bpm: 82, tala: 'keherwa' },
  'chura-liya-hai-tumne-jo': { bpm: 80, tala: 'keherwa' },
  'ek-pyar-ka-nagma': { bpm: 97, tala: 'keherwa' },
  'mere-mehboob-qayamat-hogi': { bpm: 106, tala: 'keherwa' },
  'hothon-se-chhoo-lo-tum': { bpm: 99, tala: 'dadra' },
  'neele-neele-ambar-par': { bpm: 89, tala: 'keherwa' },
  'tu-mile-dil-khile': { bpm: 88, tala: 'keherwa' },
  'gulabi-ankhen-jo-teri-dekhi': { bpm: 105, tala: 'keherwa' },
  'ye-sham-mastani': { bpm: 112, tala: 'keherwa' },
  'kabhi-kabhi-mere-dil-me': { bpm: 78, tala: 'keherwa' },
  'chhoo-kar-mere-man-ko': { bpm: 96, tala: 'keherwa' },
  'tere-bina-zindagi-se': { bpm: 95, tala: 'keherwa' },
  'tere-bina-jiya-jaye-na': { bpm: 108, tala: 'dadra' },
  'mere-sapno-ki-rani': { bpm: 124, tala: 'keherwa' },
  'pyar-diwana-hota-hai': { bpm: 102, tala: 'keherwa' },
  'o-mere-dil-ke-chain': { bpm: 109, tala: 'keherwa' },
  'zindagi-ek-safar-hai-suhana': { bpm: 120, tala: 'keherwa' },
  'ek-ladki-ko-dekha-to': { bpm: 92, tala: 'keherwa' },
  'bahut-pyar-karte-hai': { bpm: 110, tala: 'dadra' },
  'jeena-yahan-merna-yahan': { bpm: 112, tala: 'keherwa' },
  'kora-kagaz-tha-yeh-mann-mera': { bpm: 96, tala: 'keherwa' },
  'abhi-naa-jao-chhod-kar': { bpm: 104, tala: 'dadra' },
  'chaudhvin-ka-chand-ho': { bpm: 84, tala: 'keherwa' },
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
  'rimjhim-ke-geet-sawan-gaye': { bpm: 108, tala: 'dadra' },
  'neele-gagan-ke-tale': { bpm: 104, tala: 'dadra' },
  'oh-re-taal-mile': { bpm: 108, tala: 'keherwa' },
  'mere-rang-mein-rangne-wali': { bpm: 98, tala: 'keherwa' },
  'tumhen-apna-banane-ki-kasam': { bpm: 98, tala: 'keherwa' },
  'tu-hi-re': { bpm: 100, tala: 'keherwa' },
  'lukka-chuppi': { bpm: 104, tala: 'keherwa' },
  'mitwa-mere-man-ye-bata-de-tu': { bpm: 92, tala: 'keherwa' },
  'tum-se-hi-na-hai-ye-paana': { bpm: 65, tala: 'keherwa' },
  'saiyyan-heere-moti-main-na-chahu': { bpm: 86, tala: 'keherwa' },
  'pani-da-rang-wekh-ke': { bpm: 98, tala: 'keherwa' },
  'jeene-laga-hoon': { bpm: 90, tala: 'keherwa' },
  'sanam-re-sanam-re': { bpm: 112, tala: 'keherwa' },
  'janam-janam-janam': { bpm: 96, tala: 'keherwa' },
  'gerua-dhoop-se-nikal-ke': { bpm: 88, tala: 'keherwa' },
  'hawayein-le-jaye-jane-kaha': { bpm: 126, tala: 'keherwa' },
  'dil-diyan-gallan': { bpm: 105, tala: 'keherwa' },
  'banarasiya-rang-me-bhang-ya': { bpm: 91, tala: 'keherwa' },
  'kya-mausam-hai-chal-kahin-door-nikal-jaye': { bpm: 108, tala: 'keherwa' },
};

function matchPitchOnLine(line) {
  // Pitch tokens [A-G](#|b)? stay case-sensitive so words like "for" never match "F".
  const patterns = [
    /(?:[Ff]lute|[Ss]cale|[Pp]itch|[Bb]ansuri|FLUTE|SCALE|PITCH|BANSURI)[^:\n]{0,28}[:=\-\s]\s*(?:[Ss]cale\s+)?([A-G](?:#|b)?)(?![A-Za-z#b])/,
    /\b(?:[Uu]sed|USED)\s+([A-G](?:#|b)?)(?![A-Za-z#b])\s*(?:[Nn]atural|[Ss]harp|[Ff]lat|[Bb]ass|[Mm]edium|[Ss]cale|[Ff]lute)?/,
    /\b([A-G](?:#|b)?)(?![A-Za-z#b])\s*(?:[Nn]atural|[Ss]harp|[Ff]lat|[Bb]ass|[Mm]edium)?\s*(?:[Ff]lute|[Bb]ansuri|[Ss]cale|FLUTE|BANSURI|SCALE)\b/,
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

/**
 * Case-sensitive musical key detection across first 30 lines, prioritizing "Flute used for notations / Sargam"
 * over generic "Original Scale" headers.
 */
function detectScaleId(lines, defaultScale = null) {
  const headerBlock = lines.slice(0, 30).filter((l) => /(flute|scale|pitch|bansuri)/i.test(l));
  // Pass 1: Explicit notation-flute headers
  for (const line of headerBlock) {
    if (!/(used for notation|flute used|for sargam)/i.test(line)) continue;
    const hit = matchPitchOnLine(line);
    if (hit) return hit;
  }
  // Pass 2: Other headers excluding "original scale"
  for (const line of headerBlock) {
    if (/original scale/i.test(line)) continue;
    const hit = matchPitchOnLine(line);
    if (hit) return hit;
  }
  // Pass 3: Fallback including "original scale"
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

function isSargamLine(line) {
  if (!line || line.length < 3) return false;
  if (/^h+m+/i.test(line.trim()) || /hm{2,}/i.test(line)) return false;
  if (
    /^(singer|singers|music|movie|film|lyrics|lyricist|raag|raga|scale|pitch|flute|note|notes|sthayi|mukhda|antara|charanam|pallavi|interlude|prel+ude|repeat|play|click|watch|video|http|based on|signs|symbols|this song|i used|for the|glass|piano|guitar|violin|voilin|melodica|trumpet|keyboard|saxophone|sax|sitar|santoor|harmonium|banjo|yoodling|yodelling|humming|whistle|accordion|mandolin|shehnai|aroh|avroh|thaat|pakad|vaadi|samvaadi)/i.test(
      line
    )
  ) {
    return false;
  }
  const cleaned = line
    .replace(/\(\s*[x×]\s*\d+\s*\)/gi, '')
    .replace(/\[\s*\d+\s*\]/g, '')
    .replace(/[\|\s,\.\'’\+\*\~\-\(\)\{\}\[\]…_#\/\^0-9:;!×]+/g, '');

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
  return distinctSwaras.size >= 2;
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
  // Guard composer lines like "Music : Ajay Atul" or "Music by : Hemant Kumar"
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
  } = opts;
  const tokens = [];
  const seg = segment.replace(/\(\s*[x×]\s*\d+\s*\)/gi, '').trim();
  if (!seg) return tokens;

  let i = 0;
  let pendingMeend = false;
  let pendingKan = null;
  let inMurki = false;
  let murkiHasGamak = false;

  const mapLetter = (ch, isSharpAfter) => {
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
      const isSustainDots = ch === '.' && i > 0 && seg[i - 1] === '.';
      if (!isSustainDots) {
        octave = 'mandra';
        explicitOctave = true;
        i++;
      } else {
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

  // Handle trailing pendingKan left at the end of a segment
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

function detectMaConvention(post, lines, sargamLines, ragaRaw = '') {
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

  const catInfo = post.categories
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
  const ym = (movieRaw || lines.slice(0, 10).join(' ')).match(/\b(19[4-9]\d|20[0-2]\d)\b/);
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

function parsePostToCompactSong(post) {
  const slug = post.slug;
  if (FEATURED_SLUGS.has(slug)) return null;
  if (BROKEN_SOURCE_SLUGS.has(slug)) return null;

  const title = cleanTitle(post.title.rendered);
  const catSlugs = post.categories.map((id) => catById.get(id)?.slug || '');

  if (
    catSlugs.includes('blog') ||
    catSlugs.includes('stories') ||
    /contest|instrumelodies|how to|tips|lesson|tutorial|quiz|scale chart|about us/i.test(title)
  ) {
    return null;
  }

  const lines = htmlToLines(post.content.rendered);
  const fullText = lines.join('\n');
  const sargamLineList = lines.filter(isSargamLine);
  if (sargamLineList.length < 3) return null;

  const ytMatch = post.content.rendered.match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  const ytId = ytMatch ? ytMatch[1] : undefined;

  const movieRaw = extractField(lines, /^(?:movie|film)\s*[:\-–]\s*(.+)$/i);
  const movie = movieRaw
    ? movieRaw.replace(/\(\s*\d{4}\s*\)/g, '').replace(/,\s*$/, '').trim()
    : catSlugs.includes('devotional')
    ? 'Traditional Bhajan'
    : catSlugs.includes('sargam-notation-for-popular-tunes')
    ? 'Popular Instrumental'
    : 'Bollywood Classic';

  const { era, year, catNames } = inferEraAndYear(post, lines, movieRaw);

  const singerRaw =
    extractField(lines, /^singers?\s*[:\-–]\s*(.+)$/i) ||
    catNames.find((n) =>
      /(Kishore|Lata|Rafi|Asha|Mukesh|Arijit|Sonu|Udit|Alka|Kumar Sanu|Jagjit|Hemant|Shreya|Manna|Talat|Yesudas)/i.test(
        n
      )
    ) ||
    'Classic Vocal';

  const composerRaw =
    extractField(lines, /^music(?:\s*(?:director|by))?\s*[:\-–]\s*(.+)$/i) ||
    catNames.find((n) =>
      /(Burman|Laxmikant|Shankar|Madan Mohan|Kalyanji|Naushad|Rahman|Pritam|Jatin|Khayyam|Salil|Nadeem|Anu Malik|Vishal|Mithoon)/i.test(
        n
      )
    ) ||
    'Bollywood Composer';

  const ragaRaw =
    extractField(lines, /^(?:based on\s*)?raa?g(?:a)?\s*[:\-–]\s*(.+)$/i) || 'Hindustani Sargam';

  const maMode = detectMaConvention(post, lines, sargamLineList, ragaRaw);
  const sargamJoined = sargamLineList.join(' ');
  const carnaticCount = (sargamJoined.match(/[SRGMPDNsrgmpdn][123]/g) || []).length;
  const carnatic = carnaticCount >= 3;
  const allSwaraLetters = sargamJoined.match(/[SRGMPDNsrgmpdn]/g) || [];
  const lowerSwaraLetters = sargamJoined.match(/[srgmpdn]/g) || [];
  const lowerRatio = lowerSwaraLetters.length / Math.max(1, allSwaraLetters.length);
  const lowercaseShuddha = lowerRatio >= 0.6 && /[sp]/.test(sargamJoined);
  const parseOpts = {
    maMode,
    mPrimeIsTivra: Boolean(SLUG_OVERRIDES[slug]?.mPrimeIsTivra),
    carnatic,
    lowercaseShuddha,
  };

  const mir = mirCache[slug];
  const mirValid = !MIR_BLOCKLIST.has(slug) && mir && mir.status === 'ok' && mir.oemVerified === true;
  const explicitScale = detectScaleId(lines, null);
  const mirScale = null; // FFT-aliased MIR keys disabled; rely on explicit header or sensible era fallback
  const fallbackScale =
    era === 'Retro Classics' ? 'G_BASS' : era === 'Modern Bollywood' ? 'E_BASS' : 'C_MEDIUM';
  const scaleId = explicitScale || mirScale || fallbackScale;

  const known = KNOWN_BPMS[slug];
  let bpm = known?.bpm ?? 92;
  let tala = known?.tala ?? 'keherwa';
  if (!known) {
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

    if (mirValid && mir.conf >= 0.32) {
      bpm = mir.bpm;
      tala = textSaysDadra || (mir.conf >= 0.45 && mir.tala === 'dadra') ? 'dadra' : 'keherwa';
      const isSlowMood =
        catSlugs.includes('sad') || catSlugs.includes('ghazal') || catSlugs.includes('romantic');
      if (tala === 'keherwa' && bpm >= 118 && mir.onsetDensity < 4.5 && isSlowMood) {
        bpm = Math.round(bpm / 2);
      } else if (tala === 'keherwa' && bpm < 64 && mir.onsetDensity > 5.8) {
        bpm = Math.round(bpm * 2);
      }
      bpm = Math.max(60, Math.min(148, bpm));
    } else if (textSaysDadra) {
      tala = 'dadra';
      bpm = 114;
    } else if (catSlugs.includes('sad') || catSlugs.includes('ghazal')) {
      bpm = 80;
    } else if (catSlugs.includes('romantic')) {
      bpm = 88;
    } else if (catSlugs.includes('devotional')) {
      bpm = 90;
    } else if (year >= 1990 && year <= 2005) {
      bpm = 102;
    } else {
      bpm = 92;
    }

    if (bpm > 136) {
      bpm = Math.max(60, Math.round(bpm / 2));
    }
  }
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
      // Chorus: before a sargam line (or "Chorus: Aaa..") is a backing fill, not a lead verse
      const isChorusVocal =
        isChorusWord &&
        idx + 1 < lines.length &&
        isRealVocalLyricLine(lines[idx + 1]);

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
    if (rawNotes.length >= 240) break;

    const prevLine = idx > 0 ? lines[idx - 1] : '';
    const lyricLine = isLyricLine(prevLine) && !INLINE_INST_PREFIX_RX.test(prevLine.trim()) ? prevLine : '';

    const sargamCells = line.includes('|')
      ? line
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : [line];
    const lyricCells =
      lyricLine && (lyricLine.includes('|') || lyricLine.includes('\u0964'))
        ? lyricLine
            .split(/[|\u0964]/)
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
      const cleanWord = (word || '')
        .replace(/^[A-Za-z ]+:\s*/, '')
        .replace(/[\(\[]\s*(?:avroh|aroh|music|interlude|flute)\s*[\)\]]/gi, '')
        .replace(/^\(\s*[x×]?\s*\d+\s*\)$/, '')
        .trim();
      const baseDur = parsed.length === 1 ? 0.85 : parsed.length === 2 ? 0.5 : 0.35;
      for (let k = 0; k < parsed.length; k++) {
        const tok = parsed[k];
        let dur = tok.inMurki ? 0.25 : baseDur;
        if (tok.sustainCount > 0) {
          dur += Math.min(2.4, tok.sustainCount * 0.35);
        }
        dur = Math.min(3.25, Number(dur.toFixed(3)));

        rawNotes.push({
          swara: tok.swara,
          octave: tok.octave,
          explicitOctave: tok.explicitOctave,
          lineIdx: currentLineIdx,
          startBeat: Number(cursorBeat.toFixed(3)),
          durationBeats: dur,
          lyric: k === 0 ? cleanWord : '',
          breathAfter: false,
          ornament: tok.ornament,
        });
        cursorBeat += dur;
      }
    };

    if (sargamCells.length > 1) {
      const parsedCells = [];
      for (let c = 0; c < sargamCells.length; c++) {
        const parsed = parseSargamSegment(sargamCells[c], parseOpts);
        if (parsed.length > 0) parsedCells.push(parsed);
      }
      const G = parsedCells.length;
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
        pushParsedGroup(parsedCells[g], word);
      }
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
    }

    if (rawNotes.length > lineStartIdx) {
      const lineNoteCount = rawNotes.length - lineStartIdx;
      const closingNote = rawNotes[rawNotes.length - 1];
      if (closingNote.durationBeats < 1.25) {
        const extra = Math.min(0.55, closingNote.durationBeats * 0.45);
        closingNote.durationBeats = Number((closingNote.durationBeats + extra).toFixed(3));
        cursorBeat += extra;
      }

      const rawLineDur = cursorBeat - lineStartBeat;
      const desiredTotal = rawLineDur + 0.55;
      let targetSlot = Math.max(
        phraseQuantum,
        Math.round(desiredTotal / phraseQuantum) * phraseQuantum
      );
      const breathGap = 0.55;
      let playableSpan = targetSlot - breathGap;
      let scale = playableSpan / Math.max(0.5, rawLineDur);

      while (scale < 0.76 && targetSlot < phraseQuantum * 4) {
        targetSlot += phraseQuantum;
        playableSpan = targetSlot - breathGap;
        scale = playableSpan / Math.max(0.5, rawLineDur);
      }
      while (scale > 1.32 && targetSlot > phraseQuantum && lineNoteCount * 0.25 <= targetSlot - phraseQuantum - breathGap) {
        targetSlot -= phraseQuantum;
        playableSpan = targetSlot - breathGap;
        scale = playableSpan / Math.max(0.5, rawLineDur);
      }
      // Guarantee min 0.25 duration per note can never overflow targetSlot
      while (lineNoteCount * 0.25 > playableSpan) {
        targetSlot += phraseQuantum;
        playableSpan = targetSlot - breathGap;
        scale = playableSpan / Math.max(0.5, rawLineDur);
      }

      let cur = lineStartBeat;
      for (let k = lineStartIdx; k < rawNotes.length; k++) {
        const scaledDur = Math.max(0.25, Number((rawNotes[k].durationBeats * scale).toFixed(3)));
        rawNotes[k].startBeat = Number(cur.toFixed(3));
        rawNotes[k].durationBeats = scaledDur;
        cur += scaledDur;
      }

      const maxEnd = lineStartBeat + targetSlot - 0.35;
      if (cur > maxEnd) {
        // Proportionally compress this line only if scaledDurs hit 0.25 floor and crept past maxEnd
        const actualSpan = cur - lineStartBeat;
        const fixScale = (maxEnd - lineStartBeat) / actualSpan;
        let fixCur = lineStartBeat;
        for (let k = lineStartIdx; k < rawNotes.length; k++) {
          const d = Math.max(0.25, Number((rawNotes[k].durationBeats * fixScale).toFixed(3)));
          rawNotes[k].startBeat = Number(fixCur.toFixed(3));
          rawNotes[k].durationBeats = d;
          fixCur += d;
        }
        cur = fixCur;
      }

      if (cur > lineStartBeat + targetSlot) {
        targetSlot += phraseQuantum;
      }

      const lastNote = rawNotes[rawNotes.length - 1];
      lastNote.breathAfter = true;
      cursorBeat = lineStartBeat + targetSlot;
    }
  }

  if (rawNotes.length < 18) return null;

  resolveOctaveContinuity(rawNotes);
  totalClampedNotes += enforcePlayableRange(rawNotes);
  recomputeOrnaments(rawNotes);

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
    c: truncateAtWord(composerRaw, 38),
    sg: truncateAtWord(singerRaw, 44),
    e: era,
    d: difficulty,
    sc: scaleId,
    r: truncateAtWord(ragaRaw, 36),
    tl: tala,
    bpm,
    url: post.link,
    ...(ytId ? { yt: ytId } : {}),
    tb: totalBeats,
    sec: sections,
    n: compactNotes,
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const compactSongs = [];
const seenSlugs = new Set();
const seenMelodyHashes = new Map();

for (const post of dump.posts) {
  const s = parsePostToCompactSong(post);
  if (!s || seenSlugs.has(s.id)) continue;
  const melHash = JSON.stringify(s.n.slice(0, 40).map((x) => [x[0], x[1]]));
  if (seenMelodyHashes.has(melHash)) {
    console.warn(`WARNING: Duplicate melody hash skipped: ${s.id} (matches ${seenMelodyHashes.get(melHash)})`);
    continue;
  }
  seenMelodyHashes.set(melHash, s.id);
  seenSlugs.add(s.id);
  compactSongs.push(s);
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
