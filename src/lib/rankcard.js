// ==========================================================================
//  Génération de la carte de rang en image (PNG) via @napi-rs/canvas.
//  Si le module n'est pas dispo ou échoue, les commandes retombent sur un embed.
// ==========================================================================
import { levelFromXp, config } from '../config.js';
import { fmt } from './format.js';

let Canvas = null;
try {
  Canvas = await import('@napi-rs/canvas');
} catch {
  console.warn('[rankcard] @napi-rs/canvas indisponible — cartes de rang en mode texte.');
}

export const rankCardAvailable = () => Canvas !== null;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * @param {object} p
 * @param {string} p.username
 * @param {string} p.avatarURL
 * @param {number} p.totalXp
 * @param {number} p.rank
 * @param {number} p.memberCount
 * @param {number} p.prestige
 * @param {number} p.messages
 * @returns {Promise<Buffer|null>}
 */
export async function renderRankCard(p) {
  if (!Canvas) return null;
  try {
    const W = 934;
    const H = 282;
    const canvas = Canvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const { level, xpIntoLevel, xpNeeded } = levelFromXp(p.totalXp);
    const ratio = xpNeeded > 0 ? Math.min(1, xpIntoLevel / xpNeeded) : 1;

    // Fond
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1e1f2b');
    grad.addColorStop(1, '#2b2d3a');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.fill();

    // Panneau interne
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, 16, 16, W - 32, H - 32, 22);
    ctx.fill();

    // Avatar
    const AV = 160;
    const ax = 50;
    const ay = H / 2 - AV / 2;
    try {
      const img = await Canvas.loadImage(p.avatarURL);
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, ax, ay, AV, AV);
      ctx.restore();
    } catch { /* pas d'avatar : cercle plein */
      ctx.fillStyle = '#5865f2';
      ctx.beginPath();
      ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2, 0, Math.PI * 2);
    ctx.stroke();

    const textX = ax + AV + 40;

    // Nom + prestige
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px Sans';
    const name = p.username.length > 20 ? p.username.slice(0, 19) + '…' : p.username;
    ctx.fillText(name, textX, 90);
    if (p.prestige > 0) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 26px Sans';
      ctx.fillText('★'.repeat(Math.min(p.prestige, 10)), textX, 126);
    }

    // Rang / niveau (à droite)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b9bbbe';
    ctx.font = 'bold 26px Sans';
    ctx.fillText(`RANG #${fmt(p.rank)} / ${fmt(p.memberCount)}`, W - 50, 70);
    ctx.fillStyle = '#9b59b6';
    ctx.font = 'bold 34px Sans';
    ctx.fillText(`NIVEAU ${fmt(level)}`, W - 50, 112);
    ctx.textAlign = 'left';

    // Barre d'XP
    const bx = textX;
    const by = 175;
    const bw = W - textX - 50;
    const bh = 34;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    if (ratio > 0) {
      const fillGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      fillGrad.addColorStop(0, '#9b59b6');
      fillGrad.addColorStop(1, '#5865f2');
      ctx.fillStyle = fillGrad;
      roundRect(ctx, bx, by, Math.max(bh, bw * ratio), bh, bh / 2);
      ctx.fill();
    }

    // Texte XP
    ctx.fillStyle = '#dcddde';
    ctx.font = '22px Sans';
    ctx.fillText(`${fmt(xpIntoLevel)} / ${fmt(xpNeeded)} XP`, bx, by + bh + 32);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b9bbbe';
    ctx.fillText(`${fmt(p.messages)} messages`, bx + bw, by + bh + 32);
    ctx.textAlign = 'left';

    return await canvas.encode('png');
  } catch (err) {
    console.warn('[rankcard] échec du rendu:', err.message);
    return null;
  }
}

/**
 * Carte "LEVEL UP !" annoncée dans le salon de level-up.
 * @param {object} p
 * @param {string} p.username
 * @param {string} p.avatarURL
 * @param {number} p.oldLevel
 * @param {number} p.newLevel
 * @param {?string} p.roleName  nom du nouveau rôle de palier, si palier atteint
 * @returns {Promise<Buffer|null>}
 */
export async function renderLevelUpCard(p) {
  if (!Canvas) return null;
  try {
    const W = 900;
    const H = 260;
    const canvas = Canvas.createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Fond
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0d1b2a');
    grad.addColorStop(1, '#12263a');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, W, H, 26);
    ctx.fill();

    // Cadre néon
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 3;
    roundRect(ctx, 14, 14, W - 28, H - 28, 20);
    ctx.stroke();

    // Avatar
    const AV = 140;
    const ax = 46;
    const ay = H / 2 - AV / 2;
    try {
      const img = await Canvas.loadImage(p.avatarURL);
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, ax, ay, AV, AV);
      ctx.restore();
    } catch {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2, 0, Math.PI * 2);
    ctx.stroke();

    const tx = ax + AV + 44;

    // Titre
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 52px Sans';
    ctx.fillText('LEVEL UP !', tx, 78);

    // Nom
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 30px Sans';
    const name = p.username.length > 22 ? p.username.slice(0, 21) + '…' : p.username;
    ctx.fillText(name, tx, 118);

    // Boîtes AVANT > MAINTENANT
    const boxY = 140;
    const boxH = 66;
    const boxW = 190;
    const drawBox = (x, label, value, accent) => {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(ctx, x, boxY, boxW, boxH, 12);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      roundRect(ctx, x, boxY, boxW, boxH, 12);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px Sans';
      ctx.fillText(label, x + 16, boxY + 24);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 26px Sans';
      ctx.fillText(value, x + 16, boxY + 52);
    };
    drawBox(tx, 'AVANT', `Niv. ${p.oldLevel}`, 'rgba(148,163,184,0.4)');
    // Flèche dessinée (pas de glyphe de police)
    const arX = tx + boxW + 20;
    const arY = boxY + boxH / 2;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(arX, arY - 12);
    ctx.lineTo(arX + 20, arY);
    ctx.lineTo(arX, arY + 12);
    ctx.closePath();
    ctx.fill();
    drawBox(tx + boxW + 56, 'MAINTENANT', `Niv. ${p.newLevel}`, '#38bdf8');

    // Pastille
    const pillText = p.roleName ? `Nouveau rôle : ${p.roleName}` : 'Progression automatique';
    ctx.font = 'bold 15px Sans';
    const pw = ctx.measureText(pillText).width + 28;
    ctx.fillStyle = 'rgba(34,197,94,0.18)';
    roundRect(ctx, tx + 2 * boxW + 76, boxY + 18, Math.min(pw, W - (tx + 2 * boxW + 76) - 30), 30, 15);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.fillText(pillText, tx + 2 * boxW + 90, boxY + 38);

    return await canvas.encode('png');
  } catch (err) {
    console.warn('[levelupcard] échec du rendu:', err.message);
    return null;
  }
}
