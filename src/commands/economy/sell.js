import { SlashCommandBuilder } from 'discord.js';
import {
  getInventory, getShopItem, removeItem, addCoins,
} from '../../database/models.js';
import { config } from '../../config.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

function sellableEntries(guildId, userId) {
  return getInventory(guildId, userId)
    .map((row) => {
      const meta = getShopItem(guildId, row.item_id);
      const value = row.data?.value ?? 0;
      const name = row.data?.name ?? meta?.name ?? row.item_id;
      const emoji = row.data?.emoji ?? meta?.emoji ?? '📦';
      const sellable = (row.data?.sellable || row.data?.value) && !meta; // objets hors-boutique avec valeur
      return { row, name, emoji, value, sellable };
    })
    .filter((e) => e.sellable && e.value > 0);
}

export default {
  data: new SlashCommandBuilder()
    .setName('vendre')
    .setDescription('Revends un objet de ton inventaire (gagné en caisse) contre des coins')
    .addStringOption((o) => o.setName('objet').setDescription('L\'objet à vendre').setRequired(true).setAutocomplete(true))
    .addIntegerOption((o) => o.setName('quantite').setDescription('Combien (défaut : 1)').setMinValue(1)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const opts = sellableEntries(interaction.guild.id, interaction.user.id)
      .filter((e) => e.row.item_id.includes(focused) || e.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((e) => ({ name: `${e.name} ×${e.row.qty} — ${fmt(e.value)} 🪙/u`, value: e.row.item_id }));
    await interaction.respond(opts);
  },

  async execute(interaction) {
    const { guild, user } = interaction;
    const id = interaction.options.getString('objet');
    const qty = interaction.options.getInteger('quantite') ?? 1;

    const entry = sellableEntries(guild.id, user.id).find((e) => e.row.item_id === id);
    if (!entry) return interaction.reply({ embeds: [errorEmbed('Objet introuvable ou invendable.')], ephemeral: true });
    if (entry.row.qty < qty) return interaction.reply({ embeds: [errorEmbed(`Tu n'en as que ${entry.row.qty}.`)], ephemeral: true });

    const total = entry.value * qty;
    removeItem(guild.id, user.id, id, qty);
    addCoins(guild.id, user.id, total, `vente ${id} x${qty}`);

    await interaction.reply({
      embeds: [baseEmbed(config.colors.success).setDescription(
        `Tu as vendu ${entry.emoji} **${entry.name}** ×${qty} pour **${fmt(total)}** ${config.emojis.coin}.`,
      )],
    });
  },
};
