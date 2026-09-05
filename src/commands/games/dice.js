import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { config } from '../../config.js';
import { takeBet, settleGame } from '../../lib/games.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, randInt } from '../../lib/format.js';
import { renderDiceGif, gifOn } from '../../lib/gameRender.js';

export default {
  data: new SlashCommandBuilder()
    .setName('dé')
    .setDescription('Devine le dé (1-6) — mise x6 si juste')
    .addStringOption((o) => o.setName('mise').setDescription('Ex : 100, all').setRequired(true))
    .addIntegerOption((o) => o.setName('numéro').setDescription('Ton pari (1 à 6)').setRequired(true).setMinValue(1).setMaxValue(6)),

  async execute(interaction) {
    const { guild, member } = interaction;
    const guess = interaction.options.getInteger('numéro');
    const bet = takeBet(guild.id, member.id, interaction.options.getString('mise'));
    if (!bet.ok) return interaction.reply({ embeds: [bet.embed], ephemeral: true });

    const roll = randInt(1, 6);
    const won = roll === guess;
    const winnings = won ? bet.bet * config.games.dice.payout : 0;
    const { net } = await settleGame(member, bet.bet, winnings, { channel: interaction.channel, reason: 'dé' });

    const embed = baseEmbed(won ? config.colors.success : config.colors.danger)
      .setTitle('🎲 Lancer de dé')
      .setDescription(won
        ? `Le dé tombe sur **${roll}** — bien vu ! **+${fmt(net)}** ${config.emojis.coin}`
        : `Le dé tombe sur **${roll}** — tu avais parié **${guess}**. **−${fmt(bet.bet)}** ${config.emojis.coin}`);

    if (gifOn()) {
      await interaction.deferReply();
      const gif = await renderDiceGif({ roll, guess, bet: bet.bet, net, won }).catch(() => null);
      if (gif) {
        return interaction.editReply({
          embeds: [embed.setImage('attachment://dice.gif')],
          files: [new AttachmentBuilder(gif.buffer, { name: 'dice.gif' })],
        });
      }
    }
    await (interaction.deferred ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] }));
  },
};
