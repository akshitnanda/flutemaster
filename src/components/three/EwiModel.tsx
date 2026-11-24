import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { EwiFingering, EwiSettings, LiveMidiState } from '../../types/music';
import { EWI_STUDIO_VOICES, formatTranspose } from '../../data/ewi';

/** Shared spatial constants for EwiModel & EwiHands (local upright EDA-100 aerophone space) */
export const EWI_MAIN_PADS: Array<{
  index: number;
  code: string;
  y: number;
  bodyRadius: number;
  padRadius: number;
  hand: 'left' | 'right';
}> = [
  { index: 0, code: 'L1', y: 1.04, bodyRadius: 0.192, padRadius: 0.088, hand: 'left' },
  { index: 1, code: 'L2', y: 0.64, bodyRadius: 0.196, padRadius: 0.09, hand: 'left' },
  { index: 2, code: 'L3', y: 0.24, bodyRadius: 0.2, padRadius: 0.09, hand: 'left' },
  { index: 3, code: 'R1', y: -0.32, bodyRadius: 0.205, padRadius: 0.092, hand: 'right' },
  { index: 4, code: 'R2', y: -0.72, bodyRadius: 0.21, padRadius: 0.092, hand: 'right' },
  { index: 5, code: 'R3', y: -1.12, bodyRadius: 0.215, padRadius: 0.092, hand: 'right' },
];

// Rear Left-Thumb 3-Zone Capacitive Octave Pads (OCT+ / 0 / OCT-)
export const EWI_OCTAVE_BASE_POS: [number, number, number] = [0.04, 1.12, -0.205];
export const EWI_OCTAVE_STEP_Y = 0.21;

// Chromatic Capacitive Side / Pinky Touch Pads
export const EWI_LP_SHARP_POS: [number, number, number] = [0.22, -0.04, 0.09]; // Left Pinky G# / +½
export const EWI_SIDE_BB_POS: [number, number, number] = [-0.22, -0.02, 0.1]; // Right Side Bb / Flat
export const EWI_RP_EB_POS: [number, number, number] = [-0.23, -1.42, 0.1]; // Right Pinky Eb
export const EWI_PALM_D_POS: [number, number, number] = [0.21, 1.38, 0.07]; // Left Palm D

// Right-Thumb Pitch Bend Touch Pad (angled slightly on -X rear flank so visible across angles)
export const EWI_PITCH_BEND_POS: [number, number, number] = [-0.14, -0.58, -0.19];

function createObsidianChassisTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#16171a');
  grad.addColorStop(0.28, '#23262c');
  grad.addColorStop(0.5, '#2b2f37');
  grad.addColorStop(0.75, '#1d2026');
  grad.addColorStop(1, '#141518');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Micro satin anodized sheen lines
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 512;
    ctx.strokeStyle =
      Math.random() > 0.5 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawOledCanvas(
  canvas: HTMLCanvasElement,
  toneNum: string,
  fingeringMode: 'sax' | 'flute',
  transpose: number,
  breathLevel: number,
  reverbLevel: number,
  writtenNote: string,
  midiConnected: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Deep matte OLED black background
  ctx.fillStyle = '#070b0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle cyan/emerald OLED scan frame
  ctx.strokeStyle = 'rgba(114, 239, 221, 0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  // Header strip
  ctx.fillStyle = '#72efdd';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('EDA-100', 18, 32);

  ctx.fillStyle = midiConnected ? '#38bfa9' : '#e9c46a';
  ctx.textAlign = 'right';
  ctx.fillText(midiConnected ? '● USB MIDI' : '● 3W SPK', canvas.width - 18, 32);

  // Divider line
  ctx.strokeStyle = 'rgba(114, 239, 221, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 44);
  ctx.lineTo(canvas.width - 16, 44);
  ctx.stroke();

  // Primary big LED digits: Tone + Fingering Mode + Written Pitch
  ctx.fillStyle = '#f8f9fa';
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`T${toneNum}`, 18, 94);

  ctx.fillStyle = '#e9c46a';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(fingeringMode === 'sax' ? 'F01' : 'F02', 162, 92);

  ctx.fillStyle = '#72efdd';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(writtenNote, canvas.width - 18, 92);

  // Bottom status telemetry row
  ctx.fillStyle = '#9aa8b8';
  ctx.font = 'bold 19px monospace';
  ctx.textAlign = 'left';
  const trStr = transpose === 0 ? '0' : transpose > 0 ? `+${transpose}` : `${transpose}`;
  ctx.fillText(`TR:${trStr}`, 18, 134);
  ctx.textAlign = 'center';
  ctx.fillText(`BR:0${breathLevel}`, 142, 134);
  ctx.textAlign = 'right';
  ctx.fillText(`RV:${String(reverbLevel).padStart(2, '0')}`, canvas.width - 18, 134);
}

interface EwiModelProps {
  active?: boolean;
  fingering: EwiFingering;
  ewiSettings: EwiSettings;
  effectiveTranspose: number;
  liveMidi?: LiveMidiState;
  isPlaying: boolean;
  isBreathPause: boolean;
  showKeyLabels: boolean;
}

export const EwiModel: React.FC<EwiModelProps> = ({
  active = true,
  fingering,
  ewiSettings,
  effectiveTranspose,
  liveMidi,
  isPlaying,
  isBreathPause,
  showKeyLabels,
}) => {
  const chassisTex = useMemo(() => createObsidianChassisTexture(), []);

  // Live dynamic OLED texture
  const oledCanvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 288;
    c.height = 154;
    return c;
  }, []);

  const oledTex = useMemo(() => {
    const t = new THREE.CanvasTexture(oledCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [oledCanvas]);

  useEffect(() => {
    return () => {
      chassisTex.dispose();
      oledTex.dispose();
    };
  }, [chassisTex, oledTex]);

  const voiceEntry =
    EWI_STUDIO_VOICES.find((v) => v.id === ewiSettings.voice) || EWI_STUDIO_VOICES[0];

  useEffect(() => {
    drawOledCanvas(
      oledCanvas,
      voiceEntry.edaToneNum,
      ewiSettings.fingeringMode,
      effectiveTranspose,
      ewiSettings.breathLevel,
      ewiSettings.reverbLevel,
      fingering.writtenNote,
      Boolean(liveMidi?.connected)
    );
    oledTex.needsUpdate = true;
  }, [
    oledCanvas,
    oledTex,
    voiceEntry.edaToneNum,
    ewiSettings.fingeringMode,
    effectiveTranspose,
    ewiSettings.breathLevel,
    ewiSettings.reverbLevel,
    fingering.writtenNote,
    liveMidi?.connected,
  ]);

  const chassisMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: chassisTex,
        color: new THREE.Color('#1c1f24'),
        metalness: 0.28,
        roughness: 0.34,
        clearcoat: 0.55,
        clearcoatRoughness: 0.24,
      }),
    [chassisTex]
  );

  const gunmetalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#343942',
        metalness: 0.78,
        roughness: 0.28,
      }),
    []
  );

  const chromeTrimMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c4cbd6',
        metalness: 0.88,
        roughness: 0.2,
      }),
    []
  );

  const siliconeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#121316',
        roughness: 0.62,
        metalness: 0.04,
        clearcoat: 0.12,
      }),
    []
  );

  const breathHaloRef = useRef<THREE.Mesh>(null);
  const bellLedRef = useRef<THREE.Mesh>(null);
  const pitchGlowRef = useRef<THREE.Mesh>(null);

  const hasLeftPinky =
    fingering.auxPads.includes('G#') || fingering.auxPads.includes('Sharp');
  const hasSideBb =
    fingering.auxPads.includes('Bb') || fingering.auxPads.includes('Flat');
  const hasEb = fingering.auxPads.includes('Eb');
  const hasPalmD = fingering.auxPads.includes('PalmD');
  const pitchActive =
    fingering.pitchBendActive || Math.abs(liveMidi?.pitchBend ?? 0) > 0.12;

  useFrame(({ clock }) => {
    if (!active) return;
    const t = clock.getElapsedTime();

    if (breathHaloRef.current) {
      const breathScale =
        liveMidi?.connected && liveMidi.breathCC > 0
          ? 1 + (liveMidi.breathCC / 127) * 0.24
          : isBreathPause
          ? 1 + 0.18 * Math.sin(t * 4.5)
          : isPlaying
          ? 1 + 0.06 * Math.sin(t * 7.5)
          : 1;
      breathHaloRef.current.scale.set(breathScale, breathScale, 1);
    }

    if (bellLedRef.current) {
      const mat = bellLedRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = isBreathPause
        ? 0.25
        : isPlaying
        ? 0.68 + 0.22 * Math.sin(t * 6)
        : 0.42;
    }

    if (pitchGlowRef.current && pitchActive) {
      const s = 1 + 0.14 * Math.sin(t * 14);
      pitchGlowRef.current.scale.set(s, s, 1);
    }
  });

  const leftPinkyTag = ewiSettings.fingeringMode === 'flute' ? '+½ (LP)' : 'G# (LP)';
  const sideBbTag = ewiSettings.fingeringMode === 'flute' ? 'Bb / Flat' : 'Side Bb';

  return (
    <group name="ewi-eastar-eda100">
      {/* ====================================================================
          SLEEK OBSIDIAN-BLACK EASTAR EDA-100 AEROPHONE BODY
          ==================================================================== */}
      {/* Main Tapered Aerophone Tube */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow material={chassisMat}>
        <cylinderGeometry args={[0.182, 0.226, 3.68, 44]} />
      </mesh>

      {/* Subtle ergonomic upper shoulder collar */}
      <mesh position={[0, 1.94, 0]} material={gunmetalMat}>
        <cylinderGeometry args={[0.155, 0.184, 0.12, 36]} />
      </mesh>
      <mesh position={[0, 1.88, 0]} rotation={[Math.PI / 2, 0, 0]} material={chromeTrimMat}>
        <torusGeometry args={[0.183, 0.011, 12, 40]} />
      </mesh>

      {/* Removable Soft Silicone Mouthpiece (curved ergonomic beak) */}
      <group position={[0, 2.24, -0.02]} rotation={[-0.14, 0, 0]}>
        {/* Mouthpiece base collar */}
        <mesh position={[0, -0.22, 0]} material={chromeTrimMat}>
          <cylinderGeometry args={[0.132, 0.148, 0.08, 28]} />
        </mesh>
        {/* Soft matte black silicone body */}
        <mesh position={[0, 0.02, 0]} scale={[1.05, 1, 0.72]} castShadow material={siliconeMat}>
          <cylinderGeometry args={[0.078, 0.128, 0.44, 28]} />
        </mesh>
        {/* Tip windway rim */}
        <mesh position={[0, 0.24, 0]} scale={[1.05, 1, 0.65]} material={siliconeMat}>
          <cylinderGeometry args={[0.07, 0.078, 0.06, 24]} />
        </mesh>
        {/* Glowing Breath-Sensor Halo Ring */}
        <mesh ref={breathHaloRef} position={[0, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.068, 0.106, 32]} />
          <meshBasicMaterial
            color={
              isBreathPause
                ? '#72efdd'
                : pitchActive
                ? '#e9c46a'
                : fingering.octaveShift === 1
                ? '#f4a261'
                : fingering.octaveShift === -1
                ? '#72efdd'
                : '#2a9d8f'
            }
            transparent
            opacity={isBreathPause ? 0.92 : 0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ====================================================================
          BUILT-IN BACKLIT MINI OLED DISPLAY & MENU CONTROL CLUSTER
          ==================================================================== */}
      {/* Beveled Glossy Display Bezel above L1 */}
      <group position={[0, 1.58, 0.184]} rotation={[-0.02, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.31, 0.185, 0.026]} />
          <meshPhysicalMaterial
            color="#0b0d10"
            roughness={0.14}
            metalness={0.4}
            clearcoat={0.9}
          />
        </mesh>
        {/* Live CanvasTexture OLED readout */}
        <mesh position={[0, 0, 0.0145]}>
          <planeGeometry args={[0.285, 0.155]} />
          <meshBasicMaterial map={oledTex} toneMapped={false} />
        </mesh>
      </group>

      {/* Compact EDA-100 Hardware Function Buttons flanking top bezel */}
      {[-0.105, -0.035, 0.035, 0.105].map((bx, i) => (
        <mesh key={i} position={[bx, 1.38, 0.194]} rotation={[Math.PI / 2, 0, 0]} material={gunmetalMat}>
          <cylinderGeometry args={[0.021, 0.023, 0.02, 16]} />
        </mesh>
      ))}

      {/* Subtle recessed silver sensor channel framing the 6 front touch keys */}
      <mesh position={[0, -0.03, 0.184]}>
        <boxGeometry args={[0.22, 2.52, 0.018]} />
        <meshStandardMaterial color="#121418" metalness={0.35} roughness={0.48} />
      </mesh>

      {/* ====================================================================
          LOWER BELL FLARE, 3W HI-FI SPEAKER GRILLE, POWER LED & USB-C / 3.5MM
          ==================================================================== */}
      <group position={[0, -1.94, 0]}>
        {/* Slight contoured digital bell flare */}
        <mesh castShadow material={chassisMat}>
          <cylinderGeometry args={[0.226, 0.288, 0.44, 44]} />
        </mesh>
        {/* Brushed chrome collar accent */}
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={chromeTrimMat}>
          <torusGeometry args={[0.228, 0.013, 12, 44]} />
        </mesh>
        {/* Ambient LED Acoustic Status Ring */}
        <mesh ref={bellLedRef} position={[0, -0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.286, 0.012, 12, 44]} />
          <meshBasicMaterial
            color={pitchActive ? '#e9c46a' : '#2a9d8f'}
            transparent
            opacity={0.55}
          />
        </mesh>
        {/* Recessed 3W Built-In Speaker Mesh */}
        <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.258, 36]} />
          <meshStandardMaterial color="#0e1014" roughness={0.72} metalness={0.45} side={THREE.DoubleSide} />
        </mesh>
        {/* Front micro speaker perforations */}
        {[-0.08, 0, 0.08].map((sx, i) => (
          <mesh key={i} position={[sx, 0.02, 0.252]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.015, 12]} />
            <meshStandardMaterial color="#090a0c" roughness={0.8} />
          </mesh>
        ))}
        {/* Side USB-C & 3.5mm headphone jack micro accents */}
        <mesh position={[0.248, -0.02, -0.04]} rotation={[0, Math.PI / 2, 0]} material={chromeTrimMat}>
          <cylinderGeometry args={[0.022, 0.022, 0.015, 16]} />
        </mesh>
      </group>

      {/* ====================================================================
          6 NOISELESS FLUSH CAPACITIVE TOUCH PADS (L1-L3 · R1-R3)
          ==================================================================== */}
      {EWI_MAIN_PADS.map((pad, idx) => {
        const touched = fingering.mainPads[idx];
        return (
          <group key={pad.code} position={[0, pad.y, pad.bodyRadius + 0.008]}>
            {/* Recessed metallic capacitive sensor ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]} material={gunmetalMat}>
              <cylinderGeometry args={[pad.padRadius * 1.15, pad.padRadius * 1.18, 0.02, 32]} />
            </mesh>
            {/* Flush satin-silver capacitive touch disc */}
            <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[pad.padRadius * 0.96, pad.padRadius * 0.96, 0.014, 32]} />
              <meshPhysicalMaterial
                color={touched ? '#2a9d8f' : '#ced4de'}
                emissive={touched ? '#2a9d8f' : '#181c22'}
                emissiveIntensity={touched ? 1.35 : 0.14}
                metalness={touched ? 0.25 : 0.84}
                roughness={0.18}
                clearcoat={0.85}
              />
            </mesh>
            {/* Active jade/gold capacitive glow ring */}
            <mesh visible={touched} position={[0, 0, 0.024]}>
              <ringGeometry args={[pad.padRadius * 0.94, pad.padRadius * 1.46, 32]} />
              <meshBasicMaterial
                color="#72efdd"
                transparent
                opacity={0.94}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Clean Pad Code Label */}
            <Html
              position={[pad.hand === 'left' ? -0.34 : 0.34, 0, 0.04]}
              center
              zIndexRange={[6, 0]}
            >
              <div
                className={`pointer-events-none px-1.5 py-[1px] rounded text-[9px] font-mono-tech transition-all ${
                  !active ? 'hidden' : showKeyLabels ? 'opacity-100' : 'opacity-0'
                } ${
                  touched
                    ? 'bg-[#2a9d8f] text-[#f8f9fa] font-bold border border-[#72efdd]/80 shadow-[0_0_8px_rgba(42,157,143,0.75)]'
                    : 'bg-[#181614]/88 text-[#a69f95] border border-white/12'
                }`}
              >
                {pad.code}
              </div>
            </Html>
          </group>
        );
      })}

      {/* ====================================================================
          REAR LEFT-THUMB 3-ZONE OCTAVE ROLLER PADS (OCT+ / 0 / OCT-)
          ==================================================================== */}
      <group position={EWI_OCTAVE_BASE_POS}>
        {(
          [
            { shift: 1 as const, dy: EWI_OCTAVE_STEP_Y, label: 'OCT+', color: '#f4a261' },
            { shift: 0 as const, dy: 0, label: '0', color: '#72efdd' },
            { shift: -1 as const, dy: -EWI_OCTAVE_STEP_Y, label: 'OCT−', color: '#72efdd' },
          ]
        ).map((zone) => {
          const isZoneActive = fingering.octaveShift === zone.shift;
          return (
            <mesh
              key={zone.label}
              position={[0, zone.dy, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <capsuleGeometry args={[0.044, 0.13, 8, 16]} />
              <meshPhysicalMaterial
                color={isZoneActive ? zone.color : '#8a93a2'}
                emissive={isZoneActive ? zone.color : '#000000'}
                emissiveIntensity={isZoneActive ? 1.25 : 0}
                metalness={isZoneActive ? 0.2 : 0.78}
                roughness={0.22}
              />
            </mesh>
          );
        })}

        <Html position={[0.36, fingering.octaveShift * EWI_OCTAVE_STEP_Y, 0.04]} center zIndexRange={[14, 0]}>
          <div
            className={`pointer-events-none px-2 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              !active
                ? 'hidden'
                : fingering.octaveShift === 1
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_12px_rgba(244,162,97,0.5)] opacity-100'
                : fingering.octaveShift === -1
                ? 'bg-[#0e2228]/95 border-[#72efdd] text-[#72efdd] shadow-[0_0_12px_rgba(114,239,221,0.45)] opacity-100'
                : showKeyLabels
                ? 'bg-[#181614]/82 border-white/12 text-[#a69f95] opacity-75'
                : 'opacity-0'
            }`}
          >
            {fingering.octaveShift === 1
              ? '● OCT+ PAD'
              : fingering.octaveShift === -1
              ? '● OCT− PAD'
              : 'OCT 0'}
          </div>
        </Html>
      </group>

      {/* ====================================================================
          RIGHT-THUMB PITCH BEND CAPACITIVE PAD (Meend / Gamak!)
          ==================================================================== */}
      <group position={EWI_PITCH_BEND_POS}>
        {/* Sleek pitch-bend touch bar */}
        <mesh rotation={[0, -0.55, 0]}>
          <capsuleGeometry args={[0.045, 0.19, 8, 16]} />
          <meshPhysicalMaterial
            color={pitchActive ? '#e9c46a' : '#8a93a2'}
            emissive={pitchActive ? '#e9c46a' : '#000000'}
            emissiveIntensity={pitchActive ? 1.45 : 0}
            metalness={pitchActive ? 0.2 : 0.75}
            roughness={0.2}
          />
        </mesh>
        {/* Golden Meend/Gamak pulse halo */}
        <mesh ref={pitchGlowRef} visible={pitchActive} position={[-0.04, 0, -0.02]} rotation={[0, -0.6, 0]}>
          <ringGeometry args={[0.07, 0.13, 24]} />
          <meshBasicMaterial color="#e9c46a" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>

        <Html position={[-0.32, 0.02, 0.04]} center zIndexRange={[15, 0]}>
          <div
            className={`pointer-events-none px-2 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              !active
                ? 'hidden'
                : pitchActive
                ? 'bg-[#2c220a]/95 border-[#e9c46a] text-[#e9c46a] shadow-[0_0_12px_rgba(233,196,106,0.6)] opacity-100'
                : showKeyLabels
                ? 'bg-[#181614]/82 border-white/12 text-[#a69f95] opacity-70'
                : 'opacity-0'
            }`}
          >
            {pitchActive ? '● PITCH BEND' : 'PB'}
          </div>
        </Html>
      </group>

      {/* Ergonomic Rear Right-Thumb Rest Hook */}
      <mesh position={[0, -0.92, -0.25]} rotation={[0, Math.PI / 2, 0]} material={gunmetalMat}>
        <torusGeometry args={[0.068, 0.02, 10, 20, Math.PI * 1.1]} />
      </mesh>

      {/* ====================================================================
          CHROMATIC SIDE & PINKY CAPACITIVE TOUCH PADS
          ==================================================================== */}
      {/* Left Pinky (G# / +½ Sharp) */}
      <group position={EWI_LP_SHARP_POS}>
        <mesh rotation={[0, 0.42, 0]}>
          <boxGeometry args={[0.075, 0.16, 0.032]} />
          <meshPhysicalMaterial
            color={hasLeftPinky ? '#f4a261' : '#9aa3b2'}
            emissive={hasLeftPinky ? '#f4a261' : '#000000'}
            emissiveIntensity={hasLeftPinky ? 1.25 : 0}
            metalness={0.72}
            roughness={0.22}
          />
        </mesh>
        <Html position={[0.26, 0.04, 0.05]} center zIndexRange={[14, 0]}>
          <div
            className={`pointer-events-none px-1.5 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              active && hasLeftPinky
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_10px_rgba(244,162,97,0.5)] opacity-100'
                : 'opacity-0 hidden'
            }`}
          >
            ● {leftPinkyTag}
          </div>
        </Html>
      </group>

      {/* Right Side (Bb / Flat) */}
      <group position={EWI_SIDE_BB_POS}>
        <mesh rotation={[0, -0.42, 0]}>
          <capsuleGeometry args={[0.034, 0.15, 8, 14]} />
          <meshPhysicalMaterial
            color={hasSideBb ? '#f4a261' : '#9aa3b2'}
            emissive={hasSideBb ? '#f4a261' : '#000000'}
            emissiveIntensity={hasSideBb ? 1.25 : 0}
            metalness={0.72}
            roughness={0.22}
          />
        </mesh>
        <Html position={[-0.3, 0.04, 0.08]} center zIndexRange={[14, 0]}>
          <div
            className={`pointer-events-none px-1.5 py-0.5 rounded-full text-[9px] font-mono-tech font-bold whitespace-nowrap border transition-all ${
              active && hasSideBb
                ? 'bg-[#2b1a0c]/95 border-[#f4a261] text-[#f4a261] shadow-[0_0_10px_rgba(244,162,97,0.5)] opacity-100'
                : 'opacity-0 hidden'
            }`}
          >
            ● {sideBbTag}
          </div>
        </Html>
      </group>

      {/* Right Pinky (Eb) */}
      <group position={EWI_RP_EB_POS}>
        <mesh rotation={[0.15, -0.45, 0]}>
          <boxGeometry args={[0.08, 0.145, 0.032]} />
          <meshPhysicalMaterial
            color={hasEb ? '#f4a261' : '#9aa3b2'}
            emissive={hasEb ? '#f4a261' : '#000000'}
            emissiveIntensity={hasEb ? 1.25 : 0}
            metalness={0.72}
            roughness={0.22}
          />
        </mesh>
        <Html position={[-0.26, -0.05, 0.08]} center zIndexRange={[14, 0]}>
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

      {/* Left Palm (Palm D) */}
      <group position={EWI_PALM_D_POS}>
        <mesh rotation={[0, 0.3, -0.22]}>
          <capsuleGeometry args={[0.032, 0.14, 8, 12]} />
          <meshPhysicalMaterial
            color={hasPalmD ? '#f4a261' : '#9aa3b2'}
            emissive={hasPalmD ? '#f4a261' : '#000000'}
            emissiveIntensity={hasPalmD ? 1.25 : 0}
            metalness={0.72}
            roughness={0.22}
          />
        </mesh>
        <Html position={[0.27, 0.06, 0.05]} center zIndexRange={[14, 0]}>
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

      {/* Compact Transpose readout tag on lower bezel when labels shown */}
      <Html position={[0.38, 1.62, 0.12]} center zIndexRange={[10, 0]}>
        <div
          className={`pointer-events-none px-1.5 py-0.5 rounded text-[9px] font-mono-tech whitespace-nowrap border transition-all ${
            !active
              ? 'hidden'
              : showKeyLabels
              ? 'bg-[#12161b]/90 border-[#72efdd]/35 text-[#72efdd] opacity-90'
              : 'opacity-0'
          }`}
        >
          TR {formatTranspose(effectiveTranspose)}
        </div>
      </Html>
    </group>
  );
};
