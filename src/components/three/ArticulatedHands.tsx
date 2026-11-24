import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HolePattern, OrnamentType } from '../../types/music';
import { FINGER_HOLES, FLUTE_RADIUS } from './fluteGeometry';

interface ArticulatedHandsProps {
  holes: HolePattern;
  activeOrnament?: OrnamentType;
  isPlaying: boolean;
  handOpacity?: number;
}

interface FingerConfig {
  holeIndex: number;
  x: number;
  zOffset: number;
  /**
   * Standard Right-Handed Bansuri Ergonomics (Player at +Z looking toward -Z; flute extends to +X):
   * - Left Hand (Holes 1, 2, 3): wraps from far side (-Z) curling back toward player (+Z) => sideSign = -1
   *   (Index = L1 on left/-X, Middle = L2, Ring = L3 on right/+X)
   * - Right Hand (Holes 4, 5, 6, 7): reaches from near/player side (+Z) forward toward (-Z) => sideSign = +1
   *   (Index = R1 on left/-X, Middle = R2, Ring = R3, Pinky = R4 on right/+X)
   */
  sideSign: 1 | -1;
  lengthScale: number;
}

const FINGER_CONFIGS: FingerConfig[] = [
  // Left Hand (Holes 1, 2, 3) — Knuckles on -Z (far side), fingers curl toward +Z (player side)
  { holeIndex: 0, x: FINGER_HOLES[0].x, zOffset: FINGER_HOLES[0].zOffset, sideSign: -1, lengthScale: 0.96 },
  { holeIndex: 1, x: FINGER_HOLES[1].x, zOffset: FINGER_HOLES[1].zOffset, sideSign: -1, lengthScale: 1.03 },
  { holeIndex: 2, x: FINGER_HOLES[2].x, zOffset: FINGER_HOLES[2].zOffset, sideSign: -1, lengthScale: 0.97 },
  // Right Hand (Holes 4, 5, 6, 7) — Knuckles on +Z (player side), fingers arch forward toward -Z
  { holeIndex: 3, x: FINGER_HOLES[3].x, zOffset: FINGER_HOLES[3].zOffset, sideSign: 1, lengthScale: 0.96 },
  { holeIndex: 4, x: FINGER_HOLES[4].x, zOffset: FINGER_HOLES[4].zOffset, sideSign: 1, lengthScale: 1.03 },
  { holeIndex: 5, x: FINGER_HOLES[5].x, zOffset: FINGER_HOLES[5].zOffset, sideSign: 1, lengthScale: 0.97 },
  { holeIndex: 6, x: FINGER_HOLES[6].x, zOffset: FINGER_HOLES[6].zOffset, sideSign: 1, lengthScale: 0.78 },
];

/**
 * Gracefully articulated translucent finger calibrated so:
 * - Closed (1.0): Fingertip pad rests flush on the hole center, glowing jade teal.
 * - Open (0.0): Finger lifts naturally (~24 deg) into a relaxed hover directly above the hole.
 * - Half-Hole (0.5): Fingertip stays close to the bamboo and slides halfway back along the finger
 *   axis toward its knuckle, exposing the open 50% of the amber split-circle indicator underneath.
 */
const ArticulatedFinger: React.FC<{
  config: FingerConfig;
  state: 0 | 0.5 | 1;
  activeOrnament?: OrnamentType;
  isPlaying: boolean;
  isLowestActive: boolean;
  handMaterial: THREE.MeshPhysicalMaterial;
}> = ({ config, state, activeOrnament, isPlaying, isLowestActive, handMaterial }) => {
  const fingerRootRef = useRef<THREE.Group>(null);
  const proximalRef = useRef<THREE.Group>(null);
  const middleRef = useRef<THREE.Group>(null);
  const tipPadMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const smoothState = useRef<number>(state);
  const dir = config.sideSign;
  const segAxisZ = -dir; // Direction from knuckle toward hole center

  const proxLen = 0.44 * config.lengthScale;
  const midLen = 0.34 * config.lengthScale;
  const distLen = 0.24 * config.lengthScale;
  const reachZ = proxLen + midLen * 0.88 + distLen * 0.65;

  const knuckleZ = config.zOffset + dir * reachZ;
  const knuckleY = FLUTE_RADIUS + 0.14;

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const speed = activeOrnament === 'meend' ? 6.2 : 14.5;
    smoothState.current = THREE.MathUtils.lerp(smoothState.current, state, 1 - Math.exp(-speed * dt));

    const s = smoothState.current;
    const t = clock.getElapsedTime();

    const liftAmount = THREE.MathUtils.clamp(1 - s * 1.9, 0, 1);
    const halfBell = Math.max(0, 1 - Math.abs(s - 0.5) * 2.4);

    let gamakOffset = 0;
    if (isPlaying && activeOrnament === 'gamak' && isLowestActive) {
      gamakOffset = Math.sin(t * 25) * 0.04;
    }

    // Half-hole slides fingertip 50% back toward its knuckle (`dir`) while staying low over bamboo
    if (fingerRootRef.current) {
      const slideBack = halfBell * 0.105 * dir;
      fingerRootRef.current.position.z = knuckleZ + slideBack;
      fingerRootRef.current.position.y = knuckleY + halfBell * 0.015 + Math.abs(gamakOffset) * 0.25;
    }

    // Right-hand rule around +X: rotating segAxisZ = (0,0,-dir) by +(angle * dir) lifts UP (+Y) for BOTH hands
    if (proximalRef.current) {
      const closedSlope = -0.06 * dir;
      const openLift = (liftAmount * 0.32 + gamakOffset) * dir;
      proximalRef.current.rotation.x = closedSlope + openLift;
    }

    // Gentle downward finger curl toward bamboo surface
    if (middleRef.current) {
      const pipCurl = (-0.24 + liftAmount * 0.08 + halfBell * 0.06) * dir;
      middleRef.current.rotation.x = pipCurl;
    }

    if (tipPadMatRef.current) {
      if (state === 1) {
        tipPadMatRef.current.color.set('#38bfa9');
        tipPadMatRef.current.opacity = 0.85;
      } else if (state === 0.5) {
        tipPadMatRef.current.color.set('#f4a261');
        tipPadMatRef.current.opacity = 0.9;
      } else {
        tipPadMatRef.current.color.set('#d4a373');
        tipPadMatRef.current.opacity = 0.16;
      }
    }
  });

  return (
    <group ref={fingerRootRef} position={[config.x, knuckleY, knuckleZ]}>
      {/* Smooth MCP Knuckle */}
      <mesh material={handMaterial}>
        <sphereGeometry args={[0.068, 16, 16]} />
      </mesh>

      {/* Proximal Phalanx */}
      <group ref={proximalRef}>
        <mesh
          position={[0, 0, segAxisZ * (proxLen * 0.5)]}
          rotation={[Math.PI / 2, 0, 0]}
          material={handMaterial}
        >
          <capsuleGeometry args={[0.058, Math.max(0.06, proxLen - 0.09), 8, 16]} />
        </mesh>

        {/* PIP Joint + Middle Phalanx */}
        <group ref={middleRef} position={[0, 0, segAxisZ * proxLen]}>
          <mesh material={handMaterial}>
            <sphereGeometry args={[0.056, 14, 14]} />
          </mesh>

          <mesh
            position={[0, 0, segAxisZ * (midLen * 0.5)]}
            rotation={[Math.PI / 2, 0, 0]}
            material={handMaterial}
          >
            <capsuleGeometry args={[0.052, Math.max(0.06, midLen - 0.07), 8, 16]} />
          </mesh>

          {/* Distal Phalanx & Luminous Contact Pad */}
          <group position={[0, 0, segAxisZ * midLen]} rotation={[-0.14 * dir, 0, 0]}>
            <mesh
              position={[0, 0, segAxisZ * (distLen * 0.45)]}
              rotation={[Math.PI / 2, 0, 0]}
              material={handMaterial}
            >
              <capsuleGeometry args={[0.048, distLen * 0.68, 8, 16]} />
            </mesh>

            <mesh
              position={[0, -0.044, segAxisZ * (distLen * 0.62)]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[0.054, 20]} />
              <meshBasicMaterial
                ref={tipPadMatRef}
                color="#38bfa9"
                transparent
                opacity={0.8}
                depthWrite={false}
              />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

export const ArticulatedHands: React.FC<ArticulatedHandsProps> = ({
  holes,
  activeOrnament,
  isPlaying,
  handOpacity = 0.34,
}) => {
  const handMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f5e6d3'),
        emissive: new THREE.Color('#7a5938'),
        emissiveIntensity: 0.22,
        roughness: 0.25,
        metalness: 0.06,
        transparent: true,
        opacity: handOpacity,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        depthWrite: false,
      }),
    [handOpacity]
  );

  let lowestActiveIdx = 0;
  for (let i = 5; i >= 0; i--) {
    if (holes[i] > 0) {
      lowestActiveIdx = i;
      break;
    }
  }

  return (
    <group name="translucent-hands">
      {FINGER_CONFIGS.map((cfg) => (
        <ArticulatedFinger
          key={`finger-${cfg.holeIndex}`}
          config={cfg}
          state={holes[cfg.holeIndex] ?? 0}
          activeOrnament={activeOrnament}
          isPlaying={isPlaying}
          isLowestActive={cfg.holeIndex === lowestActiveIdx}
          handMaterial={handMaterial}
        />
      ))}

      {/* ====================================================================
          LEFT HAND (Holes 1–3): Wraps cleanly from far side (-Z), palm facing player (+Z)
          ==================================================================== */}
      <group position={[-0.26, -0.02, -1.04]}>
        {/* Sculpted smooth Left Palm */}
        <mesh
          position={[0, -0.06, -0.2]}
          rotation={[-0.52, 0, 0]}
          scale={[0.74, 0.19, 0.46]}
          material={handMaterial}
        >
          <sphereGeometry args={[1, 24, 24]} />
        </mesh>
        {/* Rounded knuckle bridge connecting L1–L3 */}
        <mesh position={[0, 0.36, 0.14]} rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.078, 1.08, 8, 18]} />
        </mesh>
        {/* Soft wrist taper extending gracefully back-left */}
        <mesh position={[-0.2, -0.34, -0.52]} rotation={[-0.82, -0.18, 0]} material={handMaterial}>
          <capsuleGeometry args={[0.16, 0.42, 10, 18]} />
        </mesh>
      </group>

      {/* Left Thumb supporting underneath the bamboo shaft near Hole 1 */}
      <group position={[-0.78, -FLUTE_RADIUS - 0.05, -0.18]} rotation={[-0.24, 0.22, -0.14]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={handMaterial}>
          <capsuleGeometry args={[0.068, 0.44, 8, 16]} />
        </mesh>
      </group>

      {/* ====================================================================
          RIGHT HAND (Holes 4–7): Reaches naturally from player side (+Z) over Holes 4–7
          ==================================================================== */}
      <group position={[1.82, -0.06, 1.02]}>
        {/* Sculpted smooth Right Palm (trimmer perspective proportion on +Z) */}
        <mesh
          position={[0.04, -0.08, 0.18]}
          rotation={[0.58, 0, 0]}
          scale={[0.84, 0.15, 0.36]}
          material={handMaterial}
        >
          <sphereGeometry args={[1, 24, 24]} />
        </mesh>
        {/* Rounded knuckle bridge connecting R1–R4 */}
        <mesh position={[0.06, 0.38, -0.14]} rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.074, 1.72, 8, 18]} />
        </mesh>
        {/* Soft wrist taper sloping downward toward player's right forearm */}
        <mesh position={[0.24, -0.34, 0.46]} rotation={[0.88, 0.16, 0]} material={handMaterial}>
          <capsuleGeometry args={[0.145, 0.38, 10, 18]} />
        </mesh>
      </group>

      {/* Right Thumb cradling underneath the bamboo shaft between R1 and R2 */}
      <group position={[1.24, -FLUTE_RADIUS - 0.05, 0.18]} rotation={[0.24, -0.22, 0.14]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={handMaterial}>
          <capsuleGeometry args={[0.068, 0.46, 8, 16]} />
        </mesh>
      </group>
    </group>
  );
};
