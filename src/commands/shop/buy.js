import { SlashCommandBuilder } from 'discord.js';
import {
  getShopItem, getShopItems, getUser, removeCoins, removeGems, addItem, decrementStock,
} from '../../database/models.js';
import { config } from '../../config.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';
import { trackMission } from '../../lib/missions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('acheter')
    .setDescription('Achète un article de la boutique')
    .addStringOption((o) => o.setName('article').setDescription('Identifiant de l\'article').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const items = getShopItems(interaction.guild.id)
      .filter((i) => i.item_id.includes(focused) || i.name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(items.map((i) => ({ name: `${i.name} (${fmt(i.price)} ${i.currency === 'gems' ? '💎' : '🪙'})`, value: i.item_id })));
  },

  async execute(interaction) {
    const { guild, member } = interaction;
    const id = interaction.options.getString('article');
    const item = getShopItem(guild.id, id);
    if (!item || !item.enabled) return interaction.reply({ embeds: [errorEmbed('Article introuvable.')], ephemeral: true });
    if (item.stock === 0) return interaction.reply({ embeds: [errorEmbed('Article en rupture de stock.')], ephemeral: true });

    const isGem = item.currency === 'gems';
    const curEmoji = isGem ? config.emojis.gem : config.emojis.coin;
    const u = getUser(guild.id, member.id);
    const balance = isGem ? u.gems : u.coins;
    if (balance < item.price) {
      return interaction.reply({ embeds: [errorEmbed(`Il te manque **${fmt(item.price - balance)}** ${curEmoji}.`)], ephemeral: true });
    }

    const pay = () => {
      const ok = isGem
        ? removeGems(guild.id, member.id, item.price, `achat ${item.item_id}`)
        : removeCoins(guild.id, member.id, item.price, `achat ${item.item_id}`);
      if (ok && !isGem) trackMission(guild.id, member.id, 'spend_coins', item.price);
      return ok;
    };

    // Rôle : attribution immédiate, pas de stockage inventaire
    if (item.type === 'role') {
      const roleId = item.data.role_id;
      if (!roleId || !guild.roles.cache.has(roleId)) {
        return interaction.reply({ embeds: [errorEmbed('Le rôle lié à cet article n\'existe plus.')], ephemeral: true });
      }
      if (member.roles.cache.has(roleId)) {
        return interaction.reply({ embeds: [errorEmbed('Tu as déjà ce rôle.')], ephemeral: true });
      }
      try {
        await member.roles.add(roleId, 'Achat boutique');
      } catch {
        return interaction.reply({ embeds: [errorEmbed('Je n\'ai pas pu attribuer le rôle (permissions / hiérarchie).')], ephemeral: true });
      }
      if (!pay()) return interaction.reply({ embeds: [errorEmbed('Paiement impossible.')], ephemeral: true });
      decrementStock(guild.id, item.item_id);
      return interaction.reply({ embeds: [baseEmbed(config.colors.success)
        .setDescription(`${item.emoji} Tu as acheté **${item.name}** et reçu le rôle <@&${roleId}> !`)] });
    }

    // Autres types : inventaire
    if (!pay()) return interaction.reply({ embeds: [errorEmbed('Paiement impossible.')], ephemeral: true });
    decrementStock(guild.id, item.item_id);
    addItem(guild.id, member.id, item.item_id, 1, item.data);

    await interaction.reply({ embeds: [baseEmbed(config.colors.success)
      .setDescription(`${item.emoji} Tu as acheté **${item.name}** pour **${fmt(item.price)}** ${curEmoji}.` +
        (item.type === 'consumable' ? `\nUtilise-le avec \`/utiliser ${item.item_id}\`.` : ''))] });
  },
};
