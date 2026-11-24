# FluteMaster — 3D Wind Studio (v1.0)

Interactive **3D Wind Instrument Learning Studio** for classic, 90s, and modern Bollywood melodies — featuring **4 live 3D instruments** (**Bansuri**, **Alto Saxophone**, **12-Hole Chromatic Mouth Organ**, and **Eastar EDA-100 Digital Aerophone / EWI**), **472 OEM-verified Bollywood songs**, a scrolling **Bhatkhande Sargam Highway**, **Web MIDI** support, and a **3-layer studio audio mixer**.

---

## Highlights

- **4 Interactive 3D Instruments & Translucent Articulated Hands**
  - **Indian Bamboo Bansuri** — 6-hole + tuning-hole fingerings, 50% amber Komal/Ma half-hole indicators, and breath pressure cues.
  - **Alto Saxophone** — Written G = Sa layout, rear Left-Thumb Octave Key, chromatic side/pinky keys (`G#`, `Side Bb`, `Eb`, `Palm D`).
  - **12-Hole Chromatic Mouth Organ** — Solo-tuned holes `1–12`, Blow (`↑` jade) vs Draw (`↓` sky) airflow indicators, and chromatic Right Slide button (`●`).
  - **Eastar EDA-100 EWI (Digital Aerophone)** — Obsidian body with live dynamic OLED display, flush capacitive touch pads (`L1–L3`, `R1–R3`), dual built-in fingering modes (`01 Sax` / `02 Flute`), rear 3-zone Octave Roller Pads (`OCT−`/`0`/`OCT+`), Right-Thumb Pitch Bend pad for *Meend* & *Gamak*, live per-song auto-calculated **`Trans`** value (`-12..+12`), **Web MIDI** input (`USB-C` / `Bluetooth MIDI`), and a complete 4-tab **Eastar EDA-100 Tutorial & 27-Tone Guide**.
- **3 Studio Camera Angles** — `First-Person` (`1`), `Front / Mirror` (`2`), and smart auto-panning `Close-Up` (`3`), plus free orbit zoom.
- **472 OEM-Verified Bollywood Songs**
  - 9 hand-crafted Studio Featured classics (*Tujhe Dekha To*, *Lag Ja Gale*, *Roop Tera Mastana*, *Pal Pal Dil Ke Paas*, *Pehla Nasha*, *Chura Ke Dil Mera*, *Tum Hi Ho*, *Kesariya*, *Agar Tum Saath Ho*) + 463 bar-locked archive songs with Bhatkhande Sargam, Devanagari + Romanized lyrics, and ornamentations (*Meend*, *Kan*, *Gamak*).
- **True Monophonic Single-Breath Studio Audio Engine**
  - 27 YIN-pitch-verified CC0 acoustic studio samples (Assam Bamboo Bansuri, Studio Vibrato Saxophone, Hohner Super 64 Harmonica) + expressive monophonic EWI Wind-Synth (`08 Electronic Flute`) with breath-tracked filter bloom & `0–30` Reverb depth.
  - Independent 3-layer mixer: **Instrument Lead**, **4-String Tanpura Drone** (with Hold mode), and **Keherwa / Dadra Tabla Beat**.
- **Practice Power Tools** — `0.5×–1.0×` pitch-preserved tempo scaling, live **Tap Tempo**, **A–B Section Looping**, **Step-by-Step ("Wait for Me") Mode**, **Test Swaras** sandbox, and collapsible **YouTube Reference PiP** comparison player.

---

## Tech Stack

- **Frontend:** React 19, TypeScript 5.8, Vite 8 (Rolldown), Tailwind CSS v4
- **3D Engine:** Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei`
- **Audio & MIDI:** Web Audio API, Tone.js, Web MIDI API
- **Deployment:** Vercel (`vercel.json` with strict CSP, security headers & immutable asset caching) + GitHub Actions CI

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

### Production Build & Preview

```bash
npm run build
npm run preview
```

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `←` / `→` | Previous / Next Note (Step Mode) |
| `1` / `2` / `3` | Switch 3D Camera POV (`First-Person` / `Front / Mirror` / `Close-Up`) |
| `I` | Cycle 3D Instrument (`Bansuri → Saxophone → Mouth Organ → EWI`) |
| `L` | Toggle 472-Song Bollywood Library |
