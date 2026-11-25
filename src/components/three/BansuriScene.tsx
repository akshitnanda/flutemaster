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
    <div className="relative w-full h-full bg-[#0c0c0b] overflow-hidden select-none">
      {/* Subtle architectural stage vignette (zero neon radial blooms) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(201, 162, 94, 0.055) 0%, rgba(12, 12, 11, 0) 75%)',
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
        <color attach="background" args={['#0c0c0b']} />
        <fog attach="fog" args={['#0c0c0b', 11, 26]} />

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
          HUD OVERLAY — TOP LEFT: Typographic Swara Telemetry (No glass-pill card!)
          ==================================================================== */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 sm:top-3 sm:left-3.5 flex flex-col gap-1 z-10 max-w-[205px] sm:max-w-[300px]">
        <div
          className={`pointer-events-auto flex items-center gap-2.5 sm:gap-3 px-2.5 py-1.5 bg-[#0c0c0b]/78 border-l-2 ${
            isHighlightedWarning
              ? 'border-[#e05a33]'
              : instrument === 'harmonica' && harmonicaTab.action === 'draw'
              ? 'border-[#38bdf8]'
              : 'border-[#3ca38f]'
          }`}
        >
          {/* Active Swara Glyph Slot */}
          <div
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-[2px] flex flex-col items-center justify-center shrink-0 border ${
              isHighlightedWarning
                ? 'bg-[#28160f] border-[#e05a33]/65 text-[#f4a261]'
                : instrument === 'harmonica' && harmonicaTab.action === 'draw'
                ? 'bg-[#0e1f2d] border-[#38bdf8]/60 text-[#7dd3fc]'
                : 'bg-[#12221e] border-[#3ca38f]/60 text-[#5eead4]'
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
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xs sm:text-sm font-semibold text-[#f2ede4] truncate">
                {swaraMeta.isKomal ? 'Komal ' : swaraMeta.isTivra ? 'Tivra ' : 'Shuddha '}
                {swaraMeta.fullBase}
              </span>
              <span
                className={`hidden sm:inline font-hindi text-xs text-[#c9a25e] ${
                  swaraMeta.isKomal ? 'underline decoration-[#e05a33] underline-offset-2' : ''
                }`}
              >
                ({swaraMeta.hindiName}
                {swaraMeta.isTivra ? '′' : ''})
              </span>
            </div>
            <div className="text-[10px] text-[#8a8278] flex items-center gap-1.5 mt-0.5 truncate font-mono-tech">
              <span className="truncate">{getOctaveLabel(activeOctave).split(' ')[0]}</span>
              <span className="text-[#45403a]">/</span>
              <span className="text-[#c9a25e] truncate">
                {instrument === 'saxophone'
                  ? `Sax ${saxFingering.writtenNote}`
                  : instrument === 'harmonica'
                  ? `Tab ${harmonicaTab.compactTab}`
                  : instrument === 'ewi'
                  ? `${ewiFingering.writtenNote} · TR ${formatTranspose(effectiveEwiTranspose)}`
                  : `${freqHz.toFixed(0)} Hz`}
              </span>
            </div>

            {/* INSTRUMENT-SPECIFIC 2D MICRO-CHART */}
            {instrument === 'bansuri' && (
              <div className="flex items-center gap-1 sm:gap-1.5 mt-1.5" title="6 Main Bansuri Holes (L1-L3 · R1-R3)">
                {bansuriFingering.holes.slice(0, 6).map((h, i) => (
                  <React.Fragment key={i}>
                    {i === 3 && <span className="w-1 h-[1px] bg-[#3a352f]" />}
                    <span
                      className={`relative w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border ${
                        h === 1
                          ? 'bg-[#3ca38f] border-[#f2ede4]/65'
                          : h === 0.5
                          ? 'bg-[#0c0c0b] border-[#e05a33] overflow-hidden'
                          : 'bg-[#0c0c0b] border-[#45403a]'
                      }`}
                      title={`${HOLE_LABELS[i].finger}: ${
                        h === 1 ? 'Closed' : h === 0.5 ? 'Half-Hole (50%)' : 'Open'
                      }`}
                    >
                      {h === 0.5 && <span className="absolute inset-y-0 left-0 w-1/2 bg-[#e05a33]" />}
                    </span>
                  </React.Fragment>
                ))}
                {activeOrnament && (
                  <span className="ml-1 px-1 py-[1px] rounded-[2px] bg-[#1e1b16] border border-[#c9a25e]/45 text-[9px] font-mono-tech uppercase text-[#c9a25e]">
                    {activeOrnament}
                  </span>
                )}
              </div>
            )}

            {instrument === 'saxophone' && (
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1.5">
                <span
                  className={`px-1 py-[1px] rounded-[2px] text-[8px] sm:text-[9px] font-mono-tech font-semibold border ${
                    saxFingering.octaveKey
                      ? 'bg-[#e05a33] text-[#0c0c0b] border-[#e05a33]'
                      : 'bg-[#121110] text-[#8a8278] border-[#262320]'
                  }`}
                  title="Left Thumb Octave Key"
                >
                  OCT
                </span>
                {saxFingering.mainKeys.map((pressed, i) => (
                  <React.Fragment key={i}>
                    {i === 3 && <span className="w-1 h-[1px] bg-[#3a352f]" />}
                    <span
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border ${
                        pressed
                          ? 'bg-[#3ca38f] border-[#f2ede4]/65'
                          : 'bg-[#0c0c0b] border-[#45403a]'
                      }`}
                      title={`${SAX_KEY_LABELS[i].finger}: ${pressed ? 'Pressed' : 'Open'}`}
                    />
                  </React.Fragment>
                ))}
                {saxFingering.auxKeys.map((k) => (
                  <span
                    key={k}
                    className="px-1 py-[1px] rounded-[2px] bg-[#2a1812] border border-[#e05a33]/65 text-[9px] font-mono-tech font-semibold text-[#f4a261]"
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
                          <span className="w-[1px] h-2.5 bg-[#3a352f] mx-[1px]" />
                        )}
                        <span
                          className={`w-3 h-3.5 rounded-[2px] text-[7px] font-mono-tech flex items-center justify-center border ${
                            active
                              ? harmonicaTab.action === 'blow'
                                ? 'bg-[#3ca38f] border-[#f2ede4] text-[#0c0c0b] font-bold'
                                : 'bg-[#38bdf8] border-[#f2ede4] text-[#0c0c0b] font-bold'
                              : 'bg-[#0c0c0b] border-[#262320] text-[#7a7369]'
                          }`}
                        >
                          {holeNum}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
                {harmonicaTab.slide && (
                  <span className="ml-1 px-1 py-[1px] rounded-[2px] bg-[#e05a33] text-[#0c0c0b] text-[8px] font-mono-tech font-bold">
                    SLIDE
                  </span>
                )}
              </div>
            )}

            {instrument === 'ewi' && (
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1.5">
                <span
                  className={`px-1 py-[1px] rounded-[2px] text-[8px] sm:text-[9px] font-mono-tech font-semibold border ${
                    ewiFingering.octaveShift === 1
                      ? 'bg-[#e05a33] text-[#0c0c0b] border-[#e05a33]'
                      : ewiFingering.octaveShift === -1
                      ? 'bg-[#3ca38f] text-[#0c0c0b] border-[#3ca38f]'
                      : 'bg-[#121110] text-[#8a8278] border-[#262320]'
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
                    {i === 3 && <span className="w-0.5 sm:w-1 h-[1px] bg-[#3a352f]" />}
                    <span
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border ${
                        touched
                          ? 'bg-[#3ca38f] border-[#f2ede4]/65'
                          : 'bg-[#0c0c0b] border-[#45403a]'
                      }`}
                      title={`${EWI_PAD_LABELS[i].finger}: ${touched ? 'Touch' : 'Lift'}`}
                    />
                  </React.Fragment>
                ))}
                {ewiFingering.auxPads.map((p) => (
                  <span
                    key={p}
                    className="px-1 py-[1px] rounded-[2px] bg-[#2a1812] border border-[#e05a33]/65 text-[9px] font-mono-tech font-semibold text-[#f4a261]"
                  >
                    +{p}
                  </span>
                ))}
                {ewiFingering.pitchBendActive && (
                  <span className="px-1 py-[1px] rounded-[2px] bg-[#c9a25e] text-[#0c0c0b] text-[9px] font-mono-tech font-bold">
                    PB
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Minimal Inline Breath / Airflow Status Line */}
        <div
          className={`${
            isBreathPause ? 'inline-flex' : 'hidden sm:inline-flex'
          } items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono-tech w-fit max-w-full border-l-2 ${
            isBreathPause
              ? 'bg-[#112420]/90 border-[#3ca38f] text-[#72efdd]'
              : instrument === 'harmonica' && harmonicaTab.action === 'draw'
              ? 'bg-[#0c0c0b]/70 border-[#38bdf8]/70 text-[#7dd3fc]'
              : 'bg-[#0c0c0b]/65 border-[#262320] text-[#a0978c]'
          }`}
        >
          {isBreathPause ? (
            <>
              <Wind className="w-3 h-3 animate-breath-pulse text-[#72efdd] shrink-0" />
              <span>BREATH PAUSE — INHALE CALMLY</span>
            </>
          ) : instrument === 'bansuri' ? (
            <>
              <Wind className="w-3 h-3 text-[#c9a25e] shrink-0" />
              <span className="truncate">{bansuriFingering.breathLabel}</span>
            </>
          ) : instrument === 'saxophone' ? (
            <>
              <Wind className="w-3 h-3 text-[#c9a25e] shrink-0" />
              <span>
                {saxFingering.octaveKey
                  ? 'Octave Key Active · Focused Reed Support'
                  : 'Lower Stack · Relaxed Embouchure'}
              </span>
            </>
          ) : instrument === 'ewi' ? (
            <>
              <Wind className="w-3 h-3 text-[#3ca38f] shrink-0" />
              <span className="truncate">
                Mode {ewiSettings.fingeringMode === 'sax' ? '01 Sax' : '02 Flute'} · BR 0
                {ewiSettings.breathLevel} ·{' '}
                {ewiFingering.pitchBendActive
                  ? 'Pitch Bend Active'
                  : ewiFingering.octaveShift === 1
                  ? 'OCT+ Pad'
                  : ewiFingering.octaveShift === -1
                  ? 'OCT− Pad'
                  : 'Capacitive Touch'}
              </span>
            </>
          ) : harmonicaTab.action === 'blow' ? (
            <>
              <ArrowUp className="w-3 h-3 text-[#3ca38f] shrink-0" />
              <span>
                Hole {harmonicaTab.hole} · BLOW
                {harmonicaTab.slide ? ' + SLIDE' : ''}
              </span>
            </>
          ) : (
            <>
              <ArrowDown className="w-3 h-3 text-[#38bdf8] shrink-0" />
              <span>
                Hole {harmonicaTab.hole} · DRAW
                {harmonicaTab.slide ? ' + SLIDE' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ====================================================================
          HUD OVERLAY — TOP RIGHT: Flat Architectural Camera & Layer Bar
          ==================================================================== */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3.5 flex flex-col items-end gap-1.5 z-10">
        <div className="flex items-center rounded-[2px] bg-[#11100f] border border-[#262320] divide-x divide-[#262320]">
          <span className="hidden md:flex items-center gap-1 px-2 py-1 text-[10px] font-mono-tech uppercase tracking-wider text-[#8a8278]">
            <Eye className="w-3 h-3 text-[#c9a25e]" />
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
                className={`px-2 sm:px-2.5 py-1 text-[11px] font-mono-tech transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#f2ede4] text-[#0c0c0b] font-semibold'
                    : 'text-[#8a8278] hover:text-[#f2ede4] hover:bg-[#191715]'
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHands((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-mono-tech border transition-colors cursor-pointer ${
              showHands
                ? 'bg-[#191715] border-[#c9a25e]/55 text-[#c9a25e]'
                : 'bg-[#11100f] border-[#262320] text-[#8a8278] hover:text-[#f2ede4]'
            }`}
            title="Toggle 3D Translucent Hands"
          >
            <Hand className="w-3 h-3" />
            <span className="hidden sm:inline">Hands</span>
          </button>
          <button
            onClick={() => setShowLabels((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-mono-tech border transition-colors cursor-pointer ${
              showLabels
                ? 'bg-[#191715] border-[#c9a25e]/55 text-[#c9a25e]'
                : 'bg-[#11100f] border-[#262320] text-[#8a8278] hover:text-[#f2ede4]'
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
            className={`flex items-center gap-1 px-2 py-1 rounded-[2px] text-[10px] font-mono-tech border transition-colors cursor-pointer ${
              showScaleBar
                ? 'bg-[#162824] border-[#3ca38f] text-[#f2ede4]'
                : 'bg-[#11100f] border-[#262320] text-[#b8b0a5] hover:border-[#c9a25e]/50'
            }`}
            title="Open Interactive Sargam Sandbox to test any note in 3D"
          >
            <span className="sm:hidden">Swaras</span>
            <span className="hidden sm:inline">Test Swaras</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          DOCKED BOTTOM STAGE STATUS RAIL (Replaces floating translucent pills!)
          ==================================================================== */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 flex items-center justify-between gap-3 px-3 py-1 bg-[#0f0e0d]/92 border-t border-[#262320] z-10 text-[10px] font-mono-tech">
        {/* Instrument-Specific Visual Legend */}
        <div className="hidden lg:flex items-center gap-3 text-[#8a8278] shrink-0">
          {instrument === 'bansuri' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3ca38f]" />
                Closed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-[#45403a]" />
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="relative w-2 h-2 rounded-full border border-[#e05a33] overflow-hidden">
                  <span className="absolute inset-y-0 left-0 w-1/2 bg-[#e05a33]" />
                </span>
                Half-Hole
              </span>
            </>
          )}

          {instrument === 'saxophone' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3ca38f]" />
                Pressed Pearl
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#e5dfd4]" />
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#e05a33]" />
                Octave / Aux
              </span>
            </>
          )}

          {instrument === 'harmonica' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[1px] bg-[#3ca38f]" />
                Blow (↑)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[1px] bg-[#38bdf8]" />
                Draw (↓)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#e05a33]" />
                Slide IN
              </span>
            </>
          )}

          {instrument === 'ewi' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3ca38f]" />
                Touch Pad
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#e05a33]" />
                OCT+ / Chromatic
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#c9a25e]" />
                Pitch Bend
              </span>
            </>
          )}
        </div>

        {/* Inline Coaching Cue */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          {activeCoachingTip ? (
            <span className="inline-flex items-center gap-1.5 text-[#f0ba7d] truncate max-w-full">
              <AlertTriangle className="w-3 h-3 text-[#e05a33] shrink-0" />
              <span className="truncate">{activeCoachingTip}</span>
            </span>
          ) : (
            <span className="hidden sm:inline text-[#6e675e]">
              Drag to orbit 3D instrument · Scroll to zoom
            </span>
          )}
        </div>

        {/* Active Instrument Tuning Readout */}
        <div className="hidden md:flex items-center gap-1.5 text-[#c9a25e] shrink-0">
          {instrument === 'bansuri' && (
            <>
              <span>{song.scale.name}</span>
              <span className="text-[#8a8278]">({song.scale.rootNote})</span>
            </>
          )}
          {instrument === 'saxophone' && (
            <>
              <span>Alto Sax</span>
              <span className="text-[#8a8278]">(Sa = {song.scale.rootNote})</span>
            </>
          )}
          {instrument === 'harmonica' && (
            <>
              <span>12H Chromatic</span>
              <span className="text-[#8a8278]">({song.scale.rootNote})</span>
            </>
          )}
          {instrument === 'ewi' && (
            <>
              <span className="text-[#3ca38f]">Eastar EDA-100</span>
              <span>Trans {formatTranspose(effectiveEwiTranspose)}</span>
            </>
          )}
        </div>
      </div>

      {/* Interactive Swara Sandbox Drawer (Flat architectural rack strip) */}
      {showScaleBar && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 max-w-[96%] overflow-x-auto no-scrollbar px-2 py-1.5 rounded-[2px] bg-[#11100f] border border-[#262320] shadow-xl flex items-center gap-1">
          <span className="text-[9px] font-mono-tech uppercase tracking-wider text-[#8a8278] px-1 shrink-0">
            Swaras:
          </span>
          {INTERACTIVE_SCALE_NOTES.map((item) => {
            const isCurrent = item.swara === activeSwara && item.octave === activeOctave;
            const meta = SWARA_META[item.swara];
            return (
              <button
                key={`${item.octave}-${item.swara}`}
                onClick={() => onPreviewSwara(item.swara, item.octave)}
                className={`px-1.5 py-0.5 rounded-[2px] transition-colors cursor-pointer shrink-0 border ${
                  isCurrent
                    ? 'bg-[#3ca38f] border-[#f2ede4] text-[#0c0c0b]'
                    : meta.isKomal || item.swara === 'M' || meta.isTivra
                    ? 'bg-[#1c1512] border-[#e05a33]/40 text-[#f4a261] hover:border-[#e05a33]'
                    : 'bg-[#171513] border-[#262320] text-[#f2ede4] hover:border-[#c9a25e]/60'
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
