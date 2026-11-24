import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  CameraView,
  EwiSettings,
  InstrumentType,
  LiveMidiState,
  Octave,
  OrnamentType,
  Song,
  SwaraId,
} from '../../types/music';
import {
  getFingering,
  getFrequencyHz,
  getOctaveLabel,
  HOLE_LABELS,
  INTERACTIVE_SCALE_NOTES,
  SWARA_META,
} from '../../data/sargam';
import {
  getHarmonicaTab,
  getSaxFingering,
  SAX_KEY_LABELS,
} from '../../data/instruments';
import {
  DEFAULT_EWI_SETTINGS,
  EWI_PAD_LABELS,
  formatTranspose,
  getEwiFingering,
  getRecommendedEdaTranspose,
} from '../../data/ewi';
import { BansuriModel } from './BansuriModel';
import { ArticulatedHands } from './ArticulatedHands';
import { FINGER_HOLES } from './fluteGeometry';
import { SaxophoneModel } from './SaxophoneModel';
import { SaxophoneHands } from './SaxophoneHands';
import { getHarmonicaHoleX, HarmonicaModel } from './HarmonicaModel';
import { HarmonicaHands } from './HarmonicaHands';
import { EwiModel } from './EwiModel';
import { EwiHands } from './EwiHands';
import { SwaraSymbol } from '../SwaraSymbol';
import { AlertTriangle, ArrowDown, ArrowUp, Eye, Hand, Hash, Wind } from 'lucide-react';

interface CameraPreset {
  pos: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: Record<InstrumentType, Record<CameraView, CameraPreset>> = {
  bansuri: {
    'front-facing': { pos: [0.08, 2.88, 4.75], target: [0.08, 0.02, 0.0] },
    'first-person': { pos: [-3.75, 1.88, 2.15], target: [0.95, 0.0, -0.06] },
    'close-up': { pos: [0.68, 2.18, 2.18], target: [0.68, 0.08, 0.0] },
  },
  saxophone: {
    'front-facing': { pos: [0.32, 0.28, 5.45], target: [0.32, -0.05, 0.05] },
    'first-person': { pos: [-2.35, 2.25, 1.85], target: [0.35, -0.35, 0.0] },
    'close-up': { pos: [0.05, 0.22, 3.35], target: [0.05, 0.05, 0.05] },
  },
  harmonica: {
    'front-facing': { pos: [0.15, 1.92, 4.85], target: [0.15, -0.04, 0.15] },
    'first-person': { pos: [0.15, 2.95, 3.85], target: [0.15, -0.08, 0.2] },
    'close-up': { pos: [0.0, 1.25, 3.25], target: [0.0, -0.05, 0.35] },
  },
  ewi: {
    'front-facing': { pos: [-0.08, 0.22, 5.85], target: [-0.1, -0.08, 0.04] },
    'first-person': { pos: [-2.65, 2.15, 2.05], target: [0.3, -0.25, 0.0] },
    'close-up': { pos: [0.0, 0.16, 3.32], target: [0.0, -0.04, 0.06] },
  },
};

interface CameraRigProps {
  instrument: InstrumentType;
  cameraView: CameraView;
  halfHoleIndex: number | null;
  harmonicaHole: number;
  harmonicaSlide: boolean;
  saxLowerActive: boolean;
  ewiLowerActive: boolean;
}

const CameraRig: React.FC<CameraRigProps> = ({
  instrument,
  cameraView,
  halfHoleIndex,
  harmonicaHole,
  harmonicaSlide,
  saxLowerActive,
  ewiLowerActive,
}) => {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const isUserDragging = useRef(false);
  const desiredPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.bansuri['front-facing'].pos));
  const desiredTarget = useRef(new THREE.Vector3(...CAMERA_PRESETS.bansuri['front-facing'].target));
  const offsetVec = useRef(new THREE.Vector3());

  useEffect(() => {
    isUserDragging.current = false;
  }, [cameraView, instrument, size.width, size.height]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const preset = CAMERA_PRESETS[instrument][cameraView];

    desiredPos.current.set(...preset.pos);
    desiredTarget.current.set(...preset.target);

    // Smart Close-Up auto-framing per instrument!
    if (cameraView === 'close-up') {
      if (instrument === 'bansuri' && halfHoleIndex !== null && FINGER_HOLES[halfHoleIndex]) {
        const holeX = FINGER_HOLES[halfHoleIndex].x;
        desiredPos.current.x = THREE.MathUtils.lerp(0.68, holeX, 0.55);
        desiredTarget.current.x = THREE.MathUtils.lerp(0.68, holeX, 0.65);
      } else if (instrument === 'harmonica') {
        const hx = getHarmonicaHoleX(harmonicaHole);
        const focusX = harmonicaSlide ? THREE.MathUtils.lerp(hx, 1.45, 0.35) : hx;
        desiredPos.current.x = focusX;
        desiredTarget.current.x = focusX;
      } else if (instrument === 'saxophone') {
        const panX = saxLowerActive ? 0.32 : -0.45;
        desiredPos.current.x = panX;
        desiredTarget.current.x = panX;
      } else if (instrument === 'ewi') {
        const panX = ewiLowerActive ? 0.32 : -0.42;
        desiredPos.current.x = panX;
        desiredTarget.current.x = panX;
      }
    }

    // Dynamic viewport aspect-ratio & compact-width adaptation:
    // Pulls camera cleanly back on mobile/narrow viewports and shifts slightly clear of top-left HUD on 768-1240px!
    const aspect = size.width / Math.max(1, size.height);
    const refAspect = cameraView === 'close-up' ? 1.85 : 2.35;
    let fitScale = 1.0;
    if (aspect < refAspect) {
      fitScale = Math.min(2.35, Math.max(1.0, Math.pow(refAspect / Math.max(0.55, aspect), 0.74)));
    }
    if (cameraView === 'front-facing' && size.width >= 640 && size.width < 1260) {
      fitScale = Math.max(fitScale, 1.12);
      if (instrument === 'ewi') {
        desiredTarget.current.x -= 0.32;
        desiredPos.current.x -= 0.32;
      }
    }
    if (fitScale > 1.001) {
      offsetVec.current.subVectors(desiredPos.current, desiredTarget.current).multiplyScalar(fitScale);
      // Gently nudge look target slightly upward so the 3D instrument drops cleanly clear of top-left HUD!
      desiredTarget.current.y += (fitScale - 1) * 0.22;
      desiredPos.current.copy(desiredTarget.current).add(offsetVec.current);
    }

    if (!isUserDragging.current) {
      const lerpAlpha = 1 - Math.exp(-5.0 * dt);
      camera.position.lerp(desiredPos.current, lerpAlpha);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(desiredTarget.current, lerpAlpha);
        controlsRef.current.update();
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      minDistance={1.6}
      maxDistance={14.5}
      minPolarAngle={0.18}
      maxPolarAngle={Math.PI * 0.62}
      onStart={() => {
        isUserDragging.current = true;
      }}
    />
  );
};

interface BansuriSceneProps {
  instrument: InstrumentType;
  ewiSettings?: EwiSettings;
  liveMidi?: LiveMidiState;
  song: Song;
  activeSwara: SwaraId;
  activeOctave: Octave;
  activeOrnament?: OrnamentType;
  isPlaying: boolean;
  isBreathPause: boolean;
  cameraView: CameraView;
  onCameraViewChange: (view: CameraView) => void;
  notationStyle: 'short' | 'full';
  onPreviewSwara: (swara: SwaraId, octave: Octave) => void;
}

export const BansuriScene: React.FC<BansuriSceneProps> = ({
  instrument,
  ewiSettings = DEFAULT_EWI_SETTINGS,
  liveMidi,
  song,
  activeSwara,
  activeOctave,
  activeOrnament,
  isPlaying,
  isBreathPause,
  cameraView,
  onCameraViewChange,
  notationStyle,
  onPreviewSwara,
}) => {
  const [showLabels, setShowLabels] = useState(true);
  const [showHands, setShowHands] = useState(true);
  const [showScaleBar, setShowScaleBar] = useState(false);

  const bansuriFingering = useMemo(
    () => getFingering(activeSwara, activeOctave),
    [activeSwara, activeOctave]
  );
  const saxFingering = useMemo(
    () => getSaxFingering(activeSwara, activeOctave),
    [activeSwara, activeOctave]
  );
  const harmonicaTab = useMemo(
    () => getHarmonicaTab(activeSwara, activeOctave),
    [activeSwara, activeOctave]
  );
  const ewiFingering = useMemo(
    () =>
      getEwiFingering(
        activeSwara,
        activeOctave,
        ewiSettings.fingeringMode,
        activeOrnament,
        ewiSettings.pitchBendEnabled
      ),
    [activeSwara, activeOctave, ewiSettings.fingeringMode, activeOrnament, ewiSettings.pitchBendEnabled]
  );

  const effectiveEwiTranspose =
    ewiSettings.transposeMode === 'auto'
      ? getRecommendedEdaTranspose(song.scale.id)
      : ewiSettings.manualTranspose;

  const freqHz = useMemo(
    () => getFrequencyHz(activeSwara, activeOctave, song.scale.rootHz),
    [activeSwara, activeOctave, song.scale.rootHz]
  );
  const swaraMeta = SWARA_META[activeSwara];

  // Unified coaching hint pill for the active instrument
  const activeCoachingTip =
    instrument === 'bansuri'
      ? bansuriFingering.pitchWarning
      : instrument === 'saxophone'
      ? saxFingering.coachingTip
      : instrument === 'ewi'
      ? ewiFingering.coachingTip
      : harmonicaTab.coachingTip;

  const isHighlightedWarning =
    instrument === 'bansuri'
      ? bansuriFingering.halfHoleIndex !== null
      : instrument === 'saxophone'
      ? saxFingering.auxKeys.length > 0 || saxFingering.octaveKey
      : instrument === 'ewi'
      ? ewiFingering.auxPads.length > 0 || ewiFingering.pitchBendActive
      : harmonicaTab.slide;

  const saxLowerActive =
    saxFingering.mainKeys[3] || saxFingering.mainKeys[4] || saxFingering.mainKeys[5];
  const ewiLowerActive =
    ewiFingering.mainPads[3] ||
    ewiFingering.mainPads[4] ||
    ewiFingering.mainPads[5] ||
    ewiFingering.pitchBendActive;

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-[#171513] via-[#131210] to-[#121212] overflow-hidden select-none">
      {/* Subtle warm studio spotlight glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            instrument === 'ewi'
              ? 'radial-gradient(ellipse 68% 58% at 50% 44%, rgba(42, 157, 143, 0.13) 0%, rgba(114, 239, 221, 0.05) 46%, rgba(18, 18, 18, 0) 78%)'
              : instrument === 'harmonica'
              ? 'radial-gradient(ellipse 68% 58% at 50% 44%, rgba(56, 189, 248, 0.08) 0%, rgba(212, 163, 115, 0.06) 46%, rgba(18, 18, 18, 0) 78%)'
              : 'radial-gradient(ellipse 68% 58% at 50% 44%, rgba(212, 163, 115, 0.1) 0%, rgba(42, 157, 143, 0.03) 48%, rgba(18, 18, 18, 0) 78%)',
        }}
      />

      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: CAMERA_PRESETS.bansuri['front-facing'].pos, fov: 35, near: 0.1, far: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
          });
        }}
      >
        <color attach="background" args={['#131210']} />
        <fog attach="fog" args={['#131210', 11, 25]} />

        {/* Studio Warm Bamboo/Brass & Jade Rim Lighting */}
        <ambientLight intensity={0.48} color="#fff1df" />
        <spotLight
          position={[0.5, 6.2, 4.5]}
          angle={0.5}
          penumbra={0.85}
          intensity={2.6}
          color="#ffe5c4"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-4.5, 2.4, 2.2]} intensity={0.95} color="#d4a373" />
        <pointLight position={[4.2, 1.8, -2.6]} intensity={1.15} color="#2a9d8f" />
        <directionalLight position={[0, -3, 2]} intensity={0.35} color="#8a725a" />

        {/* Zero-network procedural studio reflection environment (essential for Sax Brass & Harmonica Chrome!) */}
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={2.4}
            position={[0, 5, 3]}
            rotation={[Math.PI / 3, 0, 0]}
            scale={[10, 2.5, 1]}
            color="#fff0d9"
          />
          <Lightformer
            form="rect"
            intensity={1.5}
            position={[-5, 2, 2]}
            rotation={[0, Math.PI / 3, 0]}
            scale={[6, 2.5, 1]}
            color="#f5d5a7"
          />
          <Lightformer
            form="rect"
            intensity={1.3}
            position={[5, 2, -2]}
            rotation={[0, -Math.PI / 3, 0]}
            scale={[5, 2, 1]}
            color="#2a9d8f"
          />
          <Lightformer
            form="ring"
            intensity={1.1}
            position={[0, 1, 6]}
            scale={[4, 4, 1]}
            color="#ffe3c2"
          />
        </Environment>

        {/* Keep all 3 3D instrument stages mounted & toggle visibility -> 0ms switching & zero React 19 Drei Html removeChild errors! */}
        <group position={[0, 0.12, 0]} visible={instrument === 'bansuri'}>
          <BansuriModel
            active={instrument === 'bansuri'}
            holes={bansuriFingering.holes}
            breath={bansuriFingering.breath}
            isPlaying={isPlaying}
            isBreathPause={isBreathPause}
            showHoleLabels={showLabels}
          />
          <group visible={showHands}>
            <ArticulatedHands
              holes={bansuriFingering.holes}
              activeOrnament={activeOrnament}
              isPlaying={isPlaying}
              handOpacity={0.34}
            />
          </group>
        </group>

        <group
          position={[-0.18, -0.05, -0.08]}
          rotation={[0.12, -0.06, 0.94]}
          visible={instrument === 'saxophone'}
        >
          <SaxophoneModel
            active={instrument === 'saxophone'}
            fingering={saxFingering}
            isPlaying={isPlaying}
            isBreathPause={isBreathPause}
            showKeyLabels={showLabels}
          />
          <group visible={showHands}>
            <SaxophoneHands
              fingering={saxFingering}
              activeOrnament={activeOrnament}
              isPlaying={isPlaying}
              handOpacity={0.34}
            />
          </group>
        </group>

        <group position={[0, 0.08, 0]} visible={instrument === 'harmonica'}>
          <HarmonicaModel
            active={instrument === 'harmonica'}
            tab={harmonicaTab}
            isPlaying={isPlaying}
            isBreathPause={isBreathPause}
            showHoleLabels={showLabels}
          />
          <group visible={showHands}>
            <HarmonicaHands
              tab={harmonicaTab}
              activeOrnament={activeOrnament}
              isPlaying={isPlaying}
              handOpacity={0.34}
            />
          </group>
        </group>

        <group
          position={[-0.06, -0.14, 0]}
          rotation={[0.08, -0.04, 1.08]}
          visible={instrument === 'ewi'}
        >
          <EwiModel
            active={instrument === 'ewi'}
            fingering={ewiFingering}
            ewiSettings={ewiSettings}
            effectiveTranspose={effectiveEwiTranspose}
            liveMidi={liveMidi}
            isPlaying={isPlaying}
            isBreathPause={isBreathPause}
            showKeyLabels={showLabels}
          />
          <group visible={showHands}>
            <EwiHands
              fingering={ewiFingering}
              activeOrnament={activeOrnament}
              isPlaying={isPlaying}
              handOpacity={0.33}
            />
          </group>
        </group>

        {/* Grounded Studio Contact Shadow */}
        <ContactShadows
          position={[0.2, -1.05, 0]}
          opacity={0.46}
          scale={15}
          blur={2.4}
          far={3.2}
          color="#050403"
        />

        <CameraRig
          instrument={instrument}
          cameraView={cameraView}
          halfHoleIndex={bansuriFingering.halfHoleIndex}
          harmonicaHole={harmonicaTab.hole}
          harmonicaSlide={harmonicaTab.slide}
          saxLowerActive={saxLowerActive}
          ewiLowerActive={ewiLowerActive}
        />
      </Canvas>

      {/* ====================================================================
          HUD OVERLAY — TOP LEFT: Active Swara + Instrument-Specific 2D Reference
          ==================================================================== */}
      <div className="pointer-events-none absolute top-2 left-2 sm:top-3 sm:left-3.5 flex flex-col gap-1.5 sm:gap-2 z-10 max-w-[205px] sm:max-w-[310px]">
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#181614]/88 backdrop-blur-md border border-[#d4a373]/20 shadow-lg">
          {/* Active Swara Glyph Pill */}
          <div
            className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg flex flex-col items-center justify-center shrink-0 border transition-all ${
              isHighlightedWarning
                ? 'bg-[#f4a261]/15 border-[#f4a261]/60 text-[#f4a261] shadow-[0_0_16px_rgba(244,162,97,0.22)]'
                : instrument === 'harmonica' && harmonicaTab.action === 'draw'
                ? 'bg-[#38bdf8]/16 border-[#38bdf8]/60 text-[#7dd3fc] shadow-[0_0_16px_rgba(56,189,248,0.22)]'
                : 'bg-[#2a9d8f]/18 border-[#2a9d8f]/60 text-[#38bfa9] shadow-[0_0_16px_rgba(42,157,143,0.22)]'
            }`}
          >
            <SwaraSymbol
              swara={activeSwara}
              octave={activeOctave}
              notationStyle={notationStyle}
              size="md"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-semibold text-[#f8f9fa] truncate">
                {swaraMeta.isKomal ? 'Komal ' : swaraMeta.isTivra ? 'Tivra ' : 'Shuddha '}
                {swaraMeta.fullBase}
              </span>
              <span
                className={`hidden sm:inline font-hindi text-xs text-[#d4a373] ${
                  swaraMeta.isKomal ? 'underline decoration-[#f4a261] underline-offset-2' : ''
                }`}
              >
                ({swaraMeta.hindiName}
                {swaraMeta.isTivra ? '′' : ''})
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#a69f95] flex items-center gap-1.5 sm:gap-2 mt-0.5 truncate">
              <span className="truncate">{getOctaveLabel(activeOctave).split(' ')[0]}</span>
              <span className="text-[#d4a373]/40">•</span>
              <span className="font-mono-tech text-[#d4a373] truncate">
                {instrument === 'saxophone'
                  ? `Sax ${saxFingering.writtenNote}`
                  : instrument === 'harmonica'
                  ? `Tab ${harmonicaTab.compactTab}`
                  : instrument === 'ewi'
                  ? `${ewiFingering.writtenNote} · TR ${formatTranspose(effectiveEwiTranspose)}`
                  : `${freqHz.toFixed(0)} Hz`}
              </span>
            </div>

            {/* INSTRUMENT-SPECIFIC 2D REFERENCE STRIP */}
            {instrument === 'bansuri' && (
              <div className="flex items-center gap-1 sm:gap-1.5 mt-1.5" title="6 Main Bansuri Holes (L1-L3 · R1-R3)">
                {bansuriFingering.holes.slice(0, 6).map((h, i) => (
                  <React.Fragment key={i}>
                    {i === 3 && <span className="w-1 sm:w-1.5 h-[1px] bg-[#d4a373]/30" />}
                    <span
                      className={`relative w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border transition-all ${
                        h === 1
                          ? 'bg-[#2a9d8f] border-[#e9c46a] shadow-[0_0_6px_rgba(42,157,143,0.75)]'
                          : h === 0.5
                          ? 'bg-[#121212] border-[#f4a261] overflow-hidden shadow-[0_0_6px_rgba(244,162,97,0.7)]'
                          : 'bg-[#121212] border-[#d4a373]/35'
                      }`}
                      title={`${HOLE_LABELS[i].finger}: ${
                        h === 1 ? 'Closed' : h === 0.5 ? 'Half-Hole (50%)' : 'Open'
                      }`}
                    >
                      {h === 0.5 && <span className="absolute inset-y-0 left-0 w-1/2 bg-[#f4a261]" />}
                    </span>
                  </React.Fragment>
                ))}
                {activeOrnament && (
                  <span className="ml-1 px-1.5 py-[1px] rounded bg-[#d4a373]/20 border border-[#d4a373]/40 text-[9px] uppercase tracking-wider text-[#e9c46a] font-semibold">
                    {activeOrnament}
                  </span>
                )}
              </div>
            )}

            {instrument === 'saxophone' && (
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1.5">
                <span
                  className={`px-1 sm:px-1.5 py-[1px] rounded text-[8px] sm:text-[9px] font-mono-tech font-bold border ${
                    saxFingering.octaveKey
                      ? 'bg-[#f4a261] text-[#121212] border-[#fff0d9]'
                      : 'bg-[#121212] text-[#a69f95] border-white/15'
                  }`}
                  title="Left Thumb Octave Key"
                >
                  OCT
                </span>
                {saxFingering.mainKeys.map((pressed, i) => (
                  <React.Fragment key={i}>
                    {i === 3 && <span className="w-1 h-[1px] bg-[#d4a373]/35" />}
                    <span
                      className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border transition-all ${
                        pressed
                          ? 'bg-[#2a9d8f] border-[#e9c46a] shadow-[0_0_6px_rgba(42,157,143,0.75)]'
                          : 'bg-[#121212] border-[#d4a373]/35'
                      }`}
                      title={`${SAX_KEY_LABELS[i].finger}: ${pressed ? 'Pressed' : 'Open'}`}
                    />
                  </React.Fragment>
                ))}
                {saxFingering.auxKeys.map((k) => (
                  <span
                    key={k}
                    className="px-1.5 py-[1px] rounded bg-[#f4a261]/25 border border-[#f4a261] text-[9px] font-mono-tech font-bold text-[#f4a261]"
                  >
                    +{k}
                  </span>
                ))}
              </div>
            )}

            {instrument === 'harmonica' && (
              <div className="flex items-center gap-1 mt-1.5">
                <div className="flex items-center gap-[2px]" title="12 Chromatic Harmonica Holes (1-12)">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const holeNum = i + 1;
                    const active = holeNum === harmonicaTab.hole;
                    return (
                      <React.Fragment key={holeNum}>
                        {(holeNum === 5 || holeNum === 9) && (
                          <span className="w-[2px] h-2.5 bg-[#d4a373]/30 mx-[1px]" />
                        )}
                        <span
                          className={`w-3 h-3.5 rounded-[3px] text-[7px] font-mono-tech flex items-center justify-center border transition-all ${
                            active
                              ? harmonicaTab.action === 'blow'
                                ? 'bg-[#2a9d8f] border-[#e9c46a] text-[#f8f9fa] font-bold scale-110'
                                : 'bg-[#38bdf8] border-[#f8f9fa] text-[#121212] font-bold scale-110'
                              : 'bg-[#121212] border-white/12 text-[#a69f95]/65'
                          }`}
                        >
                          {holeNum}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
                {harmonicaTab.slide && (
                  <span className="ml-1 px-1.5 py-[1px] rounded bg-[#f4a261] text-[#121212] text-[9px] font-mono-tech font-bold">
                    ●SLIDE
                  </span>
                )}
              </div>
            )}

            {instrument === 'ewi' && (
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1.5">
                <span
                  className={`px-1 sm:px-1.5 py-[1px] rounded text-[8px] sm:text-[9px] font-mono-tech font-bold border ${
                    ewiFingering.octaveShift === 1
                      ? 'bg-[#f4a261] text-[#121212] border-[#fff0d9]'
                      : ewiFingering.octaveShift === -1
                      ? 'bg-[#72efdd] text-[#121212] border-white'
                      : 'bg-[#121212] text-[#a69f95] border-white/15'
                  }`}
                  title="Rear Left-Thumb Octave Pad (OCT- / 0 / OCT+)"
                >
                  {ewiFingering.octaveShift === 1
                    ? 'OCT+'
                    : ewiFingering.octaveShift === -1
                    ? 'OCT−'
                    : 'OCT 0'}
                </span>
                {ewiFingering.mainPads.map((touched, i) => (
                  <React.Fragment key={i}>
                    {i === 3 && <span className="w-0.5 sm:w-1 h-[1px] bg-[#72efdd]/35" />}
                    <span
                      className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border transition-all ${
                        touched
                          ? 'bg-[#2a9d8f] border-[#72efdd] shadow-[0_0_6px_rgba(114,239,221,0.75)]'
                          : 'bg-[#121212] border-white/25'
                      }`}
                      title={`${EWI_PAD_LABELS[i].finger}: ${touched ? 'Touch' : 'Lift'}`}
                    />
                  </React.Fragment>
                ))}
                {ewiFingering.auxPads.map((p) => (
                  <span
                    key={p}
                    className="px-1.5 py-[1px] rounded bg-[#f4a261]/25 border border-[#f4a261] text-[9px] font-mono-tech font-bold text-[#f4a261]"
                  >
                    +{p}
                  </span>
                ))}
                {ewiFingering.pitchBendActive && (
                  <span className="px-1.5 py-[1px] rounded bg-[#e9c46a] text-[#121212] text-[9px] font-mono-tech font-bold">
                    ●PB
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Breath / Register / Blow-Draw Cue Pill */}
        <div
          className={`${
            isBreathPause ? 'inline-flex' : 'hidden sm:inline-flex'
          } items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg backdrop-blur-md border text-[10px] sm:text-[11px] w-fit max-w-full transition-all ${
            isBreathPause
              ? 'bg-[#2a9d8f]/22 border-[#2a9d8f]/60 text-[#72efdd]'
              : instrument === 'harmonica' && harmonicaTab.action === 'draw'
              ? 'bg-[#0f2433]/88 border-[#38bdf8]/50 text-[#7dd3fc]'
              : instrument === 'harmonica'
              ? 'bg-[#122926]/88 border-[#2a9d8f]/50 text-[#72efdd]'
              : 'bg-[#181614]/82 border-white/10 text-[#d0c8be]'
          }`}
        >
          {isBreathPause ? (
            <>
              <Wind className="w-3.5 h-3.5 animate-breath-pulse text-[#72efdd]" />
              <span>🌬️ Natural Phrasing Pause — Inhale Calmly</span>
            </>
          ) : instrument === 'bansuri' ? (
            <>
              <Wind className="w-3.5 h-3.5 text-[#d4a373]" />
              <span>{bansuriFingering.breathLabel}</span>
            </>
          ) : instrument === 'saxophone' ? (
            <>
              <Wind className="w-3.5 h-3.5 text-[#e9c46a]" />
              <span>
                {saxFingering.octaveKey
                  ? 'Octave Key Active · Focused Reed Support'
                  : 'Lower Stack · Warm Relaxed Embouchure'}
              </span>
            </>
          ) : instrument === 'ewi' ? (
            <>
              <Wind className="w-3.5 h-3.5 text-[#72efdd]" />
              <span>
                Mode {ewiSettings.fingeringMode === 'sax' ? '01 Sax' : '02 Flute'} · Breath 0
                {ewiSettings.breathLevel} ·{' '}
                {ewiFingering.pitchBendActive
                  ? 'Right-Thumb Pitch Bend Active'
                  : ewiFingering.octaveShift === 1
                  ? 'Thumb on OCT+ Pad'
                  : ewiFingering.octaveShift === -1
                  ? 'Thumb on OCT− Pad'
                  : 'Feather-Light Capacitive Touch'}
              </span>
            </>
          ) : harmonicaTab.action === 'blow' ? (
            <>
              <ArrowUp className="w-3.5 h-3.5 text-[#38bfa9]" />
              <span>
                Hole {harmonicaTab.hole} · BLOW (Exhale)
                {harmonicaTab.slide ? ' + Slide IN' : ''}
              </span>
            </>
          ) : (
            <>
              <ArrowDown className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>
                Hole {harmonicaTab.hole} · DRAW (Inhale)
                {harmonicaTab.slide ? ' + Slide IN' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ====================================================================
          HUD OVERLAY — TOP RIGHT: Camera Angle Switcher & Visual Toggles
          ==================================================================== */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3.5 flex flex-col items-end gap-1.5 sm:gap-2 z-10">
        <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl bg-[#181614]/88 backdrop-blur-md border border-[#d4a373]/20 shadow-lg">
          <span className="hidden md:flex items-center gap-1 px-2 text-[10px] uppercase tracking-wider text-[#a69f95]">
            <Eye className="w-3 h-3 text-[#d4a373]" />
            POV
          </span>
          {(
            [
              { id: 'first-person', label: 'First-Person', short: '1st', keyHint: '1' },
              { id: 'front-facing', label: 'Front / Mirror', short: 'Front', keyHint: '2' },
              { id: 'close-up', label: 'Close-Up', short: 'Zoom', keyHint: '3' },
            ] as const
          ).map((cam) => {
            const active = cameraView === cam.id;
            return (
              <button
                key={cam.id}
                onClick={() => onCameraViewChange(cam.id)}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#d4a373] text-[#121212] font-semibold shadow-[0_0_12px_rgba(212,163,115,0.35)]'
                    : 'text-[#d0c8be] hover:text-[#f8f9fa] hover:bg-white/5'
                }`}
                title={`Switch to ${cam.label} camera (Key ${cam.keyHint})`}
              >
                <span className="sm:hidden">{cam.short}</span>
                <span className="hidden sm:inline">{cam.label}</span>
              </button>
            );
          })}
        </div>

        {/* Compact Studio Layer Toggles */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => setShowHands((v) => !v)}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] backdrop-blur-md border transition-colors cursor-pointer ${
              showHands
                ? 'bg-[#181614]/85 border-[#d4a373]/30 text-[#e9c46a]'
                : 'bg-[#181614]/65 border-white/10 text-[#a69f95]'
            }`}
            title="Toggle 3D Translucent Hands"
          >
            <Hand className="w-3 h-3" />
            <span className="hidden sm:inline">Hands</span>
          </button>
          <button
            onClick={() => setShowLabels((v) => !v)}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] backdrop-blur-md border transition-colors cursor-pointer ${
              showLabels
                ? 'bg-[#181614]/85 border-[#d4a373]/30 text-[#e9c46a]'
                : 'bg-[#181614]/65 border-white/10 text-[#a69f95]'
            }`}
            title="Toggle Hole / Key Numbers"
          >
            <Hash className="w-3 h-3" />
            <span className="hidden sm:inline">
              {instrument === 'saxophone' ? 'Keys' : instrument === 'ewi' ? 'Pads' : 'Holes'}
            </span>
          </button>
          <button
            onClick={() => setShowScaleBar((v) => !v)}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] backdrop-blur-md border transition-colors cursor-pointer ${
              showScaleBar
                ? 'bg-[#2a9d8f]/25 border-[#2a9d8f]/60 text-[#72efdd]'
                : 'bg-[#181614]/85 border-white/10 text-[#d0c8be] hover:border-[#d4a373]/35'
            }`}
            title="Open Interactive Sargam Sandbox to test any note in 3D"
          >
            <span className="sm:hidden">Swaras</span>
            <span className="hidden sm:inline">Test Swaras</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          HUD OVERLAY — BOTTOM: Instrument Legend, Coaching Badge & Scale Chip
          ==================================================================== */}
      <div className="pointer-events-none absolute bottom-2 sm:bottom-2.5 inset-x-2.5 sm:inset-x-3.5 flex items-end justify-between gap-2 z-10">
        {/* Instrument-Specific Visual Legend */}
        <div className="hidden lg:flex items-center gap-3 px-3 py-1 rounded-lg bg-[#141311]/82 backdrop-blur-md border border-white/8 text-[11px] text-[#a69f95] shrink-0">
          {instrument === 'bansuri' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a9d8f] border border-[#e9c46a]" />
                Closed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#121212] border border-[#d4a373]/45" />
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="relative w-2.5 h-2.5 rounded-full bg-[#121212] border border-[#f4a261] overflow-hidden">
                  <span className="absolute inset-y-0 left-0 w-1/2 bg-[#f4a261]" />
                </span>
                Half-Hole (Komal / Ma)
              </span>
            </>
          )}

          {instrument === 'saxophone' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a9d8f] border border-[#e9c46a]" />
                Pressed Pearl
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f4eee2] border border-[#d4a373]/50" />
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f4a261]" />
                Octave / Chromatic Key
              </span>
            </>
          )}

          {instrument === 'harmonica' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[#2a9d8f]" />
                Blow (↑ Exhale)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[#38bdf8]" />
                Draw (↓ Inhale)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f4a261]" />
                Slide IN (+½)
              </span>
            </>
          )}

          {instrument === 'ewi' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a9d8f] border border-[#72efdd]" />
                Capacitive Touch
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f4a261]" />
                OCT+ / Chromatic
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e9c46a]" />
                Pitch Bend (Meend)
              </span>
            </>
          )}
        </div>

        {/* Dynamic Coaching / Pitch Control Badge */}
        {activeCoachingTip && (
          <div className="pointer-events-auto mx-auto flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#261a10]/92 backdrop-blur-md border border-[#f4a261]/55 text-[#f7c08a] text-[10px] sm:text-xs shadow-[0_0_20px_rgba(244,162,97,0.2)] max-w-[92vw] sm:max-w-lg min-w-0">
            <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#f4a261] shrink-0" />
            <span className="truncate">{activeCoachingTip}</span>
          </div>
        )}

        {/* Active Instrument Tuning Chip */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141311]/82 backdrop-blur-md border border-[#d4a373]/20 text-[11px] text-[#d4a373] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4a373]" />
          {instrument === 'bansuri' && (
            <>
              <span className="font-medium">{song.scale.name}</span>
              <span className="text-[#a69f95] font-mono-tech">({song.scale.rootNote})</span>
            </>
          )}
          {instrument === 'saxophone' && (
            <>
              <span className="font-medium">Alto Sax</span>
              <span className="text-[#a69f95] font-mono-tech">
                (Sa = {song.scale.rootNote})
              </span>
            </>
          )}
          {instrument === 'harmonica' && (
            <>
              <span className="font-medium">12-Hole Chromatic</span>
              <span className="text-[#a69f95] font-mono-tech">({song.scale.rootNote})</span>
            </>
          )}
          {instrument === 'ewi' && (
            <>
              <span className="font-medium text-[#72efdd]">Eastar EDA-100</span>
              <span className="text-[#e9c46a] font-mono-tech">
                Trans {formatTranspose(effectiveEwiTranspose)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Interactive Swara Sandbox Drawer */}
      {showScaleBar && (
        <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-20 max-w-[96%] overflow-x-auto px-2 py-1.5 rounded-xl bg-[#181614]/95 backdrop-blur-lg border border-[#d4a373]/30 shadow-2xl flex items-center gap-1">
          <span className="text-[9px] uppercase tracking-wider text-[#a69f95] px-1 shrink-0">
            Swaras:
          </span>
          {INTERACTIVE_SCALE_NOTES.map((item) => {
            const isCurrent = item.swara === activeSwara && item.octave === activeOctave;
            const meta = SWARA_META[item.swara];
            return (
              <button
                key={`${item.octave}-${item.swara}`}
                onClick={() => onPreviewSwara(item.swara, item.octave)}
                className={`px-1.5 py-0.5 rounded-lg transition-all cursor-pointer shrink-0 border ${
                  isCurrent
                    ? 'bg-[#2a9d8f] border-[#72efdd] text-[#f8f9fa] shadow-[0_0_10px_rgba(42,157,143,0.6)]'
                    : meta.isKomal || item.swara === 'M' || meta.isTivra
                    ? 'bg-[#241c15] border-[#f4a261]/35 text-[#f4a261] hover:bg-[#f4a261]/20'
                    : 'bg-[#22201d] border-white/10 text-[#f8f9fa] hover:border-[#d4a373]/50'
                }`}
              >
                <SwaraSymbol
                  swara={item.swara}
                  octave={item.octave}
                  notationStyle="short"
                  size="xs"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
