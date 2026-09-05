// Constructeurs d'embeds réutilisables.
import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

export function baseEmbed(color = config.colors.primary) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

export function successEmbed(description, title) {
  const e = baseEmbed(config.colors.success).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function errorEmbed(description, title = '❌ Erreur') {
  return baseEmbed(config.colors.danger).setTitle(title).setDescription(description);
}

export function infoEmbed(description, title) {
  const e = baseEmbed(config.colors.info).setDescription(description);
  if (title) e.setTitle(title);
  return e;
}

export function warnEmbed(description, title = '⚠️') {
  return baseEmbed(config.colors.warning).setTitle(title).setDescription(description);
}

/** Réponse d'erreur éphémère standard. */
export function replyError(interaction, description) {
  const payload = { embeds: [errorEmbed(description)], ephemeral: true };
  return interaction.deferred || interaction.replied
    ? interaction.followUp(payload)
    : interaction.reply(payload);
}
