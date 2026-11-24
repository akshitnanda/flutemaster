import React from 'react';
import { Octave, SwaraId } from '../types/music';
import { SWARA_META } from '../data/sargam';

interface SwaraSymbolProps {
  swara: SwaraId;
  octave: Octave;
  notationStyle?: 'short' | 'full';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: {
    text: 'text-xs',
    dot: 'w-1 h-1',
    tivra: 'w-[1.5px] h-1.5',
    underline: 'h-[1.5px] w-3',
    gap: 'gap-[1px]',
  },
  sm: {
    text: 'text-sm',
    dot: 'w-1 h-1',
    tivra: 'w-[1.5px] h-2',
    underline: 'h-[1.5px] w-3.5',
    gap: 'gap-[1.5px]',
  },
  md: {
    text: 'text-base',
    dot: 'w-1.5 h-1.5',
    tivra: 'w-[2px] h-2.5',
    underline: 'h-[2px] w-4',
    gap: 'gap-[2px]',
  },
  lg: {
    text: 'text-xl',
    dot: 'w-1.5 h-1.5',
    tivra: 'w-[2px] h-3',
    underline: 'h-[2px] w-5',
    gap: 'gap-[2px]',
  },
  xl: {
    text: 'text-3xl',
    dot: 'w-2 h-2',
    tivra: 'w-[2.5px] h-3.5',
    underline: 'h-[2.5px] w-7',
    gap: 'gap-[3px]',
  },
};

/**
 * Renders authentic Indian Classical Bhatkhande Sargam notation with guaranteed crisp alignment:
 * - Mandra Saptak (Lower): crisp dot directly below the note
 * - Madhya Saptak (Middle): clean unmarked base swara
 * - Taar Saptak (Upper): crisp dot directly above the note
 * - Komal (Flat): crisp horizontal underline beneath the swara (R̲, G̲, D̲, N̲)
 * - Tivra (Sharp) Ma: vertical line directly above M (M̍)
 */
export const SwaraSymbol: React.FC<SwaraSymbolProps> = ({
  swara,
  octave,
  notationStyle = 'full',
  size = 'md',
  className = '',
}) => {
  const meta = SWARA_META[swara];
  const s = SIZE_MAP[size];
  const label = notationStyle === 'full' ? meta.fullBase : meta.shortBase;

  return (
    <span
      className={`inline-flex flex-col items-center justify-center leading-none select-none ${s.gap} ${className}`}
      aria-label={`${octave} ${meta.isKomal ? 'komal ' : ''}${meta.isTivra ? 'tivra ' : ''}${meta.fullBase}`}
    >
      {/* Top mark slot: Tivra vertical stroke and/or Taar Saptak upper dot */}
      <span className="flex items-center justify-center gap-0.5 min-h-[6px]">
        {octave === 'taar' && (
          <span className={`${s.dot} rounded-full bg-current inline-block`} />
        )}
        {meta.isTivra && (
          <span
            className={`${s.tivra} bg-current rounded-full inline-block`}
            title="Tivra Ma (Sharp)"
          />
        )}
      </span>

      {/* Primary Swara glyph */}
      <span className={`${s.text} font-semibold tracking-tight leading-none`}>{label}</span>

      {/* Bottom mark slot: Komal underline & Mandra Saptak lower dot */}
      <span className="flex flex-col items-center justify-center gap-[2px] min-h-[6px]">
        {meta.isKomal && (
          <span
            className={`${s.underline} bg-current rounded-full inline-block opacity-95`}
            title="Komal (Flat)"
          />
        )}
        {octave === 'mandra' && (
          <span className={`${s.dot} rounded-full bg-current inline-block`} />
        )}
      </span>
    </span>
  );
};
