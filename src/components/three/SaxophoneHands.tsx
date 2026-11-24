import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrnamentType, SaxFingering } from '../../types/music';
import {
  SAX_EB_POS,
  SAX_GSHARP_POS,
  SAX_MAIN_KEYS,
  SAX_OCTAVE_KEY_POS,
  SAX_SIDE_BB_POS,
} from './SaxophoneModel';

interface SaxophoneHandsProps {
  fingering: SaxFingering;
  activeOrnament?: OrnamentType;
  isPlaying: boolean;
  handOpacity?: number;
}

/**
 * Single articulated translucent finger wrapping cleanly from its side flank onto a Saxophone pearl key.
 * - Left Hand (L1-L3): approaches from +X flank (top-side when sax tilts diagonally left-to-right).
 * - Right Hand (R1-R3): approaches from -X flank (bottom-side when sax tilts diagonally left-to-right).
 */
const SaxFinger: React.FC<{
  y: number;
  bodyRadius: number;
  sideSign: 1 | -1; // +1 = Left Hand (+X flank), -1 = Right Hand (-X flank)
  pressed: boolean;
  lengthScale: number;
  isGamakTarget: boolean;
  handMaterial: THREE.MeshPhysicalMaterial;
}> = ({ y, bodyRadius, sideSign, pressed, lengthScale, isGamakTarget, handMaterial }) => {
  const rootRef = useRef<THREE.Group>(null);
  const proxRef = useRef<THREE.Group>(null);
  const tipMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const smooth = useRef(pressed ? 1 : 0);

  const seg1 = 0.34 * lengthScale;
  const seg2 = 0.28 * lengthScale;
  const dirX = -sideSign; // Points inward toward x = 0 (center pearl)

  // Knuckle sits gracefully beside the brass tube on the hand's flank
  const knuckleX = sideSign * (bodyRadius + 0.42);
  const knuckleZ = bodyRadius + 0.14;

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    smooth.current = THREE.MathUtils.lerp(smooth.current, pressed ? 1 : 0, 1 - Math.exp(-15 * dt));

    const lift = 1 - smooth.current;
    const t = clock.getElapsedTime();
    const vib = isGamakTarget ? Math.sin(t * 24) * 0.035 : 0;

    if (proxRef.current) {
      // Rotate around Y-axis to lift fingertip outward (+Z) away from pearl when open!
      // Right-hand rule around +Y: rotating (-1, 0, 0) [Left Hand pointing -X] by -angle swings toward +Z!
      // Rotating (+1, 0, 0) [Right Hand pointing +X] by +angle swings toward +Z!
      // So liftAngle = -(lift * 0.34) * sideSign swings fingertip smoothly outward (+Z) for BOTH hands!
      proxRef.current.rotation.y = (-0.08 - (lift * 0.34 + vib)) * sideSign;
    }

    if (tipMatRef.current) {
      tipMatRef.current.color.set(pressed ? '#38bfa9' : '#d4a373');
      tipMatRef.current.opacity = pressed ? 0.85 : 0.15;
    }
  });

  return (
    <group ref={rootRef} position={[knuckleX, y, knuckleZ]}>
      <mesh material={handMaterial}>
        <sphereGeometry args={[0.062, 14, 14]} />
      </mesh>

      <group ref={proxRef}>
        <mesh
          position={[dirX * (seg1 * 0.5), 0, -0.02]}
          rotation={[0, 0, Math.PI / 2]}
          material={handMaterial}
        >
          <capsuleGeometry args={[0.052, Math.max(0.06, seg1 - 0.08), 8, 14]} />
        </mesh>

        {/* Middle + Distal curving gently onto pearl */}
        <group position={[dirX * seg1, 0, -0.04]} rotation={[0, 0.24 * sideSign, 0]}>
          <mesh material={handMaterial}>
            <sphereGeometry args={[0.05, 12, 12]} />
          </mesh>
          <mesh
            position={[dirX * (seg2 * 0.5), 0, -0.02]}
            rotation={[0, 0, Math.PI / 2]}
            material={handMaterial}
          >
            <capsuleGeometry args={[0.046, Math.max(0.05, seg2 - 0.06), 8, 14]} />
          </mesh>
          {/* Glowing fingertip contact pad */}
          <mesh position={[dirX * (seg2 * 0.88), 0, -0.06]}>
            <circleGeometry args={[0.05, 18]} />
            <meshBasicMaterial
              ref={tipMatRef}
              color="#38bfa9"
              transparent
              opacity={0.8}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export const SaxophoneHands: React.FC<SaxophoneHandsProps> = ({
  fingering,
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

  const octThumbRef = useRef<THREE.Group>(null);
  const gSharpPinkyRef = useRef<THREE.Group>(null);
  const ebPinkyRef = useRef<THREE.Group>(null);
  const sideBbRef = useRef<THREE.Mesh>(null);

  const hasGSharp = fingering.auxKeys.includes('G#');
  const hasSideBb = fingering.auxKeys.includes('Bb');
  const hasEb = fingering.auxKeys.includes('Eb');

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = 1 - Math.exp(-15 * dt);

    // Left Thumb physically presses rear Octave Key!
    if (octThumbRef.current) {
      const targetZ = SAX_OCTAVE_KEY_POS[2] + (fingering.octaveKey ? -0.02 : -0.14);
      octThumbRef.current.position.z = THREE.MathUtils.lerp(
        octThumbRef.current.position.z,
        targetZ,
        k
      );
    }

    // Left Pinky engages G# table key
    if (gSharpPinkyRef.current) {
      const targetX = SAX_GSHARP_POS[0] + (hasGSharp ? 0.06 : 0.18);
      gSharpPinkyRef.current.position.x = THREE.MathUtils.lerp(
        gSharpPinkyRef.current.position.x,
        targetX,
        k
      );
    }

    // Right Pinky engages Eb spatula key
    if (ebPinkyRef.current) {
      const targetX = SAX_EB_POS[0] - (hasEb ? 0.06 : 0.18);
      ebPinkyRef.current.position.x = THREE.MathUtils.lerp(
        ebPinkyRef.current.position.x,
        targetX,
        k
      );
    }

    if (sideBbRef.current) {
      const targetX = SAX_SIDE_BB_POS[0] - (hasSideBb ? 0.04 : 0.14);
      sideBbRef.current.position.x = THREE.MathUtils.lerp(sideBbRef.current.position.x, targetX, k);
    }
  });

  // Find lowest pressed pearl for subtle Gamak vibration
  let lowestIdx = 0;
  for (let i = 5; i >= 0; i--) {
    if (fingering.mainKeys[i]) {
      lowestIdx = i;
      break;
    }
  }

  return (
    <group name="saxophone-translucent-hands">
      {/* 6 Articulated Fingers over L1-L3 & R1-R3 Pearls */}
      {SAX_MAIN_KEYS.map((k, idx) => (
        <SaxFinger
          key={k.code}
          y={k.y}
          bodyRadius={k.bodyRadius}
          sideSign={k.hand === 'left' ? 1 : -1}
          pressed={fingering.mainKeys[idx]}
          lengthScale={idx % 3 === 1 ? 1.04 : 0.96}
          isGamakTarget={isPlaying && activeOrnament === 'gamak' && idx === lowestIdx}
          handMaterial={handMaterial}
        />
      ))}

      {/* LEFT HAND PALM & WRIST (+X flank, upper stack — snug organic fit) */}
      <group position={[0.58, 0.72, -0.02]}>
        <mesh
          rotation={[0, -0.42, 0.1]}
          scale={[0.19, 0.5, 0.36]}
          material={handMaterial}
        >
          <sphereGeometry args={[1, 22, 22]} />
        </mesh>
        {/* Knuckle bridge L1-L3 */}
        <mesh position={[-0.04, 0, 0.28]} material={handMaterial}>
          <capsuleGeometry args={[0.066, 0.84, 8, 16]} />
        </mesh>
        {/* Soft wrist taper */}
        <mesh position={[0.22, 0.04, -0.32]} rotation={[0.45, 0.62, 0]} material={handMaterial}>
          <capsuleGeometry args={[0.125, 0.32, 10, 16]} />
        </mesh>
      </group>

      {/* Left Thumb pressing rear Octave Key */}
      <group ref={octThumbRef} position={[0.14, SAX_OCTAVE_KEY_POS[1], SAX_OCTAVE_KEY_POS[2] - 0.12]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.058, 0.28, 8, 14]} />
        </mesh>
        <mesh position={[-0.14, 0, 0.04]} visible={fingering.octaveKey}>
          <sphereGeometry args={[0.055, 14, 14]} />
          <meshBasicMaterial color="#f4a261" transparent opacity={0.82} />
        </mesh>
      </group>

      {/* Left Pinky over G# Table Key */}
      <group ref={gSharpPinkyRef} position={[SAX_GSHARP_POS[0] + 0.16, SAX_GSHARP_POS[1], SAX_GSHARP_POS[2] + 0.06]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.042, 0.24, 8, 12]} />
        </mesh>
      </group>

      {/* RIGHT HAND PALM & WRIST (-X flank, lower stack — cleanly visible!) */}
      <group position={[-0.64, -0.62, 0.02]}>
        <mesh
          rotation={[0, 0.42, -0.1]}
          scale={[0.19, 0.52, 0.36]}
          material={handMaterial}
        >
          <sphereGeometry args={[1, 22, 22]} />
        </mesh>
        {/* Knuckle bridge R1-R3 */}
        <mesh position={[0.04, 0, 0.32]} material={handMaterial}>
          <capsuleGeometry args={[0.066, 0.86, 8, 16]} />
        </mesh>
        {/* Soft wrist taper */}
        <mesh position={[-0.22, -0.06, -0.32]} rotation={[0.45, -0.62, 0]} material={handMaterial}>
          <capsuleGeometry args={[0.125, 0.32, 10, 16]} />
        </mesh>
      </group>

      {/* Right Thumb resting in rear brass hook */}
      <group position={[-0.16, -0.58, -0.32]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={handMaterial}>
          <capsuleGeometry args={[0.06, 0.3, 8, 14]} />
        </mesh>
      </group>

      {/* Right Index Side-Knuckle nudge for Side Bb */}
      <mesh
        ref={sideBbRef}
        position={[SAX_SIDE_BB_POS[0] - 0.14, SAX_SIDE_BB_POS[1], SAX_SIDE_BB_POS[2] + 0.04]}
        rotation={[0, 0, Math.PI / 2]}
        material={handMaterial}
      >
        <capsuleGeometry args={[0.045, 0.18, 8, 12]} />
      </mesh>

      {/* Right Pinky over Eb Spatula Key */}
      <group ref={ebPinkyRef} position={[SAX_EB_POS[0] - 0.16, SAX_EB_POS[1], SAX_EB_POS[2] + 0.04]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.042, 0.24, 8, 12]} />
        </mesh>
      </group>
    </group>
  );
};
