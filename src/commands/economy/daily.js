import { SlashCommandBuilder } from 'discord.js';
import { claimDaily } from '../../lib/collect.js';

export default {
  data: new SlashCommandBuilder().setName('daily').setDescription('Récupère ta récompense quotidienne'),
  async execute(interaction) {
    const r = await claimDaily({ member: interaction.member, channel: interaction.channel });
    await interaction.reply({ embeds: [r.embed], ephemeral: !r.ok });
  },
};
