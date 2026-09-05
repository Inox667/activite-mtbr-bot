import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { config } from '../../config.js';
import {
  setLevelRole, getLevelRoles, clearLevelRoles, setGuildConfig, getUser,
} from '../../database/models.js';
import { syncLevelRoles } from '../../lib/leveling.js';
import { levelFromXp } from '../../config.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configuration initiale du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('roles').setDescription('Détecte les rôles de palier par leur nom'))
    .addSubcommand((s) => s.setName('salon').setDescription('Définit les salons du bot')
      .addChannelOption((o) => o.setName('levelup').setDescription('Salon des annonces de level-up').addChannelTypes(ChannelType.GuildText))
      .addChannelOption((o) => o.setName('annonces').setDescription('Salon des succès / podium hebdo').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('sync-roles').setDescription('Recalcule les rôles de palier de tous les membres'))
    .addSubcommand((s) => s.setName('etat').setDescription('Affiche la configuration actuelle')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'roles') {
      await interaction.deferReply({ ephemeral: true });
      await guild.roles.fetch();
      clearLevelRoles(guild.id);
      const matched = [];
      const missing = [];
      for (const entry of config.levelRoles) {
        const role = guild.roles.cache.find((r) => r.name.toLowerCase() === entry.name.toLowerCase());
        if (role) { setLevelRole(guild.id, entry.level, role.id); matched.push(`✅ Niv. ${entry.level} → <@&${role.id}>`); }
        else missing.push(`❌ Niv. ${entry.level} → rôle « ${entry.name} » introuvable`);
      }
      const embed = baseEmbed(missing.length ? config.colors.warning : config.colors.success)
        .setTitle('🔧 Détection des rôles de palier')
        .setDescription([...matched, ...missing].join('\n'))
        .setFooter({ text: missing.length ? 'Crée/renomme les rôles manquants puis relance /setup roles.' : 'Tous les paliers sont liés.' });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'salon') {
      const levelup = interaction.options.getChannel('levelup');
      const annonces = interaction.options.getChannel('annonces');
      const patch = {};
      if (levelup) patch.levelup_channel_id = levelup.id;
      if (annonces) patch.announce_channel_id = annonces.id;
      if (!Object.keys(patch).length) {
        return interaction.reply({ embeds: [errorEmbed('Précise au moins un salon.')], ephemeral: true });
      }
      setGuildConfig(guild.id, patch);
      return interaction.reply({
        embeds: [baseEmbed(config.colors.success).setDescription(
          (levelup ? `Level-up → <#${levelup.id}>\n` : '') + (annonces ? `Annonces → <#${annonces.id}>` : ''))],
        ephemeral: true,
      });
    }

    if (sub === 'sync-roles') {
      const tiers = getLevelRoles(guild.id);
      if (!tiers.length) return interaction.reply({ embeds: [errorEmbed('Lance d\'abord `/setup roles`.')], ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const members = await guild.members.fetch();
      let done = 0;
      for (const member of members.values()) {
        if (member.user.bot) continue;
        const lvl = levelFromXp(getUser(guild.id, member.id).xp).level;
        await syncLevelRoles(member, lvl);
        done++;
      }
      return interaction.editReply({ embeds: [baseEmbed(config.colors.success).setDescription(`Rôles recalculés pour **${done}** membres.`)] });
    }

    // etat
    const tiers = getLevelRoles(guild.id);
    const g = (await import('../../database/models.js')).getGuildConfig(guild.id);
    const embed = baseEmbed(config.colors.info)
      .setTitle('⚙️ Configuration MTBR')
      .addFields(
        { name: 'XP activée', value: g.xp_enabled ? 'oui' : 'non', inline: true },
        { name: 'Multiplicateur XP', value: `×${g.xp_multiplier}`, inline: true },
        { name: 'Event XP', value: g.event_expires_at > Date.now() / 1000 ? `×${g.event_multiplier} (actif)` : 'aucun', inline: true },
        { name: 'Salon level-up', value: g.levelup_channel_id ? `<#${g.levelup_channel_id}>` : '_non défini_', inline: true },
        { name: 'Salon annonces', value: g.announce_channel_id ? `<#${g.announce_channel_id}>` : '_non défini_', inline: true },
        { name: 'Mode level-up', value: g.levelup_mode, inline: true },
        { name: 'Rôles de palier liés', value: `${tiers.length} / ${config.levelRoles.length}`, inline: true },
        { name: 'Salons ignorés', value: g.ignored_channels.length ? g.ignored_channels.map((c) => `<#${c}>`).join(' ') : '_aucun_', inline: false },
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
