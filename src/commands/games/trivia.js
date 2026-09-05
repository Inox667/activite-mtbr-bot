import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder,
} from 'discord.js';
import { config } from '../../config.js';
import { getUser, updateUser, addCoins } from '../../database/models.js';
import { TRIVIA } from '../../data/trivia.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, pick } from '../../lib/format.js';
import { trackMission } from '../../lib/missions.js';
import { checkAchievements } from '../../lib/achievements.js';
import { announceAchievements } from '../../lib/leveling.js';
import { renderQuiz, gfxOn } from '../../lib/gameRender.js';

const LETTERS = ['🇦', '🇧', '🇨', '🇩'];
const T = config.games.trivia;

async function frame(q, state) {
  const embed = baseEmbed(
    state.revealed ? (state.correct ? config.colors.success : config.colors.danger) : config.colors.info,
  ).setTitle(`🧠 Quiz — ${q.cat}`);

  if (gfxOn()) {
    const png = await renderQuiz({
      category: q.cat, question: q.q, choices: q.choices, timeSec: T.timeSec,
      revealed: state.revealed, answerIndex: q.answer, chosenIndex: state.chosen ?? -1, correct: state.correct, reward: state.reward ?? T.reward,
    }).catch(() => null);
    if (png) {
      embed.setImage('attachment://quiz.png');
      if (state.note) embed.setDescription(state.note);
      return { embeds: [embed], files: [new AttachmentBuilder(png, { name: 'quiz.png' })] };
    }
  }
  embed.setDescription(
    `**${q.q}**\n\n${q.choices.map((c, i) => `${LETTERS[i]} ${c}`).join('\n')}`
    + (state.note ? `\n\n${state.note}` : ''),
  ).setFooter({ text: `${T.timeSec} s · ${fmt(T.reward)} ${config.emojis.coin} par bonne réponse` });
  return { embeds: [embed], files: [] };
}

export default {
  data: new SlashCommandBuilder().setName('quiz').setDescription('Réponds à une question de culture générale'),

  async execute(interaction) {
    const { guild, member } = interaction;
    const q = pick(TRIVIA);
    await interaction.deferReply();

    const row = new ActionRowBuilder().addComponents(
      ...q.choices.map((c, i) => new ButtonBuilder().setCustomId(String(i)).setLabel(['A', 'B', 'C', 'D'][i]).setStyle(ButtonStyle.Secondary)),
    );
    const msg = await interaction.editReply({ ...(await frame(q, {})), components: [row] });

    try {
      const b = await msg.awaitMessageComponent({
        componentType: ComponentType.Button, time: T.timeSec * 1000, filter: (i) => i.user.id === member.id,
      });
      const chosen = Number(b.customId);
      const correct = chosen === q.answer;
      const u = getUser(guild.id, member.id);

      if (correct) {
        const streak = u.trivia_streak + 1;
        const bonus = Math.min(5, Math.floor(streak / 2)) * T.streakBonus;
        const total = T.reward + bonus;
        updateUser(guild.id, member.id, { trivia_streak: streak });
        addCoins(guild.id, member.id, total, 'quiz');
        trackMission(guild.id, member.id, 'trivia_correct', 1);
        trackMission(guild.id, member.id, 'earn_coins', total);
        const unlocked = checkAchievements({ guildId: guild.id, userId: member.id, user: getUser(guild.id, member.id), event: 'trivia' });
        if (unlocked.length) await announceAchievements(member, unlocked, interaction.channel);
        await b.update({
          ...(await frame(q, { revealed: true, correct: true, chosen, reward: total, note: `**+${fmt(total)}** ${config.emojis.coin}${bonus ? ` (+${fmt(bonus)} série)` : ''} · 🔥 Série : **${streak}**` })),
          components: [],
        });
      } else {
        updateUser(guild.id, member.id, { trivia_streak: 0 });
        await b.update({
          ...(await frame(q, { revealed: true, correct: false, chosen, note: `La bonne réponse était **${q.choices[q.answer]}**. Série remise à 0.` })),
          components: [],
        });
      }
    } catch {
      updateUser(guild.id, member.id, { trivia_streak: 0 });
      await interaction.editReply({
        ...(await frame(q, { revealed: true, correct: false, chosen: -1, note: `⌛ Temps écoulé ! Réponse : **${q.choices[q.answer]}**.` })),
        components: [],
      }).catch(() => {});
    }
  },
};
