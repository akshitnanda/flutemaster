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
  'D#': 'E_BASS',
  EB: 'E_BASS',
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
  B: 'A_SHARP_MEDIUM',
  C: 'C_MEDIUM',
  'C#': 'C_SHARP_MEDIUM',
  DB: 'C_SHARP_MEDIUM',
};

const SWARA_SEMI = {
  S: 0, Rk: 1, R: 2, Gk: 3, G: 4, M: 5, Mt: 6, P: 7, Dk: 8, D: 9, Nk: 10, N: 11,
};
const MANDRA_OK = new Set(['P', 'Dk', 'D', 'Nk', 'N']);
const TAAR_OK = new Set(['S', 'Rk', 'R', 'Gk', 'G', 'M', 'Mt', 'P']);

function toSemi(swara, octave) {
  return (SWARA_SEMI[swara] ?? 0) + (octave === 'mandra' ? -12 : octave === 'taar' ? 12 : 0);
}

/**
 * Fixes missing octave markers in text Sargam (e.g. "S N S N D N" in Kal Ho Na Ho or
 * "G R S N D" in Dil Diyan Gallan) by snapping unmarked notes away from unnatural >=8-semitone
 * octave jumps when an adjacent playable flute octave is within <=4 semitones.
 */
function resolveOctaveContinuity(notes) {
  for (let i = 1; i < notes.length; i++) {
    const cur = notes[i];
    if (cur.explicitOctave) continue;
    const prevSemi = toSemi(notes[i - 1].swara, notes[i - 1].octave);
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

// Slugs already covered by our hand-crafted Studio Featured songs (with Devanagari lyrics)
const FEATURED_SLUGS = new Set([
  'tujhe-dekha-to-ye-jana-sanam',
  'lag-ja-gale',
  'roop-tera-mastana',
  'pal-pal-dil-ke-paas',
  'pehla-nasha-pehla-khumar',
  'kyuki-tum-hi-ho',
]);

const catById = new Map();
for (const c of dump.categories) {
  catById.set(c.id, c);
}

// OEM-verified original studio BPMs & Talas (cross-referenced against Tunebat, SongBPM & original classic recordings — ZERO remixes/alts)
const KNOWN_BPMS = {
  'kal-ho-na-ho-har-ghadi-badal-rahi-hai': { bpm: 82, tala: 'keherwa' },
  'chura-liya-hai-tumne-jo': { bpm: 80, tala: 'keherwa' },
  'ek-pyar-ka-nagma': { bpm: 97, tala: 'keherwa' },
  'mere-mehboob-qayamat-hogi': { bpm: 106, tala: 'keherwa' },
  'hothon-se-chhoo-lo-tum': { bpm: 99, tala: 'dadra' },
  'neele-neele-ambar-par': { bpm: 89, tala: 'keherwa' },
  'tu-mile-dil-khile': { bpm: 88, tala: 'keherwa' },
  'gulabi-ankhen-jo-teri-dekhi': { bpm: 105, tala: 'keherwa' },
  'yeh-sham-mastani': { bpm: 112, tala: 'keherwa' },
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
  'abhi-naa-jao-chhod-kar': { bpm: 104, tala: 'keherwa' },
  'chaudhvin-ka-chand-ho': { bpm: 84, tala: 'keherwa' },
  'tum-itna-jo-muskura-rahe-ho': { bpm: 80, tala: 'keherwa' },
  'jan-gan-man': { bpm: 96, tala: 'keherwa' },
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

/**
 * Case-sensitive musical key detection so words like "for" never falsely match "F".
 */
function detectScaleId(lines, defaultScale = null) {
  const headerBlock = lines.slice(0, 18);
  for (const line of headerBlock) {
    if (!/(flute|scale|pitch|bansuri)/i.test(line)) continue;
    // Match explicit uppercase pitch token like "C#", "G#", "A", "E", "Bb", "F#"
    // (Use negative lookahead instead of \b because '#' is a non-word character!)
    const patterns = [
      /(?:[Ff]lute|[Ss]cale|[Pp]itch|[Bb]ansuri)[^:\n]{0,28}[:=\-]\s*([A-G](?:#|b)?)(?![A-Za-z#b])/,
      /\b[Uu]sed\s+([A-G](?:#|b)?)(?![A-Za-z#b])\s*(?:[Nn]atural|[Ss]harp|[Ff]lat|[Bb]ass|[Mm]edium|[Ss]cale|[Ff]lute)?/,
      /\b([A-G](?:#|b)?)(?![A-Za-z#b])\s*(?:[Nn]atural|[Ss]harp|[Ff]lat|[Bb]ass|[Mm]edium)?\s*(?:[Ff]lute|[Bb]ansuri|[Ss]cale)\b/,
    ];
    for (const rx of patterns) {
      const m = line.match(rx);
      if (m && m[1]) {
        const raw = m[1].toUpperCase();
        if (PITCH_TO_SCALE_ID[raw]) return PITCH_TO_SCALE_ID[raw];
      }
    }
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
  if (
    /^(singer|singers|music|movie|film|lyrics|lyricist|raag|raga|scale|pitch|flute|note|notes|sthayi|mukhda|antara|charanam|pallavi|interlude|prel+ude|repeat|play|click|watch|video|http|based on|signs|symbols|this song|i used|for the|glass|piano|guitar|violin|melodica)/i.test(
      line
    )
  ) {
    return false;
  }
  const cleaned = line
    .replace(/\(\s*[x×]\s*\d+\s*\)/gi, '')
    .replace(/\[\s*\d+\s*\]/g, '')
    .replace(/[\|\s,\.\'’\+\*\~\-\(\)\{\}\[\]…_#\/\^0-9:;!]+/g, '');

  if (cleaned.length < 3) return false;
  const swaraChars = (cleaned.match(/[SRGMPDNrgmdnsp]/g) || []).length;
  const ratio = swaraChars / cleaned.length;
  if (ratio < 0.82) return false;
  if (
    /\b(man|ram|sam|dam|gam|mad|sad|dad|rag|sargam|gana|raga|raaga|sangam|pranam|param|madan|raman|naman|daman|sagar|magar|nagar|pagar|gagan|mard|dard|sard|rang|sang|mang|dang|gang|pang|nang|mand|sand|band|rand|gand)\b/i.test(
      line
    )
  ) {
    return false;
  }
  const upperSwaras = (cleaned.match(/[SRGMPDN]/g) || []).length;
  const hasSymbols = /[\|~,'’\.\{\}\(\)\+]/.test(line);
  return upperSwaras >= 2 || (hasSymbols && swaraChars >= 4);
}

function isLyricLine(line) {
  if (!line || line.length < 2) return false;
  if (isSargamLine(line)) return false;
  if (
    /^(singer|singers|music|movie|film|lyrics|lyricist|raag|raga|scale|pitch|flute|based on|sargam|full sargam|notations|click here|watch|youtube|subscribe|note:|hint:|tip:|disclaimer|tags:|comment|share|repeat|play again|for beginners|i used|when at first|signs and symbols|piano|melodica|guitar|violin|glass|flute interlude|interlude|prel+ude)/i.test(
      line
    )
  ) {
    return false;
  }
  if (line.length > 92) return false;
  if (!/[a-zA-Z]/.test(line)) return false;
  return true;
}

function isSectionHeader(line) {
  return /^(sthayi|mukhda|pallavi|chorus|antara|charanam|verse|interlude|prel+ude|intro|music|anupallavi|glass|piano|guitar|violin|melodica)\s*[\d:.\-]*$/i.test(
    line.trim()
  );
}

function parseSargamSegment(segment, maMode) {
  const tokens = [];
  const seg = segment.replace(/\(\s*[x×]\s*\d+\s*\)/gi, '').trim();
  if (!seg) return tokens;

  let i = 0;
  let pendingMeend = false;
  let pendingKan = null;
  let inMurki = false;

  const mapLetter = (ch, isSharpAfter) => {
    switch (ch) {
      case 'S':
      case 's':
        return 'S';
      case 'r':
        return 'Rk';
      case 'R':
        return 'R';
      case 'g':
        return 'Gk';
      case 'G':
        return 'G';
      case 'm':
        return maMode === 'm-is-tivra' ? 'Mt' : 'M';
      case 'M':
        if (isSharpAfter) return 'Mt';
        return maMode === 'M-is-tivra' ? 'Mt' : 'M';
      case 'P':
      case 'p':
        return 'P';
      case 'd':
        return 'Dk';
      case 'D':
        return 'D';
      case 'n':
        return 'Nk';
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
        const innerTokens = parseSargamSegment(inner, maMode);
        if (innerTokens.length > 0) {
          pendingKan = { swara: innerTokens[0].swara, octave: innerTokens[0].octave };
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

    let isSharp = false;
    while (i < seg.length) {
      const next = seg[i];
      if (next === '#' || next === '^') {
        isSharp = true;
        i++;
      } else if (next === "'" || next === '’' || next === '+' || next === '*') {
        octave = 'taar';
        explicitOctave = true;
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

    const swara = mapLetter(letter, isSharp);
    if (!swara) continue;

    if (octave === 'mandra' && ['S', 'Rk', 'R', 'Gk', 'G', 'M', 'Mt'].includes(swara)) {
      octave = 'madhya';
    }
    if (octave === 'taar' && ['Dk', 'D', 'Nk', 'N'].includes(swara)) {
      octave = 'madhya';
    }

    let ornament = undefined;
    if (pendingMeend && tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      ornament = ['meend', prev.swara, prev.octave];
    } else if (pendingKan) {
      ornament = ['kan', pendingKan.swara, pendingKan.octave];
    } else if (inMurki && !tokens.some((t) => t.ornament && t.ornament[0] === 'gamak')) {
      ornament = ['gamak'];
    }

    tokens.push({ swara, octave, explicitOctave, sustainCount, inMurki, ornament });
    pendingMeend = false;
    pendingKan = null;
  }

  return tokens;
}

function detectMaConvention(fullText, sargamLines, ragaRaw = '') {
  const joined = sargamLines.join(' ');
  const lower = fullText.toLowerCase();
  if (/m[#\^]/i.test(joined)) return 'M-is-shuddha';
  if (/small\s*m\s*=\s*tivra|tivra[^.\n]{0,20}\bm\b/i.test(lower)) return 'm-is-tivra';
  if (/capital\s*m\s*=\s*tivra|small\s*m\s*=\s*shud|tivra[^.\n]{0,20}\bM\b/i.test(lower)) {
    return 'M-is-tivra';
  }
  const hasLowerM = /\bm\b|[\s\|~,\(']m[\s\|~'\)\.]/.test(joined);
  const hasUpperM = /\bM\b|[\s\|~,\(']M[\s\|~'\)\.]/.test(joined);
  if (hasLowerM && hasUpperM) return 'M-is-tivra';
  // Classical Tivra-Ma Raags (Yaman, Kalyan, Marwa, Puriya, Todi, Multani, Madhuvanti, Hameer, Kamod)
  if (
    hasUpperM &&
    !hasLowerM &&
    /\b(yaman|kalyan|marwa|puriya|multani|todi|madhuvanti|hameer|kamod|shuddh\s*kalyan)\b/i.test(ragaRaw)
  ) {
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
    .trim();
  // Clean title-case if entirely lowercase
  if (cleaned === cleaned.toLowerCase()) {
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned;
}

function extractField(lines, regex) {
  for (const l of lines.slice(0, 14)) {
    const m = l.match(regex);
    if (m && m[1]) {
      return m[1].replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();
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

function parsePostToCompactSong(post) {
  const slug = post.slug;
  if (FEATURED_SLUGS.has(slug)) return null;

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

  // Extract embedded YouTube tutorial/rendition ID directly from the post if present
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
  const maMode = detectMaConvention(fullText, sargamLineList, ragaRaw);

  const mir = mirCache[slug];
  // Strictly accept ONLY OEM-verified original studio recordings (zero remixes/alts/mismatches!)
  const mirValid = mir && mir.status === 'ok' && mir.oemVerified === true;
  const explicitScale = detectScaleId(lines, null);
  const mirScale =
    mirValid && mir.key && mir.keyConf >= 0.42 ? PITCH_TO_SCALE_ID[mir.key] || null : null;
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
      // Real original-recording MIR BPM & Meter!
      bpm = mir.bpm;
      tala = textSaysDadra || (mir.conf >= 0.45 && mir.tala === 'dadra') ? 'dadra' : 'keherwa';
      // Intelligent ballad half-time resolution (e.g. Agar Tum Saath Ho 123 -> 62 BPM when spacious)
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
  }
  const beatsPerBar = tala === 'dadra' ? 6 : 8;

  // If the post explicitly has a STHAYI / MUKHDA / PALLAVI header, start cleanly there
  // instead of pulling in prelude guitar/violin/chorus lines!
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

  for (let idx = scanStartIdx; idx < lines.length; idx++) {
    const line = lines[idx];

    if (isSectionHeader(line)) {
      if (/interlude|prel+ude|intro|music|glass|piano|guitar|violin|melodica/i.test(line)) {
        inInterlude = true;
      } else {
        inInterlude = false;
        const secLabel = /antara|charanam|verse/i.test(line)
          ? `Antara${sectionStarts.some((s) => s.name.startsWith('Antara')) ? ' 2' : ''}`
          : 'Mukhda';
        if (rawNotes.length > 0 && !sectionStarts.some((s) => s.name === secLabel)) {
          sectionStarts.push({ name: secLabel, startBeat: Number(cursorBeat.toFixed(2)) });
        }
      }
      continue;
    }

    // Automatically exit interlude if we hit a clean lyric line followed by a sargam line
    if (inInterlude && isLyricLine(line) && idx + 1 < lines.length && isSargamLine(lines[idx + 1])) {
      inInterlude = false;
    }

    if (!isSargamLine(line)) continue;
    if (inInterlude) continue;
    if (rawNotes.length >= 92) break;

    const prevLine = idx > 0 ? lines[idx - 1] : '';
    const lyricLine = isLyricLine(prevLine) ? prevLine : '';

    const sargamCells = line.includes('|')
      ? line
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : [line];
    const lyricCells =
      lyricLine && lyricLine.includes('|')
        ? lyricLine
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean)
        : lyricLine
        ? lyricLine.split(/\s+/).filter(Boolean)
        : [];

    const lineStartIdx = rawNotes.length;
    const phraseQuantum = tala === 'dadra' ? 6 : 4;
    // Snap every vocal line cleanly to a Sam / half-bar boundary so Tabla never drifts off-beat
    const lineStartBeat = Math.round(cursorBeat / phraseQuantum) * phraseQuantum;
    cursorBeat = lineStartBeat;

    const pushParsedGroup = (parsed, word) => {
      const cleanWord = (word || '').replace(/^(glass|piano|guitar|music)\s*:\s*/i, '').trim();
      const baseDur = parsed.length === 1 ? 0.85 : parsed.length === 2 ? 0.5 : 0.35;
      for (let k = 0; k < parsed.length; k++) {
        const tok = parsed[k];
        let dur = tok.inMurki ? 0.25 : baseDur;
        // True proportional melody-sync sustain: honor long dots/dashes (e.g. P... or S----)
        if (tok.sustainCount > 0) {
          dur += Math.min(2.4, tok.sustainCount * 0.35);
        }
        dur = Math.min(3.25, Number(dur.toFixed(3)));

        rawNotes.push({
          swara: tok.swara,
          octave: tok.octave,
          explicitOctave: tok.explicitOctave,
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
      for (let c = 0; c < sargamCells.length; c++) {
        const parsed = parseSargamSegment(sargamCells[c], maMode);
        if (parsed.length === 0) continue;
        pushParsedGroup(parsed, lyricCells[c] || '');
      }
    } else {
      const groups = line.split(/\s+/).filter(Boolean);
      for (let g = 0; g < groups.length; g++) {
        const parsed = parseSargamSegment(groups[g], maMode);
        if (parsed.length === 0) continue;
        const word =
          lyricCells.length > 0 && g < lyricCells.length
            ? lyricCells[g]
            : g === 0 && lyricCells.length > 0
            ? lyricCells.join(' ').slice(0, 18)
            : '';
        pushParsedGroup(parsed, word);
      }
    }

    if (rawNotes.length > lineStartIdx) {
      // Natural vocal phrase-ending vowel elongation before breath pause
      const closingNote = rawNotes[rawNotes.length - 1];
      if (closingNote.durationBeats < 1.25) {
        const extra = Math.min(0.55, closingNote.durationBeats * 0.45);
        closingNote.durationBeats = Number((closingNote.durationBeats + extra).toFixed(3));
        cursorBeat += extra;
      }

      // Bar-locked phrase quantization: stretch/compress vocal line cleanly into a natural
      // multiple of 4 beats (Keherwa) or 6 beats (Dadra) with an authentic breath gap before Sam!
      const rawLineDur = cursorBeat - lineStartBeat;
      const desiredTotal = rawLineDur + 0.55;
      let targetSlot = Math.max(
        phraseQuantum,
        Math.round(desiredTotal / phraseQuantum) * phraseQuantum
      );
      const breathGap = 0.55;
      let playableSpan = targetSlot - breathGap;
      let scale = playableSpan / Math.max(0.5, rawLineDur);

      // Keep pacing natural — avoid compressing long lines too fast or dragging tiny lines
      while (scale < 0.76 && targetSlot < phraseQuantum * 4) {
        targetSlot += phraseQuantum;
        playableSpan = targetSlot - breathGap;
        scale = playableSpan / Math.max(0.5, rawLineDur);
      }
      while (scale > 1.32 && targetSlot > phraseQuantum) {
        targetSlot -= phraseQuantum;
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

      // Clamp last note cleanly so breath pause always resolves before next Sam
      const lastNote = rawNotes[rawNotes.length - 1];
      const maxEnd = lineStartBeat + targetSlot - 0.35;
      if (lastNote.startBeat + lastNote.durationBeats > maxEnd) {
        lastNote.durationBeats = Math.max(0.25, Number((maxEnd - lastNote.startBeat).toFixed(3)));
      }
      lastNote.breathAfter = true;
      cursorBeat = lineStartBeat + targetSlot;
    }
  }

  if (rawNotes.length < 18) return null;

  // Fix omitted octave commas/apostrophes in text sargam for smooth melodic contour!
  resolveOctaveContinuity(rawNotes);

  const totalBeats = Math.ceil(cursorBeat / beatsPerBar) * beatsPerBar;

  const sections = [];
  if (sectionStarts.length > 0 && sectionStarts[0].startBeat > 4) {
    sections.push(['mukhda', 'Mukhda (Sthayi)', 0, sectionStarts[0].startBeat]);
    for (let s = 0; s < sectionStarts.length; s++) {
      const startB = sectionStarts[s].startBeat;
      const endB = s + 1 < sectionStarts.length ? sectionStarts[s + 1].startBeat : totalBeats;
      if (endB - startB >= 4) {
        sections.push([`sec-${s}`, sectionStarts[s].name, startB, endB]);
      }
    }
  } else {
    const mid = Math.floor(totalBeats / 2 / beatsPerBar) * beatsPerBar;
    if (mid >= beatsPerBar && totalBeats - mid >= beatsPerBar) {
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

  // Ultra-compact tuple note format: [swara, octCode, startBeat, dur, lyric, breathFlag(0|1), ornType?, graceSwara?, graceOctCode?]
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
    m: movie.slice(0, 46),
    y: year,
    c: composerRaw.slice(0, 38),
    sg: singerRaw.slice(0, 44),
    e: era,
    d: difficulty,
    sc: scaleId,
    r: ragaRaw.slice(0, 36),
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

for (const post of dump.posts) {
  const s = parsePostToCompactSong(post);
  if (!s || seenSlugs.has(s.id)) continue;
  seenSlugs.add(s.id);
  compactSongs.push(s);
}

// Sort well-known classics first, then alphabetical
compactSongs.sort((a, b) => {
  const ak = KNOWN_BPMS[a.id] ? 1 : 0;
  const bk = KNOWN_BPMS[b.id] ? 1 : 0;
  if (ak !== bk) return bk - ak;
  return a.t.localeCompare(b.t);
});

fs.writeFileSync(OUT_PATH, JSON.stringify(compactSongs), 'utf8');

// Clean up temporary large JSON if present
const oldTmp = path.resolve('src/data/importedSongs.json');
if (fs.existsSync(oldTmp)) fs.unlinkSync(oldTmp);

const sizeKb = Math.round(fs.statSync(OUT_PATH).size / 1024);
console.log(`Built compact public/data/library.json: ${compactSongs.length} additional songs (${sizeKb} KB).`);
for (const s of compactSongs.slice(0, 10)) {
  console.log(`  - ${s.t} (${s.y}) | ${s.e} | ${s.d} | ${s.sc} | ${s.bpm} BPM | ${s.n.length} notes`);
}
