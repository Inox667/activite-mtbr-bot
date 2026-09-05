import { SlashCommandBuilder } from 'discord.js';
import {
  getInventory, getShopItem, removeItem, addCoins,
} from '../../database/models.js';
import { config } from '../../config.js';
import { grantXp } from '../../lib/leveling.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt, randInt } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('utiliser')
    .setDescription('Utilise un objet consommable de ton inventaire')
    .addStringOption((o) => o.setName('objet').setDescription('Identifiant de l\'objet').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const inv = getInventory(interaction.guild.id, interaction.user.id);
    const opts = inv
      .map((row) => ({ row, meta: getShopItem(interaction.guild.id, row.item_id) }))
      .filter(({ meta }) => meta?.type === 'consumable')
      .filter(({ row, meta }) => row.item_id.includes(focused) || (meta?.name ?? '').toLowerCase().includes(focused))
      .slice(0, 25)
      .map(({ row, meta }) => ({ name: `${meta?.name ?? row.item_id} ×${row.qty}`, value: row.item_id }));
    await interaction.respond(opts);
  },

  async execute(interaction) {
    const { guild, member } = interaction;
    const id = interaction.options.getString('objet');
    const meta = getShopItem(guild.id, id);
    const inv = getInventory(guild.id, member.id);
    const owned = inv.find((r) => r.item_id === id);

    if (!owned) return interaction.reply({ embeds: [errorEmbed('Tu ne possèdes pas cet objet.')], ephemeral: true });
    if (meta?.type !== 'consumable') return interaction.reply({ embeds: [errorEmbed('Cet objet ne s\'utilise pas.')], ephemeral: true });

    const effect = meta.data?.effect;
    const value = Number(meta.data?.value ?? 0);
    let resultText;

    if (effect === 'coins') {
      addCoins(guild.id, member.id, value, `objet ${id}`);
      resultText = `Tu reçois **${fmt(value)}** ${config.emojis.coin}.`;
    } else if (effect === 'xp') {
      await grantXp(member, value, { channel: interaction.channel, source: 'objet', weekly: false });
      resultText = `Tu gagnes **${fmt(value)}** ${config.emojis.xp} XP.`;
    } else if (effect === 'lootbox') {
      const roll = randInt(1, 100);
      let reward;
      if (roll <= 60) reward = randInt(200, 800);
      else if (roll <= 90) reward = randInt(800, 2500);
      else reward = randInt(2500, 10000);
      addCoins(guild.id, member.id, reward, `lootbox ${id}`);
      resultText = `🎁 La caisse contenait **${fmt(reward)}** ${config.emojis.coin} !`;
    } else {
      return interaction.reply({ embeds: [errorEmbed('Cet objet n\'a pas d\'effet configuré.')], ephemeral: true });
    }

    removeItem(guild.id, member.id, id, 1);
    await interaction.reply({ embeds: [baseEmbed(config.colors.success).setTitle(`${meta.emoji} ${meta.name}`).setDescription(resultText)] });
  },
};
