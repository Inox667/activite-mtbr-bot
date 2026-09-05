import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../../config.js';
import { getGuildConfig, setGuildConfig } from '../../database/models.js';
import { baseEmbed } from '../../lib/embeds.js';
import { relTs } from '../../lib/format.js';
import { nowSec } from '../../lib/cooldowns.js';

export default {
  data: new SlashCommandBuilder()
    .setName('event-xp')
    .setDescription('Lance (ou arrête) un bonus d\'XP temporaire pour tout le serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addNumberOption((o) => o.setName('multiplicateur').setDescription('Ex : 2 pour double XP. 1 pour arrêter.').setRequired(true).setMinValue(1).setMaxValue(5))
    .addIntegerOption((o) => o.setName('heures').setDescription('Durée en heures (défaut 24)').setMinValue(1).setMaxValue(168)),

  async execute(interaction) {
    const mult = interaction.options.getNumber('multiplicateur');
    const hours = interaction.options.getInteger('heures') ?? 24;

    if (mult <= 1) {
      setGuildConfig(interaction.guild.id, { event_multiplier: 1, event_expires_at: 0 });
      return interaction.reply({ embeds: [baseEmbed(config.colors.info).setDescription('Event d\'XP arrêté.')] });
    }

    const expires = nowSec() + hours * 3600;
    setGuildConfig(interaction.guild.id, { event_multiplier: mult, event_expires_at: expires });

    const g = getGuildConfig(interaction.guild.id);
    const chId = g.announce_channel_id || g.levelup_channel_id;
    const ch = chId && interaction.guild.channels.cache.get(chId);
    const embed = baseEmbed(config.colors.xp)
      .setTitle(`⚡ Event XP ×${mult} !`)
      .setDescription(`L'XP est multipliée par **${mult}** jusqu'à ${relTs(expires)}.\nÀ vos claviers et à vos micros !`);
    if (ch?.isTextBased()) ch.send({ embeds: [embed] }).catch(() => {});
    await interaction.reply({ embeds: [embed] });
  },
};
