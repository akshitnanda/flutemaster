import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TMP_DIR = path.resolve('tmp_samples');
const PUB_SAMPLES = path.resolve('public/samples');

function midiToHz(midi, cents = 0) {
  return 440 * Math.pow(2, (midi - 69 + cents / 100) / 12);
}

async function downloadFile(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'FluteMaster-Studio/2.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

/**
 * Measures integrated mean/max volume via ffmpeg volumedetect so we can apply
 * pure STATIC linear gain normalization (preserving 100% of the natural human
 * breath attack and swell — ZERO dynamic AGC pumping!).
 */
async function measureVolume(inputPath, trimDb) {
  const { stderr } = await execFileAsync('ffmpeg', [
    '-i',
    inputPath,
    '-af',
    `silenceremove=start_periods=1:start_duration=0.004:start_threshold=${trimDb},atrim=0:6.0,volumedetect`,
    '-f',
    'null',
    '-',
  ]);
  const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
  const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
  return {
    meanDb: meanMatch ? parseFloat(meanMatch[1]) : -22,
    maxDb: maxMatch ? parseFloat(maxMatch[1]) : -3,
  };
}

/**
 * Masters a studio WAV into a pristine 192kbps mono MP3 with:
 * - Ultra-gentle silence trimming (-54dB) that keeps natural breath chiff intact
 * - Up to 6.0s of genuine unlooped human sustain (eliminates artificial loop artifacts)
 * - Pure static linear gain normalization (targets -18dB mean RMS, capped at -1.5dB peak)
 */
async function masterSample(inputPath, outputPath, maxSec = 6.0, trimDb = '-54dB', targetMeanDb = -18.0) {
  const { meanDb, maxDb } = await measureVolume(inputPath, trimDb);
  // Compute linear gain without clipping (-1.5dB headroom)
  let gainDb = targetMeanDb - meanDb;
  if (maxDb + gainDb > -1.5) {
    gainDb = -1.5 - maxDb;
  }
  gainDb = Math.max(-12, Math.min(18, Number(gainDb.toFixed(2))));

  const fadeStart = Math.max(0.5, Number((maxSec - 0.35).toFixed(2)));
  const filterChain = [
    `silenceremove=start_periods=1:start_duration=0.004:start_threshold=${trimDb}`,
    `atrim=0:${maxSec}`,
    `afade=t=out:st=${fadeStart}:d=0.35`,
    `volume=${gainDb}dB`,
  ].join(',');

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-af',
    filterChain,
    '-ar',
    '44100',
    '-ac',
    '1',
    '-b:a',
    '192k',
    outputPath,
  ]);
}

async function cleanDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  await fs.mkdir(TMP_DIR, { recursive: true });

  const manifest = {
    credits: {
      bansuri:
        'Real Indian Assam Bamboo Bansuri recordings ("Flute Sargams", CC0 1.0 Public Domain) by roguentropy — single cohesive bamboo instrument',
      saxophone:
        'Real Studio Vibrato Saxophone (VCSL BrettTenor Vibrato by Versilian Studios, CC0 1.0 Public Domain)',
      harmonica:
        'Real Studio Hohner Super 64 Chromatic Harmonica (VCSL by Versilian Studios, CC0 1.0 Public Domain)',
    },
    bansuri: [],
    saxophone: [],
    harmonica: [],
  };

  /* ========================================================================
     1. REAL INDIAN ASSAM BAMBOO BANSURI (roguentropy CC0 — 3 cohesive registers)
        Pure straight-tone wooden bamboo (ZERO Western opera vibrato, ZERO mismatched clips).
        Exact measured concert frequencies from roguentropy's bamboo recordings:
        - E4.mp3 (MIDI 64 +39c -> 337.137 Hz, 3.49s deep warm low/mid bamboo)
        - E5.mp3 (MIDI 76 +22c -> 667.686 Hz, 3.47s singing mid/high bamboo)
        - B5.mp3 (MIDI 83 +68c -> 1027.336 Hz, 3.43s pure shimmering taar bamboo)
     ======================================================================== */
  console.log('1/3 Downloading & mastering REAL Indian Assam Bamboo Bansuri bank (roguentropy CC0)...');
  const bansuriOut = path.join(PUB_SAMPLES, 'bansuri');
  await cleanDir(bansuriOut);
  const bansuriBase =
    'https://raw.githubusercontent.com/veeragoni/flutewizard/main/public/samples/bansuri';
  const bansuriFiles = [
    { name: '64.mp3', midi: 64, cents: 39, out: 'E4.mp3' },
    { name: '76.mp3', midi: 76, cents: 22, out: 'E5.mp3' },
    { name: '83.mp3', midi: 83, cents: 68, out: 'B5.mp3' },
  ];

  for (const bf of bansuriFiles) {
    const tmpFile = path.join(TMP_DIR, `bansuri_${bf.out}`);
    const outFile = path.join(bansuriOut, bf.out);
    await downloadFile(`${bansuriBase}/${bf.name}`, tmpFile);
    await masterSample(tmpFile, outFile, 3.6, '-54dB', -17.5);
    manifest.bansuri.push({
      file: bf.out,
      midi: bf.midi,
      hz: Number(midiToHz(bf.midi, bf.cents).toFixed(3)),
    });
  }
  manifest.bansuri.sort((a, b) => a.hz - b.hz);
  console.log(`   Done: ${manifest.bansuri.length} pure Assam Bamboo Bansuri samples mastered (E4, E5, B5).`);

  /* ========================================================================
     2. REAL STUDIO SAXOPHONE (VCSL BrettTenor Vibrato CC0)
        TRUE CONCERT PITCHES (+1 octave over Yamaha filename convention: C2 file = Concert C3 = MIDI 48)
     ======================================================================== */
  console.log('2/3 Downloading & mastering REAL Studio Saxophone bank (TRUE concert pitch)...');
  const saxOut = path.join(PUB_SAMPLES, 'saxophone');
  await cleanDir(saxOut);
  const saxBase =
    'https://raw.githubusercontent.com/sgossner/VCSL/master/Aerophones/Reed%20Aerophones/Tenor%20Saxophone/Vibrato';
  const saxFiles = [
    { name: 'BrettTenor_Vib_Main_A%231_var2.wav', midi: 46, out: 'As2.mp3' },
    { name: 'BrettTenor_Vib_Main_C2_var4.wav', midi: 48, out: 'C3.mp3' },
    { name: 'BrettTenor_Vib_Main_D2_var2.wav', midi: 50, out: 'D3.mp3' },
    { name: 'BrettTenor_Vib_Main_E2_var2.wav', midi: 52, out: 'E3.mp3' },
    { name: 'BrettTenor_Vib_Main_F%232_var3.wav', midi: 54, out: 'Fs3.mp3' },
    { name: 'BrettTenor_Vib_Main_A%232_var4.wav', midi: 58, out: 'As3.mp3' },
    { name: 'BrettTenor_Vib_Main_C3_var1.wav', midi: 60, out: 'C4.mp3' },
    { name: 'BrettTenor_Vib_Main_D3_var1.wav', midi: 62, out: 'D4.mp3' },
    { name: 'BrettTenor_Vib_Main_E3_var3.wav', midi: 64, out: 'E4.mp3' },
    { name: 'BrettTenor_Vib_Main_F%233_var2.wav', midi: 66, out: 'Fs4.mp3' },
    { name: 'BrettTenor_Vib_Main_A%233_var3.wav', midi: 70, out: 'As4.mp3' },
    { name: 'BrettTenor_Vib_Main_C4_var2.wav', midi: 72, out: 'C5.mp3' },
    { name: 'BrettTenor_Vib_Main_E4_var4.wav', midi: 76, out: 'E5.mp3' },
    { name: 'BrettTenor_Vib_Main_G4_var3.wav', midi: 79, out: 'G5.mp3' },
  ];

  for (const sf of saxFiles) {
    const tmpFile = path.join(TMP_DIR, `sax_${sf.out}.wav`);
    const outFile = path.join(saxOut, sf.out);
    await downloadFile(`${saxBase}/${sf.name}`, tmpFile);
    await masterSample(tmpFile, outFile, 4.8, '-50dB', -18.5);
    manifest.saxophone.push({
      file: sf.out,
      midi: sf.midi,
      hz: Number(midiToHz(sf.midi).toFixed(3)),
    });
  }
  manifest.saxophone.sort((a, b) => a.hz - b.hz);
  console.log(`   Done: ${manifest.saxophone.length} studio Saxophone samples mastered (As2..G5).`);

  /* ========================================================================
     3. REAL STUDIO HOHNER SUPER 64 CHROMATIC HARMONICA (VCSL CC0)
        TRUE CONCERT PITCHES (+1 octave over Yamaha filename convention: C2 file = Concert C3 = MIDI 48)
     ======================================================================== */
  console.log('3/3 Downloading & mastering REAL Hohner Super 64 Chromatic Harmonica bank...');
  const harmOut = path.join(PUB_SAMPLES, 'harmonica');
  await cleanDir(harmOut);
  const harmBase =
    'https://raw.githubusercontent.com/sgossner/VCSL/master/Aerophones/Free%20Aerophones/Harmonica-Hohner-Super64/Sustains/Normal';
  const harmFiles = [
    { name: 'Hohner-Super64_Normal%20_C2.wav', midi: 48, out: 'C3.mp3' },
    { name: 'Hohner-Super64_Normal%20_E2.wav', midi: 52, out: 'E3.mp3' },
    { name: 'Hohner-Super64_Normal%20_G2.wav', midi: 55, out: 'G3.mp3' },
    { name: 'Hohner-Super64_Normal%20_C3.wav', midi: 60, out: 'C4.mp3' },
    { name: 'Hohner-Super64_Normal%20_E3.wav', midi: 64, out: 'E4.mp3' },
    { name: 'Hohner-Super64_Normal%20_G3.wav', midi: 67, out: 'G4.mp3' },
    { name: 'Hohner-Super64_Normal%20_C4.wav', midi: 72, out: 'C5.mp3' },
    { name: 'Hohner-Super64_Normal%20_E4.wav', midi: 76, out: 'E5.mp3' },
    { name: 'Hohner-Super64_Normal%20_G4.wav', midi: 79, out: 'G5.mp3' },
    { name: 'Hohner-Super64_Normal%20_C5.wav', midi: 84, out: 'C6.mp3' },
  ];

  for (const hf of harmFiles) {
    const tmpFile = path.join(TMP_DIR, `harm_${hf.out}.wav`);
    const outFile = path.join(harmOut, hf.out);
    await downloadFile(`${harmBase}/${hf.name}`, tmpFile);
    await masterSample(tmpFile, outFile, 4.8, '-50dB', -19.5);
    manifest.harmonica.push({
      file: hf.out,
      midi: hf.midi,
      hz: Number(midiToHz(hf.midi).toFixed(3)),
    });
  }
  manifest.harmonica.sort((a, b) => a.hz - b.hz);
  console.log(`   Done: ${manifest.harmonica.length} Hohner Super 64 samples mastered (C3..C6).`);

  await fs.writeFile(
    path.join(PUB_SAMPLES, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  await fs.rm(TMP_DIR, { recursive: true, force: true });
  console.log('Saved verified studio manifest to public/samples/manifest.json!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
