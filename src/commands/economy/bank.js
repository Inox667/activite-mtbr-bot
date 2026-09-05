import { SlashCommandBuilder } from 'discord.js';
import { getUser, deposit, withdraw } from '../../database/models.js';
import { config } from '../../config.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt, parseAmount } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('banque')
    .setDescription('Déposer ou retirer des coins de ta banque')
    .addSubcommand((s) => s.setName('déposer').setDescription('Mettre des coins à l\'abri')
      .addStringOption((o) => o.setName('montant').setDescription('Ex : 500, all, half').setRequired(true)))
    .addSubcommand((s) => s.setName('retirer').setDescription('Récupérer des coins de la banque')
      .addStringOption((o) => o.setName('montant').setDescription('Ex : 500, all, half').setRequired(true))),

  async execute(interaction) {
    const { guild, user } = interaction;
    const sub = interaction.options.getSubcommand();
    const u = getUser(guild.id, user.id);
    const raw = interaction.options.getString('montant');

    if (sub === 'déposer') {
      const amount = parseAmount(raw, u.coins);
      if (amount == null || amount <= 0) return interaction.reply({ embeds: [errorEmbed('Montant invalide.')], ephemeral: true });
      const done = deposit(guild.id, user.id, amount >= u.coins ? 'all' : amount);
      if (!done) return interaction.reply({ embeds: [errorEmbed('Rien à déposer.')], ephemeral: true });
      const after = getUser(guild.id, user.id);
      return interaction.reply({ embeds: [baseEmbed(config.colors.info).setDescription(
        `🏦 Déposé **${fmt(done)}** ${config.emojis.coin}.\nPoche : **${fmt(after.coins)}** · Banque : **${fmt(after.bank)}**`)] });
    }

    const amount = parseAmount(raw, u.bank);
    if (amount == null || amount <= 0) return interaction.reply({ embeds: [errorEmbed('Montant invalide.')], ephemeral: true });
    const done = withdraw(guild.id, user.id, amount >= u.bank ? 'all' : amount);
    if (!done) return interaction.reply({ embeds: [errorEmbed('Rien à retirer.')], ephemeral: true });
    const after = getUser(guild.id, user.id);
    return interaction.reply({ embeds: [baseEmbed(config.colors.info).setDescription(
      `🏦 Retiré **${fmt(done)}** ${config.emojis.coin}.\nPoche : **${fmt(after.coins)}** · Banque : **${fmt(after.bank)}**`)] });
  },
};
