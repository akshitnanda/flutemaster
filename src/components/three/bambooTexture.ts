import * as THREE from 'three';

/**
 * Generates an organic, realistic warm golden-amber bamboo wood grain CanvasTexture
 * along with a subtle matching bump map. Runs 100% client-side with zero external assets.
 */
export function createBambooTextures(): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 512;

  // Color canvas
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext('2d')!;

  // Base warm honey-bamboo gradient along the length (vertical in cylinder UV = along shaft)
  const baseGrad = ctx.createLinearGradient(0, 0, width, height);
  baseGrad.addColorStop(0, '#c89254');
  baseGrad.addColorStop(0.28, '#ddb078');
  baseGrad.addColorStop(0.55, '#d4a373');
  baseGrad.addColorStop(0.8, '#c28c50');
  baseGrad.addColorStop(1, '#b57f45');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle organic mottling / toasted bamboo shading
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const rx = 35 + Math.random() * 110;
    const ry = 18 + Math.random() * 55;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, rx);
    const dark = Math.random() > 0.45;
    grad.addColorStop(0, dark ? 'rgba(92, 54, 24, 0.14)' : 'rgba(246, 218, 174, 0.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine longitudinal bamboo vascular fibers (vertical streaks along cylinder height)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, width, height);

  for (let i = 0; i < 420; i++) {
    const x = Math.random() * width;
    const lineWidth = 0.6 + Math.random() * 1.9;
    const alpha = 0.06 + Math.random() * 0.16;
    const isLight = Math.random() > 0.52;

    ctx.strokeStyle = isLight
      ? `rgba(250, 224, 182, ${alpha})`
      : `rgba(88, 52, 22, ${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, height);
    ctx.stroke();

    bCtx.strokeStyle = isLight ? 'rgba(180,180,180,0.28)' : 'rgba(90,90,90,0.28)';
    bCtx.lineWidth = lineWidth;
    bCtx.beginPath();
    bCtx.moveTo(x, 0);
    bCtx.lineTo(x, height);
    bCtx.stroke();
  }

  // Tiny natural bamboo pores / flecks
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const h = 3 + Math.random() * 10;
    ctx.fillStyle = `rgba(98, 58, 24, ${0.08 + Math.random() * 0.14})`;
    ctx.fillRect(x, y, 1.2, h);
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { colorMap, bumpMap };
}

/**
 * Generates a razor-sharp 50% split-circle texture for Half-Hole (Komal / Ma) indicator:
 * Half shaded warm amber-gold (#F4A261 / #E9C46A), half dark hollow bore (#100e0d),
 * separated by a luminous crisp divider bar.
 */
export function createHalfHoleTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const r = size / 2;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r - 6, 0, Math.PI * 2);
  ctx.clip();

  // Open half (right/distal side) - dark hollow bore
  ctx.fillStyle = '#0d0c0b';
  ctx.fillRect(0, 0, size, size);

  // Shaded 50% covered half (left/proximal side) - glowing amber-gold gradient
  const grad = ctx.createLinearGradient(0, 0, r, size);
  grad.addColorStop(0, '#f4a261');
  grad.addColorStop(0.5, '#e9c46a');
  grad.addColorStop(1, '#d4a373');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, r, size);

  // Crisp luminous split divider line down the center
  ctx.fillStyle = '#fff5e4';
  ctx.fillRect(r - 4, 0, 8, size);

  ctx.restore();

  // Outer amber caution ring
  ctx.strokeStyle = '#f4a261';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(r, r, r - 10, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
