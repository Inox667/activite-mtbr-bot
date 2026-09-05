import { SlashCommandBuilder } from 'discord.js';
import { claimWeekly } from '../../lib/collect.js';

export default {
  data: new SlashCommandBuilder().setName('weekly').setDescription('Récupère ta récompense hebdomadaire'),
  async execute(interaction) {
    const r = claimWeekly({ member: interaction.member });
    await interaction.reply({ embeds: [r.embed], ephemeral: !r.ok });
  },
};
