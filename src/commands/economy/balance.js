import { SlashCommandBuilder } from 'discord.js';
import { getUser, leaderboard } from '../../database/models.js';
import { config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('solde')
    .setDescription('Affiche ton solde (poche + banque)')
    .addUserOption((o) => o.setName('membre').setDescription('Le membre à afficher')),

  async execute(interaction) {
    const target = interaction.options.getUser('membre') ?? interaction.user;
    const u = getUser(interaction.guild.id, target.id);
    const all = leaderboard(interaction.guild.id, 'coins', 10000);
    const rank = all.findIndex((r) => r.user_id === target.id) + 1;

    const embed = baseEmbed(config.colors.coins)
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
      .addFields(
        { name: '👛 Poche', value: `**${fmt(u.coins)}** ${config.emojis.coin}`, inline: true },
        { name: '🏦 Banque', value: `**${fmt(u.bank)}** ${config.emojis.coin}`, inline: true },
        { name: '💰 Total', value: `**${fmt(u.coins + u.bank)}** ${config.emojis.coin}`, inline: true },
        { name: '💎 Gems', value: `**${fmt(u.gems)}** ${config.emojis.gem}`, inline: true },
      )
      .setFooter({ text: rank > 0 ? `Rang fortune : #${rank}` : 'Pas encore classé' });
    await interaction.reply({ embeds: [embed] });
  },
};
