import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getUser, getRank, countMembers, roleTierForLevel } from '../../database/models.js';
import { levelFromXp, config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, progressBar } from '../../lib/format.js';
import { renderRankCard } from '../../lib/rankcard.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Affiche ta carte de rang (ou celle d\'un membre)')
    .addUserOption((o) => o.setName('membre').setDescription('Le membre à afficher')),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('membre') ?? interaction.user;
    if (target.bot) {
      return interaction.editReply('Les bots ne gagnent pas d\'XP 🤖');
    }
    const guildId = interaction.guild.id;
    const u = getUser(guildId, target.id);
    const { level, xpIntoLevel, xpNeeded } = levelFromXp(u.xp);
    const rank = getRank(guildId, target.id, 'xp') ?? 0;
    const members = countMembers(guildId);

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const displayName = member?.displayName ?? target.username;

    const png = await renderRankCard({
      username: displayName,
      avatarURL: target.displayAvatarURL({ extension: 'png', size: 256 }),
      totalXp: u.xp,
      rank,
      memberCount: members,
      prestige: u.prestige,
      messages: u.messages,
    });

    if (png) {
      const file = new AttachmentBuilder(png, { name: 'rank.png' });
      return interaction.editReply({ files: [file] });
    }

    // Fallback texte
    const tier = roleTierForLevel(guildId, level);
    const embed = baseEmbed(config.colors.xp)
      .setAuthor({ name: displayName, iconURL: target.displayAvatarURL() })
      .setTitle(`Niveau ${fmt(level)}${u.prestige ? ` · ★${u.prestige}` : ''}`)
      .setDescription(
        `**Rang :** #${fmt(rank)} / ${fmt(members)}\n` +
        `**XP :** ${fmt(xpIntoLevel)} / ${fmt(xpNeeded)} (total ${fmt(u.xp)})\n` +
        progressBar(xpIntoLevel, xpNeeded) + '\n' +
        `**Messages :** ${fmt(u.messages)} · **Vocal :** ${fmt(Math.floor(u.voice_minutes / 60))} h` +
        (tier ? `\n**Palier :** <@&${tier.role_id}>` : '')
      );
    return interaction.editReply({ embeds: [embed] });
  },
};
