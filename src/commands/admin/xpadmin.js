import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config, levelFromXp, totalXpForLevel } from '../../config.js';
import { getUser, updateUser } from '../../database/models.js';
import { grantXp, syncLevelRoles } from '../../lib/leveling.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

export default {
  data: new SlashCommandBuilder()
    .setName('xp-admin')
    .setDescription('Gérer l\'XP des membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('donner').setDescription('Donne de l\'XP')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('XP à ajouter').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('retirer').setDescription('Retire de l\'XP')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('XP à retirer').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('definir-niveau').setDescription('Fixe le niveau d\'un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
      .addIntegerOption((o) => o.setName('niveau').setDescription('Niveau cible').setRequired(true).setMinValue(0).setMaxValue(config.leveling.maxLevel)))
    .addSubcommand((s) => s.setName('reset').setDescription('Remet un membre à zéro (XP + niveau)')
      .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('membre');
    if (target.bot) return interaction.reply({ embeds: [errorEmbed('Les bots n\'ont pas d\'XP.')], ephemeral: true });
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ embeds: [errorEmbed('Membre introuvable.')], ephemeral: true });
    const guildId = interaction.guild.id;

    if (sub === 'donner' || sub === 'retirer') {
      const amount = interaction.options.getInteger('montant') * (sub === 'retirer' ? -1 : 1);
      const res = await grantXp(member, amount, { channel: interaction.channel, weekly: false, source: 'admin', silent: sub === 'retirer' });
      if (sub === 'retirer') await syncLevelRoles(member, res.newLevel);
      return interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(
        `${sub === 'donner' ? '➕' : '➖'} **${fmt(Math.abs(amount))}** XP ${sub === 'donner' ? 'à' : 'de'} <@${target.id}>.\nNiveau : **${res.oldLevel} → ${res.newLevel}**`)] });
    }

    if (sub === 'definir-niveau') {
      const level = interaction.options.getInteger('niveau');
      const xp = totalXpForLevel(level);
      updateUser(guildId, target.id, { xp, level });
      await syncLevelRoles(member, level);
      return interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(`<@${target.id}> est maintenant **niveau ${level}** (${fmt(xp)} XP).`)] });
    }

    // reset
    updateUser(guildId, target.id, { xp: 0, weekly_xp: 0, level: 0 });
    await syncLevelRoles(member, 0);
    return interaction.reply({ embeds: [baseEmbed(config.colors.warning).setDescription(`XP de <@${target.id}> remise à zéro.`)] });
  },
};
