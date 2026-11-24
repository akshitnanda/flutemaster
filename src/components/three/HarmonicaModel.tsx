import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { HarmonicaTab } from '../../types/music';

/** Shared spatial constants for 12-Hole Chromatic Harmonica */
export const HARMONICA_WIDTH = 5.4;
export const HARMONICA_DEPTH = 1.18;
export const HARMONICA_HEIGHT = 0.62;
export const HARMONICA_HOLE_COUNT = 12;
export const HARMONICA_HOLE_SPACING = 0.39;

export function getHarmonicaHoleX(hole1Based: number): number {
  const idx = Math.max(0, Math.min(HARMONICA_HOLE_COUNT - 1, hole1Based - 1));
  return (idx - (HARMONICA_HOLE_COUNT - 1) / 2) * HARMONICA_HOLE_SPACING;
}

function createChromeCoverTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#c8ccd0');
  grad.addColorStop(0.28, '#eff2f5');
  grad.addColorStop(0.55, '#d7dbe0');
  grad.addColorStop(0.85, '#b6bcc2');
  grad.addColorStop(1, '#dce0e6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 180; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(60,65,72,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(42, 46, 52, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 26, w - 96, 114);

  ctx.fillStyle = 'rgba(28, 32, 38, 0.78)';
  ctx.font = '600 22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FLUTEMASTER · CHROMONICA 12', w / 2, 72);

  ctx.font = '500 13px monospace';
  ctx.fillStyle = 'rgba(52, 58, 66, 0.62)';
  ctx.fillText('SOLO-TUNED CHROMATIC · MANDRA (1–4) · MADHYA (5–8) · TAAR (9–12)', w / 2, 108);

  // Crisp engraved numbers 1–12 along the front edge
  ctx.font = '700 28px monospace';
  ctx.fillStyle = '#181c20';
  for (let hole = 1; hole <= HARMONICA_HOLE_COUNT; hole++) {
    const worldX = getHarmonicaHoleX(hole);
    const u = (worldX / HARMONICA_WIDTH + 0.5) * w;
    ctx.fillText(String(hole), u, h - 42);
    ctx.fillStyle = 'rgba(24,28,32,0.5)';
    ctx.fillRect(u - 1.5, h - 20, 3, 14);
    ctx.fillStyle = '#181c20';
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface HarmonicaModelProps {
  active?: boolean;
  tab: HarmonicaTab;
  isPlaying: boolean;
  isBreathPause: boolean;
  showHoleLabels: boolean;
}

export const HarmonicaModel: React.FC<HarmonicaModelProps> = ({
  active = true,
  tab,
  isPlaying,
  isBreathPause,
  showHoleLabels,
}) => {
  const coverTex = useMemo(() => createChromeCoverTexture(), []);

  const chromeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#dfe4ea'),
        metalness: 0.88,
        roughness: 0.18,
        clearcoat: 0.8,
        clearcoatRoughness: 0.14,
      }),
    []
  );

  const brassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e0ad48',
        metalness: 0.82,
        roughness: 0.25,
      }),
    []
  );

  const mahoganyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#7c3c1e',
        roughness: 0.4,
        clearcoat: 0.35,
      }),
    []
  );

  const slideGroupRef = useRef<THREE.Group>(null);
  const focusRingRef = useRef<THREE.Group>(null);
  const airflowConeRef = useRef<THREE.Mesh>(null);
  const airflowCone2Ref = useRef<THREE.Mesh>(null);

  const smoothSlide = useRef(tab.slide ? 1 : 0);
  const smoothFocusX = useRef(getHarmonicaHoleX(tab.hole));

  useFrame(({ clock }, delta) => {
    if (!active) return;
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    smoothSlide.current = THREE.MathUtils.lerp(
      smoothSlide.current,
      tab.slide ? 1 : 0,
      1 - Math.exp(-18 * dt)
    );
    if (slideGroupRef.current) {
      slideGroupRef.current.position.x = HARMONICA_WIDTH / 2 + 0.32 - smoothSlide.current * 0.22;
    }

    const targetX = getHarmonicaHoleX(tab.hole);
    smoothFocusX.current = THREE.MathUtils.lerp(
      smoothFocusX.current,
      targetX,
      1 - Math.exp(-15 * dt)
    );
    if (focusRingRef.current) {
      focusRingRef.current.position.x = smoothFocusX.current;
    }

    // Crisp visible directional airflow arrows in front of the mouthpiece holes (+Z = player)
    const dirSign = tab.action === 'blow' ? -1 : 1;
    const animCycle = (t * 2.2) % 1;
    if (airflowConeRef.current) {
      const mat = airflowConeRef.current.material as THREE.MeshBasicMaterial;
      const baseOp = isBreathPause ? 0.1 : isPlaying ? 0.85 : 0.65;
      mat.opacity = baseOp * (0.78 + 0.22 * Math.sin(t * 7));
      const zTravel = tab.action === 'blow' ? 0.46 - animCycle * 0.26 : 0.18 + animCycle * 0.28;
      airflowConeRef.current.position.z = zTravel;
      airflowConeRef.current.rotation.x = dirSign === -1 ? -Math.PI / 2 : Math.PI / 2;
    }
    if (airflowCone2Ref.current) {
      const mat = airflowCone2Ref.current.material as THREE.MeshBasicMaterial;
      const baseOp = isBreathPause ? 0.06 : isPlaying ? 0.6 : 0.42;
      const phase2 = (t * 2.2 + 0.5) % 1;
      mat.opacity = baseOp * (1 - phase2 * 0.55);
      const zTravel2 = tab.action === 'blow' ? 0.58 - phase2 * 0.32 : 0.16 + phase2 * 0.36;
      airflowCone2Ref.current.position.z = zTravel2;
      airflowCone2Ref.current.rotation.x = dirSign === -1 ? -Math.PI / 2 : Math.PI / 2;
    }
  });

  const actionColor = isBreathPause
    ? '#72efdd'
    : tab.action === 'blow'
    ? '#2a9d8f'
    : '#38bdf8';

  // Exact front face Z so ALL 12 holes sit cleanly PROUD on the mouthpiece (never occluded!)
  const frontFaceZ = 0.64;

  return (
    <group name="chromatic-harmonica-body">
      {/* ====================================================================
          WARM MAHOGANY COMB & GLEAMING BRASS REED PLATES (Visible Sandwich!)
          ==================================================================== */}
      <mesh position={[0, 0, -0.02]} castShadow receiveShadow material={mahoganyMat}>
        <boxGeometry args={[HARMONICA_WIDTH - 0.04, 0.26, HARMONICA_DEPTH - 0.08]} />
      </mesh>
      <mesh position={[0, 0.155, -0.01]} material={brassMat}>
        <boxGeometry args={[HARMONICA_WIDTH + 0.02, 0.055, HARMONICA_DEPTH - 0.04]} />
      </mesh>
      <mesh position={[0, -0.155, -0.01]} material={brassMat}>
        <boxGeometry args={[HARMONICA_WIDTH + 0.02, 0.055, HARMONICA_DEPTH - 0.04]} />
      </mesh>

      {/* ====================================================================
          POLISHED CHROME COVER PLATES (TOP WITH ENGRAVED 1–12 & BOTTOM)
          ==================================================================== */}
      <mesh position={[0, 0.26, -0.06]} castShadow receiveShadow>
        <boxGeometry args={[HARMONICA_WIDTH, 0.16, HARMONICA_DEPTH - 0.2]} />
        <meshPhysicalMaterial color="#e2e6eb" metalness={0.86} roughness={0.2} clearcoat={0.75} />
      </mesh>
      <mesh position={[0, 0.344, -0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HARMONICA_WIDTH - 0.04, HARMONICA_DEPTH - 0.22]} />
        <meshPhysicalMaterial map={coverTex} metalness={0.58} roughness={0.28} clearcoat={0.65} />
      </mesh>
      <mesh position={[0, -0.26, -0.06]} castShadow receiveShadow material={chromeMat}>
        <boxGeometry args={[HARMONICA_WIDTH, 0.16, HARMONICA_DEPTH - 0.2]} />
      </mesh>

      {/* Decorative Brass Cover Screws */}
      {[-HARMONICA_WIDTH / 2 + 0.22, HARMONICA_WIDTH / 2 - 0.22].map((sx, i) => (
        <mesh key={`screw-${i}`} position={[sx, 0.346, -0.06]} material={brassMat}>
          <cylinderGeometry args={[0.055, 0.055, 0.02, 18]} />
        </mesh>
      ))}

      {/* ====================================================================
          SCULPTED SILVER FRONT MOUTHPIECE FRAME & 12 EXPOSED CHROMATIC HOLES
          ==================================================================== */}
      {/* Sleek beveled silver mouthpiece rails (top lip & bottom lip framing the 12 holes!) */}
      <mesh position={[0, 0.165, 0.56]} rotation={[0, 0, Math.PI / 2]} castShadow material={chromeMat}>
        <cylinderGeometry args={[0.065, 0.065, HARMONICA_WIDTH + 0.04, 24]} />
      </mesh>
      <mesh position={[0, -0.165, 0.56]} rotation={[0, 0, Math.PI / 2]} castShadow material={chromeMat}>
        <cylinderGeometry args={[0.065, 0.065, HARMONICA_WIDTH + 0.04, 24]} />
      </mesh>
      {/* Mouthpiece backing faceplate sitting behind the holes */}
      <mesh position={[0, 0, 0.57]} material={chromeMat}>
        <boxGeometry args={[HARMONICA_WIDTH + 0.02, 0.34, 0.12]} />
      </mesh>

      {/* 12 Individual Crisp Recessed Chromatic Holes (1–12) cleanly visible on frontFaceZ */}
      {Array.from({ length: HARMONICA_HOLE_COUNT }).map((_, i) => {
        const holeNum = i + 1;
        const hx = getHarmonicaHoleX(holeNum);
        const isActive = holeNum === tab.hole;
        const isSlideActive = isActive && tab.slide;
        const showOctaveDivider = holeNum === 4 || holeNum === 8;

        return (
          <group key={`harm-hole-${holeNum}`} position={[hx, 0, frontFaceZ]}>
            {/* Crisp Metallic Hole Bezel Surround */}
            <mesh position={[0, 0, -0.005]} material={brassMat}>
              <boxGeometry args={[0.31, 0.27, 0.016]} />
            </mesh>
            {/* Deep Dark Recessed Air Channel Opening */}
            <mesh position={[0, 0, 0.004]}>
              <boxGeometry args={[0.26, 0.22, 0.014]} />
              <meshStandardMaterial color="#080706" roughness={0.95} />
            </mesh>

            {/* Luminous Active Hole Glow (Jade Teal = Blow ↑, Sky Blue = Draw ↓) */}
            <mesh visible={isActive} position={[0, 0, 0.014]}>
              <planeGeometry args={[0.25, 0.21]} />
              <meshBasicMaterial color={actionColor} />
            </mesh>

            {/* Crisp Outer Active Halo (Warm Amber when Slide IN, bright off-white otherwise) */}
            <mesh visible={isActive} position={[0, 0, 0.02]}>
              <ringGeometry args={[0.155, 0.225, 28]} />
              <meshBasicMaterial
                color={isSlideActive ? '#f4a261' : '#f8f9fa'}
                transparent
                opacity={0.96}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Gold Octave Separator Rib between Mandra (4|5) and Madhya (8|9) */}
            {showOctaveDivider && (
              <mesh position={[HARMONICA_HOLE_SPACING / 2, 0, 0.01]} material={brassMat}>
                <boxGeometry args={[0.028, 0.36, 0.02]} />
              </mesh>
            )}

            {/* Compact Hole Index Pill neatly below mouthpiece */}
            <Html position={[0, -0.44, 0.06]} center zIndexRange={[6, 0]}>
              <div
                className={`pointer-events-none px-1 py-[1px] min-w-[18px] text-center rounded text-[9px] font-mono-tech transition-all ${
                  !active ? 'hidden' : showHoleLabels ? 'opacity-100' : 'opacity-0'
                } ${
                  isActive
                    ? tab.action === 'blow'
                      ? 'bg-[#2a9d8f] text-[#f8f9fa] font-bold border border-[#e9c46a] shadow-[0_0_8px_rgba(42,157,143,0.75)]'
                      : 'bg-[#38bdf8] text-[#121212] font-bold border border-[#f8f9fa] shadow-[0_0_8px_rgba(56,189,248,0.75)]'
                    : 'bg-[#181614]/88 text-[#a69f95] border border-white/10'
                }`}
              >
                {holeNum}
              </div>
            </Html>
          </group>
        );
      })}

      {/* ====================================================================
          SLIDING EMBOUCHURE FOCUS RING & DIRECTIONAL BLOW/DRAW AIRFLOW CONES
          ==================================================================== */}
      <group ref={focusRingRef} position={[getHarmonicaHoleX(tab.hole), 0, frontFaceZ + 0.03]}>
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[0.19, 0.25, 32]} />
          <meshBasicMaterial
            color={tab.slide ? '#f4a261' : actionColor}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Bold Directional Airflow Cones clearly pointing INTO hole on BLOW, OUTWARD on DRAW */}
        <mesh ref={airflowConeRef} position={[0, 0, 0.34]}>
          <coneGeometry args={[0.115, 0.24, 20]} />
          <meshBasicMaterial color={actionColor} transparent opacity={0.75} depthWrite={false} />
        </mesh>
        <mesh ref={airflowCone2Ref} position={[0, 0, 0.5]}>
          <coneGeometry args={[0.088, 0.18, 20]} />
          <meshBasicMaterial color={actionColor} transparent opacity={0.48} depthWrite={false} />
        </mesh>

        {/* Action Badge floating cleanly above the active hole */}
        <Html position={[0, 0.56, 0.04]} center zIndexRange={[16, 0]}>
          <div
            className={`pointer-events-none flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap shadow-lg transition-all ${
              !active
                ? 'hidden'
                : isBreathPause
                ? 'bg-[#162926]/95 border-[#72efdd] text-[#72efdd]'
                : tab.action === 'blow'
                ? 'bg-[#122926]/95 border-[#2a9d8f] text-[#72efdd]'
                : 'bg-[#0f2433]/95 border-[#38bdf8] text-[#7dd3fc]'
            }`}
          >
            <span>
              {isBreathPause
                ? '🌬️ BREATH'
                : `Hole ${tab.hole} · ${tab.action === 'blow' ? '↑ BLOW' : '↓ DRAW'}`}
            </span>
            {tab.slide && !isBreathPause && (
              <span className="px-1 py-[1px] rounded bg-[#f4a261] text-[#121212] text-[9px] font-extrabold">
                +SLIDE
              </span>
            )}
          </div>
        </Html>
      </group>

      {/* ====================================================================
          RIGHT-SIDE SPRING-LOADED CHROMATIC SLIDE BUTTON (+X)
          ==================================================================== */}
      <mesh
        position={[HARMONICA_WIDTH / 2 + 0.04, 0, 0.54]}
        rotation={[0, 0, Math.PI / 2]}
        material={brassMat}
      >
        <cylinderGeometry args={[0.13, 0.13, 0.14, 24]} />
      </mesh>

      <group ref={slideGroupRef} position={[HARMONICA_WIDTH / 2 + 0.32, 0, 0.54]}>
        <mesh position={[-0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={chromeMat}>
          <cylinderGeometry args={[0.055, 0.055, 0.36, 20]} />
        </mesh>
        <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.13, 0.18, 28]} />
          <meshPhysicalMaterial
            color={tab.slide ? '#f4a261' : '#e6eaef'}
            emissive={tab.slide ? '#f4a261' : '#000000'}
            emissiveIntensity={tab.slide ? 1.15 : 0}
            metalness={tab.slide ? 0.45 : 0.88}
            roughness={0.18}
            clearcoat={0.8}
          />
        </mesh>
        <mesh visible={tab.slide} position={[0.18, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <ringGeometry args={[0.14, 0.24, 28]} />
          <meshBasicMaterial
            color="#f4a261"
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>

        <Html position={[0.14, 0.46, 0.06]} center zIndexRange={[15, 0]}>
          <div
            className={`pointer-events-none px-2 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              !active
                ? 'hidden'
                : tab.slide
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_12px_rgba(244,162,97,0.55)] opacity-100'
                : showHoleLabels
                ? 'bg-[#181614]/82 border-white/12 text-[#a69f95] opacity-80'
                : 'opacity-0'
            }`}
          >
            {tab.slide ? '● SLIDE IN (+½)' : 'SLIDE'}
          </div>
        </Html>
      </group>
    </group>
  );
};
