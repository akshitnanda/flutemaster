import React from 'react';
import { SwaraSymbol } from './SwaraSymbol';
import { BookOpen, Keyboard, X } from 'lucide-react';

interface NotationGuideModalProps {
  open: boolean;
  onClose: () => void;
  onOpenEwiGuide?: () => void;
}

export const NotationGuideModal: React.FC<NotationGuideModalProps> = ({
  open,
  onClose,
  onOpenEwiGuide,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-[#181614] border border-[#d4a373]/30 shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#d4a373]" />
            <h2 className="text-lg font-semibold text-[#f8f9fa]">
              Bansuri Sargam &amp; Studio Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a69f95] hover:text-[#f8f9fa] hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Sargam Notation Key */}
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373] mb-2.5">
            Indian Classical Sargam Notation (Bhatkhande System)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="w-10 h-10 rounded-lg bg-[#141311] border border-white/10 flex items-center justify-center text-[#72efdd]">
                <SwaraSymbol swara="N" octave="mandra" notationStyle="short" size="md" />
              </div>
              <div>
                <div className="font-semibold text-[#f8f9fa]">Mandra Saptak (Lower Octave)</div>
                <div className="text-[#a69f95]">Dot below the note. Blow gently &amp; warmly.</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="w-10 h-10 rounded-lg bg-[#141311] border border-white/10 flex items-center justify-center text-[#f8f9fa]">
                <SwaraSymbol swara="S" octave="madhya" notationStyle="short" size="md" />
              </div>
              <div>
                <div className="font-semibold text-[#f8f9fa]">Madhya Saptak (Middle Octave)</div>
                <div className="text-[#a69f95]">Standard unadorned note. Top 3 holes = Sa.</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="w-10 h-10 rounded-lg bg-[#141311] border border-white/10 flex items-center justify-center text-[#e9c46a]">
                <SwaraSymbol swara="S" octave="taar" notationStyle="short" size="md" />
              </div>
              <div>
                <div className="font-semibold text-[#f8f9fa]">Taar Saptak (Upper Octave)</div>
                <div className="text-[#a69f95]">Dot above the note. Use a faster focused air stream.</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="w-10 h-10 rounded-lg bg-[#2a1f16] border border-[#f4a261]/45 flex items-center justify-center text-[#f4a261]">
                <SwaraSymbol swara="Gk" octave="madhya" notationStyle="short" size="md" />
              </div>
              <div>
                <div className="font-semibold text-[#f8f9fa]">Komal (Flat) Notes</div>
                <div className="text-[#a69f95]">Underlined (R̲, G̲, D̲, N̲). Slide finger 50% open!</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#201e1b] border border-white/6 sm:col-span-2">
              <div className="w-10 h-10 rounded-lg bg-[#2a1f16] border border-[#e9c46a]/45 flex items-center justify-center text-[#e9c46a]">
                <SwaraSymbol swara="Mt" octave="madhya" notationStyle="short" size="md" />
              </div>
              <div>
                <div className="font-semibold text-[#f8f9fa]">Tivra (Sharp) Ma vs. Shuddha Ma</div>
                <div className="text-[#a69f95]">
                  Vertical line above M indicates Tivra Ma (all 6 holes open). Unmarked Shuddha Ma
                  uses a 50% half-hole on Hole 1 (Left Index).
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Instrument Techniques */}
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373] mb-2">
            4-Instrument Playing Techniques
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="font-semibold text-[#e9c46a]">Bansuri (Bamboo Flute)</div>
              <p className="text-[#a69f95] mt-1">
                Top 3 holes = Sa. Slide fingers 50% back for Komal notes &amp; Shuddha Ma (split-circle
                amber indicator).
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="font-semibold text-[#f4a261]">Alto Saxophone</div>
              <p className="text-[#a69f95] mt-1">
                Sa = Written G (L1–L3). Left Thumb engages the rear Octave Key from Madhya Pa up;
                auxiliary keys (G#, Side Bb, Eb) handle Komal swaras.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="font-semibold text-[#7dd3fc]">Mouth Organ (12H Chromatic)</div>
              <p className="text-[#a69f95] mt-1">
                Holes 1–4 (Mandra), 5–8 (Madhya), 9–12 (Taar). Jade = Blow (↑), Sky = Draw (↓);
                press Right Slide Button (●) for Komal &amp; Tivra notes.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#192322] border border-[#72efdd]/30">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[#72efdd]">EWI · Eastar EDA-100 Aerophone</div>
                {onOpenEwiGuide && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenEwiGuide();
                    }}
                    className="px-2 py-0.5 rounded bg-[#2a9d8f]/25 hover:bg-[#2a9d8f]/40 border border-[#72efdd]/45 text-[10px] font-semibold text-[#72efdd] cursor-pointer"
                  >
                    Open Full Guide →
                  </button>
                )}
              </div>
              <p className="text-[#a69f95] mt-1">
                Noiseless capacitive touch pads with dual modes (01 Sax / 02 Flute), rear Left-Thumb
                Octave Pads (OCT−/0/OCT+), Right-Thumb Pitch Bend for Meend, and instant Transpose!
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Alankars & Breath */}
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373] mb-2">
            Ornamentations (Alankars) &amp; Breath Cues
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="font-semibold text-[#e9c46a]">Meend (Glide)</div>
              <p className="text-[#a69f95] mt-1">
                Golden curved arc connecting notes — smoothly slide fingers or bend breath seamlessly
                between swaras.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="font-semibold text-[#72efdd]">Kan (Grace Note)</div>
              <p className="text-[#a69f95] mt-1">
                Dashed entry flick — briefly touch the adjacent grace note right before landing on
                the main swara.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#201e1b] border border-white/6">
              <div className="font-semibold text-[#38bfa9]">Gamak (Oscillation)</div>
              <p className="text-[#a69f95] mt-1">
                Wavy contour above a note — finger/embouchure vibrato (or hand-cupped Wah on Mouth
                Organ) for classical expression.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Keyboard Shortcuts */}
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-[#d4a373] mb-2 flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            Practice Shortcuts
          </h3>
          <div className="flex flex-wrap gap-2 text-xs text-[#d0c8be]">
            {[
              ['Space', 'Play / Pause'],
              ['← / →', 'Prev / Next Note (Step Mode)'],
              ['1 / 2 / 3', 'Switch 3D Camera Angles'],
              ['I', 'Cycle Instrument'],
              ['L', 'Toggle Song Library'],
            ].map(([k, desc]) => (
              <span
                key={k}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#201e1b] border border-white/10"
              >
                <kbd className="px-1.5 py-0.5 rounded bg-[#121212] border border-[#d4a373]/40 font-mono-tech text-[10px] text-[#e9c46a]">
                  {k}
                </kbd>
                <span>{desc}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
