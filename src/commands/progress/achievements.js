import { SlashCommandBuilder } from 'discord.js';
import { getAchievements } from '../../database/models.js';
import { ACHIEVEMENTS } from '../../lib/achievements.js';
import { config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, relTs } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('succès')
    .setDescription('Liste des succès et lesquels sont débloqués')
    .addUserOption((o) => o.setName('membre').setDescription('Le membre')),

  async execute(interaction) {
    const target = interaction.options.getUser('membre') ?? interaction.user;
    const unlocked = new Map(getAchievements(interaction.guild.id, target.id).map((a) => [a.achievement_id, a.unlocked_at]));

    const lines = ACHIEVEMENTS.map((a) => {
      if (unlocked.has(a.id)) {
        return `${a.emoji} **${a.name}** — ${a.description} _(débloqué ${relTs(unlocked.get(a.id))})_`;
      }
      return `🔒 **${a.name}** — ${a.description}` + (a.reward ? ` _(${fmt(a.reward)} ${config.emojis.coin})_` : '');
    });

    const embed = baseEmbed(config.colors.success)
      .setAuthor({ name: `Succès de ${target.username}`, iconURL: target.displayAvatarURL() })
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${unlocked.size} / ${ACHIEVEMENTS.length} débloqués` });
    await interaction.reply({ embeds: [embed] });
  },
};
