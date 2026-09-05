// ==========================================================================
//  Roulette de caisse — GIF animé (défilement fluide, décélération) rendu en
//  une seule image envoyée une fois (pas d'éditions multiples = zéro lag).
//  Icônes stylisées dessinées. Couleurs de rareté depuis data/cases.js.
// ==========================================================================
import { RARITIES } from '../data/cases.js';

let Canvas = null;
let gifenc = null;
try {
  Canvas = await import('@napi-rs/canvas');
} catch {
  console.warn('[caseRender] @napi-rs/canvas indisponible — caisses en mode texte.');
}
try {
  const g = await import('gifenc');
  gifenc = g.GIFEncoder ? g : (g.default ?? g);
} catch {
  console.warn('[caseRender] gifenc indisponible — caisses en image fixe.');
}

export const caseReelAvailable = () => Canvas !== null;
export const caseGifAvailable = () => Canvas !== null && gifenc !== null;

const W = 900;
const H = 220;
const CELL_W = 144;
const CELL_H = 158;
const GAP = 15;
const PITCH = CELL_W + GAP;
const PAD = GAP;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawIcon(ctx, cx, cy, size, kind, hex) {
  const [r, g, b] = hexToRgb(hex);
  const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 1.6);
  halo.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
  halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 1.6, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createLinearGradient(cx, cy - size, cx, cy + size);
  grad.addColorStop(0, `rgb(${Math.min(255, r + 55)},${Math.min(255, g + 55)},${Math.min(255, b + 55)})`);
  grad.addColorStop(1, `rgb(${(r * 0.55) | 0},${(g * 0.55) | 0},${(b * 0.55) | 0})`);
  ctx.fillStyle = grad;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  if (kind === 'gems') {
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy - size * 0.2);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy - size * 0.2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size * 0.2); ctx.lineTo(cx + size, cy - size * 0.2);
    ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy + size);
    ctx.stroke();
    return;
  }
  if (kind === 'xp') {
    const spikes = 5; const outer = size; const inner = size * 0.44;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / spikes) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    return;
  }
  if (kind === 'coins') {
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const s = size;
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.9, cy - s * 0.45);
  ctx.lineTo(cx + s * 0.9, cy + s * 0.45);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - s * 0.9, cy + s * 0.45);
  ctx.lineTo(cx - s * 0.9, cy - s * 0.45);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}

function drawCell(ctx, x, item, winner) {
  const rr = RARITIES[item.rarity] ?? RARITIES.commun;
  const [r, g, b] = hexToRgb(rr.hex);
  const top = (H - CELL_H) / 2;

  const grad = ctx.createLinearGradient(x, top, x, top + CELL_H);
  grad.addColorStop(0, `rgba(${r},${g},${b},${winner ? 0.45 : 0.24})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0.05)`);
  ctx.fillStyle = grad;
  roundRect(ctx, x, top, CELL_W, CELL_H, 13);
  ctx.fill();

  const sheen = ctx.createLinearGradient(x, top, x, top + 38);
  sheen.addColorStop(0, 'rgba(255,255,255,0.13)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  roundRect(ctx, x, top, CELL_W, 38, 13);
  ctx.fill();

  ctx.strokeStyle = winner ? '#ffffff' : rr.hex;
  ctx.lineWidth = winner ? 4 : 2;
  roundRect(ctx, x, top, CELL_W, CELL_H, 13);
  ctx.stroke();

  drawIcon(ctx, x + CELL_W / 2, top + 50, 24, item.kind ?? 'item', rr.hex);

  ctx.textAlign = 'center';
  ctx.font = 'bold 12px Sans';
  ctx.fillStyle = '#eef2f7';
  const words = item.name.split(' ');
  let l1 = ''; let l2 = '';
  for (const w of words) {
    if (!l2 && (l1 + ' ' + w).trim().length <= 15) l1 = (l1 + ' ' + w).trim();
    else l2 = (l2 + ' ' + w).trim();
  }
  if (l2.length > 15) l2 = l2.slice(0, 14) + '…';
  ctx.fillText(l1, x + CELL_W / 2, top + 100);
  if (l2) ctx.fillText(l2, x + CELL_W / 2, top + 116);

  ctx.font = 'bold 10px Sans';
  ctx.fillStyle = rr.hex;
  ctx.fillText(rr.label.toUpperCase(), x + CELL_W / 2, top + (l2 ? 133 : 122));

  ctx.fillStyle = rr.hex;
  roundRect(ctx, x + 10, top + CELL_H - 9, CELL_W - 20, 4, 2);
  ctx.fill();
  ctx.textAlign = 'left';
}

/** Dessine une frame complète (bande + voiles + marqueur) sur `ctx`. */
function drawFrame(ctx, strip, offsetPx, landed) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1120');
  bg.addColorStop(1, '#121b2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const first = Math.floor((offsetPx - PAD) / PITCH) - 1;
  const cxMark = W / 2;
  for (let i = first; i < first + Math.ceil(W / PITCH) + 3; i++) {
    if (i < 0 || i >= strip.length) continue;
    const x = PAD + i * PITCH - offsetPx;
    const center = x + CELL_W / 2;
    drawCell(ctx, x, strip[i], landed && Math.abs(center - cxMark) < 3);
  }

  // voiles latéraux
  const fl = ctx.createLinearGradient(0, 0, 130, 0);
  fl.addColorStop(0, 'rgba(10,17,32,0.98)');
  fl.addColorStop(1, 'rgba(10,17,32,0)');
  ctx.fillStyle = fl;
  ctx.fillRect(0, 0, 130, H);
  const fr = ctx.createLinearGradient(W - 130, 0, W, 0);
  fr.addColorStop(0, 'rgba(10,17,32,0)');
  fr.addColorStop(1, 'rgba(10,17,32,0.98)');
  ctx.fillStyle = fr;
  ctx.fillRect(W - 130, 0, 130, H);

  // marqueur
  ctx.fillStyle = landed ? '#ffffff' : '#eab308';
  ctx.beginPath();
  ctx.moveTo(cxMark - 12, 3); ctx.lineTo(cxMark + 12, 3); ctx.lineTo(cxMark, 24); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cxMark - 12, H - 3); ctx.lineTo(cxMark + 12, H - 3); ctx.lineTo(cxMark, H - 24); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = landed ? 'rgba(255,255,255,0.9)' : 'rgba(234,179,8,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cxMark, 3); ctx.lineTo(cxMark, H - 3); ctx.stroke();
}

/** Décalage de scroll pour lequel la cellule `idx` est pile sous le marqueur. */
function centerOffsetFor(idx) {
  return idx * PITCH + PAD + CELL_W / 2 - W / 2;
}

/** Image fixe (PNG) — fallback si pas de GIF. */
export async function renderReelFrame(strip, offsetPx, opts = {}) {
  if (!Canvas) return null;
  try {
    const canvas = Canvas.createCanvas(W, H);
    drawFrame(canvas.getContext('2d'), strip, offsetPx, opts.landed ?? false);
    return await canvas.encode('png');
  } catch (err) {
    console.warn('[caseRender] PNG:', err.message);
    return null;
  }
}
export async function renderCaseReel(cells, opts = {}) {
  const idx = opts.markerIndex ?? Math.floor(cells.length / 2);
  return renderReelFrame(cells, centerOffsetFor(idx), { landed: opts.markerIndex != null });
}

export function reelPlan(winnerIndex, frames = 7, spinCells = 16) {
  const end = centerOffsetFor(winnerIndex);
  const start = end - spinCells * PITCH;
  const offsets = [];
  for (let f = 0; f <= frames; f++) {
    const t = f / frames;
    offsets.push(start + (end - start) * (1 - Math.pow(1 - t, 3)));
  }
  return { offsets };
}

/**
 * GIF animé du défilement complet.
 * @param {Array} strip      bande d'objets
 * @param {number} winnerIndex  index de la cellule gagnante dans la bande
 * @param {object} [opts] { spinCells:number }
 * @returns {Promise<{buffer:Buffer, spinMs:number}|null>}
 */
export async function renderCaseGif(strip, winnerIndex, opts = {}) {
  if (!Canvas || !gifenc) return null;
  const { spinCells = 24 } = opts;
  try {
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    const canvas = Canvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const end = centerOffsetFor(winnerIndex);
    const start = end - spinCells * PITCH;

    // Frames : ease-out quartique. Beaucoup de frames = fluide.
    const N = 54;
    const frames = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const eased = 1 - Math.pow(1 - t, 4);
      const offset = start + (end - start) * eased;
      // pas de frame par frame -> delai proportionnel (rapide au début, lent à la fin)
      frames.push({ offset, t });
    }

    const enc = GIFEncoder();

    // Palette fixe : on la calcule sur une frame représentative (mi-parcours).
    drawFrame(ctx, strip, frames[Math.floor(N * 0.5)].offset, false);
    const sample = ctx.getImageData(0, 0, W, H).data;
    const palette = quantize(sample, 256, { format: 'rgb565' });

    let spinMs = 0;
    for (let i = 0; i < N; i++) {
      const landed = i === N - 1;
      drawFrame(ctx, strip, frames[i].offset, landed);
      const { data } = ctx.getImageData(0, 0, W, H);
      const index = applyPalette(data, palette, 'rgb565');
      // délai : ~34 ms en pleine vitesse -> ~112 ms juste avant l'arrêt ; hold 2.4 s
      const prog = i / (N - 1);
      const eased = 1 - Math.pow(1 - prog, 4);
      const delay = landed ? 1800 : Math.round(30 + eased * 52);
      if (!landed) spinMs += delay;
      // repeat:-1 sur la 1re frame => le GIF ne tourne qu'une fois (pas de boucle).
      enc.writeFrame(index, W, H, { palette, delay, transparent: false, repeat: i === 0 ? -1 : undefined });
    }
    enc.finish();
    return { buffer: Buffer.from(enc.bytes()), spinMs };
  } catch (err) {
    console.warn('[caseRender] GIF:', err.message);
    return null;
  }
}
