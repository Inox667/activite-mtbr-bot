import { SlashCommandBuilder } from 'discord.js';
import { claimWork } from '../../lib/collect.js';

export default {
  data: new SlashCommandBuilder().setName('work').setDescription('Travaille pour gagner des coins'),
  async execute(interaction) {
    const r = claimWork({ member: interaction.member });
    await interaction.reply({ embeds: [r.embed], ephemeral: !r.ok });
  },
};
