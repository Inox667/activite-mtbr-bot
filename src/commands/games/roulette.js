import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { config } from '../../config.js';
import { takeBet, settleGame } from '../../lib/games.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt, randInt } from '../../lib/format.js';
import { renderRouletteGif, gifOn } from '../../lib/gameRender.js';

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function evaluate(pari, n) {
  const p = config.games.roulette;
  if (/^\d+$/.test(pari)) {
    return Number(pari) === n ? p.straightPayout : 0;
  }
  switch (pari) {
    case 'rouge': return n !== 0 && RED.has(n) ? p.colorPayout : 0;
    case 'noir': return n !== 0 && !RED.has(n) ? p.colorPayout : 0;
    case 'pair': return n !== 0 && n % 2 === 0 ? p.parityPayout : 0;
    case 'impair': return n !== 0 && n % 2 === 1 ? p.parityPayout : 0;
    case 'manque': return n >= 1 && n <= 18 ? p.parityPayout : 0;   // low
    case 'passe': return n >= 19 && n <= 36 ? p.parityPayout : 0;   // high
    case 'p12': return n >= 1 && n <= 12 ? p.dozenPayout : 0;
    case 'm12': return n >= 13 && n <= 24 ? p.dozenPayout : 0;
    case 'd12': return n >= 25 && n <= 36 ? p.dozenPayout : 0;
    default: return 0;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Roulette européenne (0-36)')
    .addStringOption((o) => o.setName('mise').setDescription('Ex : 100, all').setRequired(true))
    .addStringOption((o) => o.setName('pari').setDescription('rouge, noir, pair, impair, p12/m12/d12, manque, passe, ou un numéro 0-36').setRequired(true)),

  async execute(interaction) {
    const { guild, member } = interaction;
    const pari = interaction.options.getString('pari').toLowerCase().trim();
    const valid = /^\d+$/.test(pari)
      ? Number(pari) >= 0 && Number(pari) <= 36
      : ['rouge', 'noir', 'pair', 'impair', 'manque', 'passe', 'p12', 'm12', 'd12'].includes(pari);
    if (!valid) {
      return interaction.reply({ embeds: [baseEmbed(config.colors.danger).setDescription('Pari invalide. Voir la description de la commande.')], ephemeral: true });
    }

    const bet = takeBet(guild.id, member.id, interaction.options.getString('mise'));
    if (!bet.ok) return interaction.reply({ embeds: [bet.embed], ephemeral: true });

    const n = randInt(0, 36);
    const mult = evaluate(pari, n);
    const winnings = mult > 0 ? bet.bet * mult : 0;
    const { net } = await settleGame(member, bet.bet, winnings, { channel: interaction.channel, reason: 'roulette' });

    const color = n === 0 ? '🟢' : RED.has(n) ? '🔴' : '⚫';
    const embed = baseEmbed(mult > 0 ? config.colors.success : config.colors.danger)
      .setTitle('🎡 Roulette')
      .setDescription(mult > 0
        ? `La bille tombe sur ${color} **${n}** — pari **${pari}** ×${mult} !\n**+${fmt(net)}** ${config.emojis.coin}`
        : `La bille tombe sur ${color} **${n}** — pari **${pari}** perdu.\n**−${fmt(bet.bet)}** ${config.emojis.coin}`);

    if (gifOn()) {
      await interaction.deferReply();
      const gif = await renderRouletteGif({ number: n, pari, mult, bet: bet.bet, net }).catch(() => null);
      if (gif) {
        return interaction.editReply({
          embeds: [embed.setImage('attachment://roulette.gif')],
          files: [new AttachmentBuilder(gif.buffer, { name: 'roulette.gif' })],
        });
      }
    }
    await (interaction.deferred ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] }));
  },
};
