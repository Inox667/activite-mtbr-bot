// ==========================================================================
//  Rendu visuel des jeux (même style que la caisse : fond navy dégradé,
//  coins arrondis, accents néon). GIF animés pour slots / pile-face / dé /
//  roulette ; images fixes pour blackjack / quiz / duel.
// ==========================================================================
let Canvas = null;
let gifenc = null;
try { Canvas = await import('@napi-rs/canvas'); }
catch { console.warn('[gameRender] @napi-rs/canvas indisponible.'); }
try {
  const g = await import('gifenc');
  gifenc = g.GIFEncoder ? g : (g.default ?? g);
} catch { console.warn('[gameRender] gifenc indisponible.'); }

export const gfxOn = () => Canvas !== null;
export const gifOn = () => Canvas !== null && gifenc !== null;

// ---- primitives -----------------------------------------------------
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function bg(ctx, W, H, tint) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1120');
  g.addColorStop(1, '#121b2e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (tint) {
    const [r, gr, b] = hexRgb(tint);
    const rad = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) / 1.3);
    rad.addColorStop(0, `rgba(${r},${gr},${b},0.16)`);
    rad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  rr(ctx, 5, 5, W - 10, H - 10, 18);
  ctx.stroke();
}

function glow(ctx, cx, cy, radius, hex, a = 0.5) {
  const [r, g, b] = hexRgb(hex);
  const rad = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
  rad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
  rad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = rad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

async function loadAvatar(url) {
  try { return await Canvas.loadImage(url); } catch { return null; }
}

// ---- GIF générique -------------------------------------------------
async function makeGif(W, H, frames) {
  if (!Canvas || !gifenc) return null;
  const { GIFEncoder, quantize, applyPalette } = gifenc;
  const canvas = Canvas.createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  frames[Math.floor(frames.length / 2)].draw(ctx);
  const palette = quantize(ctx.getImageData(0, 0, W, H).data, 256, { format: 'rgb565' });
  const enc = GIFEncoder();
  let dur = 0;
  for (let i = 0; i < frames.length; i++) {
    frames[i].draw(ctx);
    const idx = applyPalette(ctx.getImageData(0, 0, W, H).data, palette, 'rgb565');
    enc.writeFrame(idx, W, H, { palette, delay: frames[i].delay, transparent: false, repeat: i === 0 ? -1 : undefined });
    dur += frames[i].delay;
  }
  enc.finish();
  return { buffer: Buffer.from(enc.bytes()), durationMs: dur };
}

async function makePng(W, H, draw) {
  if (!Canvas) return null;
  const canvas = Canvas.createCanvas(W, H);
  await draw(canvas.getContext('2d'), canvas);
  return canvas.encode('png');
}

// ==========================================================================
//  MACHINE À SOUS
// ==========================================================================
const SLOT = {
  '🍒': { color: '#e5484d', shape: 'cherry' },
  '🍋': { color: '#f5c518', shape: 'lemon' },
  '🔔': { color: '#f0a500', shape: 'bell' },
  '⭐': { color: '#facc15', shape: 'star' },
  '💎': { color: '#22d3ee', shape: 'diamond' },
  '7️⃣': { color: '#ef4444', shape: 'seven' },
};
const SLOT_KEYS = Object.keys(SLOT);

function drawSymbol(ctx, cx, cy, s, size) {
  const meta = SLOT[s] ?? { color: '#94a3b8', shape: 'diamond' };
  glow(ctx, cx, cy, size * 1.4, meta.color, 0.4);
  const grad = ctx.createLinearGradient(cx, cy - size, cx, cy + size);
  const [r, g, b] = hexRgb(meta.color);
  grad.addColorStop(0, `rgb(${Math.min(255, r + 55)},${Math.min(255, g + 55)},${Math.min(255, b + 55)})`);
  grad.addColorStop(1, `rgb(${(r * 0.6) | 0},${(g * 0.6) | 0},${(b * 0.6) | 0})`);
  ctx.fillStyle = grad;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;

  ctx.beginPath();
  switch (meta.shape) {
    case 'diamond':
      ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size * 0.8, cy); ctx.lineTo(cx, cy + size); ctx.lineTo(cx - size * 0.8, cy);
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 ? size * 0.45 : size;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const px = cx + Math.cos(a) * rad; const py = cy + Math.sin(a) * rad;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    }
    case 'lemon':
      ctx.ellipse(cx, cy, size, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); break;
    case 'cherry':
      ctx.arc(cx - size * 0.4, cy + size * 0.3, size * 0.55, 0, Math.PI * 2);
      ctx.arc(cx + size * 0.45, cy + size * 0.35, size * 0.5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3fae5a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx - size * 0.4, cy - size * 0.2); ctx.quadraticCurveTo(cx, cy - size, cx + size * 0.45, cy - size * 0.15);
      ctx.stroke(); break;
    case 'bell':
      ctx.moveTo(cx - size * 0.85, cy + size * 0.6);
      ctx.quadraticCurveTo(cx - size * 0.85, cy - size * 0.9, cx, cy - size * 0.9);
      ctx.quadraticCurveTo(cx + size * 0.85, cy - size * 0.9, cx + size * 0.85, cy + size * 0.6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + size * 0.8, size * 0.2, 0, Math.PI * 2); ctx.fill(); break;
    case 'seven':
      ctx.fillStyle = meta.color;
      ctx.font = `bold ${size * 2.1}px Sans`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('7', cx, cy + 2);
      ctx.strokeText('7', cx, cy + 2);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      break;
    default: break;
  }
}

/**
 * @param {object} p
 * @param {string[]} p.result  3 symboles finaux
 * @param {number} p.bet
 * @param {number} p.net  gain net (négatif si perdu)
 * @param {string} p.label
 */
export async function renderSlotsGif(p) {
  if (!gifOn()) return null;
  const W = 720; const H = 300;
  const reelX = [W / 2 - 200, W / 2, W / 2 + 200];
  const cy = 148;
  const won = p.net > 0;

  // Chaque rouleau s'arrête à une frame différente (L -> R).
  const stops = [16, 24, 32];
  const N = 40;
  const spinSeq = () => Array.from({ length: 40 }, () => SLOT_KEYS[(Math.random() * SLOT_KEYS.length) | 0]);
  const seqs = [spinSeq(), spinSeq(), spinSeq()];

  const drawBoard = (ctx, faces, flashWin) => {
    bg(ctx, W, H, won ? '#22c55e' : '#3b4252');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 26px Sans';
    ctx.fillText('MACHINE À SOUS', W / 2, 44);

    // fenêtre des rouleaux
    rr(ctx, W / 2 - 300, 78, 600, 140, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = flashWin ? '#facc15' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = flashWin ? 5 : 2;
    ctx.stroke();

    for (let r = 0; r < 3; r++) {
      ctx.save();
      rr(ctx, reelX[r] - 78, 82, 156, 132, 12);
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(reelX[r] - 78, 82, 156, 132);
      drawSymbol(ctx, reelX[r], cy, faces[r], 46);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      rr(ctx, reelX[r] - 78, 82, 156, 132, 12);
      ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '17px Sans';
    ctx.fillText(`Mise : ${p.bet}`, W / 2, 250);
    if (flashWin !== null) {
      ctx.fillStyle = won ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 24px Sans';
      ctx.fillText(won ? `GAGNÉ  +${p.net}` : `PERDU  -${p.bet}`, W / 2, 280);
    }
    ctx.textAlign = 'left';
  };

  const frames = [];
  for (let i = 0; i < N; i++) {
    const faces = [0, 1, 2].map((r) => {
      if (i >= stops[r]) return p.result[r];
      return seqs[r][(i * 3 + r) % seqs[r].length];
    });
    const allStopped = i >= stops[2];
    frames.push({ draw: (ctx) => drawBoard(ctx, faces, allStopped ? won : null), delay: allStopped ? 60 : 45 });
  }
  // hold final
  frames.push({ draw: (ctx) => drawBoard(ctx, p.result, won), delay: 2200 });
  return makeGif(W, H, frames);
}

// ==========================================================================
//  PILE OU FACE
// ==========================================================================
export async function renderCoinGif(p) {
  if (!gifOn()) return null;
  const W = 460; const H = 320;
  const cx = W / 2; const cy = 150; const R = 78;
  const won = p.won;
  const faceColor = (f) => (f === 'pile' ? '#eab308' : '#38bdf8');

  const drawCoin = (ctx, scaleX, face, settled) => {
    bg(ctx, W, H, won ? '#22c55e' : '#3b4252');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 24px Sans';
    ctx.fillText('PILE OU FACE', W / 2, 42);

    glow(ctx, cx, cy, R * 1.7, faceColor(face), 0.45);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.06, Math.abs(scaleX)), 1);
    const g = ctx.createLinearGradient(0, -R, 0, R);
    const fc = faceColor(face);
    const [r, gg, b] = hexRgb(fc);
    g.addColorStop(0, `rgb(${Math.min(255, r + 60)},${Math.min(255, gg + 60)},${Math.min(255, b + 60)})`);
    g.addColorStop(1, `rgb(${(r * 0.6) | 0},${(gg * 0.6) | 0},${(b * 0.6) | 0})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
    if (Math.abs(scaleX) > 0.55) {
      ctx.fillStyle = '#0a1120';
      ctx.font = 'bold 40px Sans';
      ctx.textBaseline = 'middle';
      ctx.fillText(face === 'pile' ? 'P' : 'F', cx, cy + 2);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.fillStyle = '#94a3b8'; ctx.font = '16px Sans';
    ctx.fillText(`Ton choix : ${p.choice === 'pile' ? 'Pile' : 'Face'} · Mise ${p.bet}`, W / 2, 258);
    if (settled) {
      ctx.fillStyle = won ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 22px Sans';
      ctx.fillText(won ? `GAGNÉ  +${p.net}` : `PERDU  -${p.bet}`, W / 2, 288);
    }
    ctx.textAlign = 'left';
  };

  const frames = [];
  const spins = 9;
  for (let i = 0; i < spins; i++) {
    const t = i / spins;
    const phase = Math.cos(t * Math.PI * (spins - 1));
    const face = phase >= 0 ? 'pile' : 'face';
    frames.push({ draw: (ctx) => drawCoin(ctx, phase, face, false), delay: Math.round(70 + t * 90) });
  }
  frames.push({ draw: (ctx) => drawCoin(ctx, 1, p.result, false), delay: 350 });
  frames.push({ draw: (ctx) => drawCoin(ctx, 1, p.result, true), delay: 2200 });
  return makeGif(W, H, frames);
}

// ==========================================================================
//  DÉ
// ==========================================================================
const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
function drawDie(ctx, cx, cy, size, value, hex) {
  glow(ctx, cx, cy, size * 1.5, hex, 0.4);
  const g = ctx.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
  g.addColorStop(0, '#f8fafc'); g.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = g;
  rr(ctx, cx - size, cy - size, size * 2, size * 2, size * 0.28);
  ctx.fill();
  ctx.strokeStyle = hex; ctx.lineWidth = 4;
  rr(ctx, cx - size, cy - size, size * 2, size * 2, size * 0.28);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  const off = size * 0.5;
  for (const [dx, dy] of (PIPS[value] ?? [])) {
    ctx.beginPath();
    ctx.arc(cx + dx * off, cy + dy * off, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}
export async function renderDiceGif(p) {
  if (!gifOn()) return null;
  const W = 460; const H = 320;
  const cx = W / 2; const cy = 150;
  const won = p.won;
  const accent = won ? '#22c55e' : '#ef4444';

  const draw = (ctx, value, settled) => {
    bg(ctx, W, H, won ? '#22c55e' : '#3b4252');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 24px Sans';
    ctx.fillText('LANCER DE DÉ', W / 2, 42);
    drawDie(ctx, cx, cy, 62, value, settled ? accent : '#64748b');
    ctx.fillStyle = '#94a3b8'; ctx.font = '16px Sans';
    ctx.fillText(`Ton pari : ${p.guess} · Mise ${p.bet}`, W / 2, 262);
    if (settled) {
      ctx.fillStyle = accent; ctx.font = 'bold 22px Sans';
      ctx.fillText(won ? `GAGNÉ  +${p.net}` : `PERDU  -${p.bet}`, W / 2, 292);
    }
    ctx.textAlign = 'left';
  };

  const frames = [];
  const spins = 12;
  for (let i = 0; i < spins; i++) {
    const v = 1 + ((Math.random() * 6) | 0);
    frames.push({ draw: (ctx) => draw(ctx, v, false), delay: Math.round(55 + (i / spins) * 90) });
  }
  frames.push({ draw: (ctx) => draw(ctx, p.roll, true), delay: 2200 });
  return makeGif(W, H, frames);
}

// ==========================================================================
//  ROULETTE  (bande de numéros qui défile, comme la caisse)
// ==========================================================================
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const numColor = (n) => (n === 0 ? '#16a34a' : RED.has(n) ? '#dc2626' : '#1e293b');
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

export async function renderRouletteGif(p) {
  if (!gifOn()) return null;
  const W = 900; const H = 200;
  const CELL = 96; const GAP = 8; const PITCH = CELL + GAP;
  const winPos = WHEEL.indexOf(p.number);
  const STRIP = 90;
  const strip = Array.from({ length: STRIP }, (_, i) => WHEEL[(i + winPos - 60 + WHEEL.length * 3) % WHEEL.length]);
  const WINNER_IDX = 60;
  const endOffset = WINNER_IDX * PITCH + GAP + CELL / 2 - W / 2;
  const startOffset = endOffset - 28 * PITCH;
  const win = p.mult > 0;

  const drawFrame = (ctx, offset, landed) => {
    bg(ctx, W, H, win ? '#22c55e' : '#3b4252');
    const top = (H - 120) / 2;
    const first = Math.floor((offset - GAP) / PITCH) - 1;
    for (let i = first; i < first + Math.ceil(W / PITCH) + 3; i++) {
      if (i < 0 || i >= strip.length) continue;
      const n = strip[i];
      const x = GAP + i * PITCH - offset;
      const c = numColor(n);
      const isWin = landed && Math.abs(x + CELL / 2 - W / 2) < 4;
      const [r, g, b] = hexRgb(c);
      const grad = ctx.createLinearGradient(x, top, x, top + 120);
      grad.addColorStop(0, `rgba(${r},${g},${b},${isWin ? 1 : 0.85})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.5)`);
      ctx.fillStyle = grad;
      rr(ctx, x, top, CELL, 120, 12); ctx.fill();
      ctx.strokeStyle = isWin ? '#ffffff' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = isWin ? 4 : 2;
      rr(ctx, x, top, CELL, 120, 12); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px Sans';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), x + CELL / 2, top + 60);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    // voiles
    const fl = ctx.createLinearGradient(0, 0, 120, 0);
    fl.addColorStop(0, 'rgba(10,17,32,0.98)'); fl.addColorStop(1, 'rgba(10,17,32,0)');
    ctx.fillStyle = fl; ctx.fillRect(0, 0, 120, H);
    const fr = ctx.createLinearGradient(W - 120, 0, W, 0);
    fr.addColorStop(0, 'rgba(10,17,32,0)'); fr.addColorStop(1, 'rgba(10,17,32,0.98)');
    ctx.fillStyle = fr; ctx.fillRect(W - 120, 0, 120, H);
    // marqueur
    ctx.fillStyle = landed ? '#ffffff' : '#eab308';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 12, 3); ctx.lineTo(W / 2 + 12, 3); ctx.lineTo(W / 2, 24); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 12, H - 3); ctx.lineTo(W / 2 + 12, H - 3); ctx.lineTo(W / 2, H - 24); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = landed ? 'rgba(255,255,255,0.9)' : 'rgba(234,179,8,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, 3); ctx.lineTo(W / 2, H - 3); ctx.stroke();

    ctx.textAlign = 'center';
    if (landed) {
      ctx.fillStyle = win ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 20px Sans';
      ctx.fillText(win ? `GAGNÉ  ×${p.mult}  +${p.net}` : `PERDU  -${p.bet}`, W / 2, 22);
    }
    ctx.textAlign = 'left';
  };

  const N = 48;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const eased = 1 - Math.pow(1 - t, 4);
    const off = startOffset + (endOffset - startOffset) * eased;
    frames.push({ draw: (ctx) => drawFrame(ctx, off, i === N - 1), delay: i === N - 1 ? 2200 : Math.round(30 + eased * 55) });
  }
  return makeGif(W, H, frames);
}

// ==========================================================================
//  BLACKJACK  (image fixe, mise à jour à chaque action)
// ==========================================================================
function drawPlayingCard(ctx, x, y, w, h, card, hidden) {
  rr(ctx, x, y, w, h, 10);
  if (hidden) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#1e3a8a'); g.addColorStop(1, '#3730a3');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 6 + i * 7, 0, Math.PI * 2); ctx.stroke(); }
    return;
  }
  ctx.fillStyle = '#f8fafc'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5; ctx.stroke();
  const red = card.s === '♥' || card.s === '♦';
  ctx.fillStyle = red ? '#dc2626' : '#0f172a';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 22px Sans';
  ctx.fillText(card.r, x + 8, y + 26);
  ctx.font = '18px Sans';
  ctx.fillText(card.s, x + 9, y + 46);
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px Sans';
  ctx.fillText(card.r, x + w - 8, y + h - 12);
  ctx.textAlign = 'center';
  ctx.font = '44px Sans';
  ctx.fillText(card.s, x + w / 2, y + h / 2 + 16);
  ctx.textAlign = 'left';
}

/**
 * @param {object} p { player:[], dealer:[], hideDealer, bet, status, pv, dv, tone }
 *  tone: 'win' | 'lose' | 'push' | null
 */
export async function renderBlackjack(p) {
  return makePng(720, 400, (ctx) => {
    const W = 720; const H = 400;
    const tint = p.tone === 'win' ? '#22c55e' : p.tone === 'lose' ? '#ef4444' : p.tone === 'push' ? '#eab308' : '#2f855a';
    bg(ctx, W, H, tint);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 22px Sans';
    ctx.fillText('BLACKJACK', 28, 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8'; ctx.font = '16px Sans';
    ctx.fillText(`Mise : ${p.bet}`, W - 28, 40);
    ctx.textAlign = 'left';

    const cw = 76; const ch = 108;
    const row = (cards, y, label, val, hideLast) => {
      ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 18px Sans';
      ctx.fillText(`${label}${val != null ? `  —  ${val}` : ''}`, 28, y - 14);
      cards.forEach((c, i) => {
        drawPlayingCard(ctx, 28 + i * (cw + 12), y, cw, ch, c, hideLast && i === cards.length - 1);
      });
    };
    row(p.dealer, 74, 'Croupier', p.hideDealer ? null : p.dv, p.hideDealer);
    row(p.player, 244, 'Toi', p.pv, false);

    if (p.status) {
      ctx.textAlign = 'center';
      ctx.fillStyle = p.tone === 'win' ? '#22c55e' : p.tone === 'lose' ? '#ef4444' : p.tone === 'push' ? '#eab308' : '#e5e7eb';
      ctx.font = 'bold 22px Sans';
      ctx.fillText(p.status, W / 2, H - 24);
      ctx.textAlign = 'left';
    }
  });
}

// ==========================================================================
//  QUIZ  (image fixe : question + 4 choix)
// ==========================================================================
export async function renderQuiz(p) {
  return makePng(760, 440, (ctx) => {
    const W = 760; const H = 440;
    bg(ctx, W, H, p.revealed ? (p.correct ? '#22c55e' : '#ef4444') : '#6366f1');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a5b4fc'; ctx.font = 'bold 16px Sans';
    ctx.fillText(`QUIZ · ${p.category.toUpperCase()}`, 32, 42);
    ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 24px Sans';
    // question wrap
    const words = p.question.split(' ');
    let line = ''; let y = 84;
    for (const w of words) {
      if (ctx.measureText(line + ' ' + w).width > W - 64) { ctx.fillText(line, 32, y); line = w; y += 32; }
      else line = line ? line + ' ' + w : w;
    }
    ctx.fillText(line, 32, y);

    const letters = ['A', 'B', 'C', 'D'];
    const boxY = 172;
    p.choices.forEach((choice, i) => {
      const by = boxY + i * 54;
      let fill = 'rgba(255,255,255,0.06)';
      let stroke = 'rgba(255,255,255,0.18)';
      if (p.revealed) {
        if (i === p.answerIndex) { fill = 'rgba(34,197,94,0.28)'; stroke = '#22c55e'; }
        else if (i === p.chosenIndex) { fill = 'rgba(239,68,68,0.28)'; stroke = '#ef4444'; }
      }
      ctx.fillStyle = fill;
      rr(ctx, 32, by, W - 64, 46, 10); ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = 2;
      rr(ctx, 32, by, W - 64, 46, 10); ctx.stroke();
      ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 18px Sans';
      ctx.fillText(`${letters[i]}.  ${choice}`, 50, by + 29);
    });

    if (p.revealed) {
      ctx.textAlign = 'center';
      ctx.fillStyle = p.correct ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 22px Sans';
      ctx.fillText(p.correct ? `BONNE RÉPONSE  +${p.reward}` : 'MAUVAISE RÉPONSE', W / 2, H - 22);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#94a3b8'; ctx.font = '15px Sans';
      ctx.fillText(`${p.timeSec} s pour répondre`, 32, H - 22);
    }
  });
}

// ==========================================================================
//  DUEL  (image fixe : VS + dés + gagnant)
// ==========================================================================
export async function renderDuel(p) {
  if (!Canvas) return null;
  const W = 720; const H = 330;
  const canvas = Canvas.createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const [a1, a2] = await Promise.all([loadAvatar(p.p1.avatarURL), loadAvatar(p.p2.avatarURL)]);

  const winTint = '#22c55e';
  bg(ctx, W, H, winTint);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 22px Sans';
  ctx.fillText('DUEL', W / 2, 38);

  const side = (x, name, roll, avatar, isWin) => {
    const cx = x; const cy = 130; const R = 52;
    glow(ctx, cx, cy, R * 1.7, isWin ? '#22c55e' : '#64748b', isWin ? 0.6 : 0.25);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    if (avatar) ctx.drawImage(avatar, cx - R, cy - R, R * 2, R * 2);
    else { ctx.fillStyle = '#475569'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
    ctx.restore();
    ctx.strokeStyle = isWin ? '#22c55e' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isWin ? 5 : 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // badge du lancer de dé, sous l'avatar
    const bx = cx; const by = cy + R + 4;
    ctx.fillStyle = isWin ? '#22c55e' : '#334155';
    ctx.beginPath(); ctx.arc(bx, by, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px Sans';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(roll), bx, by + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 18px Sans';
    ctx.fillText(name.length > 14 ? name.slice(0, 13) + '…' : name, cx, by + 44);
  };
  side(160, p.p1.name, p.r1, a1, p.winner === 1);
  side(W - 160, p.p2.name, p.r2, a2, p.winner === 2);

  ctx.fillStyle = '#eab308'; ctx.font = 'bold 40px Sans';
  ctx.fillText('VS', W / 2, 138);

  ctx.fillStyle = '#22c55e'; ctx.font = 'bold 22px Sans';
  const wn = p.winner === 1 ? p.p1.name : p.p2.name;
  ctx.fillText(`${wn.length > 16 ? wn.slice(0, 15) + '…' : wn} remporte ${p.pot}`, W / 2, H - 24);
  ctx.textAlign = 'left';
  return canvas.encode('png');
}
