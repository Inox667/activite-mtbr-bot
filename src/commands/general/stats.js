import { SlashCommandBuilder } from 'discord.js';
import {
  getUser, getRank, activitySince, countMembers, roleTierForLevel, effectiveXpMultiplier, getGuildConfig,
} from '../../database/models.js';
import { memberXpBonus } from '../../lib/xpBonus.js';
import { levelFromXp, config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, progressBar } from '../../lib/format.js';

function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Tes statistiques détaillées (ou celles d\'un membre)')
    .addUserOption((o) => o.setName('membre').setDescription('Le membre à afficher')),

  async execute(interaction) {
    const target = interaction.options.getUser('membre') ?? interaction.user;
    if (target.bot) return interaction.reply({ content: 'Les bots n\'ont pas de stats.', ephemeral: true });

    const guildId = interaction.guild.id;
    const u = getUser(guildId, target.id);
    const { level, xpIntoLevel, xpNeeded } = levelFromXp(u.xp);
    const members = countMembers(guildId);
    const tier = roleTierForLevel(guildId, level);

    const today = activitySince(guildId, target.id, dayOffset(0));
    const week = activitySince(guildId, target.id, dayOffset(6));
    const month = activitySince(guildId, target.id, monthStart());

    const rXp = getRank(guildId, target.id, 'xp') ?? '—';
    const rMsg = getRank(guildId, target.id, 'messages') ?? '—';
    const rVoice = getRank(guildId, target.id, 'voice') ?? '—';
    const rCoins = getRank(guildId, target.id, 'coins') ?? '—';

    const gc = getGuildConfig(guildId);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const persoBonus = member ? memberXpBonus(member, gc) : { multiplier: 1, reasons: [] };
    const mult = effectiveXpMultiplier(guildId)
      * (1 + u.prestige * config.prestige.xpMultiplierPerStar)
      * persoBonus.multiplier;
    const vh = (m) => `${Math.floor(m / 60)} h ${m % 60} min`;

    const embed = baseEmbed(config.colors.xp)
      .setAuthor({ name: `Statistiques de ${target.username}`, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .setDescription(
        `**Niveau ${fmt(level)}**${u.prestige ? ` · Prestige ★${u.prestige}` : ''} — multiplicateur d'XP **×${mult.toFixed(2)}**\n` +
        `${progressBar(xpIntoLevel, xpNeeded)}\n` +
        `${fmt(xpIntoLevel)} / ${fmt(xpNeeded)} XP · total **${fmt(u.xp)}** XP`,
      )
      .addFields(
        {
          name: '🏆 Rangs serveur',
          value: `XP : **#${fmt(rXp)}**/${fmt(members)}\nMessages : **#${fmt(rMsg)}**\nVocal : **#${fmt(rVoice)}**\nFortune : **#${fmt(rCoins)}**`,
          inline: true,
        },
        {
          name: '🪙 Portefeuille',
          value: `Poche : **${fmt(u.coins)}**\nBanque : **${fmt(u.bank)}**\nTotal : **${fmt(u.coins + u.bank)}** ${config.emojis.coin}\nGems : **${fmt(u.gems)}** ${config.emojis.gem}`,
          inline: true,
        },
        {
          name: '🎰 Casino',
          value: `V/D : **${u.games_won}**/**${u.games_lost}**\nDuels gagnés : **${u.duels_won}**\nPlus gros gain : **${fmt(u.biggest_win)}**`,
          inline: true,
        },
        {
          name: '💬 Messages',
          value: `Aujourd'hui : **${fmt(today.messages)}**\n7 jours : **${fmt(week.messages)}**\nCe mois : **${fmt(month.messages)}**\nTotal : **${fmt(u.messages)}**`,
          inline: true,
        },
        {
          name: '🎙️ Vocal',
          value: `Aujourd'hui : **${vh(today.voice_minutes)}**\n7 jours : **${vh(week.voice_minutes)}**\nCe mois : **${vh(month.voice_minutes)}**\nTotal : **${vh(u.voice_minutes)}**`,
          inline: true,
        },
        {
          name: '✨ XP gagnée',
          value: `Aujourd'hui : **${fmt(today.xp)}**\n7 jours : **${fmt(week.xp)}**\nCe mois : **${fmt(month.xp)}**`,
          inline: true,
        },
      )
      .setFooter({ text: tier ? `Rôle de palier : ${interaction.guild.roles.cache.get(tier.role_id)?.name ?? '—'}` : 'Aucun rôle de palier' })
      .setTimestamp(u.created_at * 1000);

    if (persoBonus.reasons.length) {
      embed.addFields({ name: '✨ Bonus d\'XP perso', value: persoBonus.reasons.map((r) => `${r.label} : +${Math.round(r.pct * 100)} %`).join('\n'), inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
