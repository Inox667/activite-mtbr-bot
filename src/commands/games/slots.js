import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { config } from '../../config.js';
import { takeBet, settleGame } from '../../lib/games.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, weighted } from '../../lib/format.js';
import { renderSlotsGif, gifOn } from '../../lib/gameRender.js';

const REEL = config.games.slots.reel;

export default {
  data: new SlashCommandBuilder()
    .setName('machine')
    .setDescription('Machine à sous')
    .addStringOption((o) => o.setName('mise').setDescription('Ex : 100, all').setRequired(true)),

  async execute(interaction) {
    const { guild, member } = interaction;
    const bet = takeBet(guild.id, member.id, interaction.options.getString('mise'));
    if (!bet.ok) return interaction.reply({ embeds: [bet.embed], ephemeral: true });

    const r = [weighted(REEL), weighted(REEL), weighted(REEL)];
    const symbols = r.map((x) => x.s);
    let winnings = 0;
    let label = 'Perdu…';
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      winnings = Math.floor(bet.bet * r[0].x);
      label = `🎉 TRIPLE — mise ×${r[0].x} !`;
    } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
      winnings = Math.floor(bet.bet * config.games.slots.twoMatchPayout);
      label = `Paire — mise ×${config.games.slots.twoMatchPayout}`;
    }

    const { net } = await settleGame(member, bet.bet, winnings, { channel: interaction.channel, reason: 'machine' });
    const won = net > 0;
    const embed = baseEmbed(won ? config.colors.success : config.colors.danger)
      .setTitle('🎰 Machine à sous')
      .setDescription(`${label}\n${won ? `**+${fmt(net)}**` : `**−${fmt(bet.bet)}**`} ${config.emojis.coin}`);

    if (gifOn()) {
      await interaction.deferReply();
      const gif = await renderSlotsGif({ result: symbols, bet: bet.bet, net }).catch(() => null);
      if (gif) {
        return interaction.editReply({
          embeds: [embed.setImage('attachment://slots.gif')],
          files: [new AttachmentBuilder(gif.buffer, { name: 'slots.gif' })],
        });
      }
    }
    embed.setDescription(`**［ ${symbols.join(' | ')} ］**\n` + embed.data.description);
    await (interaction.deferred ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] }));
  },
};
