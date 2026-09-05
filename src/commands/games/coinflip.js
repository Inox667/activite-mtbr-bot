import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { config } from '../../config.js';
import { takeBet, settleGame } from '../../lib/games.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';
import { renderCoinGif, gifOn } from '../../lib/gameRender.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pileouface')
    .setDescription('Pile ou face — mise x2 si tu gagnes')
    .addStringOption((o) => o.setName('mise').setDescription('Ex : 100, 2.5k, all').setRequired(true))
    .addStringOption((o) => o.setName('choix').setDescription('pile ou face').setRequired(true)
      .addChoices({ name: 'Pile', value: 'pile' }, { name: 'Face', value: 'face' })),

  async execute(interaction) {
    const { guild, member } = interaction;
    const choice = interaction.options.getString('choix');
    const bet = takeBet(guild.id, member.id, interaction.options.getString('mise'));
    if (!bet.ok) return interaction.reply({ embeds: [bet.embed], ephemeral: true });

    const result = Math.random() < 0.5 ? 'pile' : 'face';
    const won = result === choice;
    const winnings = won ? Math.floor(bet.bet * config.games.coinflip.payout) : 0;
    const { net } = await settleGame(member, bet.bet, winnings, { channel: interaction.channel, reason: 'pileouface' });

    const embed = baseEmbed(won ? config.colors.success : config.colors.danger)
      .setTitle('🪙 Pile ou face')
      .setDescription(won ? `**${result === 'pile' ? 'Pile' : 'Face'}** — gagné ! **+${fmt(net)}** ${config.emojis.coin}`
        : `**${result === 'pile' ? 'Pile' : 'Face'}** — perdu… **−${fmt(bet.bet)}** ${config.emojis.coin}`);

    if (gifOn()) {
      await interaction.deferReply();
      const gif = await renderCoinGif({ result, choice, bet: bet.bet, net, won }).catch(() => null);
      if (gif) {
        return interaction.editReply({
          embeds: [embed.setImage('attachment://coin.gif')],
          files: [new AttachmentBuilder(gif.buffer, { name: 'coin.gif' })],
        });
      }
    }
    await (interaction.deferred ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] }));
  },
};
