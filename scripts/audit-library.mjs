import fs from 'node:fs';
import path from 'node:path';

const LIB_PATH = path.resolve('public/data/library.json');
const lib = JSON.parse(fs.readFileSync(LIB_PATH, 'utf8'));

const VALID_SWARAS = new Set(['S', 'Rk', 'R', 'Gk', 'G', 'M', 'Mt', 'P', 'Dk', 'D', 'Nk', 'N']);
const SWARA_SEMI = { S: 0, Rk: 1, R: 2, Gk: 3, G: 4, M: 5, Mt: 6, P: 7, Dk: 8, D: 9, Nk: 10, N: 11 };
const LABEL_LEAK_RX =
  /^(trumpet|keyboard|saxophone|violins?|voilins?|yoodling|yodelling|chorus|prelude|interlude|music|guitar|piano|humming)\b|:$/i;
const AD_LEAK_RX =
  /\b(find song lyrics|stream albums|buy guitars|find guitars|take music lessons|learn music theory|see indian cinema|stream hindi hits|stream desi music|bottom of form)\b/i;

function semi(sw, oct) {
  return (SWARA_SEMI[sw] ?? 0) + (oct === 0 ? -12 : oct === 2 ? 12 : 0);
}

const failures = [];
let overlaps = 0;
let emptySections = 0;
let pastTb = 0;
let labelLeaks = 0;
let meendDesyncs = 0;
let selfKans = 0;
let lyricArtifacts = 0;
let genericRagas = 0;
let invalidNotes = 0;
let duplicateHashes = 0;

let hugeLeaps = 0;
let sameLineHugeLeaps = 0;
let capHits = 0;
let clampedSuspects = 0;
let offGridNotes = 0;
let rushedSongs = 0;
const scaleDist = {};
const ragaDist = {};
const seenHashes = new Map();
const byId = new Map();

for (const song of lib) {
  byId.set(song.id, song);
  scaleDist[song.sc] = (scaleDist[song.sc] || 0) + 1;
  ragaDist[song.r] = (ragaDist[song.r] || 0) + 1;
  if (song.r === 'Hindustani Sargam') {
    genericRagas++;
    failures.push(`Generic raga remaining in ${song.id}`);
  }
  if (song.n.length >= 320) capHits++;

  const melHash = JSON.stringify(song.n.slice(0, 40).map((x) => [x[0], x[1]]));
  if (seenHashes.has(melHash)) {
    duplicateHashes++;
    failures.push(`Duplicate melody hash: ${song.id} matches ${seenHashes.get(melHash)}`);
  } else {
    seenHashes.set(melHash, song.id);
  }

  let prevEnd = -1;
  let totalNoteBeats = 0;
  for (let i = 0; i < song.n.length; i++) {
    const [sw, oct, st, dur, lyr, _br, ornType, graceSw, graceOct] = song.n[i];
    totalNoteBeats += dur;

    if (Math.abs(st * 4 - Math.round(st * 4)) > 0.001 || Math.abs(dur * 4 - Math.round(dur * 4)) > 0.001) {
      offGridNotes++;
      if (offGridNotes <= 10) {
        failures.push(`Off-grid note in ${song.id}#${i}: st=${st} dur=${dur}`);
      }
    }

    if (!VALID_SWARAS.has(sw) || (oct !== 0 && oct !== 1 && oct !== 2)) {
      invalidNotes++;
      failures.push(`Invalid note in ${song.id}#${i}: sw=${sw} oct=${oct}`);
    }
    if ((oct === 0 && SWARA_SEMI[sw] < 7) || (oct === 2 && SWARA_SEMI[sw] > 7)) {
      clampedSuspects++;
    }
    if (st < prevEnd - 0.001) {
      overlaps++;
      failures.push(`Overlap in ${song.id}#${i}: start=${st} < prevEnd=${prevEnd.toFixed(3)}`);
    }
    if (st + dur > song.tb + 0.001) {
      pastTb++;
      failures.push(`Note past tb in ${song.id}#${i}: end=${(st + dur).toFixed(3)} > tb=${song.tb}`);
    }
    if (lyr && LABEL_LEAK_RX.test(lyr.trim())) {
      labelLeaks++;
      failures.push(`Leaked label lyric in ${song.id}#${i}: "${lyr}"`);
    }
    if (lyr && (/~~/.test(lyr) || /\(\s*[x×]?\s*\d+\s*\)/.test(lyr))) {
      lyricArtifacts++;
      failures.push(`Lyric artifact in ${song.id}#${i}: "${lyr}"`);
    }
    if (lyr && AD_LEAK_RX.test(lyr)) {
      lyricArtifacts++;
      failures.push(`Ad-text leak in ${song.id}#${i}: "${lyr}"`);
    }
    if (ornType === 'meend' && i > 0) {
      const [pSw, pOct] = song.n[i - 1];
      if (graceSw !== pSw || graceOct !== pOct) {
        meendDesyncs++;
        failures.push(
          `Meend desync in ${song.id}#${i}: grace=(${graceSw},${graceOct}) != prev=(${pSw},${pOct})`
        );
      }
    }
    if (ornType === 'kan' && graceSw === sw && graceOct === oct) {
      selfKans++;
      failures.push(`Self-referential kan in ${song.id}#${i}: (${sw},${oct})`);
    }
    if (i > 0) {
      const leap = Math.abs(semi(sw, oct) - semi(song.n[i - 1][0], song.n[i - 1][1]));
      if (leap >= 12) {
        hugeLeaps++;
        if (song.n[i - 1][5] !== 1) sameLineHugeLeaps++;
      }
    }
    prevEnd = st + dur;
  }

  const avgNoteMs = (totalNoteBeats / Math.max(1, song.n.length)) * (60000 / song.bpm);
  if (avgNoteMs < 240 && song.id !== 'breathless') {
    rushedSongs++;
    failures.push(`Rushed tempo in ${song.id}: bpm=${song.bpm}, avgNoteMs=${Math.round(avgNoteMs)}ms < 240ms`);
  }

  for (const sec of song.sec) {
    const hasNote = song.n.some((n) => n[2] >= sec[2] - 0.001 && n[2] < sec[3] - 0.001);
    if (!hasNote) {
      emptySections++;
      failures.push(`Empty section in ${song.id}: ${sec[0]} (${sec[1]}) [${sec[2]}, ${sec[3]}]`);
    }
  }
}

if (lib.length < 471) {
  failures.push(`Song count ${lib.length} < 471`);
}
if (!byId.has('mere-mehboob-qayamat-hogi')) {
  failures.push('Missing rescued song: mere-mehboob-qayamat-hogi');
}
for (const reqId of [
  'ek-pyar-ka-nagma',
  'ek-ajnabi-haseena-se',
  'mere-hath-mein',
  'sara-pyar-tumhara',
  'theme-tune-of-movie-bombay',
  'tum-paas-aaye',
  'tum-dil-ki-dhadkan-me',
  'tere-liye',
]) {
  const s = byId.get(reqId);
  if (!s || s.n.length < 24) {
    failures.push(`Missing or too short rescued classic ${reqId}: notes=${s?.n.length || 0}`);
  }
}
if (byId.has('aye-dil-mujhe-aisi-jagah-le-chal')) {
  failures.push('Clone song still present: aye-dil-mujhe-aisi-jagah-le-chal');
}

// Golden assertions
const swCount = (s, sw) => (s ? s.n.filter((x) => x[0] === sw).length : -1);
const paal = byId.get('o-paalanhaare');
if (!paal || swCount(paal, 'Rk') !== 0 || swCount(paal, 'Gk') !== 0) {
  failures.push(`Golden check failed on o-paalanhaare: Rk=${swCount(paal, 'Rk')}, Gk=${swCount(paal, 'Gk')}`);
}
const chup = byId.get('dil-ne-kaha-chupke-se');
if (!chup || swCount(chup, 'Gk') !== 0 || chup.y !== 1994) {
  failures.push(`Golden check failed on dil-ne-kaha-chupke-se: Gk=${swCount(chup, 'Gk')} y=${chup?.y}`);
}
const jab = byId.get('jab-koi-baat-bigad-jaaye');
if (!jab || swCount(jab, 'Mt') < 4) {
  failures.push(`Golden check failed on jab-koi-baat-bigad-jaaye: Mt=${swCount(jab, 'Mt')}`);
}
const hoth = byId.get('hothon-se-chhoo-lo-tum');
if (!hoth || swCount(hoth, 'Mt') < 10) {
  failures.push(`Golden check failed on hothon-se-chhoo-lo-tum: Mt=${swCount(hoth, 'Mt')}`);
}
const ek = byId.get('ek-ladki-ko-dekha-to');
if (!ek || swCount(ek, 'Mt') !== 0) {
  failures.push(`Golden check failed on ek-ladki-ko-dekha-to: Mt=${swCount(ek, 'Mt')}`);
}
const gul = byId.get('gulabi-ankhen-jo-teri-dekhi');
if (!gul || swCount(gul, 'Mt') !== 0) {
  failures.push(`Golden check failed on gulabi-ankhen-jo-teri-dekhi: Mt=${swCount(gul, 'Mt')}`);
}
const tere = byId.get('tere-bina-zindagi-se');
if (!tere || tere.sc !== 'D_SHARP_BASS') {
  failures.push(`Golden check failed on tere-bina-zindagi-se: sc=${tere?.sc}`);
}
const hero = byId.get('flute-theme-of-movie-hero');
if (!hero || hero.y !== 1983 || hero.sc !== 'E_BASS') {
  failures.push(`Golden check failed on flute-theme-of-movie-hero: y=${hero?.y} sc=${hero?.sc}`);
}
const tumile = byId.get('tu-mile-dil-khile');
if (!tumile || swCount(tumile, 'Nk') < 5) {
  failures.push(`Golden check failed on tu-mile-dil-khile: Nk=${swCount(tumile, 'Nk')}`);
}
const dils = byId.get('dil-smbhal-ja-zara');
if (!dils || swCount(dils, 'Gk') < 5 || swCount(dils, 'Nk') < 5) {
  failures.push(`Golden check failed on dil-smbhal-ja-zara: Gk=${swCount(dils, 'Gk')} Nk=${swCount(dils, 'Nk')}`);
}
const jiyad = byId.get('tujhe-dekh-dekh-sona');
const jiyadTaarS = jiyad ? jiyad.n.filter((x) => x[0] === 'S' && x[1] === 2).length : 0;
if (!jiyad || jiyadTaarS < 4) {
  failures.push(`Golden check failed on tujhe-dekh-dekh-sona: taarS=${jiyadTaarS}`);
}
const ekPyar = byId.get('ek-pyar-ka-nagma');
if (!ekPyar || swCount(ekPyar, 'M') < 10 || swCount(ekPyar, 'Nk') < 3 || ekPyar.sc !== 'C_SHARP_MEDIUM') {
  failures.push(
    `Golden check failed on ek-pyar-ka-nagma: M=${swCount(ekPyar, 'M')} Nk=${swCount(ekPyar, 'Nk')} sc=${ekPyar?.sc}`
  );
}
const tpa = byId.get('tum-paas-aaye');
const tpaMandraP = tpa ? tpa.n.filter((x) => x[0] === 'P' && x[1] === 0).length : 0;
const tpaMandraN = tpa ? tpa.n.filter((x) => x[0] === 'N' && x[1] === 0).length : 0;
if (!tpa || tpaMandraP < 2 || tpaMandraN < 2 || tpa.sc !== 'G_BASS') {
  failures.push(`Golden check failed on tum-paas-aaye: ,P=${tpaMandraP} ,N=${tpaMandraN} sc=${tpa?.sc}`);
}
const mereHath = byId.get('mere-hath-mein');
if (!mereHath || mereHath.sc !== 'A_MEDIUM' || mereHath.n.some((x) => /khwabo/i.test(x[4] || ''))) {
  failures.push(`Golden check failed on mere-hath-mein: sc=${mereHath?.sc}`);
}
const roz = byId.get('roz-roz-ankhon-tale');
if (!roz || roz.sc !== 'C_SHARP_MEDIUM') {
  failures.push(`Golden check failed on roz-roz-ankhon-tale: sc=${roz?.sc}`);
}
const zindagi = byId.get('zindagi-ka-safar');
if (!zindagi || zindagi.r !== 'Yaman Kalyan') {
  failures.push(`Golden check failed on zindagi-ka-safar: r=${zindagi?.r}`);
}
const bombay = byId.get('theme-tune-of-movie-bombay');
if (!bombay || bombay.r !== 'Kafi') {
  failures.push(`Golden check failed on theme-tune-of-movie-bombay: r=${bombay?.r}`);
}
const sara = byId.get('sara-pyar-tumhara');
if (!sara || sara.r !== 'Khamaj / Bilawal') {
  failures.push(`Golden check failed on sara-pyar-tumhara: r=${sara?.r}`);
}
const naja = byId.get('na-ja-kahin-ab-na-ja');
if (!naja || naja.n.length > 100) {
  failures.push(`Golden check failed on na-ja-kahin-ab-na-ja: dual version leaked (${naja?.n.length} notes)`);
}
for (const [id, expBpm] of [
  ['ranjish-hi-sahi', 66],
  ['hawayein-le-jaye-jane-kaha', 94],
  ['sanam-re-sanam-re', 74],
  ['dil-diyan-gallan', 84],
  ['o-re-majhi-mere-sajan-hai-us-par', 66],
  ['suno-na-sange-marmar-ki', 72],
]) {
  const s = byId.get(id);
  if (!s || s.bpm !== expBpm) {
    failures.push(`Golden BPM check failed on ${id}: expected=${expBpm}, got=${s?.bpm}`);
  }
}
const rawSargamLyricRx = /^[SRGMPDNrgmdn\s.,…'’|~{}()\-0-9#^\[\]×x]+$/;
let sargamAsLyric = 0;
for (const song of lib) {
  for (let i = 0; i < song.n.length; i++) {
    const lyr = song.n[i][4];
    if (lyr && rawSargamLyricRx.test(lyr.trim()) && /[SRGMPDN]{2,}|[SRGMPDN]['’.,~]/.test(lyr)) {
      sargamAsLyric++;
      failures.push(`Raw sargam as lyric in ${song.id}#${i}: "${lyr}"`);
    }
  }
}

console.log('=== Sargam Library v2.0 Audit Summary ===');
console.log({
  songCount: lib.length,
  overlaps,
  emptySections,
  pastTb,
  duplicateHashes,
  labelLeaks,
  lyricArtifacts,
  selfKans,
  genericRagas,
  meendDesyncs,
  invalidNotes,
  offGridNotes,
  rushedSongs,
  outOfRangeSuspects: clampedSuspects,
});
console.log('=== Informational Metrics ===');
console.log({
  leapsGe12Semitones: hugeLeaps,
  sameLineLeapsGe12: sameLineHugeLeaps,
  songsAt320Cap: capHits,
  scaleDistribution: scaleDist,
  topRagas: Object.entries(ragaDist).sort((a, b) => b[1] - a[1]).slice(0, 12),
});

if (failures.length > 0) {
  console.error(`\nAUDIT FAILED (${failures.length} errors):`);
  for (const f of failures.slice(0, 30)) console.error('  -', f);
  process.exit(1);
}

console.log('\nAUDIT PASSED: All v2.0 regression & golden checks green.');
