import { SlashCommandBuilder } from 'discord.js';
import { config, totalXpForLevel } from '../../config.js';
import { getLevelRoles, getUser } from '../../database/models.js';
import { levelFromXp } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('niveaux')
    .setDescription('Liste les rôles de palier et le niveau requis'),

  async execute(interaction) {
    const configured = new Map(getLevelRoles(interaction.guild.id).map((r) => [r.level, r.role_id]));
    const me = getUser(interaction.guild.id, interaction.user.id);
    const myLevel = levelFromXp(me.xp).level;

    const lines = config.levelRoles.map((r) => {
      const roleId = configured.get(r.level);
      const roleTxt = roleId ? `<@&${roleId}>` : `**${r.name}** _(non lié — /setup roles)_`;
      const reached = myLevel >= r.level ? '✅' : '🔒';
      const xpReq = fmt(totalXpForLevel(r.level));
      return `${reached} **Niv. ${r.level}** — ${roleTxt} · ${xpReq} XP`;
    });

    const embed = baseEmbed(config.colors.xp)
      .setTitle('📊 Rôles de palier')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Tu es niveau ${myLevel}. Rôle unique : l'ancien palier est retiré au passage du suivant.` });
    await interaction.reply({ embeds: [embed] });
  },
};
