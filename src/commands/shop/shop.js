import { SlashCommandBuilder } from 'discord.js';
import { getShopItems } from '../../database/models.js';
import { config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

const TYPE_LABEL = {
  role: 'Rôle', badge: 'Badge', consumable: 'Consommable', collectible: 'Objet',
};

export default {
  data: new SlashCommandBuilder().setName('boutique').setDescription('Articles en vente sur le serveur'),

  async execute(interaction) {
    const items = getShopItems(interaction.guild.id);
    if (!items.length) {
      return interaction.reply({ content: 'La boutique est vide. Un admin peut la remplir avec `/boutique-admin`.', ephemeral: true });
    }
    const embed = baseEmbed(config.colors.coins).setTitle('🛒 Boutique MTBR');
    for (const it of items) {
      const stock = it.stock === -1 ? '' : ` · stock : ${it.stock}`;
      const cur = it.currency === 'gems' ? config.emojis.gem : config.emojis.coin;
      embed.addFields({
        name: `${it.emoji} ${it.name} — ${fmt(it.price)} ${cur}`,
        value: `${it.description || '_Pas de description_'}\n\`/acheter ${it.item_id}\` · ${TYPE_LABEL[it.type] ?? it.type}${stock}`,
      });
    }
    embed.addFields({ name: '​', value: `${config.emojis.gem} Les **gems** se gagnent via les quêtes hebdo/mensuelles, les gros succès et le podium.` });
    embed.setFooter({ text: `${items.length} article(s)` });
    await interaction.reply({ embeds: [embed] });
  },
};
