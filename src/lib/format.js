// Helpers de formatage (nombres, durées, barres de progression).
import { config } from '../config.js';

const nf = new Intl.NumberFormat('fr-FR');

export function fmt(n) {
  return nf.format(Math.round(n));
}

export function coins(n) {
  return `**${fmt(n)}** ${config.emojis.coin}`;
}

export function xp(n) {
  return `**${fmt(n)}** ${config.emojis.xp}`;
}

/** Durée lisible à partir de secondes : "1 h 5 min 3 s". */
export function duration(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (d) parts.push(`${d} j`);
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s && !d && !h) parts.push(`${s} s`);
  return parts.join(' ') || '0 s';
}

/** Timestamp Discord relatif (<t:...:R>). */
export function relTs(unixSec) {
  return `<t:${Math.floor(unixSec)}:R>`;
}

/** Barre de progression texte. */
export function progressBar(current, total, size = 16) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
  const filled = Math.round(ratio * size);
  return '▰'.repeat(filled) + '▱'.repeat(size - filled) + ` ${Math.floor(ratio * 100)}%`;
}

export function pct(n) {
  return `${Math.round(n * 100)}%`;
}

/** Parse une mise : nombre, "1k", "2.5m", "all", "half". */
export function parseAmount(input, max) {
  if (input == null) return null;
  const raw = String(input).trim().toLowerCase();
  if (raw === 'all' || raw === 'tout' || raw === 'max') return max;
  if (raw === 'half' || raw === 'moitié' || raw === 'moitie') return Math.floor(max / 2);
  const m = raw.match(/^([\d.,]+)\s*([kmb])?$/);
  if (!m) return null;
  let val = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(val)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[m[2]] ?? 1;
  return Math.floor(val * mult);
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Transforme un texte en identifiant : "Montre plaquée or" -> "montre-plaquee-or". */
export function slug(s) {
  return (String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'item');
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Tirage pondéré : [{w|weight:number, ...}] -> un élément. */
export function weighted(items) {
  const wof = (i) => i.w ?? i.weight ?? 0;
  const total = items.reduce((s, i) => s + wof(i), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= wof(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
