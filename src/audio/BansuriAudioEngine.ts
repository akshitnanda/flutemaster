import * as Tone from 'tone';
import {
  AudioMutes,
  AudioVolumes,
  EwiSettings,
  InstrumentType,
  Octave,
  Song,
  SongNote,
  SwaraId,
} from '../types/music';
import { getFrequencyHz, SWARA_META } from '../data/sargam';
import { getHarmonicaTab } from '../data/instruments';
import { DEFAULT_EWI_SETTINGS } from '../data/ewi';

/**
 * Studio Multi-Sampled Acoustic Wind Audio Engine for FluteMaster Wind Studio.
 *
 * Uses 27 YIN-pitch-verified, statically loudness-normalized studio recordings from /public/samples/manifest.json:
 * - Bansuri: 3 cohesive CC0 Real Indian Assam Bamboo Bansuri registers (roguentropy: E4, E5, B5)
 *   driven by a TRUE MONOPHONIC SINGLE-BREATH engine — one continuous bamboo air column per phrase
 *   with liquid Meend pitch glides, crisp finger-hole transitions, repeated-note finger taps,
 *   straight-tone Indian purity (zero Western opera vibrato), and lush studio hall reverb!
 * - Saxophone: 14 true-concert-pitch CC0 Studio Vibrato Saxophone recordings (VCSL BrettTenor, A#2..G5)
 * - Mouth Organ: 10 true-concert-pitch CC0 Studio Hohner Super 64 Chromatic Harmonica recordings (C3..C6)
 *
 * All pitch modulation uses AudioBufferSourceNode.playbackRate directly for full Tone.js compatibility.
 */

interface ManifestEntry {
  file: string;
  midi: number;
  hz: number;
}

interface SamplesManifest {
  bansuri: ManifestEntry[];
  saxophone: ManifestEntry[];
  harmonica: ManifestEntry[];
}

interface DecodedSample {
  file: string;
  midi: number;
  hz: number;
  buffer: AudioBuffer;
}

type SampleBankKey = 'bansuri' | 'saxophone' | 'harmonica';

interface MonoBansuriVoice {
  src: AudioBufferSourceNode;
  envGain: GainNode;
  gamakOsc: OscillatorNode;
  gamakGain: GainNode;
  sampleHz: number;
  currentRate: number;
  startedAt: number;
  maxEndAt: number;
  cleanupTimer: number | null;
}

interface MonoEwiVoice {
  oscMain: OscillatorNode;
  oscHarm: OscillatorNode;
  oscSub: OscillatorNode;
  breathFilter: BiquadFilterNode;
  envGain: GainNode;
  vibOsc: OscillatorNode;
  vibMainGain: GainNode;
  vibHarmGain: GainNode;
  currentHz: number;
  cleanupTimer: number | null;
}

class BansuriAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private leadBus: GainNode | null = null;
  private bansuriToneInput: AudioNode | null = null;
  private bansuriReverbSend: GainNode | null = null;
  private ewiToneInput: GainNode | null = null;
  private ewiReverbSend: GainNode | null = null;
  private tanpuraBus: GainNode | null = null;
  private tablaBus: GainNode | null = null;
  private reverbSend: ConvolverNode | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;

  private manifest: SamplesManifest | null = null;
  private manifestPromise: Promise<SamplesManifest | null> | null = null;

  private sampleBanks: Record<SampleBankKey, DecodedSample[]> = {
    bansuri: [],
    saxophone: [],
    harmonica: [],
  };
  private bankPromises: Partial<Record<SampleBankKey, Promise<void>>> = {};

  private volumes: AudioVolumes = { flute: 0.85, tanpura: 0.45, tabla: 0.5 };
  private mutes: AudioMutes = { flute: false, tanpura: false, tabla: false };
  private ewiSettings: EwiSettings = { ...DEFAULT_EWI_SETTINGS };

  // Tanpura state
  private tanpuraRunning = false;
  private tanpuraTimer: number | null = null;
  private tanpuraStringIdx = 0;
  private currentScaleHz = 392.0;
  private currentDroneSwara: SwaraId | undefined = undefined;

  // True monophonic single-breath Bansuri & EWI voices + general voice cleanup
  private monoBansuri: MonoBansuriVoice | null = null;
  private monoEwi: MonoEwiVoice | null = null;
  private activeVoiceStop: ((fadeSec?: number) => void) | null = null;
  private lastNoteEndTime = 0;
  private lastInstrument: InstrumentType = 'bansuri';
  private lastPlayedHz = 0;

  private toSampleBankKey(inst: InstrumentType): SampleBankKey {
    if (inst === 'ewi') {
      if (this.ewiSettings.voice === 'saxophone') return 'saxophone';
      if (this.ewiSettings.voice === 'harmonica') return 'harmonica';
      return 'bansuri';
    }
    return inst;
  }

  public setEwiSettings(settings: EwiSettings) {
    this.ewiSettings = { ...settings };
    if (this.ctx && this.ewiReverbSend) {
      const leadLevel = this.mutes.flute ? 0 : this.volumes.flute;
      const revNorm = Math.max(0, Math.min(30, settings.reverbLevel)) / 30;
      this.ewiReverbSend.gain.setTargetAtTime(leadLevel * revNorm * 0.72, this.ctx.currentTime, 0.05);
    }
  }

  public async ensureStarted(activeInstrument: InstrumentType = 'bansuri'): Promise<AudioContext> {
    await Tone.start();
    if (!this.ctx) {
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      this.ctx = rawCtx;
      this.setupBuses(rawCtx);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    await this.loadManifest();
    await this.loadBank(this.toSampleBankKey(activeInstrument));

    // Preload the other two studio banks silently in background for instant switching
    (['bansuri', 'saxophone', 'harmonica'] as SampleBankKey[]).forEach((inst) => {
      if (!this.bankPromises[inst]) {
        this.loadBank(inst).catch(() => {});
      }
    });

    return this.ctx;
  }

  private async loadManifest(): Promise<SamplesManifest | null> {
    if (this.manifest) return this.manifest;
    if (this.manifestPromise) return this.manifestPromise;

    this.manifestPromise = (async () => {
      try {
        const resp = await fetch('/samples/manifest.json');
        if (!resp.ok) return null;
        this.manifest = (await resp.json()) as SamplesManifest;
        return this.manifest;
      } catch {
        return null;
      }
    })();

    return this.manifestPromise;
  }

  private loadBank(instrument: SampleBankKey): Promise<void> {
    if (this.bankPromises[instrument]) return this.bankPromises[instrument]!;
    if (!this.ctx) return Promise.resolve();
    const ctx = this.ctx;

    const promise = (async () => {
      const manifest = await this.loadManifest();
      const entries = manifest?.[instrument] ?? [];
      if (entries.length === 0) return;

      // Bansuri uses ONE continuous voice per breath phrase -> extend phase-locked to 16s so long
      // Bollywood phrases at 0.5x slow practice NEVER run out of air!
      const targetDur = instrument === 'bansuri' ? 16.0 : 6.0;

      const decoded: DecodedSample[] = [];
      await Promise.all(
        entries.map(async (entry) => {
          try {
            const resp = await fetch(`/samples/${instrument}/${entry.file}`);
            if (!resp.ok) return;
            const arr = await resp.arrayBuffer();
            const rawAudioBuf = await ctx.decodeAudioData(arr.slice(0));
            const audioBuf =
              rawAudioBuf.duration >= targetDur
                ? rawAudioBuf
                : this.extendBufferPhaseLocked(ctx, rawAudioBuf, entry.hz, targetDur);
            decoded.push({
              file: entry.file,
              midi: entry.midi,
              hz: entry.hz,
              buffer: audioBuf,
            });
          } catch {
            // Skip individual broken file gracefully
          }
        })
      );
      decoded.sort((a, b) => a.hz - b.hz);
      this.sampleBanks[instrument] = decoded;
    })();

    this.bankPromises[instrument] = promise;
    return promise;
  }

  /**
   * Fundamental-period phase-locked Hann crossfade extender: preserves 100% of the authentic
   * studio embouchure breath attack while producing a seamless, click-free, zero-dip air column.
   */
  private extendBufferPhaseLocked(
    ctx: AudioContext,
    src: AudioBuffer,
    fundamentalHz: number,
    minDurationSec = 16.0
  ): AudioBuffer {
    if (src.duration >= minDurationSec) return src;

    const sr = src.sampleRate;
    const N = src.length;
    const chCount = src.numberOfChannels;
    if (N < Math.floor(sr * 0.45)) return src;

    const ch0 = src.getChannelData(0);
    const endIdx = Math.floor(N * 0.78);
    const startMin = Math.floor(N * 0.24);
    const period = sr / Math.max(80, Math.min(2000, fundamentalHz));
    const roughLen = Math.floor((endIdx - startMin) * 0.8);
    const centerLen = Math.round(roughLen / period) * period;
    const searchRadius = Math.max(10, Math.ceil(period * 1.15));
    const corrWin = Math.min(768, Math.max(128, Math.floor(period * 3)));

    let bestL = Math.round(centerLen);
    let bestErr = Number.POSITIVE_INFINITY;

    const minL = Math.max(Math.floor(period * 4), Math.floor(sr * 0.16));
    const maxL = endIdx - startMin - corrWin - 4;
    if (maxL <= minL) return src;

    const lo = Math.max(minL, Math.round(centerLen - searchRadius));
    const hi = Math.min(maxL, Math.round(centerLen + searchRadius));

    for (let L = lo; L <= hi; L++) {
      let err = 0;
      const aBase = endIdx - corrWin;
      const bBase = endIdx - L - corrWin;
      for (let k = 0; k < corrWin; k += 2) {
        const diff = ch0[aBase + k] - ch0[bBase + k];
        err += diff * diff;
      }
      if (err < bestErr) {
        bestErr = err;
        bestL = L;
      }
    }

    const fadeLen = Math.min(Math.floor(sr * 0.14), Math.floor(bestL * 0.38));
    const loopOrigin = endIdx - bestL;
    if (loopOrigin - fadeLen < startMin * 0.5 || fadeLen < 64) return src;

    const tailLen = N - endIdx;
    const targetSamples = Math.ceil(minDurationSec * sr);
    const outBuf = ctx.createBuffer(chCount, targetSamples, sr);
    const bodyLen = endIdx - fadeLen - loopOrigin;
    const stopLoopBefore = targetSamples - tailLen;

    for (let ch = 0; ch < chCount; ch++) {
      const input = src.getChannelData(ch);
      const output = outBuf.getChannelData(ch);

      const initialLen = Math.min(endIdx - fadeLen, targetSamples);
      output.set(input.subarray(0, initialLen), 0);
      let writePos = initialLen;

      while (writePos < stopLoopBefore) {
        const xfCount = Math.min(fadeLen, stopLoopBefore - writePos);
        for (let j = 0; j < xfCount; j++) {
          const w = 0.5 * (1 - Math.cos((Math.PI * j) / fadeLen));
          const a = input[endIdx - fadeLen + j];
          const b = input[loopOrigin - fadeLen + j];
          output[writePos++] = a * (1 - w) + b * w;
        }
        if (writePos >= stopLoopBefore) break;

        const copyCount = Math.min(bodyLen, stopLoopBefore - writePos);
        if (copyCount > 0) {
          output.set(input.subarray(loopOrigin, loopOrigin + copyCount), writePos);
          writePos += copyCount;
        }
      }

      const rem = targetSamples - writePos;
      if (rem > 0) {
        const decayCopy = Math.min(rem, tailLen);
        const tailBlend = Math.min(Math.floor(sr * 0.04), decayCopy);
        for (let j = 0; j < decayCopy; j++) {
          const tailSample = input[endIdx + j];
          if (j < tailBlend) {
            const w = j / tailBlend;
            const prevSrcIdx = Math.min(N - 1, loopOrigin + j);
            output[writePos + j] = input[prevSrcIdx] * (1 - w) + tailSample * w;
          } else {
            output[writePos + j] = tailSample;
          }
        }
      }
    }

    return outBuf;
  }

  private getNearestSample(instrument: SampleBankKey, targetHz: number): DecodedSample | null {
    const list = this.sampleBanks[instrument];
    if (!list || list.length === 0) return null;
    let best = list[0];
    let bestDist = Math.abs(Math.log2(targetHz / best.hz));
    for (let i = 1; i < list.length; i++) {
      const dist = Math.abs(Math.log2(targetHz / list[i].hz));
      if (dist < bestDist) {
        best = list[i];
        bestDist = dist;
      }
    }
    return best;
  }

  private setupBuses(ctx: AudioContext) {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.96;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 18;
    compressor.ratio.value = 2.2;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.2;

    this.leadBus = ctx.createGain();
    this.tanpuraBus = ctx.createGain();
    this.tablaBus = ctx.createGain();

    // Warm Indian Assam-Bamboo Bansuri Studio Acoustic Strip:
    // Deepens the hollow wooden tube resonance and lifts the velvety bamboo air whisper
    const bambooWarmth = ctx.createBiquadFilter();
    bambooWarmth.type = 'peaking';
    bambooWarmth.frequency.value = 380;
    bambooWarmth.Q.value = 0.9;
    bambooWarmth.gain.value = 2.4;

    const bambooAir = ctx.createBiquadFilter();
    bambooAir.type = 'peaking';
    bambooAir.frequency.value = 4500;
    bambooAir.Q.value = 0.9;
    bambooAir.gain.value = 2.4;

    const bambooTopRoll = ctx.createBiquadFilter();
    bambooTopRoll.type = 'lowpass';
    bambooTopRoll.frequency.value = 7000;

    bambooWarmth.connect(bambooAir);
    bambooAir.connect(bambooTopRoll);
    bambooTopRoll.connect(this.leadBus);
    this.bansuriToneInput = bambooWarmth;

    // Lush concert-hall stereo reverb inspired by Rajesh Cherthala's acoustic Bansuri recordings
    this.reverbSend = this.createStudioReverb(ctx, 2.85, 2.2);
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.36;

    const reverbLP = ctx.createBiquadFilter();
    reverbLP.type = 'lowpass';
    reverbLP.frequency.value = 4100;

    // Dedicated warm hall send for the Bansuri lead
    this.bansuriReverbSend = ctx.createGain();
    this.bansuriReverbSend.gain.value = 0.48;
    bambooTopRoll.connect(this.bansuriReverbSend);
    this.bansuriReverbSend.connect(this.reverbSend);

    // Dedicated Eastar EDA-100 EWI Studio Bus (with user-controllable 0-30 Reverb send!)
    this.ewiToneInput = ctx.createGain();
    this.ewiToneInput.gain.value = 1.0;
    this.ewiToneInput.connect(this.leadBus);
    this.ewiReverbSend = ctx.createGain();
    this.ewiReverbSend.gain.value = (this.ewiSettings.reverbLevel / 30) * 0.65;
    this.ewiToneInput.connect(this.ewiReverbSend);
    this.ewiReverbSend.connect(this.reverbSend);

    this.leadBus.connect(compressor);
    this.leadBus.connect(this.reverbSend);

    this.tanpuraBus.connect(compressor);
    this.tanpuraBus.connect(this.reverbSend);

    this.tablaBus.connect(compressor);

    this.reverbSend.connect(reverbLP);
    reverbLP.connect(reverbWet);
    reverbWet.connect(compressor);

    compressor.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    this.whiteNoiseBuffer = this.createWhiteNoiseBuffer(ctx, 0.6);
    this.applyVolumes();
  }

  private createStudioReverb(ctx: AudioContext, seconds: number, decay: number): ConvolverNode {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    const preDelay = Math.floor(ctx.sampleRate * 0.022);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = preDelay; i < length; i++) {
        const t = (i - preDelay) / (length - preDelay);
        const env = Math.pow(1 - t, decay);
        data[i] = (Math.random() * 2 - 1) * env * 0.45;
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  private createWhiteNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.8;
    }
    return buffer;
  }

  public setVolumes(volumes: AudioVolumes, mutes: AudioMutes) {
    this.volumes = volumes;
    this.mutes = mutes;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx || !this.leadBus || !this.tanpuraBus || !this.tablaBus) return;
    const now = this.ctx.currentTime;
    const leadLevel = this.mutes.flute ? 0 : this.volumes.flute * 1.08;
    this.leadBus.gain.setTargetAtTime(leadLevel, now, 0.04);
    if (this.bansuriReverbSend) {
      this.bansuriReverbSend.gain.setTargetAtTime(leadLevel * 0.44, now, 0.04);
    }
    if (this.ewiReverbSend) {
      const revNorm = Math.max(0, Math.min(30, this.ewiSettings.reverbLevel)) / 30;
      this.ewiReverbSend.gain.setTargetAtTime(leadLevel * revNorm * 0.68, now, 0.05);
    }
    this.tanpuraBus.gain.setTargetAtTime(
      this.mutes.tanpura ? 0 : this.volumes.tanpura * 0.22,
      now,
      0.08
    );
    this.tablaBus.gain.setTargetAtTime(this.mutes.tabla ? 0 : this.volumes.tabla * 0.45, now, 0.04);
  }

  public setScaleHz(scaleRootHz: number, droneSwara?: SwaraId) {
    this.currentScaleHz = scaleRootHz;
    this.currentDroneSwara = droneSwara;
  }

  /* ========================================================================
     1. TRUE MONOPHONIC SINGLE-BREATH WIND PLAYBACK ENGINE
     ======================================================================== */
  public playLeadNote(
    note: SongNote,
    scaleRootHz: number,
    durationSec: number,
    instrument: InstrumentType,
    prevNote?: SongNote | null
  ) {
    if (!this.ctx || !this.leadBus) return;
    if (this.mutes.flute || this.volumes.flute <= 0.001) return;

    const now = this.ctx.currentTime;
    const isLegato =
      this.lastInstrument === instrument &&
      Boolean(prevNote && !prevNote.breathAfter) &&
      now < this.lastNoteEndTime + 0.22;

    this.lastInstrument = instrument;
    this.lastNoteEndTime = now + durationSec;

    const bankKey = this.toSampleBankKey(instrument);
    if (!this.bankPromises[bankKey]) {
      this.loadBank(bankKey).catch(() => {});
    }

    if (instrument === 'ewi') {
      if (this.ewiSettings.voice === 'ewi-synth') {
        this.releaseMonoBansuri(0.03);
        this.playEwiSynth(note, scaleRootHz, durationSec, prevNote, isLegato);
      } else if (this.ewiSettings.voice === 'saxophone') {
        this.releaseMonoEwi(0.03);
        this.releaseMonoBansuri(0.03);
        this.playRealSaxophone(note, scaleRootHz, durationSec, prevNote, isLegato);
      } else if (this.ewiSettings.voice === 'harmonica') {
        this.releaseMonoEwi(0.03);
        this.releaseMonoBansuri(0.03);
        this.playRealHarmonica(note, scaleRootHz, durationSec, prevNote, isLegato);
      } else {
        this.releaseMonoEwi(0.03);
        this.playRealBansuri(note, scaleRootHz, durationSec, prevNote, isLegato);
      }
      return;
    }

    this.releaseMonoEwi(0.03);
    if (instrument === 'saxophone') {
      this.releaseMonoBansuri(0.03);
      this.playRealSaxophone(note, scaleRootHz, durationSec, prevNote, isLegato);
    } else if (instrument === 'harmonica') {
      this.releaseMonoBansuri(0.03);
      this.playRealHarmonica(note, scaleRootHz, durationSec, prevNote, isLegato);
    } else {
      this.playRealBansuri(note, scaleRootHz, durationSec, prevNote, isLegato);
    }
  }

  private centsToRateDelta(targetRate: number, cents: number): number {
    return targetRate * (Math.pow(2, cents / 1200) - 1);
  }

  private releaseMonoBansuri(fadeSec = 0.04) {
    const v = this.monoBansuri;
    if (!v || !this.ctx) return;
    this.monoBansuri = null;
    if (v.cleanupTimer !== null) {
      clearTimeout(v.cleanupTimer);
      v.cleanupTimer = null;
    }
    try {
      const t = this.ctx.currentTime;
      v.envGain.gain.cancelScheduledValues(t);
      v.envGain.gain.setTargetAtTime(0.0001, t, Math.max(0.012, fadeSec * 0.35));
      v.gamakGain.gain.cancelScheduledValues(t);
      v.gamakGain.gain.setTargetAtTime(0.0, t, 0.02);
      v.src.stop(t + fadeSec + 0.12);
      v.gamakOsc.stop(t + fadeSec + 0.12);
    } catch {
      // Ignore already-stopped nodes
    }
  }

  /**
   * 1A. TRUE MONOPHONIC SINGLE-BREATH INDIAN ASSAM BAMBOO BANSURI
   *     Maintains ONE live bamboo air column across an entire musical breath phrase!
   *     - ZERO polyphonic note overlap / synth-pad crossfade smear
   *     - ZERO Western orchestral opera vibrato (pure straight-tone Indian bamboo!)
   *     - Liquid vocal Meends, crisp 32ms bamboo finger-hole transitions, authentic
   *       finger-tap articulation on repeated notes, and soft breath chiff at phrase start.
   */
  private playRealBansuri(
    note: SongNote,
    scaleRootHz: number,
    durationSec: number,
    prevNote?: SongNote | null,
    isLegato = false
  ) {
    if (!this.ctx || !this.leadBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const targetHz = getFrequencyHz(note.swara, note.octave, scaleRootHz);
    const dur = Math.max(0.16, durationSec);

    // Check whether our active live single-breath bamboo voice can seamlessly carry this note
    const v = this.monoBansuri;
    const canContinueBreath =
      isLegato &&
      v !== null &&
      now + dur < v.maxEndAt - 0.5 &&
      Math.abs(12 * Math.log2(targetHz / v.sampleHz)) <= 10.5;

    // Phrase-aware natural velocity (nimble passing notes slightly softer, long anchors fuller)
    const dynVel = note.durationBeats <= 0.5 ? 0.92 : note.durationBeats >= 1.5 ? 1.08 : 1.0;

    if (canContinueBreath && v) {
      // === CONTINUE ON THE EXACT SAME LIVE BAMBOO AIR COLUMN (TRUE MONOPHONIC!) ===
      if (v.cleanupTimer !== null) {
        clearTimeout(v.cleanupTimer);
        v.cleanupTimer = null;
      }

      const prevRate = v.currentRate;
      const targetRate = Math.max(0.45, Math.min(2.2, targetHz / v.sampleHz));
      const isSameSwara = Math.abs(Math.log2(targetRate / prevRate)) < 0.004;

      v.src.playbackRate.cancelScheduledValues(now);
      v.envGain.gain.cancelScheduledValues(now);
      v.gamakGain.gain.cancelScheduledValues(now);

      if (note.ornament?.type === 'meend') {
        const srcSwara = note.ornament.graceSwara ?? prevNote?.swara ?? note.swara;
        const srcOctave = note.ornament.graceOctave ?? prevNote?.octave ?? note.octave;
        const startHz = getFrequencyHz(srcSwara, srcOctave, scaleRootHz);
        const startRate = Math.max(0.45, Math.min(2.2, startHz / v.sampleHz));
        const semitones = Math.abs(12 * Math.log2(targetRate / startRate));
        // Wide leaps get an unhurried, vocal Indian Bansuri Meend glide (220-300ms)
        const glideDur = Math.min(0.3, Math.max(0.14, semitones >= 5 ? dur * 0.45 : dur * 0.36));
        v.src.playbackRate.setValueAtTime(startRate, now);
        v.src.playbackRate.exponentialRampToValueAtTime(targetRate, now + glideDur);
        v.envGain.gain.setTargetAtTime(dynVel * 1.04, now, 0.05);
      } else if (note.ornament?.type === 'kan' && note.ornament.graceSwara) {
        const graceHz = getFrequencyHz(
          note.ornament.graceSwara,
          note.ornament.graceOctave ?? note.octave,
          scaleRootHz
        );
        const graceRate = Math.max(0.45, Math.min(2.2, graceHz / v.sampleHz));
        v.src.playbackRate.setValueAtTime(graceRate, now);
        v.src.playbackRate.exponentialRampToValueAtTime(targetRate, now + 0.052);
        v.envGain.gain.setTargetAtTime(dynVel, now, 0.03);
      } else if (isSameSwara) {
        // Authentic Indian Bansuri repeated-note articulation: soft finger-tap & breath dip (never stops air!)
        const flickRate = targetRate * Math.pow(2, 14 / 1200);
        v.src.playbackRate.setValueAtTime(flickRate, now);
        v.src.playbackRate.exponentialRampToValueAtTime(targetRate, now + 0.028);
        v.envGain.gain.setValueAtTime(dynVel * 0.62, now);
        v.envGain.gain.linearRampToValueAtTime(dynVel * 1.02, now + 0.038);
      } else {
        // Crisp, liquid 32ms bamboo finger-hole transition on the live air column
        const fingerGlide = Math.min(0.036, dur * 0.2);
        v.src.playbackRate.setValueAtTime(prevRate, now);
        v.src.playbackRate.exponentialRampToValueAtTime(targetRate, now + fingerGlide);
        // Subtle 18ms breath contour at finger change
        v.envGain.gain.setValueAtTime(dynVel * 0.88, now);
        v.envGain.gain.linearRampToValueAtTime(dynVel, now + 0.026);
      }

      this.scheduleBansuriOrnamentAndTail(v, note, targetRate, dynVel, dur, now);
      v.currentRate = targetRate;
      this.lastPlayedHz = targetHz;
      return;
    }

    // === START A FRESH BAMBOO BREATH PHRASE ===
    const sample = this.getNearestSample('bansuri', targetHz);
    if (!sample) {
      this.playFallbackTone(targetHz, dur, 'sine');
      return;
    }

    this.releaseMonoBansuri(isLegato ? 0.05 : 0.035);
    this.stopCurrentFluteNote(0.03);

    const targetRate = Math.max(0.45, Math.min(2.2, targetHz / sample.hz));
    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;

    const gamakOsc = ctx.createOscillator();
    const gamakGain = ctx.createGain();
    gamakOsc.frequency.value = 5.4;
    gamakGain.gain.setValueAtTime(0.0, now);
    gamakOsc.connect(gamakGain);
    gamakGain.connect(src.playbackRate);

    // Subtle embouchure bloom on fresh phrase onset (or Meend/Kan if first note has ornament)
    if (note.ornament?.type === 'meend') {
      const srcSwara = note.ornament.graceSwara ?? prevNote?.swara ?? note.swara;
      const srcOctave = note.ornament.graceOctave ?? prevNote?.octave ?? note.octave;
      const startHz = getFrequencyHz(srcSwara, srcOctave, scaleRootHz);
      const startRate = Math.max(0.45, Math.min(2.2, startHz / sample.hz));
      const glideDur = Math.min(0.28, dur * 0.45);
      src.playbackRate.setValueAtTime(startRate, now);
      src.playbackRate.exponentialRampToValueAtTime(targetRate, now + glideDur);
    } else if (note.ornament?.type === 'kan' && note.ornament.graceSwara) {
      const graceHz = getFrequencyHz(
        note.ornament.graceSwara,
        note.ornament.graceOctave ?? note.octave,
        scaleRootHz
      );
      const graceRate = Math.max(0.45, Math.min(2.2, graceHz / sample.hz));
      src.playbackRate.setValueAtTime(graceRate, now);
      src.playbackRate.exponentialRampToValueAtTime(targetRate, now + 0.052);
    } else {
      // Gentle -12c lip bloom as bamboo tone speaks out of breath
      const onsetRate = targetRate * Math.pow(2, -12 / 1200);
      src.playbackRate.setValueAtTime(onsetRate, now);
      src.playbackRate.exponentialRampToValueAtTime(targetRate, now + 0.055);
    }

    const envGain = ctx.createGain();
    const atk = isLegato ? 0.045 : 0.062;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(dynVel * 0.98, now + atk);

    src.connect(envGain);
    envGain.connect(this.bansuriToneInput ?? this.leadBus);

    // Fresh breath starts at 0.0s so the real Assam bamboo lip-chiff breathes cleanly;
    // rare octave-switch mid-legato enters slightly past chiff at 0.16s.
    const startOffset = isLegato ? 0.16 : 0.0;
    const maxAirSec = Math.max(2.0, (sample.buffer.duration - startOffset - 0.15) / Math.max(targetRate, 1.0));
    src.start(now, startOffset);
    gamakOsc.start(now);

    const voice: MonoBansuriVoice = {
      src,
      envGain,
      gamakOsc,
      gamakGain,
      sampleHz: sample.hz,
      currentRate: targetRate,
      startedAt: now,
      maxEndAt: now + maxAirSec,
      cleanupTimer: null,
    };

    this.monoBansuri = voice;
    this.lastPlayedHz = targetHz;
    this.scheduleBansuriOrnamentAndTail(voice, note, targetRate, dynVel, dur, now);
  }

  private scheduleBansuriOrnamentAndTail(
    v: MonoBansuriVoice,
    note: SongNote,
    targetRate: number,
    dynVel: number,
    dur: number,
    now: number
  ) {
    // Pure Indian straight-tone by default; expressive Gamak oscillation ONLY on Gamak,
    // and ultra-subtle late breath warmth (±5c) ONLY on long held notes (> 0.9s)
    v.gamakGain.gain.setValueAtTime(0.0, now);
    if (note.ornament?.type === 'gamak') {
      v.gamakOsc.frequency.setValueAtTime(5.8, now);
      v.gamakGain.gain.linearRampToValueAtTime(this.centsToRateDelta(targetRate, 18), now + 0.04);
      v.gamakGain.gain.linearRampToValueAtTime(0.0, now + dur);
    } else if (dur >= 0.9) {
      v.gamakOsc.frequency.setValueAtTime(4.5, now);
      v.gamakGain.gain.setValueAtTime(0.0, now + 0.42);
      v.gamakGain.gain.linearRampToValueAtTime(
        this.centsToRateDelta(targetRate, 5),
        now + Math.min(0.85, dur * 0.78)
      );
    }

    // Gentle messa di voce breath swell on sustained emotional anchors
    if (dur > 0.75) {
      const peakT = now + Math.min(0.45, dur * 0.45);
      v.envGain.gain.linearRampToValueAtTime(dynVel * 1.08, peakT);
    }

    // Schedule graceful exhale release at phrase end (cancelled automatically if next legato note arrives!)
    const holdUntil = now + dur + (note.breathAfter ? 0.0 : 0.22);
    const releaseSec = note.breathAfter ? 0.3 : 0.18;
    v.envGain.gain.setValueAtTime(dynVel * (note.breathAfter ? 0.92 : 0.98), holdUntil);
    v.envGain.gain.exponentialRampToValueAtTime(0.0001, holdUntil + releaseSec);

    const stopMs = Math.ceil((holdUntil - now + releaseSec + 0.08) * 1000);
    v.cleanupTimer = window.setTimeout(() => {
      if (this.monoBansuri === v) {
        this.releaseMonoBansuri(0.03);
      }
    }, stopMs);
  }

  private applyOrnamentPitch(
    src: AudioBufferSourceNode,
    sampleHz: number,
    targetHz: number,
    note: SongNote,
    scaleRootHz: number,
    octaveFactor: number,
    dur: number,
    now: number,
    prevNote?: SongNote | null,
    entryDetuneCents = 0,
    entryScoopSec = 0.045,
    legatoFingerGlide = false
  ) {
    const targetRate = Math.max(0.35, Math.min(3.0, targetHz / sampleHz));

    if (note.ornament?.type === 'meend') {
      const srcSwara = note.ornament.graceSwara ?? prevNote?.swara ?? note.swara;
      const srcOctave = note.ornament.graceOctave ?? prevNote?.octave ?? note.octave;
      const startHz = getFrequencyHz(srcSwara, srcOctave, scaleRootHz) * octaveFactor;
      const startRate = Math.max(0.35, Math.min(3.0, startHz / sampleHz));
      const glideDur = Math.min(0.28, Math.max(0.11, dur * 0.44));
      src.playbackRate.setValueAtTime(startRate, now);
      src.playbackRate.exponentialRampToValueAtTime(targetRate, now + glideDur);
    } else if (note.ornament?.type === 'kan' && note.ornament.graceSwara) {
      const graceHz =
        getFrequencyHz(
          note.ornament.graceSwara,
          note.ornament.graceOctave ?? note.octave,
          scaleRootHz
        ) * octaveFactor;
      const graceRate = Math.max(0.35, Math.min(3.0, graceHz / sampleHz));
      src.playbackRate.setValueAtTime(graceRate, now);
      src.playbackRate.exponentialRampToValueAtTime(targetRate, now + 0.058);
    } else if (
      legatoFingerGlide &&
      this.lastPlayedHz > 0 &&
      Math.abs(Math.log2(targetHz / this.lastPlayedHz)) > 0.01
    ) {
      const intervalCents = 1200 * Math.log2(this.lastPlayedHz / targetHz);
      const clampedStartCents = Math.max(-55, Math.min(55, intervalCents * 0.28));
      const startRate = Math.max(
        0.35,
        Math.min(3.0, targetRate * Math.pow(2, clampedStartCents / 1200))
      );
      src.playbackRate.setValueAtTime(startRate, now);
      src.playbackRate.exponentialRampToValueAtTime(targetRate, now + 0.038);
    } else if (entryDetuneCents !== 0) {
      const scoopStartRate = Math.max(
        0.35,
        Math.min(3.0, targetRate * Math.pow(2, entryDetuneCents / 1200))
      );
      src.playbackRate.setValueAtTime(scoopStartRate, now);
      src.playbackRate.exponentialRampToValueAtTime(targetRate, now + entryScoopSec);
    } else {
      src.playbackRate.setValueAtTime(targetRate, now);
    }

    return targetRate;
  }

  /**
   * 1B. TRUE-CONCERT-PITCH STUDIO VIBRATO SAXOPHONE (VCSL BrettTenor_Vib, A#2..G5)
   */
  private playRealSaxophone(
    note: SongNote,
    scaleRootHz: number,
    durationSec: number,
    prevNote?: SongNote | null,
    isLegato = false
  ) {
    if (!this.ctx || !this.leadBus) return;
    const ctx = this.ctx;
    const octFactor = scaleRootHz > 315 ? 0.5 : 1.0;
    const targetHz = getFrequencyHz(note.swara, note.octave, scaleRootHz) * octFactor;
    const sample = this.getNearestSample('saxophone', targetHz);

    if (!sample) {
      this.playFallbackTone(targetHz, durationSec, 'sawtooth');
      return;
    }

    this.stopCurrentFluteNote(isLegato ? 0.055 : 0.025);

    const now = ctx.currentTime;
    const rawRate = Math.max(0.45, Math.min(2.4, targetHz / sample.hz));
    const startOffset = isLegato ? Math.min(0.11, sample.buffer.duration * 0.05) : 0.0;
    const maxPlayableSec = Math.max(0.25, (sample.buffer.duration - startOffset - 0.08) / rawRate);
    const holdTail = note.breathAfter ? 0.0 : 0.1;
    const dur = Math.max(0.18, Math.min(durationSec + holdTail, maxPlayableSec));

    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;

    const targetRate = this.applyOrnamentPitch(
      src,
      sample.hz,
      targetHz,
      note,
      scaleRootHz,
      octFactor,
      dur,
      now,
      prevNote,
      isLegato ? 0 : -18,
      0.055,
      isLegato
    );

    this.lastPlayedHz = targetHz;

    let gamakOsc: OscillatorNode | null = null;
    if (note.ornament?.type === 'gamak') {
      gamakOsc = ctx.createOscillator();
      const gamakGain = ctx.createGain();
      gamakOsc.frequency.value = 5.6;
      gamakGain.gain.setValueAtTime(this.centsToRateDelta(targetRate, 24), now);
      gamakOsc.connect(gamakGain);
      gamakGain.connect(src.playbackRate);
      gamakOsc.start(now);
      gamakOsc.stop(now + dur + 0.2);
    }

    const envGain = ctx.createGain();
    const atk = isLegato ? 0.036 : 0.024;
    const release = note.breathAfter ? 0.18 : 0.1;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(1.02, now + atk);
    envGain.gain.setValueAtTime(0.95, now + Math.max(atk + 0.04, dur - 0.08));
    envGain.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);

    src.connect(envGain);
    envGain.connect(this.leadBus);

    src.start(now, startOffset);
    src.stop(now + dur + release + 0.06);

    this.activeVoiceStop = (fadeSec = 0.04) => {
      try {
        const t = ctx.currentTime;
        envGain.gain.cancelScheduledValues(t);
        envGain.gain.setTargetAtTime(0.0001, t, Math.max(0.01, fadeSec * 0.35));
        src.stop(t + fadeSec + 0.08);
        gamakOsc?.stop(t + fadeSec + 0.08);
      } catch {
        // Ignore already-stopped nodes
      }
    };
  }

  /**
   * 1C. TRUE-CONCERT-PITCH HOHNER SUPER 64 CHROMATIC HARMONICA (VCSL, C3..C6)
   */
  private playRealHarmonica(
    note: SongNote,
    scaleRootHz: number,
    durationSec: number,
    prevNote?: SongNote | null,
    isLegato = false
  ) {
    if (!this.ctx || !this.leadBus) return;
    const ctx = this.ctx;
    const targetHz = getFrequencyHz(note.swara, note.octave, scaleRootHz);
    const sample = this.getNearestSample('harmonica', targetHz);

    if (!sample) {
      this.playFallbackTone(targetHz, durationSec, 'triangle');
      return;
    }

    this.stopCurrentFluteNote(isLegato ? 0.045 : 0.02);

    const now = ctx.currentTime;
    const rawRate = Math.max(0.45, Math.min(2.4, targetHz / sample.hz));
    const startOffset = isLegato ? Math.min(0.08, sample.buffer.duration * 0.04) : 0.0;
    const maxPlayableSec = Math.max(0.25, (sample.buffer.duration - startOffset - 0.08) / rawRate);
    const holdTail = note.breathAfter ? 0.0 : 0.08;
    const dur = Math.max(0.16, Math.min(durationSec + holdTail, maxPlayableSec));
    const tab = getHarmonicaTab(note.swara, note.octave);
    const isDraw = tab.action === 'draw';

    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;

    const targetRate = this.applyOrnamentPitch(
      src,
      sample.hz,
      targetHz,
      note,
      scaleRootHz,
      1.0,
      dur,
      now,
      prevNote,
      isDraw ? -14 : 0,
      0.04,
      isLegato
    );

    this.lastPlayedHz = targetHz;

    const wahLP = ctx.createBiquadFilter();
    wahLP.type = 'lowpass';
    wahLP.Q.value = note.ornament?.type === 'gamak' ? 2.2 : 0.8;
    wahLP.frequency.setValueAtTime(isDraw ? 3800 : 5000, now);

    let wahOsc: OscillatorNode | null = null;
    if (note.ornament?.type === 'gamak') {
      wahOsc = ctx.createOscillator();
      const wahFilterGain = ctx.createGain();
      const wahPitchGain = ctx.createGain();
      wahOsc.frequency.value = 5.8;
      wahFilterGain.gain.value = 1100;
      wahPitchGain.gain.value = this.centsToRateDelta(targetRate, 16);
      wahOsc.connect(wahFilterGain);
      wahFilterGain.connect(wahLP.frequency);
      wahOsc.connect(wahPitchGain);
      wahPitchGain.connect(src.playbackRate);
      wahOsc.start(now);
      wahOsc.stop(now + dur + 0.18);
    }

    let clickSrc: AudioBufferSourceNode | null = null;
    if (tab.slide && this.whiteNoiseBuffer) {
      clickSrc = ctx.createBufferSource();
      clickSrc.buffer = this.whiteNoiseBuffer;
      const clickBP = ctx.createBiquadFilter();
      clickBP.type = 'bandpass';
      clickBP.frequency.value = 4800;
      clickBP.Q.value = 4.5;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.075, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);
      clickSrc.connect(clickBP);
      clickBP.connect(clickGain);
      clickGain.connect(this.leadBus);
      clickSrc.start(now);
      clickSrc.stop(now + 0.022);
    }

    const envGain = ctx.createGain();
    const atk = isDraw ? 0.028 : 0.018;
    const release = note.breathAfter ? 0.14 : 0.08;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(1.0, now + atk);
    envGain.gain.setValueAtTime(0.94, now + Math.max(atk + 0.04, dur - 0.06));
    envGain.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);

    src.connect(wahLP);
    wahLP.connect(envGain);
    envGain.connect(this.leadBus);

    src.start(now, startOffset);
    src.stop(now + dur + release + 0.06);

    this.activeVoiceStop = (fadeSec = 0.03) => {
      try {
        const t = ctx.currentTime;
        envGain.gain.cancelScheduledValues(t);
        envGain.gain.setTargetAtTime(0.0001, t, Math.max(0.008, fadeSec * 0.35));
        src.stop(t + fadeSec + 0.08);
        wahOsc?.stop(t + fadeSec + 0.08);
        clickSrc?.stop(t + 0.02);
      } catch {
        // Ignore already-stopped nodes
      }
    };
  }

  private playFallbackTone(hz: number, durSec: number, type: OscillatorType) {
    if (!this.ctx || !this.leadBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = hz * 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.26, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.2, durSec));
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.leadBus);
    osc.start(now);
    osc.stop(now + Math.max(0.25, durSec + 0.05));
  }

  public async playSingleSwaraPreview(
    swara: SwaraId,
    octave: Octave,
    scaleRootHz: number,
    instrument: InstrumentType = 'bansuri'
  ) {
    await this.ensureStarted(instrument);
    this.lastNoteEndTime = 0;
    const dummyNote: SongNote = {
      id: 'preview',
      swara,
      octave,
      startBeat: 0,
      durationBeats: 2.0,
      lyric: '',
      breathAfter: true,
    };
    this.playLeadNote(dummyNote, scaleRootHz, 1.5, instrument, null);
  }

  private releaseMonoEwi(fadeSec = 0.04) {
    const v = this.monoEwi;
    if (!v || !this.ctx) return;
    this.monoEwi = null;
    if (v.cleanupTimer !== null) {
      clearTimeout(v.cleanupTimer);
      v.cleanupTimer = null;
    }
    try {
      const t = this.ctx.currentTime;
      v.envGain.gain.cancelScheduledValues(t);
      v.envGain.gain.setTargetAtTime(0.0001, t, Math.max(0.012, fadeSec * 0.35));
      v.vibMainGain.gain.cancelScheduledValues(t);
      v.vibMainGain.gain.setTargetAtTime(0.0, t, 0.02);
      v.vibHarmGain.gain.cancelScheduledValues(t);
      v.vibHarmGain.gain.setTargetAtTime(0.0, t, 0.02);
      const stopT = t + fadeSec + 0.14;
      v.oscMain.stop(stopT);
      v.oscHarm.stop(stopT);
      v.oscSub.stop(stopT);
      v.vibOsc.stop(stopT);
    } catch {
      // Ignore already-stopped nodes
    }
  }

  /**
   * 1D. TRUE MONOPHONIC EXPRESSIVE EWI WIND-SYNTH (Eastar EDA-100 Tone 08 · Electronic Flute)
   *     Single continuous breath column with dual warm triangle + breath-filtered sawtooth + sub sine,
   *     breath-sensitivity filter bloom, soft onset wind chiff, and silky Pitch-Bend Meend/Gamak!
   */
  private playEwiSynth(
    note: SongNote,
    scaleRootHz: number,
    durationSec: number,
    prevNote?: SongNote | null,
    isLegato = false
  ) {
    if (!this.ctx || !this.leadBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const targetHz = Math.max(85, Math.min(2400, getFrequencyHz(note.swara, note.octave, scaleRootHz)));
    const dur = Math.max(0.16, durationSec);
    const breathLevel = this.ewiSettings.breathLevel; // 1=Light, 2=Medium, 3=Heavy
    const pbEnabled = this.ewiSettings.pitchBendEnabled;

    // Breath sensitivity shapes dynamic richness & lowpass filter bloom
    const filterMult = breathLevel === 1 ? 2.6 : breathLevel === 2 ? 3.5 : 4.6;
    const targetCutoff = Math.min(7200, Math.max(480, targetHz * filterMult));
    const dynVel =
      (note.durationBeats <= 0.5 ? 0.88 : note.durationBeats >= 1.5 ? 1.06 : 0.98) *
      (breathLevel === 1 ? 0.92 : breathLevel === 2 ? 1.0 : 1.08);
    const harmDetune = 1.0018; // ~+3 cents velvety chorus shimmer

    const v = this.monoEwi;
    if (isLegato && v) {
      if (v.cleanupTimer !== null) {
        clearTimeout(v.cleanupTimer);
        v.cleanupTimer = null;
      }

      const prevHz = v.currentHz;
      const isSameSwara = Math.abs(Math.log2(targetHz / prevHz)) < 0.004;

      v.oscMain.frequency.cancelScheduledValues(now);
      v.oscHarm.frequency.cancelScheduledValues(now);
      v.oscSub.frequency.cancelScheduledValues(now);
      v.breathFilter.frequency.cancelScheduledValues(now);
      v.envGain.gain.cancelScheduledValues(now);
      v.vibMainGain.gain.cancelScheduledValues(now);
      v.vibHarmGain.gain.cancelScheduledValues(now);

      if (pbEnabled && note.ornament?.type === 'meend') {
        const srcSwara = note.ornament.graceSwara ?? prevNote?.swara ?? note.swara;
        const srcOctave = note.ornament.graceOctave ?? prevNote?.octave ?? note.octave;
        const startHz = Math.max(85, getFrequencyHz(srcSwara, srcOctave, scaleRootHz));
        const glideDur = Math.min(0.28, Math.max(0.12, dur * 0.42));
        v.oscMain.frequency.setValueAtTime(startHz, now);
        v.oscMain.frequency.exponentialRampToValueAtTime(targetHz, now + glideDur);
        v.oscHarm.frequency.setValueAtTime(startHz * harmDetune, now);
        v.oscHarm.frequency.exponentialRampToValueAtTime(targetHz * harmDetune, now + glideDur);
        v.oscSub.frequency.setValueAtTime(startHz * 0.5, now);
        v.oscSub.frequency.exponentialRampToValueAtTime(targetHz * 0.5, now + glideDur);
        v.envGain.gain.setTargetAtTime(dynVel * 0.34, now, 0.045);
      } else if (note.ornament?.type === 'kan' && note.ornament.graceSwara) {
        const graceHz = Math.max(
          85,
          getFrequencyHz(note.ornament.graceSwara, note.ornament.graceOctave ?? note.octave, scaleRootHz)
        );
        v.oscMain.frequency.setValueAtTime(graceHz, now);
        v.oscMain.frequency.exponentialRampToValueAtTime(targetHz, now + 0.046);
        v.oscHarm.frequency.setValueAtTime(graceHz * harmDetune, now);
        v.oscHarm.frequency.exponentialRampToValueAtTime(targetHz * harmDetune, now + 0.046);
        v.oscSub.frequency.setValueAtTime(graceHz * 0.5, now);
        v.oscSub.frequency.exponentialRampToValueAtTime(targetHz * 0.5, now + 0.046);
        v.envGain.gain.setTargetAtTime(dynVel * 0.33, now, 0.03);
      } else if (isSameSwara) {
        // Gentle breath-tongue re-articulation dip on repeated swara
        v.envGain.gain.setValueAtTime(dynVel * 0.21, now);
        v.envGain.gain.linearRampToValueAtTime(dynVel * 0.34, now + 0.038);
      } else {
        // Crisp 24ms capacitive touch-sensor portamento
        const glideSec = Math.min(0.026, dur * 0.16);
        v.oscMain.frequency.setValueAtTime(prevHz, now);
        v.oscMain.frequency.exponentialRampToValueAtTime(targetHz, now + glideSec);
        v.oscHarm.frequency.setValueAtTime(prevHz * harmDetune, now);
        v.oscHarm.frequency.exponentialRampToValueAtTime(targetHz * harmDetune, now + glideSec);
        v.oscSub.frequency.setValueAtTime(prevHz * 0.5, now);
        v.oscSub.frequency.exponentialRampToValueAtTime(targetHz * 0.5, now + glideSec);
        v.envGain.gain.setValueAtTime(dynVel * 0.3, now);
        v.envGain.gain.linearRampToValueAtTime(dynVel * 0.34, now + 0.028);
      }

      v.breathFilter.frequency.setTargetAtTime(targetCutoff, now, 0.05);
      this.scheduleEwiTail(v, note, targetHz, dynVel * 0.34, dur, now, pbEnabled);
      v.currentHz = targetHz;
      this.lastPlayedHz = targetHz;
      return;
    }

    // === START A FRESH MONOPHONIC EWI WIND-SYNTH BREATH PHRASE ===
    this.releaseMonoEwi(0.03);
    this.stopCurrentFluteNote(0.03);

    const oscMain = ctx.createOscillator();
    oscMain.type = 'triangle';
    const oscHarm = ctx.createOscillator();
    oscHarm.type = 'sawtooth';
    const oscSub = ctx.createOscillator();
    oscSub.type = 'sine';

    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.72;
    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.26;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.16;

    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'lowpass';
    breathFilter.Q.value = 1.45;
    breathFilter.frequency.setValueAtTime(Math.max(240, targetHz * 1.35), now);
    breathFilter.frequency.exponentialRampToValueAtTime(targetCutoff, now + 0.09);

    const warmthShelf = ctx.createBiquadFilter();
    warmthShelf.type = 'peaking';
    warmthShelf.frequency.value = 620;
    warmthShelf.Q.value = 0.85;
    warmthShelf.gain.value = 2.6;

    const envGain = ctx.createGain();
    const peakGain = dynVel * 0.34;
    const atk = breathLevel === 1 ? 0.035 : breathLevel === 2 ? 0.052 : 0.07;
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peakGain, now + atk);

    // Subtle pitch-bend vibrato LFO
    const vibOsc = ctx.createOscillator();
    vibOsc.frequency.value = 5.4;
    const vibMainGain = ctx.createGain();
    const vibHarmGain = ctx.createGain();
    vibMainGain.gain.setValueAtTime(0.0, now);
    vibHarmGain.gain.setValueAtTime(0.0, now);
    vibOsc.connect(vibMainGain);
    vibOsc.connect(vibHarmGain);
    vibMainGain.connect(oscMain.frequency);
    vibHarmGain.connect(oscHarm.frequency);

    // Onset pitch contour (Meend, Kan, or gentle -10c breath bloom)
    if (pbEnabled && note.ornament?.type === 'meend') {
      const srcSwara = note.ornament.graceSwara ?? prevNote?.swara ?? note.swara;
      const srcOctave = note.ornament.graceOctave ?? prevNote?.octave ?? note.octave;
      const startHz = Math.max(85, getFrequencyHz(srcSwara, srcOctave, scaleRootHz));
      const glideDur = Math.min(0.26, dur * 0.44);
      oscMain.frequency.setValueAtTime(startHz, now);
      oscMain.frequency.exponentialRampToValueAtTime(targetHz, now + glideDur);
      oscHarm.frequency.setValueAtTime(startHz * harmDetune, now);
      oscHarm.frequency.exponentialRampToValueAtTime(targetHz * harmDetune, now + glideDur);
      oscSub.frequency.setValueAtTime(startHz * 0.5, now);
      oscSub.frequency.exponentialRampToValueAtTime(targetHz * 0.5, now + glideDur);
    } else if (note.ornament?.type === 'kan' && note.ornament.graceSwara) {
      const graceHz = Math.max(
        85,
        getFrequencyHz(note.ornament.graceSwara, note.ornament.graceOctave ?? note.octave, scaleRootHz)
      );
      oscMain.frequency.setValueAtTime(graceHz, now);
      oscMain.frequency.exponentialRampToValueAtTime(targetHz, now + 0.048);
      oscHarm.frequency.setValueAtTime(graceHz * harmDetune, now);
      oscHarm.frequency.exponentialRampToValueAtTime(targetHz * harmDetune, now + 0.048);
      oscSub.frequency.setValueAtTime(graceHz * 0.5, now);
      oscSub.frequency.exponentialRampToValueAtTime(targetHz * 0.5, now + 0.048);
    } else {
      const bloomStart = targetHz * Math.pow(2, -10 / 1200);
      oscMain.frequency.setValueAtTime(bloomStart, now);
      oscMain.frequency.exponentialRampToValueAtTime(targetHz, now + 0.048);
      oscHarm.frequency.setValueAtTime(bloomStart * harmDetune, now);
      oscHarm.frequency.exponentialRampToValueAtTime(targetHz * harmDetune, now + 0.048);
      oscSub.frequency.setValueAtTime(bloomStart * 0.5, now);
      oscSub.frequency.exponentialRampToValueAtTime(targetHz * 0.5, now + 0.048);
    }

    // Delicate breath-sensor air chiff burst at fresh phrase onset
    if (this.whiteNoiseBuffer) {
      const airSrc = ctx.createBufferSource();
      airSrc.buffer = this.whiteNoiseBuffer;
      const airBP = ctx.createBiquadFilter();
      airBP.type = 'bandpass';
      airBP.frequency.value = Math.min(4200, Math.max(1600, targetHz * 3.8));
      airBP.Q.value = 2.6;
      const airGain = ctx.createGain();
      airGain.gain.setValueAtTime(0.0001, now);
      airGain.gain.linearRampToValueAtTime(0.045, now + 0.018);
      airGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
      airSrc.connect(airBP);
      airBP.connect(airGain);
      airGain.connect(this.ewiToneInput ?? this.leadBus);
      airSrc.start(now);
      airSrc.stop(now + 0.095);
    }

    oscMain.connect(mainGain);
    oscHarm.connect(harmGain);
    oscSub.connect(subGain);
    mainGain.connect(breathFilter);
    harmGain.connect(breathFilter);
    subGain.connect(breathFilter);
    breathFilter.connect(warmthShelf);
    warmthShelf.connect(envGain);
    envGain.connect(this.ewiToneInput ?? this.leadBus);

    oscMain.start(now);
    oscHarm.start(now);
    oscSub.start(now);
    vibOsc.start(now);

    const voice: MonoEwiVoice = {
      oscMain,
      oscHarm,
      oscSub,
      breathFilter,
      envGain,
      vibOsc,
      vibMainGain,
      vibHarmGain,
      currentHz: targetHz,
      cleanupTimer: null,
    };

    this.monoEwi = voice;
    this.lastPlayedHz = targetHz;
    this.scheduleEwiTail(voice, note, targetHz, peakGain, dur, now, pbEnabled);
  }

  private scheduleEwiTail(
    v: MonoEwiVoice,
    note: SongNote,
    targetHz: number,
    peakGain: number,
    dur: number,
    now: number,
    pbEnabled: boolean
  ) {
    v.vibMainGain.gain.setValueAtTime(0.0, now);
    v.vibHarmGain.gain.setValueAtTime(0.0, now);

    if (pbEnabled && note.ornament?.type === 'gamak') {
      const vibHz = targetHz * (Math.pow(2, 22 / 1200) - 1);
      v.vibOsc.frequency.setValueAtTime(5.8, now);
      v.vibMainGain.gain.linearRampToValueAtTime(vibHz, now + 0.04);
      v.vibHarmGain.gain.linearRampToValueAtTime(vibHz, now + 0.04);
      v.vibMainGain.gain.linearRampToValueAtTime(0.0, now + dur);
      v.vibHarmGain.gain.linearRampToValueAtTime(0.0, now + dur);
    } else if (dur >= 0.72) {
      const vibHz = targetHz * (Math.pow(2, 8 / 1200) - 1);
      v.vibOsc.frequency.setValueAtTime(4.9, now);
      v.vibMainGain.gain.setValueAtTime(0.0, now + 0.34);
      v.vibHarmGain.gain.setValueAtTime(0.0, now + 0.34);
      v.vibMainGain.gain.linearRampToValueAtTime(vibHz, now + Math.min(0.8, dur * 0.72));
      v.vibHarmGain.gain.linearRampToValueAtTime(vibHz, now + Math.min(0.8, dur * 0.72));
    }

    // Smooth breath swell on held notes
    if (dur > 0.65) {
      v.envGain.gain.linearRampToValueAtTime(peakGain * 1.09, now + Math.min(0.42, dur * 0.45));
    }

    const holdUntil = now + dur + (note.breathAfter ? 0.0 : 0.2);
    const releaseSec = note.breathAfter ? 0.26 : 0.16;
    v.envGain.gain.setValueAtTime(peakGain * (note.breathAfter ? 0.92 : 0.98), holdUntil);
    v.envGain.gain.exponentialRampToValueAtTime(0.0001, holdUntil + releaseSec);

    const stopMs = Math.ceil((holdUntil - now + releaseSec + 0.08) * 1000);
    v.cleanupTimer = window.setTimeout(() => {
      if (this.monoEwi === v) {
        this.releaseMonoEwi(0.03);
      }
    }, stopMs);
  }

  public stopCurrentFluteNote(fadeSec = 0.04) {
    this.releaseMonoBansuri(fadeSec);
    this.releaseMonoEwi(fadeSec);
    if (this.activeVoiceStop) {
      this.activeVoiceStop(fadeSec);
      this.activeVoiceStop = null;
    }
  }

  /* ========================================================================
     2. CONTINUOUS 4-STRING INDIAN TANPURA DRONE (Pa - Sa - Sa - Low Sa)
     ======================================================================== */
  public async startTanpura(scaleRootHz: number, droneSwara?: SwaraId) {
    await this.ensureStarted();
    this.currentScaleHz = scaleRootHz;
    this.currentDroneSwara = droneSwara;
    if (this.tanpuraRunning) return;
    this.tanpuraRunning = true;
    this.tanpuraStringIdx = 0;

    const pluckNextString = () => {
      if (!this.tanpuraRunning || !this.ctx || !this.tanpuraBus) return;
      let effectiveRootHz = this.currentScaleHz;
      if (this.currentDroneSwara) {
        const semi = SWARA_META[this.currentDroneSwara].semitonesFromSa;
        const offset = semi > 7 ? semi - 12 : semi;
        effectiveRootHz = this.currentScaleHz * Math.pow(2, offset / 12);
      }
      const baseSa = effectiveRootHz / 2;
      const ratios = [0.75, 1.0, 1.0014, 0.5];
      const freq = baseSa * ratios[this.tanpuraStringIdx % 4];
      this.tanpuraStringIdx = (this.tanpuraStringIdx + 1) % 4;

      this.triggerTanpuraPluck(freq);
      this.tanpuraTimer = window.setTimeout(pluckNextString, 1180);
    };

    pluckNextString();
  }

  private triggerTanpuraPluck(freqHz: number) {
    if (!this.ctx || !this.tanpuraBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = 4.6;

    const oscMain = ctx.createOscillator();
    const oscOver = ctx.createOscillator();
    oscMain.type = 'sawtooth';
    oscOver.type = 'triangle';
    oscMain.frequency.value = freqHz;
    oscOver.frequency.value = freqHz * 2.001;

    const jawariFilter = ctx.createBiquadFilter();
    jawariFilter.type = 'bandpass';
    jawariFilter.Q.value = 3.2;
    jawariFilter.frequency.setValueAtTime(freqHz * 1.4, now);
    jawariFilter.frequency.exponentialRampToValueAtTime(freqHz * 5.2, now + 1.55);
    jawariFilter.frequency.exponentialRampToValueAtTime(freqHz * 1.8, now + dur);

    const warmLowpass = ctx.createBiquadFilter();
    warmLowpass.type = 'lowpass';
    warmLowpass.frequency.value = freqHz * 2.5;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.24, now + 0.14);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const jawariGain = ctx.createGain();
    jawariGain.gain.value = 0.52;

    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.65;

    oscMain.connect(jawariFilter);
    jawariFilter.connect(jawariGain);
    jawariGain.connect(env);

    oscOver.connect(warmLowpass);
    warmLowpass.connect(bodyGain);
    bodyGain.connect(env);

    env.connect(this.tanpuraBus);

    oscMain.start(now);
    oscOver.start(now);
    oscMain.stop(now + dur + 0.1);
    oscOver.stop(now + dur + 0.1);
  }

  public stopTanpura() {
    this.tanpuraRunning = false;
    if (this.tanpuraTimer !== null) {
      clearTimeout(this.tanpuraTimer);
      this.tanpuraTimer = null;
    }
  }

  /* ========================================================================
     3. SYNTHESIZED TABLA PERCUSSION GROOVE (Keherwa 8 / Dadra 6)
     ======================================================================== */
  public triggerTablaBeat(song: Song, beatNumber: number) {
    if (!this.ctx || !this.tablaBus) return;
    if (this.mutes.tabla || this.volumes.tabla <= 0.001) return;

    const step = ((beatNumber % song.beatsPerBar) + song.beatsPerBar) % song.beatsPerBar;
    let effectiveRootHz = song.scale.rootHz;
    if (song.droneSwara) {
      const semi = SWARA_META[song.droneSwara].semitonesFromSa;
      const offset = semi > 7 ? semi - 12 : semi;
      effectiveRootHz = song.scale.rootHz * Math.pow(2, offset / 12);
    }
    const dayanHz = effectiveRootHz * 0.5;

    if (song.tala === 'dadra') {
      if (step === 0) {
        this.playBayan(1.0);
        this.playDayan(dayanHz, 0.85, false);
      } else if (step === 1) {
        this.playBayan(0.68);
        this.playDayan(dayanHz * 1.02, 0.5, false);
      } else if (step === 2) {
        this.playDayan(dayanHz * 1.15, 0.42, true);
      } else if (step === 3) {
        this.playDayan(dayanHz * 1.05, 0.68, false);
      } else if (step === 4) {
        this.playDayan(dayanHz * 1.18, 0.4, true);
      } else {
        this.playDayan(dayanHz * 1.02, 0.45, false);
      }
    } else {
      if (step === 0) {
        this.playBayan(1.0);
        this.playDayan(dayanHz, 0.9, false);
      } else if (step === 1) {
        this.playBayan(0.62);
      } else if (step === 2) {
        this.playDayan(dayanHz * 1.02, 0.48, false);
      } else if (step === 3) {
        this.playDayan(dayanHz * 1.2, 0.42, true);
      } else if (step === 4) {
        this.playDayan(dayanHz * 1.04, 0.72, false);
      } else if (step === 5) {
        this.playDayan(dayanHz * 1.22, 0.42, true);
      } else if (step === 6) {
        this.playBayan(0.75);
        this.playDayan(dayanHz * 1.02, 0.55, false);
      } else {
        this.playBayan(0.55);
      }
    }
  }

  private playBayan(velocity: number) {
    if (!this.ctx || !this.tablaBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.32);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.55 * velocity, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    osc.connect(g);
    g.connect(this.tablaBus);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  private playDayan(baseHz: number, velocity: number, isClosedTin: boolean) {
    if (!this.ctx || !this.tablaBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    let pitch = baseHz;
    while (pitch > 0 && pitch < 190) pitch *= 2;
    while (pitch > 440) pitch /= 2;
    osc.frequency.setValueAtTime(pitch * (isClosedTin ? 1.45 : 1.0), now);
    osc.frequency.exponentialRampToValueAtTime(pitch * (isClosedTin ? 1.15 : 0.99), now + 0.09);

    const g = ctx.createGain();
    const decay = isClosedTin ? 0.075 : 0.22;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.32 * velocity, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(g);
    g.connect(this.tablaBus);
    osc.start(now);
    osc.stop(now + decay + 0.03);
  }
}

export const audioEngine = new BansuriAudioEngine();
