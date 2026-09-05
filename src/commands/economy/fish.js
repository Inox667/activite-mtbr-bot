import { SlashCommandBuilder } from 'discord.js';
import { claimFish } from '../../lib/collect.js';

export default {
  data: new SlashCommandBuilder().setName('pêche').setDescription('Va pêcher et revends ta prise'),
  async execute(interaction) {
    const r = claimFish({ member: interaction.member });
    await interaction.reply({ embeds: [r.embed], ephemeral: !r.ok });
  },
};
