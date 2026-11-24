import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { SaxFingering } from '../../types/music';

/** Shared spatial constants for SaxophoneModel & SaxophoneHands (local upright sax space) */
export const SAX_MAIN_KEYS: Array<{
  index: number;
  code: string;
  y: number;
  bodyRadius: number;
  pearlRadius: number;
  hand: 'left' | 'right';
}> = [
  { index: 0, code: 'L1', y: 1.12, bodyRadius: 0.165, pearlRadius: 0.088, hand: 'left' },
  { index: 1, code: 'L2', y: 0.72, bodyRadius: 0.185, pearlRadius: 0.092, hand: 'left' },
  { index: 2, code: 'L3', y: 0.32, bodyRadius: 0.205, pearlRadius: 0.092, hand: 'left' },
  { index: 3, code: 'R1', y: -0.22, bodyRadius: 0.23, pearlRadius: 0.095, hand: 'right' },
  { index: 4, code: 'R2', y: -0.62, bodyRadius: 0.25, pearlRadius: 0.098, hand: 'right' },
  { index: 5, code: 'R3', y: -1.02, bodyRadius: 0.272, pearlRadius: 0.098, hand: 'right' },
];

export const SAX_OCTAVE_KEY_POS: [number, number, number] = [0.04, 1.42, -0.21];
export const SAX_GSHARP_POS: [number, number, number] = [0.27, 0.04, 0.09]; // Left pinky flank (+X)
export const SAX_SIDE_BB_POS: [number, number, number] = [-0.26, 0.02, 0.12]; // Right side Bb (-X)
export const SAX_EB_POS: [number, number, number] = [-0.28, -1.28, 0.18]; // Right pinky spatula (-X)
export const SAX_PALM_D_POS: [number, number, number] = [0.24, 1.48, 0.08]; // Left palm D (+X)

function createBrushedBrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#dfb050');
  grad.addColorStop(0.45, '#f0cb75');
  grad.addColorStop(0.75, '#d49d3e');
  grad.addColorStop(1, '#c48d30');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 360; i++) {
    const y = Math.random() * 512;
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(255,244,210,0.08)' : 'rgba(110,72,18,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface SaxophoneModelProps {
  active?: boolean;
  fingering: SaxFingering;
  isPlaying: boolean;
  isBreathPause: boolean;
  showKeyLabels: boolean;
}

export const SaxophoneModel: React.FC<SaxophoneModelProps> = ({
  active = true,
  fingering,
  isPlaying,
  isBreathPause,
  showKeyLabels,
}) => {
  const brassTex = useMemo(() => createBrushedBrassTexture(), []);

  // Graceful curved brass S-neck curving up-back (-X, +Y, gentle -Z) for a sleek profile
  const neckGeom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.64, 0),
      new THREE.Vector3(-0.08, 1.98, -0.05),
      new THREE.Vector3(-0.36, 2.22, -0.14),
      new THREE.Vector3(-0.74, 2.2, -0.2),
    ]);
    return new THREE.TubeGeometry(curve, 32, 0.102, 24, false);
  }, []);

  // Sweeping brass U-Bow curving cleanly OUT TO THE RIGHT (+X) so the flared bell NEVER occludes R1-R3 pearls!
  const bowGeom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1.42, 0),
      new THREE.Vector3(0.14, -2.02, 0.06),
      new THREE.Vector3(0.72, -2.14, 0.14),
      new THREE.Vector3(1.18, -1.68, 0.18),
      new THREE.Vector3(1.28, -0.88, 0.2),
    ]);
    return new THREE.TubeGeometry(curve, 36, 0.305, 28, false);
  }, []);

  // Flared resonant Alto Saxophone bell
  const bellGeom = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const y = t * 1.12;
      const r = 0.295 + Math.pow(t, 2.35) * 0.43;
      pts.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(pts, 40);
  }, []);

  const brassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: brassTex,
        color: new THREE.Color('#e6b856'),
        metalness: 0.84,
        roughness: 0.22,
        clearcoat: 0.65,
        clearcoatRoughness: 0.16,
      }),
    [brassTex]
  );

  const darkBrassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b8842a',
        metalness: 0.8,
        roughness: 0.32,
      }),
    []
  );

  const keyRefs = useRef<Array<THREE.Group | null>>([]);
  const octRef = useRef<THREE.Group>(null);
  const bellGlowRef = useRef<THREE.Mesh>(null);
  const breathRingRef = useRef<THREE.Mesh>(null);

  const hasGSharp = fingering.auxKeys.includes('G#');
  const hasSideBb = fingering.auxKeys.includes('Bb');
  const hasEb = fingering.auxKeys.includes('Eb');
  const hasPalmD = fingering.auxKeys.includes('PalmD');

  useFrame(({ clock }, delta) => {
    if (!active) return;
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    SAX_MAIN_KEYS.forEach((k, idx) => {
      const grp = keyRefs.current[idx];
      if (!grp) return;
      const pressed = fingering.mainKeys[idx];
      const targetZ = k.bodyRadius + (pressed ? 0.044 : 0.095);
      grp.position.z = THREE.MathUtils.lerp(grp.position.z, targetZ, 1 - Math.exp(-16 * dt));
    });

    if (octRef.current) {
      const targetZ = SAX_OCTAVE_KEY_POS[2] + (fingering.octaveKey ? 0.032 : -0.012);
      octRef.current.position.z = THREE.MathUtils.lerp(
        octRef.current.position.z,
        targetZ,
        1 - Math.exp(-16 * dt)
      );
    }

    if (bellGlowRef.current) {
      const mat = bellGlowRef.current.material as THREE.MeshBasicMaterial;
      const baseOp = isBreathPause ? 0.05 : isPlaying ? 0.36 : 0.18;
      mat.opacity = baseOp * (0.85 + 0.15 * Math.sin(t * 6.5));
      const s = 1 + (isPlaying ? 0.06 * Math.sin(t * 7) : 0);
      bellGlowRef.current.scale.set(s, s, 1);
    }

    if (breathRingRef.current) {
      const s = isBreathPause ? 1 + 0.16 * Math.sin(t * 4.5) : 1 + 0.04 * Math.sin(t * 5);
      breathRingRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group name="saxophone-body">
      {/* Main Conical Brass Body Shaft */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow material={brassMat}>
        <cylinderGeometry args={[0.145, 0.305, 3.16, 40]} />
      </mesh>

      {/* Smooth Neck Tenon Collar Ring */}
      <mesh position={[0, 1.66, 0]} material={darkBrassMat}>
        <cylinderGeometry args={[0.164, 0.168, 0.14, 32]} />
      </mesh>

      {/* Curved S-Neck */}
      <mesh geometry={neckGeom} castShadow material={brassMat} />

      {/* Cork Sleeve, Glossy Black Ebonite Mouthpiece, Cane Reed & Brass Ligature */}
      <group position={[-0.82, 2.2, -0.21]} rotation={[0, 0.16, Math.PI * 0.52]}>
        <mesh position={[0, -0.08, 0]}>
          <cylinderGeometry args={[0.106, 0.106, 0.16, 24]} />
          <meshStandardMaterial color="#8f6339" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.068, 0.118, 0.44, 28]} />
          <meshPhysicalMaterial color="#181716" roughness={0.18} clearcoat={0.8} />
        </mesh>
        <mesh position={[0, 0.2, 0.072]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.08, 0.32, 0.016]} />
          <meshStandardMaterial color="#ddb678" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.07, 0]} material={darkBrassMat}>
          <cylinderGeometry args={[0.114, 0.12, 0.11, 24]} />
        </mesh>
        <mesh ref={breathRingRef} position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.068, 0.104, 28]} />
          <meshBasicMaterial
            color={isBreathPause ? '#72efdd' : fingering.octaveKey ? '#f4a261' : '#2a9d8f'}
            transparent
            opacity={isBreathPause ? 0.9 : 0.65}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Curved Brass U-Bow sweeping cleanly out to the right (+X) */}
      <mesh geometry={bowGeom} castShadow material={brassMat} />

      {/* Bell-to-Body Brace Strut */}
      <mesh position={[0.64, -1.04, 0.12]} rotation={[0, 0, Math.PI / 2]} material={darkBrassMat}>
        <cylinderGeometry args={[0.032, 0.032, 0.92, 16]} />
      </mesh>

      {/* Flared Golden Brass Bell rising cleanly on the right side (ZERO key occlusion!) */}
      <group position={[1.28, -0.9, 0.2]} rotation={[0.08, 0, -0.14]}>
        <mesh geometry={bellGeom} castShadow material={brassMat} />
        <mesh position={[0, 1.12, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
          <torusGeometry args={[0.725, 0.032, 16, 44]} />
        </mesh>
        <mesh position={[0, 0.94, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.55, 36]} />
          <meshStandardMaterial color="#1a1207" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={bellGlowRef} position={[0, 1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.36, 0.67, 36]} />
          <meshBasicMaterial
            color={fingering.octaveKey ? '#f4a261' : '#2a9d8f'}
            transparent
            opacity={0.22}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Brass Key Linkage Rods */}
      <mesh position={[0.25, 0.2, 0.04]} rotation={[0, 0, -0.055]} material={darkBrassMat}>
        <cylinderGeometry args={[0.018, 0.018, 2.75, 12]} />
      </mesh>
      <mesh position={[-0.25, -0.1, 0.06]} rotation={[0, 0, 0.055]} material={darkBrassMat}>
        <cylinderGeometry args={[0.018, 0.018, 2.65, 12]} />
      </mesh>

      {/* ====================================================================
          6 MAIN MOTHER-OF-PEARL KEYS (L1-L3 Upper · R1-R3 Lower — 100% Unobstructed!)
          ==================================================================== */}
      {SAX_MAIN_KEYS.map((k, idx) => {
        const pressed = fingering.mainKeys[idx];
        return (
          <group key={k.code}>
            <mesh
              position={[0, k.y, k.bodyRadius - 0.01]}
              rotation={[Math.PI / 2, 0, 0]}
              material={darkBrassMat}
            >
              <cylinderGeometry args={[k.pearlRadius * 1.24, k.pearlRadius * 1.32, 0.08, 28]} />
            </mesh>

            <group
              ref={(el) => {
                keyRefs.current[idx] = el;
              }}
              position={[0, k.y, k.bodyRadius + 0.08]}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
                <cylinderGeometry args={[k.pearlRadius * 1.16, k.pearlRadius * 1.16, 0.045, 28]} />
              </mesh>
              <mesh position={[0, 0, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[k.pearlRadius * 0.94, k.pearlRadius * 0.94, 0.022, 28]} />
                <meshPhysicalMaterial
                  color={pressed ? '#2a9d8f' : '#f4eee2'}
                  emissive={pressed ? '#2a9d8f' : '#2a241c'}
                  emissiveIntensity={pressed ? 1.15 : 0.12}
                  roughness={0.18}
                  clearcoat={0.9}
                />
              </mesh>
              <mesh visible={pressed} position={[0, 0, 0.038]}>
                <ringGeometry args={[k.pearlRadius * 0.95, k.pearlRadius * 1.48, 32]} />
                <meshBasicMaterial
                  color="#e9c46a"
                  transparent
                  opacity={0.94}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>

            <Html
              position={[k.hand === 'left' ? -0.34 : 0.36, k.y, k.bodyRadius + 0.06]}
              center
              zIndexRange={[6, 0]}
            >
              <div
                className={`pointer-events-none px-1 py-[1px] rounded text-[9px] font-mono-tech transition-all ${
                  !active ? 'hidden' : showKeyLabels ? 'opacity-100' : 'opacity-0'
                } ${
                  pressed
                    ? 'bg-[#2a9d8f] text-[#f8f9fa] font-bold border border-[#e9c46a]/80 shadow-[0_0_8px_rgba(42,157,143,0.7)]'
                    : 'bg-[#181614]/88 text-[#a69f95] border border-white/12'
                }`}
              >
                {k.code}
              </div>
            </Html>
          </group>
        );
      })}

      {/* REAR LEFT-THUMB OCTAVE KEY (OCT) */}
      <group ref={octRef} position={SAX_OCTAVE_KEY_POS}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.055, 0.14, 8, 16]} />
          <meshPhysicalMaterial
            color={fingering.octaveKey ? '#f4a261' : '#d4a373'}
            emissive={fingering.octaveKey ? '#f4a261' : '#000000'}
            emissiveIntensity={fingering.octaveKey ? 1.15 : 0}
            metalness={0.5}
            roughness={0.25}
          />
        </mesh>
        <Html position={[0.32, 0.16, 0.04]} center zIndexRange={[14, 0]}>
          <div
            className={`pointer-events-none px-2 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              !active
                ? 'hidden'
                : fingering.octaveKey
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_12px_rgba(244,162,97,0.5)] opacity-100'
                : showKeyLabels
                ? 'bg-[#181614]/80 border-white/12 text-[#a69f95] opacity-75'
                : 'opacity-0'
            }`}
          >
            {fingering.octaveKey ? '● OCTAVE ON' : 'OCT'}
          </div>
        </Html>
      </group>

      {/* CHROMATIC AUXILIARY KEYS (Left Pinky G#, Side Bb, Right Pinky Eb, Palm D) */}
      <group position={SAX_GSHARP_POS}>
        <mesh rotation={[0, 0.35, 0]}>
          <boxGeometry args={[0.11, 0.18, 0.06]} />
          <meshPhysicalMaterial
            color={hasGSharp ? '#f4a261' : '#c8963e'}
            emissive={hasGSharp ? '#f4a261' : '#000000'}
            emissiveIntensity={hasGSharp ? 1.15 : 0}
            metalness={0.65}
            roughness={0.25}
          />
        </mesh>
        <Html position={[0.26, 0.06, 0.06]} center zIndexRange={[14, 0]}>
          <div
            className={`pointer-events-none px-1.5 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              active && hasGSharp
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_10px_rgba(244,162,97,0.5)] opacity-100'
                : 'opacity-0 hidden'
            }`}
          >
            ● G# (LP)
          </div>
        </Html>
      </group>

      <group position={SAX_SIDE_BB_POS}>
        <mesh rotation={[0, -0.35, 0]}>
          <capsuleGeometry args={[0.044, 0.16, 8, 14]} />
          <meshPhysicalMaterial
            color={hasSideBb ? '#f4a261' : '#c8963e'}
            emissive={hasSideBb ? '#f4a261' : '#000000'}
            emissiveIntensity={hasSideBb ? 1.15 : 0}
            metalness={0.65}
            roughness={0.25}
          />
        </mesh>
        <Html position={[-0.32, 0.05, 0.1]} center zIndexRange={[14, 0]}>
          <div
            className={`pointer-events-none px-1.5 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              active && hasSideBb
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_10px_rgba(244,162,97,0.5)] opacity-100'
                : 'opacity-0 hidden'
            }`}
          >
            ● Side Bb
          </div>
        </Html>
      </group>

      <group position={SAX_EB_POS}>
        <mesh rotation={[0.2, -0.4, 0]}>
          <boxGeometry args={[0.12, 0.16, 0.055]} />
          <meshPhysicalMaterial
            color={hasEb ? '#f4a261' : '#c8963e'}
            emissive={hasEb ? '#f4a261' : '#000000'}
            emissiveIntensity={hasEb ? 1.15 : 0}
            metalness={0.65}
            roughness={0.25}
          />
        </mesh>
        <Html position={[-0.28, -0.06, 0.1]} center zIndexRange={[14, 0]}>
          <div
            className={`pointer-events-none px-1.5 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              active && hasEb
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_10px_rgba(244,162,97,0.5)] opacity-100'
                : 'opacity-0 hidden'
            }`}
          >
            ● Eb (RP)
          </div>
        </Html>
      </group>

      <group position={SAX_PALM_D_POS}>
        <mesh rotation={[0, 0.25, -0.25]}>
          <capsuleGeometry args={[0.038, 0.15, 8, 12]} />
          <meshPhysicalMaterial
            color={hasPalmD ? '#f4a261' : '#c8963e'}
            emissive={hasPalmD ? '#f4a261' : '#000000'}
            emissiveIntensity={hasPalmD ? 1.15 : 0}
            metalness={0.65}
            roughness={0.25}
          />
        </mesh>
        <Html position={[0.28, 0.08, 0.06]} center zIndexRange={[14, 0]}>
          <div
            className={`pointer-events-none px-1.5 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              active && hasPalmD
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_10px_rgba(244,162,97,0.5)] opacity-100'
                : 'opacity-0 hidden'
            }`}
          >
            ● Palm D
          </div>
        </Html>
      </group>

      {/* Rear Right-Thumb Brass Hook */}
      <mesh position={[0, -0.58, -0.28]} rotation={[0, Math.PI / 2, 0]} material={darkBrassMat}>
        <torusGeometry args={[0.075, 0.022, 10, 20, Math.PI * 1.1]} />
      </mesh>
    </group>
  );
};
