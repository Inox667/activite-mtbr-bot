import { SlashCommandBuilder } from 'discord.js';
import { getInventory, getShopItem } from '../../database/models.js';
import { config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('inventaire')
    .setDescription('Affiche l\'inventaire d\'un membre')
    .addUserOption((o) => o.setName('membre').setDescription('Le membre')),

  async execute(interaction) {
    const target = interaction.options.getUser('membre') ?? interaction.user;
    const inv = getInventory(interaction.guild.id, target.id);
    if (!inv.length) {
      return interaction.reply({ content: `${target.id === interaction.user.id ? 'Ton' : 'Cet'} inventaire est vide.`, ephemeral: true });
    }
    const lines = inv.map((row) => {
      const meta = getShopItem(interaction.guild.id, row.item_id);
      const name = row.data?.name ?? meta?.name ?? row.item_id;
      const emoji = row.data?.emoji ?? meta?.emoji ?? '📦';
      let suffix = '';
      if (meta?.type === 'consumable') suffix = ` — \`/utiliser ${row.item_id}\``;
      else if (row.data?.value) suffix = ` — revente ${row.data.value} 🪙 (\`/vendre\`)`;
      return `${emoji} **${name}** ×${row.qty}${suffix}`;
    });
    const embed = baseEmbed(config.colors.info)
      .setAuthor({ name: `Inventaire de ${target.username}`, iconURL: target.displayAvatarURL() })
      .setDescription(lines.join('\n'));
    await interaction.reply({ embeds: [embed] });
  },
};
