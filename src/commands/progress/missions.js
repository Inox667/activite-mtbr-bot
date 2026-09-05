import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import { config } from '../../config.js';
import { questFields, claimAllQuests } from '../../lib/quests.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

function view(guildId, userId) {
  const { fields, claimable } = questFields(guildId, userId);
  const embed = baseEmbed(config.colors.primary)
    .setTitle('📋 Quêtes')
    .addFields(fields)
    .setFooter({ text: 'Réclame tes récompenses avant le reset !' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('claim_all').setLabel('🎁 Tout récupérer').setStyle(ButtonStyle.Success).setDisabled(!claimable),
    new ButtonBuilder().setCustomId('refresh').setLabel('🔄 Actualiser').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

export default {
  data: new SlashCommandBuilder()
    .setName('quetes')
    .setDescription('Tes quêtes journalières, hebdomadaires et mensuelles'),

  async execute(interaction) {
    const { guild, user, member } = interaction;
    const msg = await interaction.reply({ ...view(guild.id, user.id), fetchReply: true });

    const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });
    col.on('collect', async (btn) => {
      if (btn.user.id !== user.id) return btn.reply({ content: 'Ce ne sont pas tes quêtes.', ephemeral: true });
      if (btn.customId === 'claim_all') {
        const r = await claimAllQuests({ member, channel: interaction.channel });
        await btn.update(view(guild.id, user.id));
        const parts = [`+${fmt(r.xp)} XP`, `+${fmt(r.coins)} ${config.emojis.coin}`];
        if (r.gems) parts.push(`+${fmt(r.gems)} ${config.emojis.gem}`);
        return interaction.followUp({
          content: r.count ? `🎁 ${r.count} récompense(s) : **${parts.join(' · ')}**` : 'Rien à récupérer.',
          ephemeral: true,
        });
      }
      await btn.update(view(guild.id, user.id));
    });
    col.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
