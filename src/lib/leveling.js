// ==========================================================================
//  Attribution d'XP, gestion du level-up, synchro des rôles de palier,
//  annonces, et déclenchement des succès/missions liés.
// ==========================================================================
import { config, levelFromXp } from '../config.js';
import {
  addXp, getUser, getGuildConfig, getLevelRoles, roleTierForLevel,
} from '../database/models.js';
import { checkAchievements } from './achievements.js';
import { trackMission } from './missions.js';
import { baseEmbed } from './embeds.js';
import { fmt } from './format.js';
import { renderLevelUpCard } from './rankcard.js';
import { AttachmentBuilder } from 'discord.js';

/**
 * Synchronise les rôles de palier d'un membre pour un niveau donné.
 * Politique : rôle UNIQUE. On ajoute le palier courant et on retire tous
 * les autres rôles de palier gérés par le bot.
 * @returns {{added:?string, removed:string[]}}
 */
export async function syncLevelRoles(member, level) {
  const tiers = getLevelRoles(member.guild.id);
  if (tiers.length === 0) return { added: null, removed: [] };

  const target = roleTierForLevel(member.guild.id, level); // { level, role_id } | null
  const managedRoleIds = new Set(tiers.map((t) => t.role_id));

  const toRemove = [];
  for (const roleId of managedRoleIds) {
    if (roleId !== target?.role_id && member.roles.cache.has(roleId)) toRemove.push(roleId);
  }

  let added = null;
  try {
    if (target && !member.roles.cache.has(target.role_id)) {
      await member.roles.add(target.role_id, `Palier niveau ${level}`);
      added = target.role_id;
    }
    if (toRemove.length) {
      await member.roles.remove(toRemove, `Changement de palier (niveau ${level})`);
    }
  } catch (err) {
    console.warn(`[leveling] synchro rôles impossible pour ${member.id}:`, err.message);
  }
  return { added, removed: toRemove };
}

/**
 * Donne de l'XP à un membre et gère toutes les conséquences.
 * @param {import('discord.js').GuildMember} member
 * @param {number} amount  XP brute (avant multiplicateurs si applyMultiplier)
 * @param {object} opts
 * @param {import('discord.js').TextBasedChannel} [opts.channel] salon d'origine (pour annonce "current")
 * @param {boolean} [opts.weekly=true] compter dans le classement hebdo
 * @param {string}  [opts.source='divers']
 * @param {boolean} [opts.silent=false] ne pas annoncer le level-up
 */
export async function grantXp(member, amount, opts = {}) {
  const { channel = null, weekly = true, source = 'divers', silent = false } = opts;
  const guildId = member.guild.id;
  const userId = member.id;
  if (!amount) return { leveledUp: false };

  // Bonus d'XP permanent lié au prestige (par étoile).
  if (amount > 0) {
    const stars = getUser(guildId, userId).prestige;
    if (stars > 0) amount *= 1 + stars * config.prestige.xpMultiplierPerStar;
  }

  const gained = Math.round(amount);
  const res = addXp(guildId, userId, gained, { weekly });

  if (amount > 0) trackMission(guildId, userId, 'earn_xp', gained);

  if (res.leveledUp) {
    await syncLevelRoles(member, res.newLevel);
    if (!silent) await announceLevelUp(member, res.oldLevel, res.newLevel, channel);
  }

  // Succès (niveau, richesse via récompenses, etc.)
  const user = getUser(guildId, userId);
  const unlocked = checkAchievements({ guildId, userId, user, event: 'xp', payload: { amount, source } });
  if (unlocked.length) await announceAchievements(member, unlocked, channel);

  return { ...res, gained, achievements: unlocked };
}

async function announceLevelUp(member, oldLevel, level, originChannel) {
  const g = getGuildConfig(member.guild.id);
  if (g.levelup_mode === 'off') return;

  const text = (g.levelup_message || 'Félicitations {user}, tu passes **niveau {level}** ! {emoji}')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.displayName)
    .replaceAll('{level}', fmt(level))
    .replaceAll('{emoji}', config.emojis.up);

  const tier = roleTierForLevel(member.guild.id, level);
  const newRole = tier?.role_id && tier.level === level ? tier.role_id : null;

  // Carte image (si canvas dispo), sinon embed.
  let files = [];
  let embed = null;
  const png = await renderLevelUpCard({
    username: member.displayName,
    avatarURL: member.displayAvatarURL({ extension: 'png', size: 256 }),
    oldLevel,
    newLevel: level,
    roleName: newRole ? member.guild.roles.cache.get(newRole)?.name : null,
  }).catch(() => null);

  if (png) {
    files = [new AttachmentBuilder(png, { name: 'levelup.png' })];
  } else {
    embed = baseEmbed(config.colors.xp)
      .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
      .setTitle('⬆️ LEVEL UP !')
      .setDescription(`Niveau **${oldLevel}** → **${level}**`);
    if (newRole) embed.addFields({ name: 'Nouveau rôle', value: `<@&${newRole}>`, inline: true });
  }

  const payload = { content: text, allowedMentions: { users: [member.id] } };
  if (files.length) payload.files = files;
  if (embed) payload.embeds = [embed];

  try {
    if (g.levelup_mode === 'dm') {
      await member.send(files.length ? { files } : { embeds: [embed] });
    } else if (g.levelup_mode === 'current' && originChannel) {
      await originChannel.send(payload);
    } else {
      const chId = g.levelup_channel_id;
      const ch = chId ? member.guild.channels.cache.get(chId) : originChannel;
      if (ch?.isTextBased()) await ch.send(payload);
    }
  } catch (err) {
    console.warn('[leveling] annonce level-up impossible:', err.message);
  }
}

export async function announceAchievements(member, achievements, originChannel) {
  const g = getGuildConfig(member.guild.id);
  const chId = g.announce_channel_id || g.levelup_channel_id;
  const ch = (chId && member.guild.channels.cache.get(chId)) || originChannel;
  if (!ch?.isTextBased?.()) return;

  for (const a of achievements) {
    const rewards = [];
    if (a.reward) rewards.push(`${fmt(a.reward)} ${config.emojis.coin}`);
    if (a.gems) rewards.push(`${fmt(a.gems)} ${config.emojis.gem}`);
    const embed = baseEmbed(config.colors.success)
      .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
      .setTitle(`${a.emoji} Succès débloqué : ${a.name}`)
      .setDescription(a.description + (rewards.length ? `\n\n**Récompense :** ${rewards.join(' · ')}` : ''));
    try { await ch.send({ content: `<@${member.id}>`, embeds: [embed] }); } catch { /* ignore */ }
  }
}

/** Utilitaire : niveau courant d'un utilisateur à partir de la base. */
export function currentLevel(guildId, userId) {
  return levelFromXp(getUser(guildId, userId).xp).level;
}
