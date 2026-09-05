// ==========================================================================
//  Quêtes journalières / hebdomadaires / mensuelles.
//  - Journalier : reset à minuit (config.missions.resetHour)
//  - Hebdomadaire : reset lundi 00:00
//  - Mensuel : reset le 1er du mois
//  Récompenses : XP + coins (+ gems pour hebdo/mensuel).
// ==========================================================================
import { config } from '../config.js';
import {
  getMissions, getMissionsForPeriods, createMission, progressMission,
} from '../database/models.js';
import { randInt } from './format.js';

// ---- Clés de période --------------------------------------------------
export function currentDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(d.getHours() - config.missions.resetHour);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
// Alias rétro-compat
export const currentMissionDay = currentDay;

export function currentWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Jour ISO (lundi = 1 ... dimanche = 7)
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // jeudi de la semaine
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function periodKeys(date = new Date()) {
  return { daily: currentDay(date), weekly: currentWeek(date), monthly: currentMonth(date) };
}

// ---- Pools -----------------------------------------------------------
// reward = [minCoins, maxCoins], xp = [minXP, maxXP], gems = [minGems, maxGems]
export const POOLS = {
  daily: [
    { id: 'messages', label: 'Envoyer {t} messages', min: 40, max: 90, reward: [15, 30], xp: [100, 180], gems: [0, 0] },
    { id: 'salons', label: 'Parler dans {t} salons différents', min: 3, max: 5, reward: [10, 20], xp: [40, 80], gems: [0, 0] },
    { id: 'earn_xp', label: 'Gagner {t} XP', min: 300, max: 700, reward: [15, 30], xp: [80, 150], gems: [0, 0] },
    { id: 'play_games', label: 'Jouer {t} parties au casino', min: 3, max: 8, reward: [15, 30], xp: [70, 130], gems: [0, 0] },
    { id: 'win_games', label: 'Gagner {t} parties au casino', min: 2, max: 5, reward: [25, 45], xp: [90, 160], gems: [0, 0] },
    { id: 'earn_coins', label: 'Gagner {t} coins', min: 500, max: 1500, reward: [15, 30], xp: [70, 140], gems: [0, 0] },
    { id: 'spend_coins', label: 'Dépenser {t} coins à la boutique', min: 500, max: 2000, reward: [15, 30], xp: [70, 140], gems: [0, 0] },
    { id: 'work', label: 'Faire /work {t} fois', min: 2, max: 4, reward: [15, 30], xp: [70, 120], gems: [0, 0] },
    { id: 'daily_done', label: 'Récupérer ta récompense /daily', min: 1, max: 1, reward: [20, 20], xp: [80, 80], gems: [0, 0] },
    { id: 'trivia_correct', label: 'Répondre juste à {t} quiz', min: 2, max: 5, reward: [18, 35], xp: [80, 150], gems: [0, 0] },
    { id: 'voice', label: 'Passer {t} minutes en vocal', min: 20, max: 60, reward: [15, 30], xp: [90, 160], gems: [0, 0] },
    { id: 'gift', label: 'Donner des coins à un membre {t} fois', min: 1, max: 2, reward: [12, 22], xp: [40, 80], gems: [0, 0] },
    { id: 'fish_mine', label: 'Pêcher ou miner {t} fois', min: 3, max: 6, reward: [12, 25], xp: [50, 100], gems: [0, 0] },
  ],
  weekly: [
    { id: 'messages', label: 'Envoyer {t} messages', min: 300, max: 600, reward: [150, 300], xp: [2000, 3500], gems: [1, 2] },
    { id: 'voice', label: 'Cumuler {t} minutes en vocal', min: 400, max: 900, reward: [200, 350], xp: [2500, 4000], gems: [2, 3] },
    { id: 'play_games', label: 'Jouer {t} parties au casino', min: 40, max: 70, reward: [250, 400], xp: [3000, 4500], gems: [2, 3] },
    { id: 'win_games', label: 'Gagner {t} parties au casino', min: 15, max: 30, reward: [300, 500], xp: [3000, 5000], gems: [2, 4] },
    { id: 'duels_won', label: 'Remporter {t} duels', min: 5, max: 12, reward: [200, 400], xp: [2000, 3500], gems: [2, 3] },
    { id: 'earn_coins', label: 'Gagner {t} coins', min: 8000, max: 18000, reward: [200, 400], xp: [2000, 3500], gems: [1, 2] },
    { id: 'trivia_correct', label: 'Répondre juste à {t} quiz', min: 15, max: 30, reward: [200, 350], xp: [2000, 3500], gems: [1, 2] },
    { id: 'earn_xp', label: 'Gagner {t} XP', min: 4000, max: 9000, reward: [200, 350], xp: [1500, 2500], gems: [1, 2] },
    { id: 'work', label: 'Faire /work {t} fois', min: 15, max: 30, reward: [150, 300], xp: [1500, 3000], gems: [1, 2] },
    { id: 'fish_mine', label: 'Pêcher ou miner {t} fois', min: 20, max: 40, reward: [150, 300], xp: [1500, 2500], gems: [1, 2] },
    { id: 'cases_opened', label: 'Ouvrir {t} caisses', min: 8, max: 20, reward: [200, 350], xp: [2000, 3500], gems: [1, 3] },
  ],
  monthly: [
    { id: 'messages', label: 'Envoyer {t} messages', min: 1500, max: 3000, reward: [1000, 1800], xp: [10000, 15000], gems: [6, 10] },
    { id: 'voice', label: 'Cumuler {t} minutes en vocal', min: 2000, max: 3500, reward: [1200, 2000], xp: [12000, 18000], gems: [8, 12] },
    { id: 'earn_xp', label: 'Gagner {t} XP', min: 25000, max: 50000, reward: [1000, 1800], xp: [8000, 12000], gems: [6, 10] },
    { id: 'win_games', label: 'Gagner {t} parties au casino', min: 80, max: 150, reward: [1500, 2500], xp: [12000, 18000], gems: [8, 14] },
    { id: 'earn_coins', label: 'Gagner {t} coins', min: 50000, max: 120000, reward: [1000, 2000], xp: [8000, 14000], gems: [6, 10] },
    { id: 'cases_opened', label: 'Ouvrir {t} caisses', min: 40, max: 90, reward: [1200, 2200], xp: [10000, 16000], gems: [8, 14] },
  ],
};

const COUNTS = {
  daily: config.missions.daily.count,
  weekly: config.missions.weekly.count,
  monthly: config.missions.monthly.count,
};

function generate(guildId, userId, scope, dayKey) {
  const pool = [...POOLS[scope]];
  for (let i = 0; i < COUNTS[scope] && pool.length; i++) {
    const tpl = pool.splice(randInt(0, pool.length - 1), 1)[0];
    createMission(guildId, userId, dayKey, {
      scope,
      id: tpl.id,
      target: randInt(tpl.min, tpl.max),
      reward: randInt(tpl.reward[0], tpl.reward[1]),
      xpReward: randInt(tpl.xp[0], tpl.xp[1]),
      gemReward: randInt(tpl.gems[0], tpl.gems[1]),
    });
  }
}

/** Renvoie (en générant si besoin) toutes les quêtes actives, groupées par scope. */
export function ensureMissions(guildId, userId) {
  const keys = periodKeys();
  const out = {};
  for (const scope of ['daily', 'weekly', 'monthly']) {
    const key = keys[scope];
    let missions = getMissions(guildId, userId, key);
    if (missions.length === 0) {
      generate(guildId, userId, scope, key);
      missions = getMissions(guildId, userId, key);
    }
    out[scope] = { key, missions };
  }
  return out;
}

// Rétro-compat : ancienne API "daily uniquement"
export function ensureDailyMissions(guildId, userId) {
  const { daily } = ensureMissions(guildId, userId);
  return { day: daily.key, missions: daily.missions };
}

export function missionLabel(scope, missionId, target) {
  const tpl = (POOLS[scope] || []).find((m) => m.id === missionId)
    ?? Object.values(POOLS).flat().find((m) => m.id === missionId);
  if (!tpl) return missionId;
  return tpl.label.replace('{t}', target.toLocaleString('fr-FR'));
}

export function allMissionsDone(missions) {
  return missions.length > 0 && missions.every((m) => m.progress >= m.target);
}

/**
 * Fait progresser une quête d'un type donné sur les 3 périodes en cours.
 * Sans effet si l'utilisateur n'a aucune quête de ce type.
 */
export function trackMission(guildId, userId, type, amount = 1) {
  const keys = Object.values(periodKeys());
  const active = getMissionsForPeriods(guildId, userId, keys);
  if (!active.some((m) => m.mission_id === type)) return;
  progressMission(guildId, userId, keys, type, amount);
}
