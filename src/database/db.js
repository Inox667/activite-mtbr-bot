// ==========================================================================
//  Connexion SQLite via le module natif de Node (node:sqlite).
//  Aucune dépendance à compiler. Nécessite Node >= 22.5.
//  Un seul fichier : data/mtbr.db
// ==========================================================================
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
mkdirSync(dataDir, { recursive: true });

// MTBR_DB_PATH permet de pointer vers une autre base (tests).
const dbPath = process.env.MTBR_DB_PATH || join(dataDir, 'mtbr.db');
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA wal_autocheckpoint = 200'); // checkpoint auto fréquent (≈ durabilité même si kill brutal)

/** Exécute `fn` dans une transaction (BEGIN/COMMIT, ROLLBACK si erreur). */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// --- Schéma (idempotent) ------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id            TEXT PRIMARY KEY,
  xp_enabled          INTEGER NOT NULL DEFAULT 1,
  xp_multiplier       REAL    NOT NULL DEFAULT 1.0,
  event_multiplier    REAL    NOT NULL DEFAULT 1.0,
  event_expires_at    INTEGER NOT NULL DEFAULT 0,
  levelup_channel_id  TEXT,
  levelup_message     TEXT    NOT NULL DEFAULT 'GG {user}, tu passes **niveau {level}** ! {emoji}',
  levelup_mode        TEXT    NOT NULL DEFAULT 'channel',
  announce_channel_id TEXT,
  ignored_channels    TEXT    NOT NULL DEFAULT '[]',
  no_xp_roles         TEXT    NOT NULL DEFAULT '[]',
  double_xp_channels  TEXT    NOT NULL DEFAULT '[]',
  booster_bonus       REAL    NOT NULL DEFAULT 0,     -- +% d'XP si booster du serveur
  tag_bonus           REAL    NOT NULL DEFAULT 0,     -- +% d'XP si porte le tag du serveur
  promo_bonus         REAL    NOT NULL DEFAULT 0,     -- +% d'XP si pub le serveur dans le statut
  promo_text          TEXT    NOT NULL DEFAULT '',    -- texte à chercher dans le statut (en plus du vanity)
  booster_role_id     TEXT,
  weekly_reset_at     INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS level_roles (
  guild_id TEXT NOT NULL,
  level    INTEGER NOT NULL,
  role_id  TEXT NOT NULL,
  PRIMARY KEY (guild_id, level)
);

CREATE TABLE IF NOT EXISTS users (
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  xp            INTEGER NOT NULL DEFAULT 0,
  weekly_xp     INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 0,
  coins         INTEGER NOT NULL DEFAULT 0,
  bank          INTEGER NOT NULL DEFAULT 0,
  gems          INTEGER NOT NULL DEFAULT 0,
  messages      INTEGER NOT NULL DEFAULT 0,
  voice_minutes INTEGER NOT NULL DEFAULT 0,
  prestige      INTEGER NOT NULL DEFAULT 0,
  daily_streak  INTEGER NOT NULL DEFAULT 0,
  trivia_streak INTEGER NOT NULL DEFAULT 0,
  games_won     INTEGER NOT NULL DEFAULT 0,
  games_lost    INTEGER NOT NULL DEFAULT 0,
  duels_won     INTEGER NOT NULL DEFAULT 0,
  total_gambled INTEGER NOT NULL DEFAULT 0,
  biggest_win   INTEGER NOT NULL DEFAULT 0,
  last_daily    INTEGER NOT NULL DEFAULT 0,
  last_weekly   INTEGER NOT NULL DEFAULT 0,
  last_work     INTEGER NOT NULL DEFAULT 0,
  last_crime    INTEGER NOT NULL DEFAULT 0,
  last_rob      INTEGER NOT NULL DEFAULT 0,
  last_fish     INTEGER NOT NULL DEFAULT 0,
  last_mine     INTEGER NOT NULL DEFAULT 0,
  last_case     INTEGER NOT NULL DEFAULT 0,
  cases_opened  INTEGER NOT NULL DEFAULT 0,
  last_xp_ts    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_users_xp     ON users (guild_id, xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_weekly ON users (guild_id, weekly_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_voice  ON users (guild_id, voice_minutes DESC);

CREATE TABLE IF NOT EXISTS shop_items (
  guild_id    TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji       TEXT NOT NULL DEFAULT '📦',
  price       INTEGER NOT NULL,
  type        TEXT NOT NULL DEFAULT 'collectible',
  data        TEXT NOT NULL DEFAULT '{}',
  stock       INTEGER NOT NULL DEFAULT -1,
  enabled     INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'coins',   -- coins | gems
  PRIMARY KEY (guild_id, item_id)
);

CREATE TABLE IF NOT EXISTS inventory (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  item_id  TEXT NOT NULL,
  qty      INTEGER NOT NULL DEFAULT 1,
  data     TEXT NOT NULL DEFAULT '{}',
  acquired_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, user_id, item_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  guild_id       TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS missions (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  day        TEXT NOT NULL,              -- clé de période : YYYY-MM-DD / YYYY-Www / YYYY-MM
  scope      TEXT NOT NULL DEFAULT 'daily', -- daily | weekly | monthly
  mission_id TEXT NOT NULL,
  progress   INTEGER NOT NULL DEFAULT 0,
  target     INTEGER NOT NULL,
  reward     INTEGER NOT NULL,
  xp_reward  INTEGER NOT NULL DEFAULT 0,
  gem_reward INTEGER NOT NULL DEFAULT 0,
  claimed    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id, day, mission_id)
);

-- Activité journalière par membre (pour les stats 1j / 7j / 30j).
CREATE TABLE IF NOT EXISTS activity_daily (
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  day           TEXT NOT NULL,           -- YYYY-MM-DD (local)
  messages      INTEGER NOT NULL DEFAULT 0,
  voice_minutes INTEGER NOT NULL DEFAULT 0,
  xp            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_activity ON activity_daily (guild_id, user_id, day DESC);

CREATE TABLE IF NOT EXISTS economy_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  amount   INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'coins',
  reason   TEXT NOT NULL,
  ts       INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_log_user ON economy_log (guild_id, user_id, ts DESC);
`);

// --- Migrations numérotées ---------------------------------------------
const addColumn = (d, table, col, def) => {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
};

const MIGRATIONS = [
  // v1 : colonne xp_reward sur les missions.
  (d) => addColumn(d, 'missions', 'xp_reward', 'INTEGER NOT NULL DEFAULT 0'),
  // v2 : monnaie gems + quêtes hebdo/mensuelles + devise boutique/log.
  (d) => {
    addColumn(d, 'users', 'gems', 'INTEGER NOT NULL DEFAULT 0');
    addColumn(d, 'missions', 'scope', "TEXT NOT NULL DEFAULT 'daily'");
    addColumn(d, 'missions', 'gem_reward', 'INTEGER NOT NULL DEFAULT 0');
    addColumn(d, 'economy_log', 'currency', "TEXT NOT NULL DEFAULT 'coins'");
    addColumn(d, 'shop_items', 'currency', "TEXT NOT NULL DEFAULT 'coins'");
  },
  // v3 : bonus d'XP (boost serveur / tag / pub).
  (d) => {
    addColumn(d, 'guild_config', 'booster_bonus', 'REAL NOT NULL DEFAULT 0');
    addColumn(d, 'guild_config', 'tag_bonus', 'REAL NOT NULL DEFAULT 0');
    addColumn(d, 'guild_config', 'promo_bonus', 'REAL NOT NULL DEFAULT 0');
    addColumn(d, 'guild_config', 'promo_text', "TEXT NOT NULL DEFAULT ''");
    addColumn(d, 'guild_config', 'booster_role_id', 'TEXT');
  },
  // v4 : caisses.
  (d) => {
    addColumn(d, 'users', 'last_case', 'INTEGER NOT NULL DEFAULT 0');
    addColumn(d, 'users', 'cases_opened', 'INTEGER NOT NULL DEFAULT 0');
  },
];

const version = db.prepare('PRAGMA user_version').get().user_version ?? 0;
for (let i = version; i < MIGRATIONS.length; i++) {
  tx(() => {
    MIGRATIONS[i](db);
    db.exec(`PRAGMA user_version = ${i + 1}`);
  });
  console.log(`[db] migration ${i + 1} appliquée`);
}

export default db;
