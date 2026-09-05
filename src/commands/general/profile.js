import { SlashCommandBuilder } from 'discord.js';
import { getUser, getRank, getAchievements, roleTierForLevel } from '../../database/models.js';
import { levelFromXp, config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, progressBar } from '../../lib/format.js';
import { ACHIEVEMENTS } from '../../lib/achievements.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Fiche complète d\'un membre')
    .addUserOption((o) => o.setName('membre').setDescription('Le membre à afficher')),

  async execute(interaction) {
    const target = interaction.options.getUser('membre') ?? interaction.user;
    const guildId = interaction.guild.id;
    const u = getUser(guildId, target.id);
    const { level, xpIntoLevel, xpNeeded } = levelFromXp(u.xp);
    const tier = roleTierForLevel(guildId, level);
    const achv = getAchievements(guildId, target.id).length;
    const winrate = (u.games_won + u.games_lost) > 0
      ? Math.round((u.games_won / (u.games_won + u.games_lost)) * 100) : 0;

    const embed = baseEmbed(config.colors.primary)
      .setAuthor({ name: `Profil de ${target.username}`, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: '📊 Progression',
          value:
            `Niveau **${fmt(level)}**${u.prestige ? ` · Prestige **★${u.prestige}**` : ''}\n` +
            `${progressBar(xpIntoLevel, xpNeeded)}\n` +
            `XP total : **${fmt(u.xp)}** · Rang #${fmt(getRank(guildId, target.id, 'xp') ?? 0)}\n` +
            (tier ? `Palier : <@&${tier.role_id}>` : '_Aucun rôle de palier_'),
          inline: false,
        },
        {
          name: '🪙 Économie',
          value: `Poche : **${fmt(u.coins)}**\nBanque : **${fmt(u.bank)}**\nGems : **${fmt(u.gems)}** ${config.emojis.gem}`,
          inline: true,
        },
        {
          name: '💬 Activité',
          value: `Messages : **${fmt(u.messages)}**\nVocal : **${fmt(Math.floor(u.voice_minutes / 60))} h**\nSérie /daily : **${u.daily_streak}**`,
          inline: true,
        },
        {
          name: '🎰 Casino',
          value: `V/D : **${u.games_won}** / **${u.games_lost}** (${winrate}%)\nDuels gagnés : **${u.duels_won}**\nPlus gros gain : **${fmt(u.biggest_win)}**\nTotal misé : **${fmt(u.total_gambled)}**`,
          inline: true,
        },
        {
          name: '🏅 Succès',
          value: `**${achv}** / ${ACHIEVEMENTS.length} débloqués`,
          inline: true,
        },
      )
      .setFooter({ text: `Membre depuis` })
      .setTimestamp(u.created_at * 1000);

    await interaction.reply({ embeds: [embed] });
  },
};
