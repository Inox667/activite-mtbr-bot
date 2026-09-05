// ==========================================================================
//  Logique partagée des gains réguliers (daily / weekly / work / crime /
//  pêche / mine). Utilisée par les commandes ET par /menu.
//  Chaque fonction renvoie { ok:boolean, embed:EmbedBuilder }.
// ==========================================================================
import { config } from '../config.js';
import {
  getUser, updateUser, addCoins, removeCoins,
} from '../database/models.js';
import { FISH_LOOT, MINE_LOOT } from '../data/loot.js';
import { checkCooldown, nowSec } from './cooldowns.js';
import { baseEmbed, errorEmbed } from './embeds.js';
import { fmt, duration, randInt, pick, weighted } from './format.js';
import { trackMission } from './missions.js';
import { checkAchievements } from './achievements.js';
import { announceAchievements } from './leveling.js';

/** Les 6 actions, leurs cooldowns et leur méta pour l'affichage. */
export const ACTIONS = {
  daily: { label: 'Quotidien', emoji: '🎁', cdSec: config.economy.daily.cooldownHours * 3600, field: 'last_daily' },
  weekly: { label: 'Hebdo', emoji: '📆', cdSec: config.economy.weekly.cooldownHours * 3600, field: 'last_weekly' },
  work: { label: 'Travailler', emoji: '💼', cdSec: config.economy.work.cooldownMin * 60, field: 'last_work' },
  crime: { label: 'Crime', emoji: '🦹', cdSec: config.economy.crime.cooldownMin * 60, field: 'last_crime' },
  fish: { label: 'Pêcher', emoji: '🎣', cdSec: config.games.fishing.cooldownSec, field: 'last_fish' },
  mine: { label: 'Miner', emoji: '⛏️', cdSec: config.games.mining.cooldownSec, field: 'last_mine' },
};

/** État de disponibilité de chaque action pour un utilisateur. */
export function readyStatus(user) {
  const out = {};
  for (const [key, a] of Object.entries(ACTIONS)) {
    const cd = checkCooldown(user[a.field], a.cdSec);
    out[key] = { ready: cd.ok, remaining: cd.remaining, readyAt: cd.readyAt };
  }
  return out;
}

function cdEmbed(remaining, msg) {
  return { ok: false, embed: errorEmbed(`${msg} (encore **${duration(remaining)}**)`) };
}

export async function claimDaily({ member, channel }) {
  const { guild } = member;
  const u = getUser(guild.id, member.id);
  const cd = checkCooldown(u.last_daily, ACTIONS.daily.cdSec);
  if (!cd.ok) return cdEmbed(cd.remaining, 'Récompense quotidienne déjà prise');

  const brokeStreak = u.last_daily > 0 && (nowSec() - u.last_daily) > 48 * 3600;
  const streak = brokeStreak ? 1 : u.daily_streak + 1;
  const bonus = Math.min(config.economy.daily.streakMax, (streak - 1) * config.economy.daily.streakBonus);
  const total = config.economy.daily.amount + bonus;

  updateUser(guild.id, member.id, { last_daily: nowSec(), daily_streak: streak });
  addCoins(guild.id, member.id, total, 'daily');
  trackMission(guild.id, member.id, 'daily_done', 1);
  trackMission(guild.id, member.id, 'earn_coins', total);

  const unlocked = checkAchievements({ guildId: guild.id, userId: member.id, user: getUser(guild.id, member.id), event: 'daily' });
  if (unlocked.length) await announceAchievements(member, unlocked, channel);

  return {
    ok: true,
    embed: baseEmbed(config.colors.success).setTitle('🎁 Récompense quotidienne').setDescription(
      `Tu reçois **${fmt(total)}** ${config.emojis.coin}` + (bonus ? ` (dont **+${fmt(bonus)}** de série)` : '')
      + `\n🔥 Série : **${streak}** jour${streak > 1 ? 's' : ''}` + (brokeStreak ? '\n_(série précédente perdue)_' : ''),
    ),
  };
}

export function claimWeekly({ member }) {
  const { guild } = member;
  const u = getUser(guild.id, member.id);
  const cd = checkCooldown(u.last_weekly, ACTIONS.weekly.cdSec);
  if (!cd.ok) return cdEmbed(cd.remaining, 'Récompense hebdo déjà prise');

  updateUser(guild.id, member.id, { last_weekly: nowSec() });
  addCoins(guild.id, member.id, config.economy.weekly.amount, 'weekly');
  trackMission(guild.id, member.id, 'earn_coins', config.economy.weekly.amount);

  return {
    ok: true,
    embed: baseEmbed(config.colors.success).setTitle('📆 Récompense hebdomadaire')
      .setDescription(`Tu reçois **${fmt(config.economy.weekly.amount)}** ${config.emojis.coin} !`),
  };
}

export function claimWork({ member }) {
  const { guild } = member;
  const u = getUser(guild.id, member.id);
  const cd = checkCooldown(u.last_work, ACTIONS.work.cdSec);
  if (!cd.ok) return cdEmbed(cd.remaining, 'Tu es fatigué');

  const amount = randInt(config.economy.work.min, config.economy.work.max);
  updateUser(guild.id, member.id, { last_work: nowSec() });
  addCoins(guild.id, member.id, amount, 'work');
  trackMission(guild.id, member.id, 'work', 1);
  trackMission(guild.id, member.id, 'earn_coins', amount);

  const msg = pick(config.economy.work.messages)
    .replaceAll('{amount}', fmt(amount)).replaceAll('{coin}', config.emojis.coin)
    .replaceAll('{user}', member.displayName);
  return { ok: true, embed: baseEmbed(config.colors.success).setTitle('💼 Travail').setDescription(msg) };
}

export function claimCrime({ member }) {
  const { guild } = member;
  const c = config.economy.crime;
  const u = getUser(guild.id, member.id);
  const cd = checkCooldown(u.last_crime, ACTIONS.crime.cdSec);
  if (!cd.ok) return cdEmbed(cd.remaining, 'Ça sent le roussi');
  updateUser(guild.id, member.id, { last_crime: nowSec() });

  if (Math.random() < c.successRate) {
    const amount = randInt(c.min, c.max);
    addCoins(guild.id, member.id, amount, 'crime réussi');
    trackMission(guild.id, member.id, 'earn_coins', amount);
    return {
      ok: true,
      embed: baseEmbed(config.colors.success).setTitle('🦹 Crime réussi')
        .setDescription(pick(c.successMessages).replaceAll('{amount}', fmt(amount)).replaceAll('{coin}', config.emojis.coin)),
    };
  }
  const fine = Math.min(u.coins, randInt(c.fineMin, c.fineMax));
  removeCoins(guild.id, member.id, fine, 'amende crime');
  return {
    ok: true,
    embed: baseEmbed(config.colors.danger).setTitle('🚔 Raté')
      .setDescription(pick(c.failMessages).replaceAll('{amount}', fmt(fine)).replaceAll('{coin}', config.emojis.coin)),
  };
}

function collectLoot({ member }, { field, cdSec, table, verb, title, emoji }) {
  const { guild } = member;
  const u = getUser(guild.id, member.id);
  const cd = checkCooldown(u[field], cdSec);
  if (!cd.ok) return cdEmbed(cd.remaining, `${title} : pas encore`);

  updateUser(guild.id, member.id, { [field]: nowSec() });
  const loot = weighted(table);
  const value = randInt(loot.min, loot.max);
  trackMission(guild.id, member.id, 'fish_mine', 1);
  if (value > 0) {
    addCoins(guild.id, member.id, value, title.toLowerCase());
    trackMission(guild.id, member.id, 'earn_coins', value);
  }
  return {
    ok: true,
    embed: baseEmbed(config.colors.info).setTitle(`${emoji} ${title}`).setDescription(
      `Tu ${verb} ${loot.emoji} **${loot.name}**`
      + (value > 0 ? ` et le revends **${fmt(value)}** ${config.emojis.coin}.` : ' — aucune valeur.'),
    ),
  };
}

export const claimFish = (ctx) => collectLoot(ctx, {
  field: 'last_fish', cdSec: ACTIONS.fish.cdSec, table: FISH_LOOT, verb: 'attrapes', title: 'Pêche', emoji: '🎣',
});
export const claimMine = (ctx) => collectLoot(ctx, {
  field: 'last_mine', cdSec: ACTIONS.mine.cdSec, table: MINE_LOOT, verb: 'extrais', title: 'Mine', emoji: '⛏️',
});

export const CLAIMERS = {
  daily: claimDaily, weekly: claimWeekly, work: claimWork,
  crime: claimCrime, fish: claimFish, mine: claimMine,
};
