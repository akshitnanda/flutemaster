import { Octave, OrnamentType, Song, SongEra, SongNote, SwaraId, TalaType } from '../types/music';
import { BANSURI_SCALES } from './sargam';

type CompactNoteTuple = [
  SwaraId,
  0 | 1 | 2, // octave: 0=mandra, 1=madhya, 2=taar
  number, // startBeat
  number, // durationBeats
  string, // lyric
  0 | 1, // breathAfter
  OrnamentType?,
  SwaraId?,
  (0 | 1 | 2)?
];

interface CompactSong {
  id: string;
  t: string;
  m: string;
  y: number;
  c: string;
  sg: string;
  e: SongEra;
  d: 'Beginner' | 'Intermediate' | 'Advanced';
  sc: string;
  r: string;
  tl: TalaType;
  bpm: number;
  url: string;
  yt?: string;
  tb: number;
  sec: Array<[string, string, number, number]>;
  n: CompactNoteTuple[];
}

const OCT_FROM_CODE: Record<0 | 1 | 2, Octave> = {
  0: 'mandra',
  1: 'madhya',
  2: 'taar',
};

let cachedImported: Song[] | null = null;

export async function loadExpandedLibrary(): Promise<Song[]> {
  if (cachedImported) return cachedImported;

  try {
    const resp = await fetch('/data/library.json');
    if (!resp.ok) return [];
    const raw: CompactSong[] = await resp.json();

    cachedImported = raw.map((item) => {
      const scale = BANSURI_SCALES[item.sc] ?? BANSURI_SCALES.G_BASS;
      const beatsPerBar = item.tl === 'dadra' ? 6 : 8;

      const notes: SongNote[] = item.n.map((tuple, idx) => {
        const [swara, octCode, startBeat, durationBeats, lyric, breathFlag, ornType, graceSwara, graceOct] =
          tuple;
        return {
          id: `${item.id}-n${idx}`,
          swara,
          octave: OCT_FROM_CODE[octCode] ?? 'madhya',
          startBeat,
          durationBeats,
          lyric,
          breathAfter: breathFlag === 1,
          ornament: ornType
            ? {
                type: ornType,
                graceSwara,
                graceOctave: graceOct !== undefined ? OCT_FROM_CODE[graceOct] : undefined,
                label: ornType === 'meend' ? 'Meend' : ornType === 'kan' ? 'Kan' : 'Gamak',
              }
            : undefined,
        };
      });

      return {
        id: item.id,
        title: item.t,
        movie: item.m,
        year: item.y,
        composer: item.c,
        singers: item.sg,
        era: item.e,
        difficulty: item.d,
        scale,
        raga: item.r,
        tala: item.tl,
        talaLabel: item.tl === 'dadra' ? 'Dadra (6 beats)' : 'Keherwa (8 beats)',
        beatsPerBar,
        bpm: item.bpm,
        description: `${item.r !== 'Hindustani Sargam' ? `Raag ${item.r} · ` : ''}${item.m} (${item.y}) · ${item.sg}`,
        featured: false,
        sourceUrl: item.url,
        youtubeId: item.yt,
        youtubeTitle: item.yt ? `${item.t} — Reference Rendition` : undefined,
        sections: item.sec.map(([id, name, startBeat, endBeat]) => ({
          id,
          name,
          startBeat,
          endBeat,
        })),
        notes,
        totalBeats: item.tb,
      };
    });

    return cachedImported;
  } catch {
    return [];
  }
}
