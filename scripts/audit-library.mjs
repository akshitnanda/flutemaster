import fs from 'node:fs';
import path from 'node:path';

const LIB_PATH = path.resolve('public/data/library.json');
const lib = JSON.parse(fs.readFileSync(LIB_PATH, 'utf8'));

const VALID_SWARAS = new Set(['S', 'Rk', 'R', 'Gk', 'G', 'M', 'Mt', 'P', 'Dk', 'D', 'Nk', 'N']);
const SWARA_SEMI = { S: 0, Rk: 1, R: 2, Gk: 3, G: 4, M: 5, Mt: 6, P: 7, Dk: 8, D: 9, Nk: 10, N: 11 };
const LABEL_LEAK_RX =
  /^(trumpet|keyboard|saxophone|violins?|voilins?|yoodling|yodelling|chorus|prelude|interlude|music|guitar|piano|humming)\b|:$/i;

function semi(sw, oct) {
  return (SWARA_SEMI[sw] ?? 0) + (oct === 0 ? -12 : oct === 2 ? 12 : 0);
}

const failures = [];
let overlaps = 0;
let emptySections = 0;
let pastTb = 0;
let labelLeaks = 0;
let meendDesyncs = 0;
let invalidNotes = 0;
let duplicateHashes = 0;

let hugeLeaps = 0;
let capHits = 0;
let clampedSuspects = 0;
const scaleDist = {};
const seenHashes = new Map();

for (const song of lib) {
  scaleDist[song.sc] = (scaleDist[song.sc] || 0) + 1;
  if (song.n.length >= 240) capHits++;

  const melHash = JSON.stringify(song.n.slice(0, 40).map((x) => [x[0], x[1]]));
  if (seenHashes.has(melHash)) {
    duplicateHashes++;
    failures.push(`Duplicate melody hash: ${song.id} matches ${seenHashes.get(melHash)}`);
  } else {
    seenHashes.set(melHash, song.id);
  }

  let prevEnd = -1;
  for (let i = 0; i < song.n.length; i++) {
    const [sw, oct, st, dur, lyr, _br, ornType, graceSw, graceOct] = song.n[i];

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
    if (ornType === 'meend' && i > 0) {
      const [pSw, pOct] = song.n[i - 1];
      if (graceSw !== pSw || graceOct !== pOct) {
        meendDesyncs++;
        failures.push(
          `Meend desync in ${song.id}#${i}: grace=(${graceSw},${graceOct}) != prev=(${pSw},${pOct})`
        );
      }
    }
    if (i > 0) {
      const leap = Math.abs(semi(sw, oct) - semi(song.n[i - 1][0], song.n[i - 1][1]));
      if (leap >= 12) hugeLeaps++;
    }
    prevEnd = st + dur;
  }

  for (const sec of song.sec) {
    const hasNote = song.n.some((n) => n[2] >= sec[2] - 0.001 && n[2] < sec[3] - 0.001);
    if (!hasNote) {
      emptySections++;
      failures.push(`Empty section in ${song.id}: ${sec[0]} (${sec[1]}) [${sec[2]}, ${sec[3]}]`);
    }
  }
}

const byId = new Set(lib.map((s) => s.id));
if (lib.length < 463) {
  failures.push(`Song count ${lib.length} < 463`);
}
if (!byId.has('mere-mehboob-qayamat-hogi')) {
  failures.push('Missing iconic song: mere-mehboob-qayamat-hogi');
}
if (byId.has('aye-dil-mujhe-aisi-jagah-le-chal')) {
  failures.push('Clone song still present: aye-dil-mujhe-aisi-jagah-le-chal');
}

console.log('=== Sargam Library Audit Summary ===');
console.log({
  songCount: lib.length,
  overlaps,
  emptySections,
  pastTb,
  duplicateHashes,
  labelLeaks,
  meendDesyncs,
  invalidNotes,
  hasMereMehboob: byId.has('mere-mehboob-qayamat-hogi'),
  hasBrokenClone: byId.has('aye-dil-mujhe-aisi-jagah-le-chal'),
});
console.log('=== Informational Metrics ===');
console.log({
  leapsGe12Semitones: hugeLeaps,
  songsAt240Cap: capHits,
  outOfRangeSuspects: clampedSuspects,
  scaleDistribution: scaleDist,
});

if (failures.length > 0) {
  console.error(`\nAUDIT FAILED (${failures.length} errors):`);
  for (const f of failures.slice(0, 30)) console.error('  -', f);
  process.exit(1);
}

console.log('\nAUDIT PASSED: All regression checks green.');
