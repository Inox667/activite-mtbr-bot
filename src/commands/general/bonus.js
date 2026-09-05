import { SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, effectiveXpMultiplier, getUser } from '../../database/models.js';
import { memberXpBonus, isBooster, wearsServerTag, promotesServer } from '../../lib/xpBonus.js';
import { config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { pct } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bonus')
    .setDescription('Tes bonus d\'XP actifs et ceux que tu peux débloquer'),

  async execute(interaction) {
    const g = getGuildConfig(interaction.guild.id);
    const member = interaction.member;
    const u = getUser(interaction.guild.id, member.id);

    const { multiplier, reasons } = memberXpBonus(member, g);
    const serverMult = effectiveXpMultiplier(interaction.guild.id);
    const prestigeMult = 1 + u.prestige * config.prestige.xpMultiplierPerStar;
    const total = serverMult * prestigeMult * multiplier;

    const rows = [];
    const line = (ok, label, value, help) => rows.push(`${ok ? '✅' : '⬜'} **${label}** — ${value}${ok ? '' : `\n   ↳ ${help}`}`);

    if (g.booster_bonus > 0) {
      line(isBooster(member, g), '🚀 Boost du serveur', `+${pct(g.booster_bonus)} d'XP`,
        'Booste le serveur (Nitro)' + (g.booster_role_id ? ` ou obtiens le rôle <@&${g.booster_role_id}>` : ''));
    }
    if (g.tag_bonus > 0) {
      line(wearsServerTag(member), '🏷️ Tag du serveur', `+${pct(g.tag_bonus)} d'XP`,
        'Affiche le tag du serveur à côté de ton pseudo (Paramètres → Profil → Tag de serveur)');
    }
    if (g.promo_bonus > 0) {
      const vanity = interaction.guild.vanityURLCode;
      line(promotesServer(member, g), '📣 Pub dans le statut', `+${pct(g.promo_bonus)} d'XP`,
        `Mets ${vanity ? `\`discord.gg/${vanity}\`` : `\`${g.promo_text || '(lien du serveur)'}\``} dans ton statut personnalisé`);
    }

    if (!rows.length) rows.push('_Aucun bonus d\'XP configuré sur ce serveur pour l\'instant._');

    const embed = baseEmbed(config.colors.xp)
      .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
      .setTitle('✨ Tes bonus d\'XP')
      .setDescription(rows.join('\n\n'))
      .addFields(
        { name: 'Multiplicateur serveur', value: `×${serverMult.toFixed(2)}`, inline: true },
        { name: 'Prestige', value: `×${prestigeMult.toFixed(2)}`, inline: true },
        { name: 'Tes bonus perso', value: `×${multiplier.toFixed(2)}`, inline: true },
        { name: '➡️ Multiplicateur total', value: `**×${total.toFixed(2)}**`, inline: false },
      );
    if (reasons.length) {
      embed.addFields({ name: 'Bonus actifs', value: reasons.map((r) => `${r.label} : +${pct(r.pct)}`).join('\n') });
    }
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
