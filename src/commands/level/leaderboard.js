import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} from 'discord.js';
import { leaderboard, getRank } from '../../database/models.js';
import { levelFromXp, config } from '../../config.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

const TYPES = {
  xp: { label: 'XP total', unit: 'XP', fmt: (v) => `${fmt(v)} XP` },
  weekly: { label: 'XP cette semaine', unit: 'XP', fmt: (v) => `${fmt(v)} XP` },
  coins: { label: 'Fortune', unit: 'coins', fmt: (v) => `${fmt(v)} ${config.emojis.coin}` },
  gems: { label: 'Gems', unit: 'gems', fmt: (v) => `${fmt(v)} ${config.emojis.gem}` },
  voice: { label: 'Temps en vocal', unit: 'h', fmt: (v) => `${fmt(Math.floor(v / 60))} h ${v % 60} min` },
  messages: { label: 'Messages', unit: '', fmt: (v) => `${fmt(v)} messages` },
};
const PAGE = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

function buildEmbed(guild, type, page) {
  const t = TYPES[type];
  const rows = leaderboard(guild.id, type, PAGE, page * PAGE);
  const lines = rows.map((r, i) => {
    const pos = page * PAGE + i + 1;
    const prefix = MEDALS[pos - 1] ?? `**${pos}.**`;
    const lvl = ['coins', 'gems', 'messages', 'voice'].includes(type)
      ? '' : ` · niv. ${levelFromXp(r.xp).level}`;
    const star = r.prestige ? ` ★${r.prestige}` : '';
    return `${prefix} <@${r.user_id}>${star} — ${t.fmt(r.value)}${lvl}`;
  });
  return baseEmbed(config.colors.primary)
    .setTitle(`🏆 Classement — ${t.label}`)
    .setDescription(lines.join('\n') || '_Aucune donnée pour le moment._')
    .setFooter({ text: `Page ${page + 1}` });
}

function buttons(type, page, maxPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId('next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage),
    new ButtonBuilder().setCustomId('me').setLabel('Ma position').setStyle(ButtonStyle.Primary),
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Affiche un classement du serveur')
    .addStringOption((o) => o.setName('type').setDescription('Type de classement').addChoices(
      { name: 'XP total', value: 'xp' },
      { name: 'XP de la semaine', value: 'weekly' },
      { name: 'Fortune (coins)', value: 'coins' },
      { name: 'Gems 💎', value: 'gems' },
      { name: 'Temps en vocal', value: 'voice' },
      { name: 'Messages', value: 'messages' },
    )),

  async execute(interaction) {
    const type = interaction.options.getString('type') ?? 'xp';
    let page = 0;
    const total = leaderboard(interaction.guild.id, type, 1000).length;
    const maxPage = Math.max(0, Math.ceil(total / PAGE) - 1);

    const msg = await interaction.reply({
      embeds: [buildEmbed(interaction.guild, type, page)],
      components: total > PAGE ? [buttons(type, page, maxPage)] : [],
      fetchReply: true,
    });
    if (total <= PAGE) return;

    const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 90_000 });
    col.on('collect', async (b) => {
      if (b.user.id !== interaction.user.id) {
        return b.reply({ content: 'Lance ta propre commande `/classement`.', ephemeral: true });
      }
      if (b.customId === 'me') {
        const r = getRank(interaction.guild.id, b.user.id, type === 'coins' ? 'coins' : type);
        return b.reply({ content: r ? `Tu es **#${fmt(r)}** au classement ${TYPES[type].label}.` : 'Tu n\'es pas encore classé.', ephemeral: true });
      }
      page += b.customId === 'next' ? 1 : -1;
      page = Math.max(0, Math.min(maxPage, page));
      await b.update({ embeds: [buildEmbed(interaction.guild, type, page)], components: [buttons(type, page, maxPage)] });
    });
    col.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
