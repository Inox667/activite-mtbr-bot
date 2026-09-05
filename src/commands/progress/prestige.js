import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import { config } from '../../config.js';
import { getUser, doPrestige } from '../../database/models.js';
import { syncLevelRoles } from '../../lib/leveling.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt, pct } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('prestige')
    .setDescription('Recommence au niveau 0 contre un bonus d\'XP permanent'),

  async execute(interaction) {
    const { guild, member } = interaction;
    const u = getUser(guild.id, member.id);
    const P = config.prestige;

    if (u.prestige >= P.maxStars) {
      return interaction.reply({ embeds: [errorEmbed(`Tu es déjà au prestige maximum (★${P.maxStars}).`)], ephemeral: true });
    }
    if (u.level < P.requiredLevel) {
      return interaction.reply({ embeds: [errorEmbed(`Il faut être **niveau ${P.requiredLevel}** pour passer prestige (tu es niveau ${u.level}).`)], ephemeral: true });
    }

    const nextStars = u.prestige + 1;
    const embed = baseEmbed(config.colors.warning)
      .setTitle('⭐ Passer au prestige ' + `★${nextStars} ?`)
      .setDescription(
        `Ton **niveau et ton XP repartent de 0**.\nTu gardes tes coins, ta banque, ton inventaire et tes succès.\n\n` +
        `**Gains :**\n` +
        `• +${fmt(P.coinReward)} ${config.emojis.coin} et +${fmt(P.gemReward)} ${config.emojis.gem}\n` +
        `• Multiplicateur d'XP permanent : **+${pct(P.xpMultiplierPerStar * nextStars)}**\n` +
        `• Étoile de prestige **★${nextStars}** sur ta carte de rang`,
      );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('yes').setLabel('Confirmer le prestige').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('no').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true, ephemeral: true });
    try {
      const b = await msg.awaitMessageComponent({ componentType: ComponentType.Button, time: 30_000, filter: (i) => i.user.id === member.id });
      if (b.customId === 'no') {
        return b.update({ embeds: [baseEmbed(config.colors.info).setDescription('Prestige annulé.')], components: [] });
      }
      const stars = doPrestige(guild.id, member.id);
      if (!stars) return b.update({ embeds: [errorEmbed('Conditions non remplies.')], components: [] });
      await syncLevelRoles(member, 0);
      await b.update({
        embeds: [baseEmbed(config.colors.success).setTitle('⭐ Prestige !')
          .setDescription(`Félicitations <@${member.id}>, tu passes **prestige ★${stars}** !\n+${fmt(P.coinReward)} ${config.emojis.coin} · +${fmt(P.gemReward)} ${config.emojis.gem} · +${pct(P.xpMultiplierPerStar * stars)} d'XP à vie.`)],
        components: [],
      });
    } catch {
      await interaction.editReply({ components: [] }).catch(() => {});
    }
  },
};
