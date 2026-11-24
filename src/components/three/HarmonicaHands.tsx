import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HarmonicaTab, OrnamentType } from '../../types/music';
import { HARMONICA_DEPTH, HARMONICA_WIDTH } from './HarmonicaModel';

interface HarmonicaHandsProps {
  tab: HarmonicaTab;
  activeOrnament?: OrnamentType;
  isPlaying: boolean;
  handOpacity?: number;
}

/**
 * Anatomically accurate translucent cupping hands for a 12-Hole Chromatic Harmonica:
 * - Left Hand cradles the left end (-X) between Left Thumb (bottom) and Left Index (top),
 *   curving behind (-Z) to form a natural acoustic chamber without obstructing Holes 1–12.
 * - Right Hand cups the right end (+X) with Right Index Finger positioned directly on the
 *   Chromatic Slide Button — physically pushing it IN on Komal/Tivra notes and releasing
 *   smoothly on Shuddha notes! Performs subtle hand-cupping Wah vibrato on Gamak ornaments.
 */
export const HarmonicaHands: React.FC<HarmonicaHandsProps> = ({
  tab,
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

  const slideFingerRef = useRef<THREE.Group>(null);
  const rightCupRef = useRef<THREE.Group>(null);
  const slideTipMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const smoothSlide = useRef(tab.slide ? 1 : 0);

  const mouthpieceZ = HARMONICA_DEPTH / 2 - 0.02;

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    smoothSlide.current = THREE.MathUtils.lerp(
      smoothSlide.current,
      tab.slide ? 1 : 0,
      1 - Math.exp(-18 * dt)
    );

    // Right Index Finger physically presses the chromatic slide plunger IN (-X)
    if (slideFingerRef.current) {
      slideFingerRef.current.position.x =
        HARMONICA_WIDTH / 2 + 0.56 - smoothSlide.current * 0.22;
    }

    if (slideTipMatRef.current) {
      slideTipMatRef.current.color.set(tab.slide ? '#f4a261' : '#d4a373');
      slideTipMatRef.current.opacity = tab.slide ? 0.9 : 0.16;
    }

    // Authentic Bollywood hand-cupping Wah Vibrato on right hand during Gamak!
    if (rightCupRef.current) {
      const targetRotY =
        isPlaying && activeOrnament === 'gamak' ? Math.sin(t * 16) * 0.14 : 0;
      rightCupRef.current.rotation.y = THREE.MathUtils.lerp(
        rightCupRef.current.rotation.y,
        targetRotY,
        1 - Math.exp(-12 * dt)
      );
    }
  });

  return (
    <group name="harmonica-translucent-hands">
      {/* ====================================================================
          LEFT HAND (-X): Cradles left cover plate & forms warm rear resonance cup
          ==================================================================== */}
      <group position={[-HARMONICA_WIDTH / 2 - 0.18, -0.02, -0.18]}>
        {/* Sculpted Left Palm cupping rear-left flank */}
        <mesh
          position={[-0.22, -0.06, -0.34]}
          rotation={[0.25, 0.55, 0.15]}
          scale={[0.36, 0.44, 0.62]}
          material={handMaterial}
        >
          <sphereGeometry args={[1, 22, 22]} />
        </mesh>

        {/* Left Index resting cleanly along far-left top cover shoulder (clear of Holes 1-12!) */}
        <mesh position={[0.24, 0.39, 0.12]} rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.065, 0.52, 8, 16]} />
        </mesh>

        {/* Left Thumb cradling underside of bottom cover plate */}
        <mesh position={[0.28, -0.39, 0.26]} rotation={[0, 0.12, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.072, 0.58, 8, 16]} />
        </mesh>

        {/* Curled rear tone-chamber fingers */}
        {[-0.08, -0.22, -0.36].map((fy, i) => (
          <mesh
            key={`lcup-${i}`}
            position={[0.16, fy, -0.58]}
            rotation={[0, 0.28, Math.PI / 2]}
            material={handMaterial}
          >
            <capsuleGeometry args={[0.056, 0.56 - i * 0.06, 8, 14]} />
          </mesh>
        ))}

        {/* Soft Left Wrist taper */}
        <mesh position={[-0.64, -0.26, -0.18]} rotation={[0.3, 0.4, 1.15]} material={handMaterial}>
          <capsuleGeometry args={[0.16, 0.42, 10, 16]} />
        </mesh>
      </group>

      {/* ====================================================================
          RIGHT HAND (+X): Cups right flank + Index pushes Chromatic Slide Button
          ==================================================================== */}
      <group ref={rightCupRef} position={[HARMONICA_WIDTH / 2 + 0.18, -0.02, -0.18]}>
        {/* Sculpted Right Palm cupping rear-right chamber */}
        <mesh
          position={[0.34, -0.08, -0.28]}
          rotation={[0.22, -0.52, -0.14]}
          scale={[0.36, 0.44, 0.62]}
          material={handMaterial}
        >
          <sphereGeometry args={[1, 22, 22]} />
        </mesh>

        {/* Right Thumb stabilizing underside of bottom cover plate */}
        <mesh position={[-0.22, -0.39, 0.28]} rotation={[0, -0.14, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.072, 0.56, 8, 16]} />
        </mesh>

        {/* Right Middle/Ring/Pinky cupping rear chamber */}
        {[-0.1, -0.24, -0.38].map((fy, i) => (
          <mesh
            key={`rcup-${i}`}
            position={[-0.06, fy, -0.56]}
            rotation={[0, -0.28, Math.PI / 2]}
            material={handMaterial}
          >
            <capsuleGeometry args={[0.056, 0.54 - i * 0.06, 8, 14]} />
          </mesh>
        ))}

        {/* Soft Right Wrist taper */}
        <mesh position={[0.74, -0.28, -0.14]} rotation={[0.3, -0.4, -1.15]} material={handMaterial}>
          <capsuleGeometry args={[0.16, 0.42, 10, 16]} />
        </mesh>
      </group>

      {/* Articulated Right Index Finger pressing the Chromatic Slide Button */}
      <group ref={slideFingerRef} position={[HARMONICA_WIDTH / 2 + 0.56, 0.0, mouthpieceZ - 0.02]}>
        {/* Proximal + Distal Slide Finger aligned straight along X into the plunger */}
        <mesh position={[0.16, 0, -0.08]} rotation={[0, -0.28, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.062, 0.44, 8, 16]} />
        </mesh>
        {/* Glowing fingertip contact pad on the slide plunger cap */}
        <mesh position={[-0.06, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.068, 20]} />
          <meshBasicMaterial
            ref={slideTipMatRef}
            color="#f4a261"
            transparent
            opacity={0.85}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
};
