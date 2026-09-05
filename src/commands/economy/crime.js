import { SlashCommandBuilder } from 'discord.js';
import { claimCrime } from '../../lib/collect.js';

export default {
  data: new SlashCommandBuilder().setName('crime').setDescription('Tente un coup risqué pour gagner gros'),
  async execute(interaction) {
    const r = claimCrime({ member: interaction.member });
    await interaction.reply({ embeds: [r.embed], ephemeral: !r.ok });
  },
};
