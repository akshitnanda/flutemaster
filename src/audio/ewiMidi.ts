import { LiveMidiState, Octave, SwaraId } from '../types/music';

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SWARA_BY_SEMI: SwaraId[] = ['S', 'Rk', 'R', 'Gk', 'G', 'M', 'Mt', 'P', 'Dk', 'D', 'Nk', 'N'];

export interface EwiMidiCallbacks {
  onStateChange: (state: LiveMidiState) => void;
  onNoteOn?: (midiNote: number, velocity: number, swara: SwaraId, octave: Octave) => void;
  onNoteOff?: (midiNote: number) => void;
}

/**
 * Converts an incoming MIDI note number into the closest Indian Swara & Saptak
 * relative to the active song's root Hz (e.g. E4 = MIDI 64 -> Madhya Sa).
 */
export function midiNoteToSwara(
  midiNote: number,
  scaleRootHz: number
): { swara: SwaraId; octave: Octave; noteName: string } {
  const rootMidi = Math.round(69 + 12 * Math.log2(scaleRootHz / 440));
  const diff = midiNote - rootMidi;
  const semi = ((diff % 12) + 12) % 12;
  const octOffset = Math.floor(diff / 12);
  const octave: Octave = octOffset < 0 ? 'mandra' : octOffset > 0 ? 'taar' : 'madhya';
  const noteName = `${PITCH_NAMES[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;
  return {
    swara: SWARA_BY_SEMI[semi] ?? 'S',
    octave,
    noteName,
  };
}

/**
 * Clean Web MIDI API bridge for USB / Bluetooth MIDI EWI controllers (such as the Eastar EDA-100).
 * Gracefully degrades on browsers without Web MIDI without ever throwing.
 */
class EwiMidiBridge {
  private access: MIDIAccess | null = null;
  private callbacks: EwiMidiCallbacks | null = null;
  private scaleRootHz = 329.63;
  private state: LiveMidiState = {
    supported: typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function',
    connected: false,
    deviceName: null,
    activeMidiNote: null,
    activeSwaraLabel: null,
    breathCC: 0,
    pitchBend: 0,
  };

  public getState(): LiveMidiState {
    return this.state;
  }

  public setScaleRootHz(hz: number) {
    this.scaleRootHz = hz;
  }

  public async connect(callbacks: EwiMidiCallbacks): Promise<LiveMidiState> {
    this.callbacks = callbacks;
    if (!this.state.supported) {
      callbacks.onStateChange(this.state);
      return this.state;
    }

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.bindInputs();
      this.access.onstatechange = () => this.bindInputs();
      return this.state;
    } catch {
      this.emit({ connected: false, deviceName: null });
      return this.state;
    }
  }

  public disconnect() {
    if (this.access) {
      this.access.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      this.access.onstatechange = null;
      this.access = null;
    }
    this.emit({
      connected: false,
      deviceName: null,
      activeMidiNote: null,
      activeSwaraLabel: null,
      breathCC: 0,
      pitchBend: 0,
    });
  }

  private bindInputs() {
    if (!this.access) return;
    const names: string[] = [];
    this.access.inputs.forEach((input) => {
      if (input.state === 'connected') {
        names.push(input.name || 'USB/BT MIDI Wind');
        input.onmidimessage = (ev) => this.handleMessage(ev);
      }
    });
    this.emit({
      connected: names.length > 0,
      deviceName: names[0] ?? null,
    });
  }

  private handleMessage(ev: MIDIMessageEvent) {
    const data = ev.data;
    if (!data || data.length < 2) return;
    const status = data[0] & 0xf0;
    const d1 = data[1];
    const d2 = data.length > 2 ? data[2] : 0;

    if (status === 0x90 && d2 > 0) {
      const mapped = midiNoteToSwara(d1, this.scaleRootHz);
      this.emit({
        activeMidiNote: d1,
        activeSwaraLabel: `${mapped.swara} (${mapped.noteName})`,
      });
      this.callbacks?.onNoteOn?.(d1, d2 / 127, mapped.swara, mapped.octave);
    } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
      if (this.state.activeMidiNote === d1) {
        this.emit({ activeMidiNote: null, activeSwaraLabel: null });
      }
      this.callbacks?.onNoteOff?.(d1);
    } else if (status === 0xb0 && (d1 === 2 || d1 === 11)) {
      // CC#2 (Breath Controller) or CC#11 (Expression)
      this.emit({ breathCC: d2 });
    } else if (status === 0xe0) {
      const raw14 = ((d2 << 7) | d1) - 8192;
      this.emit({ pitchBend: Number((raw14 / 8192).toFixed(2)) });
    }
  }

  private emit(patch: Partial<LiveMidiState>) {
    this.state = { ...this.state, ...patch };
    this.callbacks?.onStateChange(this.state);
  }
}

export const ewiMidiBridge = new EwiMidiBridge();
