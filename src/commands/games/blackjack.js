import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder,
} from 'discord.js';
import { config } from '../../config.js';
import { getUser, removeCoins, incrementUser } from '../../database/models.js';
import { takeBet, settleGame, freshDeck, handValue } from '../../lib/games.js';
import { baseEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';
import { renderBlackjack, gfxOn } from '../../lib/gameRender.js';

const P = config.games.blackjack;

function hands(deck) {
  return { player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()] };
}

/** Rend l'état (image si dispo, sinon embed texte). */
async function view(player, dealer, { hideDealer = true, bet, status = '', tone = null } = {}) {
  const pv = handValue(player);
  const dv = hideDealer ? handValue([dealer[0]]) : handValue(dealer);
  const embed = baseEmbed(
    tone === 'win' ? config.colors.success : tone === 'lose' ? config.colors.danger
      : tone === 'push' ? config.colors.warning : config.colors.info,
  ).setTitle('🃏 Blackjack');

  if (gfxOn()) {
    const png = await renderBlackjack({ player, dealer, hideDealer, bet, status, pv, dv, tone }).catch(() => null);
    if (png) {
      embed.setImage('attachment://bj.png');
      return { embeds: [embed], files: [new AttachmentBuilder(png, { name: 'bj.png' })] };
    }
  }
  const cs = (c) => `${c.r}${c.s}`;
  embed.addFields(
    { name: `Toi — ${pv}`, value: player.map(cs).join('  '), inline: false },
    { name: `Croupier — ${dv}${hideDealer ? '+' : ''}`, value: (hideDealer ? [cs(dealer[0]), '🂠'] : dealer.map(cs)).join('  '), inline: false },
  ).setFooter({ text: `Mise : ${fmt(bet)}${status ? ' · ' + status : ''}` });
  return { embeds: [embed], files: [] };
}

function controls(canDouble, disabled = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hit').setLabel('Tirer').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('stand').setLabel('Rester').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
  if (canDouble) row.addComponents(new ButtonBuilder().setCustomId('double').setLabel('Doubler').setStyle(ButtonStyle.Success).setDisabled(disabled));
  return row;
}

export default {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Blackjack contre le croupier')
    .addStringOption((o) => o.setName('mise').setDescription('Ex : 100, all').setRequired(true)),

  async execute(interaction) {
    const { guild, member } = interaction;
    const betRes = takeBet(guild.id, member.id, interaction.options.getString('mise'));
    if (!betRes.ok) return interaction.reply({ embeds: [betRes.embed], ephemeral: true });
    let bet = betRes.bet;

    await interaction.deferReply();
    const deck = freshDeck();
    const { player, dealer } = hands(deck);

    if (handValue(player) === 21) {
      const winnings = Math.floor(bet * P.blackjackPayout);
      const { net } = await settleGame(member, bet, winnings, { channel: interaction.channel, reason: 'blackjack' });
      return interaction.editReply(await view(player, dealer, { hideDealer: false, bet, status: `BLACKJACK ! +${fmt(net)}`, tone: 'win' }));
    }

    const canDouble = getUser(guild.id, member.id).coins >= bet;
    const first = await view(player, dealer, { bet });
    const msg = await interaction.editReply({ ...first, components: [controls(canDouble)] });

    const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });
    let finished = false;

    const finish = async (b) => {
      finished = true;
      col.stop();
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      const pv = handValue(player); const dv = handValue(dealer);
      let winnings = 0; let status;
      if (pv > 21) { status = 'Tu dépasses 21.'; }
      else if (dv > 21) { status = 'Le croupier crève !'; winnings = bet * P.winPayout; }
      else if (pv > dv) { status = 'Tu bats le croupier !'; winnings = bet * P.winPayout; }
      else if (pv === dv) { status = 'Égalité — mise rendue.'; winnings = bet; }
      else { status = 'Le croupier gagne.'; }

      const { net } = await settleGame(member, bet, winnings, { channel: interaction.channel, reason: 'blackjack' });
      const tone = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
      const suffix = net > 0 ? ` (+${fmt(net)})` : net < 0 ? ` (−${fmt(bet)})` : '';
      const payload = { ...(await view(player, dealer, { hideDealer: false, bet, status: status + suffix, tone })), components: [controls(false, true)] };
      if (b) await b.update(payload); else await interaction.editReply(payload);
    };

    col.on('collect', async (b) => {
      if (b.user.id !== member.id) return b.reply({ content: 'Ce n\'est pas ta partie.', ephemeral: true });
      if (b.customId === 'double') {
        if (!removeCoins(guild.id, member.id, bet, 'double blackjack')) {
          return b.reply({ content: 'Solde insuffisant pour doubler.', ephemeral: true });
        }
        incrementUser(guild.id, member.id, { total_gambled: bet });
        bet *= 2;
        player.push(deck.pop());
        return finish(b);
      }
      if (b.customId === 'hit') {
        player.push(deck.pop());
        if (handValue(player) >= 21) return finish(b);
        return b.update({ ...(await view(player, dealer, { bet })), components: [controls(false)] });
      }
      if (b.customId === 'stand') return finish(b);
    });

    col.on('end', () => { if (!finished) finish(null); });
  },
};
