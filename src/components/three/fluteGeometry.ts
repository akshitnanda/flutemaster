/**
 * Shared 3D spatial constants for the Bansuri model, finger holes, and articulated hands
 * ensuring exact geometric alignment between fingertips and bamboo tone holes.
 */
export const FLUTE_LENGTH = 8.4;
export const FLUTE_RADIUS = 0.23;
export const BLOWING_HOLE_X = -2.88;

export interface HoleSpec {
  index: number;
  code: string;
  x: number;
  /** Slight forward Z offset for ergonomic natural finger curvature */
  zOffset: number;
  radius: number;
  hand: 'left' | 'right';
}

export const FINGER_HOLES: HoleSpec[] = [
  { index: 0, code: 'L1', x: -0.82, zOffset: 0.0, radius: 0.092, hand: 'left' },
  { index: 1, code: 'L2', x: -0.26, zOffset: 0.0, radius: 0.095, hand: 'left' },
  { index: 2, code: 'L3', x: 0.30, zOffset: 0.01, radius: 0.092, hand: 'left' },
  { index: 3, code: 'R1', x: 0.98, zOffset: 0.0, radius: 0.096, hand: 'right' },
  { index: 4, code: 'R2', x: 1.54, zOffset: 0.0, radius: 0.098, hand: 'right' },
  { index: 5, code: 'R3', x: 2.10, zOffset: 0.01, radius: 0.095, hand: 'right' },
  // 7th Pinky / Tuning hole gently offset forward
  { index: 6, code: 'R4', x: 2.82, zOffset: 0.055, radius: 0.082, hand: 'right' },
];

export const SILK_BINDINGS: Array<{ x: number; width: number; primary: string; trim: string }> = [
  { x: -3.72, width: 0.28, primary: '#8c2327', trim: '#e9c46a' },
  { x: -2.18, width: 0.22, primary: '#1e6b63', trim: '#e9c46a' },
  { x: -1.32, width: 0.16, primary: '#8c2327', trim: '#d4a373' },
  { x: 0.64, width: 0.22, primary: '#8c2327', trim: '#e9c46a' },
  { x: 2.46, width: 0.16, primary: '#1e6b63', trim: '#e9c46a' },
  { x: 3.68, width: 0.28, primary: '#8c2327', trim: '#e9c46a' },
];

export const BAMBOO_NODES_X = [-3.35, -1.72, 0.64, 3.18];
