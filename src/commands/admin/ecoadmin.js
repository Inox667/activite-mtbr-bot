import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../../config.js';
import {
  getUser, updateUser, addCoins, removeCoins, addGems, removeGems,
} from '../../database/models.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

const money = (o) => o.setName('monnaie').setDescription('coins (défaut) ou gems')
  .addChoices({ name: 'Coins 🪙', value: 'coins' }, { name: 'Gems 💎', value: 'gems' });

export default {
  data: new SlashCommandBuilder()
    .setName('eco-admin')
    .setDescription('Gérer les coins et gems des membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('donner').setDescription('Ajoute de la monnaie')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('Montant à ajouter').setRequired(true).setMinValue(1))
      .addStringOption(money))
    .addSubcommand((s) => s.setName('retirer').setDescription('Retire de la monnaie')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('Montant à retirer').setRequired(true).setMinValue(1))
      .addStringOption(money))
    .addSubcommand((s) => s.setName('definir').setDescription('Fixe le solde en poche (coins) ou les gems')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('Nouvelle valeur').setRequired(true).setMinValue(0))
      .addStringOption(money))
    .addSubcommand((s) => s.setName('reset').setDescription('Remet poche + banque + gems à zéro')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('membre');
    if (target.bot) return interaction.reply({ embeds: [errorEmbed('Les bots n\'ont pas de monnaie.')], ephemeral: true });
    const guildId = interaction.guild.id;
    const amount = interaction.options.getInteger('montant');
    const cur = interaction.options.getString('monnaie') ?? 'coins';
    const isGem = cur === 'gems';

    if (sub === 'donner') {
      isGem ? addGems(guildId, target.id, amount, `admin:${interaction.user.id}`)
        : addCoins(guildId, target.id, amount, `admin:${interaction.user.id}`);
    } else if (sub === 'retirer') {
      const u = getUser(guildId, target.id);
      const max = isGem ? u.gems : u.coins;
      isGem ? removeGems(guildId, target.id, Math.min(amount, max), `admin:${interaction.user.id}`)
        : removeCoins(guildId, target.id, Math.min(amount, max), `admin:${interaction.user.id}`);
    } else if (sub === 'definir') {
      updateUser(guildId, target.id, isGem ? { gems: amount } : { coins: amount });
    } else {
      updateUser(guildId, target.id, { coins: 0, bank: 0, gems: 0 });
    }

    const after = getUser(guildId, target.id);
    await interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(
      `Opération **${sub}** (${cur}) sur <@${target.id}>.\n` +
      `Poche : **${fmt(after.coins)}** ${config.emojis.coin} · Banque : **${fmt(after.bank)}** · Gems : **${fmt(after.gems)}** ${config.emojis.gem}`)] });
  },
};
