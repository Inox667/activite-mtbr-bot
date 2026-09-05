import { SlashCommandBuilder } from 'discord.js';
import { claimMine } from '../../lib/collect.js';

export default {
  data: new SlashCommandBuilder().setName('mine').setDescription('Descends à la mine chercher des minerais'),
  async execute(interaction) {
    const r = claimMine({ member: interaction.member });
    await interaction.reply({ embeds: [r.embed], ephemeral: !r.ok });
  },
};
