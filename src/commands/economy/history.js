import { SlashCommandBuilder } from 'discord.js';
import { getEconomyLog } from '../../database/models.js';
import { config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, relTs } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('historique')
    .setDescription('Tes 15 derniers mouvements de coins'),

  async execute(interaction) {
    const rows = getEconomyLog(interaction.guild.id, interaction.user.id, 15);
    if (!rows.length) {
      return interaction.reply({ content: 'Aucun mouvement enregistré.', ephemeral: true });
    }
    const lines = rows.map((r) => {
      const sign = r.amount >= 0 ? '🟢 +' : '🔴 ';
      const cur = r.currency === 'gems' ? config.emojis.gem : config.emojis.coin;
      return `${sign}${fmt(r.amount)} ${cur} · ${r.reason} · ${relTs(r.ts)}`;
    });
    const embed = baseEmbed(config.colors.coins)
      .setTitle('📒 Historique')
      .setDescription(lines.join('\n'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
