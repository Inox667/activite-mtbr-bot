// ==========================================================================
//  Couche d'accès aux données. Fonctions pures (pas de dépendance Discord).
// ==========================================================================
import { db, tx } from './db.js';
import { levelFromXp, config } from '../config.js';

// ----- Config serveur -----------------------------------------------------
const insertGuild = db.prepare('INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)');
const selectGuild = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?');

export function getGuildConfig(guildId) {
  insertGuild.run(guildId);
  const row = selectGuild.get(guildId);
  return {
    ...row,
    ignored_channels: JSON.parse(row.ignored_channels),
    no_xp_roles: JSON.parse(row.no_xp_roles),
    double_xp_channels: JSON.parse(row.double_xp_channels),
  };
}

export function setGuildConfig(guildId, patch) {
  insertGuild.run(guildId);
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    values.push(Array.isArray(v) ? JSON.stringify(v) : v);
  }
  if (!fields.length) return;
  values.push(guildId);
  db.prepare(`UPDATE guild_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
}

/** Multiplicateur d'XP effectif (base × event si encore actif). */
export function effectiveXpMultiplier(guildId) {
  const g = getGuildConfig(guildId);
  const now = Math.floor(Date.now() / 1000);
  const event = g.event_expires_at > now ? g.event_multiplier : 1;
  return g.xp_multiplier * event;
}

// ----- Rôles de palier --------------------------------------------------
const upsertLevelRole = db.prepare(
  'INSERT INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?) ' +
  'ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id'
);
const selectLevelRoles = db.prepare('SELECT level, role_id FROM level_roles WHERE guild_id = ? ORDER BY level ASC');
const deleteLevelRoles = db.prepare('DELETE FROM level_roles WHERE guild_id = ?');

export function setLevelRole(guildId, level, roleId) {
  upsertLevelRole.run(guildId, level, roleId);
}
export function clearLevelRoles(guildId) {
  deleteLevelRoles.run(guildId);
}
export function getLevelRoles(guildId) {
  return selectLevelRoles.all(guildId);
}

/** Renvoie le palier de rôle correspondant à un niveau (le plus haut atteint). */
export function roleTierForLevel(guildId, level) {
  const tiers = getLevelRoles(guildId);
  let match = null;
  for (const t of tiers) if (level >= t.level) match = t;
  return match; // { level, role_id } ou null
}

// ----- Utilisateurs ----------------------------------------------------
const insertUser = db.prepare('INSERT OR IGNORE INTO users (guild_id, user_id) VALUES (?, ?)');
const selectUser = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?');

export function getUser(guildId, userId) {
  insertUser.run(guildId, userId);
  return selectUser.get(guildId, userId);
}

export function updateUser(guildId, userId, patch) {
  insertUser.run(guildId, userId);
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    values.push(v);
  }
  if (!fields.length) return;
  values.push(guildId, userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE guild_id = ? AND user_id = ?`).run(...values);
}

/** Incrémente une ou plusieurs colonnes numériques (delta). */
export function incrementUser(guildId, userId, deltas) {
  insertUser.run(guildId, userId);
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(deltas)) {
    fields.push(`${k} = ${k} + ?`);
    values.push(v);
  }
  if (!fields.length) return;
  values.push(guildId, userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE guild_id = ? AND user_id = ?`).run(...values);
}

// ----- XP -------------------------------------------------------------
const _addXp = db.prepare(
  'UPDATE users SET xp = MAX(0, xp + ?), weekly_xp = MAX(0, weekly_xp + ?), level = ? WHERE guild_id = ? AND user_id = ?'
);

/**
 * Ajoute (ou retire) de l'XP. Renvoie de quoi gérer le level-up côté appelant.
 * @returns {{oldLevel:number,newLevel:number,leveledUp:boolean,newTotalXp:number}}
 */
export function addXp(guildId, userId, amount, { weekly = true } = {}) {
  const u = getUser(guildId, userId);
  const oldLevel = levelFromXp(u.xp).level;
  const newTotalXp = Math.max(0, u.xp + amount);
  const newLevel = levelFromXp(newTotalXp).level;
  _addXp.run(amount, weekly ? amount : 0, newLevel, guildId, userId);
  return { oldLevel, newLevel, leveledUp: newLevel > oldLevel, newTotalXp };
}

// ----- Économie ------------------------------------------------------
const logEconomy = db.prepare('INSERT INTO economy_log (guild_id, user_id, amount, currency, reason) VALUES (?, ?, ?, ?, ?)');

export function addCoins(guildId, userId, amount, reason = 'divers') {
  getUser(guildId, userId);
  db.prepare('UPDATE users SET coins = coins + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
  logEconomy.run(guildId, userId, amount, 'coins', reason);
}

/** Retire des coins de la poche. Renvoie false si solde insuffisant. */
export function removeCoins(guildId, userId, amount, reason = 'divers') {
  const u = getUser(guildId, userId);
  if (u.coins < amount) return false;
  db.prepare('UPDATE users SET coins = coins - ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
  logEconomy.run(guildId, userId, -amount, 'coins', reason);
  return true;
}

// ----- Gems (monnaie premium) ---------------------------------------
export function addGems(guildId, userId, amount, reason = 'divers') {
  getUser(guildId, userId);
  db.prepare('UPDATE users SET gems = gems + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
  logEconomy.run(guildId, userId, amount, 'gems', reason);
}

export function removeGems(guildId, userId, amount, reason = 'divers') {
  const u = getUser(guildId, userId);
  if (u.gems < amount) return false;
  db.prepare('UPDATE users SET gems = gems - ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
  logEconomy.run(guildId, userId, -amount, 'gems', reason);
  return true;
}

export function transferCoins(guildId, fromId, toId, amount, reason = 'don') {
  try {
    tx(() => {
      if (!removeCoins(guildId, fromId, amount, `${reason} -> ${toId}`)) throw new Error('INSUFFICIENT');
      addCoins(guildId, toId, amount, `${reason} <- ${fromId}`);
    });
    return true;
  } catch {
    return false;
  }
}

export function deposit(guildId, userId, amount) {
  const u = getUser(guildId, userId);
  const amt = amount === 'all' ? u.coins : Math.min(amount, u.coins);
  if (amt <= 0) return 0;
  db.prepare('UPDATE users SET coins = coins - ?, bank = bank + ? WHERE guild_id = ? AND user_id = ?')
    .run(amt, amt, guildId, userId);
  return amt;
}

export function withdraw(guildId, userId, amount) {
  const u = getUser(guildId, userId);
  const amt = amount === 'all' ? u.bank : Math.min(amount, u.bank);
  if (amt <= 0) return 0;
  db.prepare('UPDATE users SET bank = bank - ?, coins = coins + ? WHERE guild_id = ? AND user_id = ?')
    .run(amt, amt, guildId, userId);
  return amt;
}

export function getEconomyLog(guildId, userId, limit = 10) {
  return db.prepare('SELECT amount, currency, reason, ts FROM economy_log WHERE guild_id = ? AND user_id = ? ORDER BY ts DESC LIMIT ?')
    .all(guildId, userId, limit);
}

// ----- Classements --------------------------------------------------
export function leaderboard(guildId, type = 'xp', limit = 10, offset = 0) {
  const col = {
    xp: 'xp', weekly: 'weekly_xp', voice: 'voice_minutes', messages: 'messages', gems: 'gems',
  }[type];
  if (col) {
    return db.prepare(
      `SELECT user_id, ${col} AS value, xp, level, prestige FROM users WHERE guild_id = ? AND ${col} > 0 ORDER BY ${col} DESC LIMIT ? OFFSET ?`
    ).all(guildId, limit, offset);
  }
  // coins = poche + banque
  return db.prepare(
    'SELECT user_id, (coins + bank) AS value, xp, level, prestige FROM users WHERE guild_id = ? AND (coins + bank) > 0 ORDER BY value DESC LIMIT ? OFFSET ?'
  ).all(guildId, limit, offset);
}

export function getRank(guildId, userId, type = 'xp') {
  const col = { xp: 'xp', weekly: 'weekly_xp', voice: 'voice_minutes', messages: 'messages', gems: 'gems' }[type];
  const expr = col || '(coins + bank)';
  const me = db.prepare(`SELECT ${expr} AS v FROM users WHERE guild_id = ? AND user_id = ?`).get(guildId, userId);
  if (!me) return null;
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM users WHERE guild_id = ? AND ${expr} > ?`
  ).get(guildId, me.v);
  return row.c + 1;
}

export function countMembers(guildId) {
  return db.prepare('SELECT COUNT(*) AS c FROM users WHERE guild_id = ?').get(guildId).c;
}

export function resetWeekly(guildId) {
  const top = leaderboard(guildId, 'weekly', 3);
  db.prepare('UPDATE users SET weekly_xp = 0 WHERE guild_id = ?').run(guildId);
  return top;
}

// ----- Inventaire --------------------------------------------------
export function addItem(guildId, userId, itemId, qty = 1, data = {}) {
  db.prepare(
    'INSERT INTO inventory (guild_id, user_id, item_id, qty, data) VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET qty = qty + excluded.qty'
  ).run(guildId, userId, itemId, qty, JSON.stringify(data));
}

export function removeItem(guildId, userId, itemId, qty = 1) {
  const row = db.prepare('SELECT qty FROM inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?')
    .get(guildId, userId, itemId);
  if (!row || row.qty < qty) return false;
  if (row.qty === qty) {
    db.prepare('DELETE FROM inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?').run(guildId, userId, itemId);
  } else {
    db.prepare('UPDATE inventory SET qty = qty - ? WHERE guild_id = ? AND user_id = ? AND item_id = ?')
      .run(qty, guildId, userId, itemId);
  }
  return true;
}

export function getInventory(guildId, userId) {
  return db.prepare('SELECT item_id, qty, data FROM inventory WHERE guild_id = ? AND user_id = ? ORDER BY acquired_at ASC')
    .all(guildId, userId)
    .map((r) => ({ ...r, data: JSON.parse(r.data) }));
}

// ----- Boutique --------------------------------------------------
export function getShopItems(guildId, includeDisabled = false) {
  const q = includeDisabled
    ? 'SELECT * FROM shop_items WHERE guild_id = ? ORDER BY sort ASC, price ASC'
    : 'SELECT * FROM shop_items WHERE guild_id = ? AND enabled = 1 ORDER BY sort ASC, price ASC';
  return db.prepare(q).all(guildId).map((r) => ({ ...r, data: JSON.parse(r.data) }));
}
export function getShopItem(guildId, itemId) {
  const r = db.prepare('SELECT * FROM shop_items WHERE guild_id = ? AND item_id = ?').get(guildId, itemId);
  return r ? { ...r, data: JSON.parse(r.data) } : null;
}
export function upsertShopItem(guildId, item) {
  db.prepare(
    `INSERT INTO shop_items (guild_id, item_id, name, description, emoji, price, type, data, stock, enabled, sort, currency)
     VALUES (@guild_id, @item_id, @name, @description, @emoji, @price, @type, @data, @stock, @enabled, @sort, @currency)
     ON CONFLICT(guild_id, item_id) DO UPDATE SET
       name=excluded.name, description=excluded.description, emoji=excluded.emoji, price=excluded.price,
       type=excluded.type, data=excluded.data, stock=excluded.stock, enabled=excluded.enabled, sort=excluded.sort,
       currency=excluded.currency`
  ).run({
    guild_id: guildId,
    item_id: item.item_id,
    name: item.name,
    description: item.description ?? '',
    emoji: item.emoji ?? '📦',
    price: item.price,
    type: item.type ?? 'collectible',
    data: JSON.stringify(item.data ?? {}),
    stock: item.stock ?? -1,
    enabled: item.enabled ?? 1,
    sort: item.sort ?? 0,
    currency: item.currency ?? 'coins',
  });
}
export function deleteShopItem(guildId, itemId) {
  db.prepare('DELETE FROM shop_items WHERE guild_id = ? AND item_id = ?').run(guildId, itemId);
}
export function decrementStock(guildId, itemId) {
  db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE guild_id = ? AND item_id = ? AND stock > 0')
    .run(guildId, itemId);
}

// ----- Succès ---------------------------------------------------
export function hasAchievement(guildId, userId, id) {
  return !!db.prepare('SELECT 1 FROM achievements WHERE guild_id = ? AND user_id = ? AND achievement_id = ?')
    .get(guildId, userId, id);
}
export function unlockAchievement(guildId, userId, id) {
  const res = db.prepare('INSERT OR IGNORE INTO achievements (guild_id, user_id, achievement_id) VALUES (?, ?, ?)')
    .run(guildId, userId, id);
  return res.changes > 0; // true si nouvellement débloqué
}
export function getAchievements(guildId, userId) {
  return db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE guild_id = ? AND user_id = ? ORDER BY unlocked_at ASC')
    .all(guildId, userId);
}

// ----- Missions / quêtes (daily | weekly | monthly) -------------------
/** Quêtes d'une période (day = clé de période). Exclut la ligne bonus. */
export function getMissions(guildId, userId, day) {
  return db.prepare("SELECT * FROM missions WHERE guild_id = ? AND user_id = ? AND day = ? AND mission_id NOT LIKE '\\_\\_%' ESCAPE '\\'")
    .all(guildId, userId, day);
}
/** Toutes les quêtes actives de l'utilisateur pour un ensemble de clés de période. */
export function getMissionsForPeriods(guildId, userId, dayKeys) {
  if (!dayKeys.length) return [];
  const ph = dayKeys.map(() => '?').join(',');
  return db.prepare(
    `SELECT * FROM missions WHERE guild_id = ? AND user_id = ? AND day IN (${ph}) AND mission_id NOT LIKE '\\_\\_%' ESCAPE '\\'`
  ).all(guildId, userId, ...dayKeys);
}
export function createMission(guildId, userId, day, m) {
  db.prepare(
    'INSERT OR IGNORE INTO missions (guild_id, user_id, day, scope, mission_id, progress, target, reward, xp_reward, gem_reward) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)'
  ).run(guildId, userId, day, m.scope ?? 'daily', m.id, m.target, m.reward, m.xpReward ?? 0, m.gemReward ?? 0);
}
/** Fait progresser une quête d'un type donné sur toutes les périodes fournies. */
export function progressMission(guildId, userId, dayKeys, type, amount = 1) {
  if (!dayKeys.length) return;
  const ph = dayKeys.map(() => '?').join(',');
  db.prepare(
    `UPDATE missions SET progress = MIN(target, progress + ?) WHERE guild_id = ? AND user_id = ? AND mission_id = ? AND claimed = 0 AND day IN (${ph})`
  ).run(amount, guildId, userId, type, ...dayKeys);
}
export function claimMission(guildId, userId, day, missionId) {
  const m = db.prepare('SELECT * FROM missions WHERE guild_id = ? AND user_id = ? AND day = ? AND mission_id = ?')
    .get(guildId, userId, day, missionId);
  if (!m || m.claimed || m.progress < m.target) return null;
  db.prepare('UPDATE missions SET claimed = 1 WHERE guild_id = ? AND user_id = ? AND day = ? AND mission_id = ?')
    .run(guildId, userId, day, missionId);
  return m;
}

/** Marque le bonus "toutes les quêtes" d'une période comme réclamé. */
export function claimAllDoneBonus(guildId, userId, day) {
  const res = db.prepare(
    'INSERT OR IGNORE INTO missions (guild_id, user_id, day, scope, mission_id, progress, target, reward, xp_reward, gem_reward, claimed) ' +
    "VALUES (?, ?, ?, 'bonus', '__all_done__', 1, 1, 0, 0, 0, 1)"
  ).run(guildId, userId, day);
  return res.changes > 0; // true = accordé pour la première fois
}
export function hasAllDoneBonus(guildId, userId, day) {
  return !!db.prepare("SELECT 1 FROM missions WHERE guild_id = ? AND user_id = ? AND day = ? AND mission_id = '__all_done__'")
    .get(guildId, userId, day);
}

// ----- Prestige ------------------------------------------------
export function doPrestige(guildId, userId) {
  const u = getUser(guildId, userId);
  if (u.level < config.prestige.requiredLevel) return null;
  if (u.prestige >= config.prestige.maxStars) return null;
  db.prepare('UPDATE users SET xp = 0, level = 0, prestige = prestige + 1, coins = coins + ?, gems = gems + ? WHERE guild_id = ? AND user_id = ?')
    .run(config.prestige.coinReward, config.prestige.gemReward, guildId, userId);
  return u.prestige + 1;
}

export function totalNet(u) {
  return u.coins + u.bank;
}

// ----- Activité journalière (stats 1j / 7j / 30j) ----------------------
export function bumpActivity(guildId, userId, day, deltas) {
  db.prepare(
    'INSERT INTO activity_daily (guild_id, user_id, day, messages, voice_minutes, xp) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(guild_id, user_id, day) DO UPDATE SET ' +
    'messages = messages + excluded.messages, voice_minutes = voice_minutes + excluded.voice_minutes, xp = xp + excluded.xp'
  ).run(guildId, userId, day, deltas.messages ?? 0, deltas.voice_minutes ?? 0, deltas.xp ?? 0);
}

/** Somme d'activité depuis une date (incluse), format YYYY-MM-DD. */
export function activitySince(guildId, userId, sinceDay) {
  return db.prepare(
    'SELECT COALESCE(SUM(messages),0) AS messages, COALESCE(SUM(voice_minutes),0) AS voice_minutes, COALESCE(SUM(xp),0) AS xp ' +
    'FROM activity_daily WHERE guild_id = ? AND user_id = ? AND day >= ?'
  ).get(guildId, userId, sinceDay);
}

/** Activité jour par jour depuis une date (pour un mini graphe). */
export function activitySeries(guildId, userId, sinceDay) {
  return db.prepare(
    'SELECT day, messages, voice_minutes, xp FROM activity_daily WHERE guild_id = ? AND user_id = ? AND day >= ? ORDER BY day ASC'
  ).all(guildId, userId, sinceDay);
}
