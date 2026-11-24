import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { BreathLevel, HolePattern } from '../../types/music';
import {
  BAMBOO_NODES_X,
  BLOWING_HOLE_X,
  FINGER_HOLES,
  FLUTE_LENGTH,
  FLUTE_RADIUS,
  SILK_BINDINGS,
} from './fluteGeometry';
import { createBambooTextures, createHalfHoleTexture } from './bambooTexture';

interface BansuriModelProps {
  active?: boolean;
  holes: HolePattern;
  breath: BreathLevel;
  isPlaying: boolean;
  isBreathPause: boolean;
  showHoleLabels: boolean;
}

export const BansuriModel: React.FC<BansuriModelProps> = ({
  active = true,
  holes,
  breath,
  isPlaying,
  isBreathPause,
  showHoleLabels,
}) => {
  const { colorMap, bumpMap } = useMemo(() => createBambooTextures(), []);
  const halfHoleTex = useMemo(() => createHalfHoleTexture(), []);

  const breathConeRef = useRef<THREE.Mesh>(null);
  const breathRingRef = useRef<THREE.Mesh>(null);
  const pulseRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (breathConeRef.current) {
      const mat = breathConeRef.current.material as THREE.MeshBasicMaterial;
      const baseIntensity = isBreathPause
        ? 0.08
        : breath === 'strong'
        ? 0.36
        : breath === 'medium'
        ? 0.25
        : 0.16;
      const activeMult = isPlaying ? 1.0 : 0.5;
      mat.opacity = baseIntensity * activeMult * (0.85 + 0.15 * Math.sin(t * 7.5));

      const scaleLen = breath === 'strong' ? 1.25 : breath === 'medium' ? 1.0 : 0.78;
      breathConeRef.current.scale.set(
        1 + 0.06 * Math.sin(t * 9),
        scaleLen * (0.95 + 0.08 * Math.sin(t * 6)),
        1 + 0.06 * Math.cos(t * 9)
      );
    }

    if (breathRingRef.current) {
      const s = isBreathPause
        ? 1.0 + 0.18 * Math.sin(t * 4)
        : 1.0 + 0.05 * Math.sin(t * 5);
      breathRingRef.current.scale.set(s, s, 1);
    }

    pulseRefs.current.forEach((mesh, idx) => {
      if (!mesh) return;
      const state = holes[idx];
      if (state === 1) {
        const s = 1 + 0.045 * Math.sin(t * 4.5 + idx * 0.5);
        mesh.scale.set(s, s, 1);
      } else if (state === 0.5) {
        const s = 1 + 0.085 * Math.sin(t * 6.5);
        mesh.scale.set(s, s, 1);
      } else {
        mesh.scale.set(1, 1, 1);
      }
    });
  });

  const breathColor = isBreathPause
    ? '#64dfdf'
    : breath === 'strong'
    ? '#f4a261'
    : breath === 'medium'
    ? '#2a9d8f'
    : '#8ecae6';

  return (
    <group name="bansuri-assembly">
      {/* Main Bamboo Shaft */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[FLUTE_RADIUS, FLUTE_RADIUS * 0.96, FLUTE_LENGTH, 48, 1, true]} />
        <meshPhysicalMaterial
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={0.014}
          roughness={0.32}
          metalness={0.04}
          clearcoat={0.42}
          clearcoatRoughness={0.25}
        />
      </mesh>

      {/* Dark Hollow Inner Bore Tube */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[FLUTE_RADIUS * 0.78, FLUTE_RADIUS * 0.75, FLUTE_LENGTH - 0.04, 32, 1, true]}
        />
        <meshStandardMaterial color="#0b0806" roughness={0.95} side={THREE.BackSide} />
      </mesh>

      {/* Head End Rim & Cork Stopper */}
      <mesh position={[-FLUTE_LENGTH / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <ringGeometry args={[FLUTE_RADIUS * 0.76, FLUTE_RADIUS, 36]} />
        <meshStandardMaterial color="#b37d44" roughness={0.55} />
      </mesh>
      <mesh position={[-FLUTE_LENGTH / 2 + 0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[FLUTE_RADIUS * 0.76, FLUTE_RADIUS * 0.76, 0.24, 24]} />
        <meshStandardMaterial color="#7a512d" roughness={0.88} />
      </mesh>

      {/* Foot End Open Rim */}
      <mesh position={[FLUTE_LENGTH / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[FLUTE_RADIUS * 0.74, FLUTE_RADIUS * 0.96, 36]} />
        <meshStandardMaterial color="#c48e55" roughness={0.5} />
      </mesh>

      {/* Natural Raised Bamboo Nodes */}
      {BAMBOO_NODES_X.map((nx, i) => (
        <mesh key={`node-${i}`} position={[nx, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[FLUTE_RADIUS * 0.99, 0.015, 12, 36]} />
          <meshStandardMaterial color="#9a6432" roughness={0.58} />
        </mesh>
      ))}

      {/* Traditional Decorative Silk Thread Bindings (Dhaga) */}
      {SILK_BINDINGS.map((b, i) => (
        <group key={`dhaga-${i}`} position={[b.x, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry
              args={[FLUTE_RADIUS * 1.028, FLUTE_RADIUS * 1.028, b.width, 40]}
            />
            <meshStandardMaterial color={b.primary} roughness={0.62} metalness={0.08} />
          </mesh>
          <mesh position={[-b.width / 2 - 0.018, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[FLUTE_RADIUS * 1.035, FLUTE_RADIUS * 1.035, 0.032, 40]} />
            <meshStandardMaterial color={b.trim} roughness={0.42} metalness={0.35} />
          </mesh>
          <mesh position={[b.width / 2 + 0.018, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[FLUTE_RADIUS * 1.035, FLUTE_RADIUS * 1.035, 0.032, 40]} />
            <meshStandardMaterial color={b.trim} roughness={0.42} metalness={0.35} />
          </mesh>
        </group>
      ))}

      {/* BLOWING HOLE (MUKHA RANDHRA) & ANIMATED AIRFLOW */}
      <group position={[BLOWING_HOLE_X, FLUTE_RADIUS + 0.005, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.18, 0.92, 1]}>
          <circleGeometry args={[0.108, 32]} />
          <meshStandardMaterial color="#090706" roughness={0.95} />
        </mesh>

        <mesh
          ref={breathRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.002, 0]}
          scale={[1.18, 0.92, 1]}
        >
          <ringGeometry args={[0.106, 0.138, 32]} />
          <meshBasicMaterial
            color={breathColor}
            transparent
            opacity={isBreathPause ? 0.9 : 0.7}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh
          ref={breathConeRef}
          position={[0, 0.14, 0.18]}
          rotation={[-Math.PI * 0.34, 0, 0]}
        >
          <coneGeometry args={[0.12, 0.48, 24, 1, true]} />
          <meshBasicMaterial
            color={breathColor}
            transparent
            opacity={0.22}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Keep Html permanently mounted to avoid React 19 synchronous root unmount warnings */}
        <Html position={[0, -0.44, 0.2]} center zIndexRange={[8, 0]}>
          <div
            className={`pointer-events-none px-1.5 py-0.5 rounded bg-[#141311]/88 border text-[9px] font-mono-tech tracking-wide whitespace-nowrap transition-opacity ${
              !active ? 'hidden' : showHoleLabels ? 'opacity-100' : 'opacity-0'
            } ${
              isBreathPause
                ? 'border-[#72efdd]/60 text-[#72efdd]'
                : 'border-[#d4a373]/30 text-[#d4a373]'
            }`}
          >
            {isBreathPause ? '🌬️ INHALE' : 'BLOW HOLE'}
          </div>
        </Html>
      </group>

      {/* 6 MAIN FINGER HOLES + 7TH PINKY/TUNING HOLE */}
      {FINGER_HOLES.map((hole, idx) => {
        const state = holes[idx] ?? 0;
        const isClosed = state === 1;
        const isHalf = state === 0.5;
        const ySurface = Math.sqrt(
          Math.max(0.01, FLUTE_RADIUS * FLUTE_RADIUS - hole.zOffset * hole.zOffset)
        );
        const tiltX = Math.atan2(hole.zOffset, ySurface);

        return (
          <group
            key={hole.code}
            position={[hole.x, ySurface + 0.005, hole.zOffset]}
            rotation={[tiltX, 0, 0]}
          >
            {/* Dark recessed hole bore */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[hole.radius, 32]} />
              <meshStandardMaterial color="#090706" roughness={0.95} />
            </mesh>

            {/* Subtle burnt bamboo rim */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
              <ringGeometry args={[hole.radius * 0.96, hole.radius * 1.18, 32]} />
              <meshStandardMaterial color="#593518" roughness={0.7} />
            </mesh>

            {/* CLOSED: Solid glowing Jade Teal core + Warm Gold outer halo */}
            <group position={[0, 0.004, 0]} visible={isClosed}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[hole.radius * 0.98, 32]} />
                <meshBasicMaterial color="#2a9d8f" />
              </mesh>
              <mesh
                ref={(el) => {
                  if (isClosed) pulseRefs.current[idx] = el;
                }}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.002, 0]}
              >
                <ringGeometry args={[hole.radius * 0.96, hole.radius * 1.44, 36]} />
                <meshBasicMaterial
                  color="#e9c46a"
                  transparent
                  opacity={0.95}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
                <ringGeometry args={[hole.radius * 1.4, hole.radius * 2.0, 36]} />
                <meshBasicMaterial
                  color="#2a9d8f"
                  transparent
                  opacity={0.38}
                  depthWrite={false}
                />
              </mesh>
            </group>

            {/* HALF-HOLE: Crisp 50% Split-Circle Indicator + Amber Aura */}
            <group position={[0, 0.006, 0]} visible={isHalf}>
              <mesh
                rotation={[-Math.PI / 2, 0, hole.hand === 'left' ? -Math.PI / 2 : Math.PI / 2]}
              >
                <circleGeometry args={[hole.radius * 1.15, 36]} />
                <meshBasicMaterial map={halfHoleTex} transparent />
              </mesh>
              <mesh
                ref={(el) => {
                  if (isHalf) pulseRefs.current[idx] = el;
                }}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.002, 0]}
              >
                <ringGeometry args={[hole.radius * 1.18, hole.radius * 1.78, 36]} />
                <meshBasicMaterial
                  color="#f4a261"
                  transparent
                  opacity={0.65}
                  depthWrite={false}
                />
              </mesh>
            </group>

            {/* OPEN: Unlit subtle rim */}
            <mesh
              visible={state === 0}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.002, 0]}
            >
              <ringGeometry args={[hole.radius * 0.98, hole.radius * 1.14, 28]} />
              <meshBasicMaterial
                color="#d4a373"
                transparent
                opacity={idx === 6 ? 0.2 : 0.34}
              />
            </mesh>

            {/* Permanently mounted Html badge for Half-Hole pitch warning */}
            <Html position={[0, 0.56, -0.05]} center zIndexRange={[16, 0]}>
              <div
                className={`pointer-events-none flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#24180f]/95 border border-[#f4a261]/80 shadow-[0_0_12px_rgba(244,162,97,0.45)] text-[10px] font-semibold text-[#f4a261] whitespace-nowrap transition-all duration-150 ${
                  active && isHalf ? 'opacity-100 scale-100' : 'opacity-0 scale-90 hidden'
                }`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-[#f4a261] overflow-hidden relative shrink-0">
                  <span className="absolute inset-y-0 left-0 w-1/2 bg-[#f4a261]" />
                </span>
                <span>½ Pitch · {hole.code}</span>
              </div>
            </Html>

            {/* Compact Hole Index Pill neatly positioned BELOW the front edge of the bamboo */}
            <Html position={[0, -0.44, 0.2]} center zIndexRange={[6, 0]}>
              <div
                className={`pointer-events-none w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono-tech transition-all ${
                  !active ? 'hidden' : showHoleLabels ? 'opacity-100' : 'opacity-0'
                } ${
                  isClosed
                    ? 'bg-[#2a9d8f] text-[#f8f9fa] font-bold border border-[#e9c46a]/80 shadow-[0_0_8px_rgba(42,157,143,0.65)]'
                    : isHalf
                    ? 'bg-[#f4a261] text-[#121212] font-bold border border-[#fff2df] shadow-[0_0_8px_rgba(244,162,97,0.65)]'
                    : 'bg-[#181614]/88 text-[#a69f95] border border-white/12'
                }`}
              >
                {idx + 1}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
