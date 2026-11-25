import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EwiFingering, OrnamentType } from '../../types/music';
import {
  EWI_LP_SHARP_POS,
  EWI_MAIN_PADS,
  EWI_OCTAVE_BASE_POS,
  EWI_OCTAVE_STEP_Y,
  EWI_PITCH_BEND_POS,
  EWI_RP_EB_POS,
  EWI_SIDE_BB_POS,
} from './EwiModel';
import { createStudioHandMaterial } from './handMaterial';

interface EwiHandsProps {
  fingering: EwiFingering;
  activeOrnament?: OrnamentType;
  isPlaying: boolean;
  handOpacity?: number;
}

/**
 * Articulated translucent finger tailored for noiseless capacitive touch pads on the Eastar EDA-100.
 * Hover distance is deliberately sleek & close (~2-3mm capacitive hover when open, feather-light touch when closed!).
 */
const EwiFinger: React.FC<{
  y: number;
  bodyRadius: number;
  sideSign: 1 | -1; // +1 = Left Hand (+X flank), -1 = Right Hand (-X flank)
  touched: boolean;
  lengthScale: number;
  isGamakTarget: boolean;
  handMaterial: THREE.MeshPhysicalMaterial;
}> = ({ y, bodyRadius, sideSign, touched, lengthScale, isGamakTarget, handMaterial }) => {
  const proxRef = useRef<THREE.Group>(null);
  const tipMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const smooth = useRef(touched ? 1 : 0);

  const seg1 = 0.31 * lengthScale;
  const seg2 = 0.25 * lengthScale;
  const dirX = -sideSign;

  const knuckleX = sideSign * (bodyRadius + 0.37);
  const knuckleZ = bodyRadius + 0.09;

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    smooth.current = THREE.MathUtils.lerp(
      smooth.current,
      touched ? 1 : 0,
      1 - Math.exp(-18 * dt)
    );

    const lift = 1 - smooth.current;
    const t = clock.getElapsedTime();
    const vib = isGamakTarget ? Math.sin(t * 24) * 0.025 : 0;

    if (proxRef.current) {
      // Right-hand rule around +Y lifts both hands cleanly outward (+Z)
      proxRef.current.rotation.y = (-0.06 - (lift * 0.28 + vib)) * sideSign;
    }

    if (tipMatRef.current) {
      tipMatRef.current.color.set(touched ? '#72efdd' : '#d4a373');
      tipMatRef.current.opacity = touched ? 0.88 : 0.14;
    }
  });

  return (
    <group position={[knuckleX, y, knuckleZ]}>
      <mesh material={handMaterial}>
        <sphereGeometry args={[0.056, 14, 14]} />
      </mesh>

      <group ref={proxRef}>
        <mesh
          position={[dirX * (seg1 * 0.5), 0, -0.02]}
          rotation={[0, 0, Math.PI / 2]}
          material={handMaterial}
        >
          <capsuleGeometry args={[0.047, Math.max(0.05, seg1 - 0.07), 8, 14]} />
        </mesh>

        <group position={[dirX * seg1, 0, -0.035]} rotation={[0, 0.22 * sideSign, 0]}>
          <mesh material={handMaterial}>
            <sphereGeometry args={[0.046, 12, 12]} />
          </mesh>
          <mesh
            position={[dirX * (seg2 * 0.5), 0, -0.018]}
            rotation={[0, 0, Math.PI / 2]}
            material={handMaterial}
          >
            <capsuleGeometry args={[0.042, Math.max(0.05, seg2 - 0.06), 8, 14]} />
          </mesh>
          {/* Capacitive fingertip glow contact dot */}
          <mesh position={[dirX * (seg2 * 0.88), 0, -0.052]}>
            <circleGeometry args={[0.046, 18]} />
            <meshBasicMaterial
              ref={tipMatRef}
              color="#72efdd"
              transparent
              opacity={0.85}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export const EwiHands: React.FC<EwiHandsProps> = ({
  fingering,
  activeOrnament,
  isPlaying,
  handOpacity = 0.23,
}) => {
  const handMaterial = useMemo(
    () =>
      createStudioHandMaterial({
        baseColor: '#e6eff2',
        emissiveColor: '#294049',
        rimColor: '#c2f7ed',
        opacity: handOpacity,
        fresnelPower: 2.35,
        fresnelStrength: 0.72,
        rimAlphaBoost: 0.5,
      }),
    [handOpacity]
  );

  useEffect(() => () => handMaterial.dispose(), [handMaterial]);

  const octThumbRef = useRef<THREE.Group>(null);
  const pbThumbRef = useRef<THREE.Group>(null);
  const lpPinkyRef = useRef<THREE.Group>(null);
  const rpPinkyRef = useRef<THREE.Group>(null);
  const sideBbRef = useRef<THREE.Mesh>(null);

  const hasLeftPinky =
    fingering.auxPads.includes('G#') || fingering.auxPads.includes('Sharp');
  const hasSideBb =
    fingering.auxPads.includes('Bb') || fingering.auxPads.includes('Flat');
  const hasEb = fingering.auxPads.includes('Eb');

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = 1 - Math.exp(-16 * dt);
    const t = clock.getElapsedTime();

    // Left Thumb glides smoothly between OCT+ (+Y), 0 (center), and OCT- (-Y) rear rollers!
    if (octThumbRef.current) {
      const targetY = EWI_OCTAVE_BASE_POS[1] + fingering.octaveShift * EWI_OCTAVE_STEP_Y;
      const targetZ = EWI_OCTAVE_BASE_POS[2] - 0.055;
      octThumbRef.current.position.y = THREE.MathUtils.lerp(
        octThumbRef.current.position.y,
        targetY,
        k
      );
      octThumbRef.current.position.z = THREE.MathUtils.lerp(
        octThumbRef.current.position.z,
        targetZ,
        k
      );
    }

    // Right Thumb visibly moves up onto the Pitch Bend pad during Meend / Gamak!
    if (pbThumbRef.current) {
      const targetY = fingering.pitchBendActive
        ? EWI_PITCH_BEND_POS[1] + (activeOrnament === 'gamak' ? Math.sin(t * 22) * 0.03 : 0.02)
        : -0.86;
      const targetX = fingering.pitchBendActive ? EWI_PITCH_BEND_POS[0] - 0.03 : -0.14;
      const targetZ = fingering.pitchBendActive ? EWI_PITCH_BEND_POS[2] - 0.03 : -0.27;
      pbThumbRef.current.position.x = THREE.MathUtils.lerp(
        pbThumbRef.current.position.x,
        targetX,
        k
      );
      pbThumbRef.current.position.y = THREE.MathUtils.lerp(
        pbThumbRef.current.position.y,
        targetY,
        k
      );
      pbThumbRef.current.position.z = THREE.MathUtils.lerp(
        pbThumbRef.current.position.z,
        targetZ,
        k
      );
    }

    if (lpPinkyRef.current) {
      const targetX = EWI_LP_SHARP_POS[0] + (hasLeftPinky ? 0.05 : 0.16);
      lpPinkyRef.current.position.x = THREE.MathUtils.lerp(
        lpPinkyRef.current.position.x,
        targetX,
        k
      );
    }

    if (rpPinkyRef.current) {
      const targetX = EWI_RP_EB_POS[0] - (hasEb ? 0.05 : 0.16);
      rpPinkyRef.current.position.x = THREE.MathUtils.lerp(
        rpPinkyRef.current.position.x,
        targetX,
        k
      );
    }

    if (sideBbRef.current) {
      const targetX = EWI_SIDE_BB_POS[0] - (hasSideBb ? 0.04 : 0.13);
      sideBbRef.current.position.x = THREE.MathUtils.lerp(
        sideBbRef.current.position.x,
        targetX,
        k
      );
    }
  });

  let lowestIdx = 0;
  for (let i = 5; i >= 0; i--) {
    if (fingering.mainPads[i]) {
      lowestIdx = i;
      break;
    }
  }

  return (
    <group name="ewi-translucent-hands">
      {/* 6 Articulated Fingers over Capacitive Touch Pads L1-L3 & R1-R3 */}
      {EWI_MAIN_PADS.map((pad, idx) => (
        <EwiFinger
          key={pad.code}
          y={pad.y}
          bodyRadius={pad.bodyRadius}
          sideSign={pad.hand === 'left' ? 1 : -1}
          touched={fingering.mainPads[idx]}
          lengthScale={idx % 3 === 1 ? 1.04 : 0.96}
          isGamakTarget={isPlaying && activeOrnament === 'gamak' && idx === lowestIdx}
          handMaterial={handMaterial}
        />
      ))}

      {/* LEFT HAND PALM & WRIST (+X upper flank) */}
      <group position={[0.53, 0.64, -0.02]}>
        <mesh rotation={[0, -0.42, 0.1]} scale={[0.175, 0.47, 0.33]} material={handMaterial}>
          <sphereGeometry args={[1, 20, 20]} />
        </mesh>
        <mesh position={[-0.03, 0, 0.25]} material={handMaterial}>
          <capsuleGeometry args={[0.06, 0.82, 8, 16]} />
        </mesh>
        <mesh position={[0.2, 0.04, -0.28]} rotation={[0.45, 0.6, 0]} material={handMaterial}>
          <capsuleGeometry args={[0.115, 0.3, 10, 16]} />
        </mesh>
      </group>

      {/* Left Thumb rolling across rear Octave Pads (OCT+ / 0 / OCT-) */}
      <group
        ref={octThumbRef}
        position={[0.15, EWI_OCTAVE_BASE_POS[1], EWI_OCTAVE_BASE_POS[2] - 0.055]}
      >
        <mesh rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.054, 0.25, 8, 14]} />
        </mesh>
        <mesh position={[-0.12, 0, 0.03]} visible={fingering.octaveShift !== 0}>
          <sphereGeometry args={[0.048, 14, 14]} />
          <meshBasicMaterial
            color={fingering.octaveShift === 1 ? '#f4a261' : '#72efdd'}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>

      {/* Left Pinky over G# / +½ Sharp Touch Pad */}
      <group
        ref={lpPinkyRef}
        position={[EWI_LP_SHARP_POS[0] + 0.15, EWI_LP_SHARP_POS[1], EWI_LP_SHARP_POS[2] + 0.04]}
      >
        <mesh rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.038, 0.22, 8, 12]} />
        </mesh>
      </group>

      {/* RIGHT HAND PALM & WRIST (-X lower flank) */}
      <group position={[-0.56, -0.72, 0]}>
        <mesh rotation={[0, 0.42, -0.1]} scale={[0.175, 0.48, 0.33]} material={handMaterial}>
          <sphereGeometry args={[1, 20, 20]} />
        </mesh>
        <mesh position={[0.03, 0, 0.27]} material={handMaterial}>
          <capsuleGeometry args={[0.06, 0.84, 8, 16]} />
        </mesh>
        <mesh position={[-0.2, -0.05, -0.28]} rotation={[0.45, -0.6, 0]} material={handMaterial}>
          <capsuleGeometry args={[0.115, 0.3, 10, 16]} />
        </mesh>
      </group>

      {/* Right Thumb resting in rear hook / gliding up onto Pitch Bend pad on Meend! */}
      <group ref={pbThumbRef} position={[-0.14, -0.86, -0.27]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.055, 0.26, 8, 14]} />
        </mesh>
        <mesh position={[0.08, 0.01, 0.04]} visible={fingering.pitchBendActive}>
          <sphereGeometry args={[0.052, 14, 14]} />
          <meshBasicMaterial color="#e9c46a" transparent opacity={0.9} />
        </mesh>
      </group>

      {/* Right Index Side-Knuckle over Side Bb / Flat Touch Pad */}
      <mesh
        ref={sideBbRef}
        position={[EWI_SIDE_BB_POS[0] - 0.13, EWI_SIDE_BB_POS[1], EWI_SIDE_BB_POS[2] + 0.03]}
        rotation={[0, 0, Math.PI / 2]}
        material={handMaterial}
      >
        <capsuleGeometry args={[0.04, 0.16, 8, 12]} />
      </mesh>

      {/* Right Pinky over Eb Touch Pad */}
      <group
        ref={rpPinkyRef}
        position={[EWI_RP_EB_POS[0] - 0.15, EWI_RP_EB_POS[1], EWI_RP_EB_POS[2] + 0.03]}
      >
        <mesh rotation={[0, 0, Math.PI / 2]} material={handMaterial}>
          <capsuleGeometry args={[0.038, 0.22, 8, 12]} />
        </mesh>
      </group>
    </group>
  );
};
