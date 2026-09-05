// XP de message + comptage + progression de quêtes + activité journalière.
import { config } from '../config.js';
import {
  getGuildConfig, getUser, updateUser, incrementUser, effectiveXpMultiplier, bumpActivity,
} from '../database/models.js';
import { grantXp } from '../lib/leveling.js';
import { trackMission, currentMissionDay } from '../lib/missions.js';
import { memberXpBonus } from '../lib/xpBonus.js';
import { randInt } from '../lib/format.js';
import { nowSec } from '../lib/cooldowns.js';

// Salons distincts où chaque membre a parlé aujourd'hui (quête "salons").
// Clé : `${guildId}:${userId}:${day}` -> Set d'IDs de salon. Réinitialisé au redémarrage.
const channelsToday = new Map();

export default async function messageCreate(message) {
  if (message.author.bot || !message.inGuild() || message.system) return;
  if (message.content.trim().length < config.leveling.message.minLength) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const g = getGuildConfig(guildId);
  if (!g.xp_enabled) return;
  if (g.ignored_channels.includes(message.channelId)) return;
  if (g.ignored_channels.includes(message.channel.parentId)) return;

  const member = message.member;
  if (member && g.no_xp_roles.some((r) => member.roles.cache.has(r))) return;

  const day = currentMissionDay();

  // Comptage message + quêtes (indépendant du cooldown XP)
  incrementUser(guildId, userId, { messages: 1 });
  bumpActivity(guildId, userId, day, { messages: 1 });
  trackMission(guildId, userId, 'messages', 1);

  // Quête "parler dans N salons différents"
  const key = `${guildId}:${userId}:${day}`;
  let set = channelsToday.get(key);
  if (!set) { set = new Set(); channelsToday.set(key, set); }
  if (!set.has(message.channelId)) {
    set.add(message.channelId);
    trackMission(guildId, userId, 'salons', 1);
  }

  // Cooldown XP
  const u = getUser(guildId, userId);
  const now = nowSec();
  if (now - u.last_xp_ts < config.leveling.message.cooldownSec) return;
  updateUser(guildId, userId, { last_xp_ts: now });

  let amount = randInt(config.leveling.message.min, config.leveling.message.max);
  amount *= effectiveXpMultiplier(guildId);
  if (g.double_xp_channels.includes(message.channelId)) amount *= 2;
  if (member) amount *= memberXpBonus(member, g).multiplier;

  if (member) {
    const res = await grantXp(member, amount, { channel: message.channel, source: 'message' });
    bumpActivity(guildId, userId, day, { xp: Math.round(res.gained ?? amount) });
  }
}

// Purge légère : garde la map bornée si le bot tourne longtemps.
setInterval(() => {
  if (channelsToday.size > 5000) channelsToday.clear();
}, 3600_000);
