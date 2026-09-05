import {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder,
} from 'discord.js';
import { config } from '../../config.js';
import {
  getUser, removeCoins, addCoins, incrementUser,
} from '../../database/models.js';
import { checkAchievements } from '../../lib/achievements.js';
import { renderDuel, gfxOn } from '../../lib/gameRender.js';
import { announceAchievements } from '../../lib/leveling.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt, parseAmount, randInt } from '../../lib/format.js';
import { trackMission } from '../../lib/missions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Défie un membre : le gagnant rafle les deux mises')
    .addUserOption((o) => o.setName('membre').setDescription('Ton adversaire').setRequired(true))
    .addStringOption((o) => o.setName('mise').setDescription('Ex : 100, 2.5k').setRequired(true)),

  async execute(interaction) {
    const { guild, member } = interaction;
    const opponent = interaction.options.getUser('membre');
    if (opponent.bot || opponent.id === member.id) {
      return interaction.reply({ embeds: [errorEmbed('Choisis un adversaire valide.')], ephemeral: true });
    }
    const oppMember = await guild.members.fetch(opponent.id).catch(() => null);
    if (!oppMember) return interaction.reply({ embeds: [errorEmbed('Membre introuvable.')], ephemeral: true });

    const challenger = getUser(guild.id, member.id);
    const wager = parseAmount(interaction.options.getString('mise'), challenger.coins);
    if (wager == null || wager < config.games.duel.minWager) {
      return interaction.reply({ embeds: [errorEmbed(`Mise minimum : **${fmt(config.games.duel.minWager)}** ${config.emojis.coin}.`)], ephemeral: true });
    }
    if (challenger.coins < wager) {
      return interaction.reply({ embeds: [errorEmbed('Tu n\'as pas assez en poche.')], ephemeral: true });
    }
    if (getUser(guild.id, opponent.id).coins < wager) {
      return interaction.reply({ embeds: [errorEmbed(`<@${opponent.id}> n'a pas **${fmt(wager)}** ${config.emojis.coin} en poche.`)], ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('accept').setLabel('Accepter le duel').setEmoji('⚔️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('decline').setLabel('Refuser').setStyle(ButtonStyle.Danger),
    );
    const msg = await interaction.reply({
      content: `<@${opponent.id}>`,
      embeds: [baseEmbed(config.colors.warning).setTitle('⚔️ Défi lancé !')
        .setDescription(`<@${member.id}> défie <@${opponent.id}> pour **${fmt(wager)}** ${config.emojis.coin} chacun.\n<@${opponent.id}>, tu as ${config.games.duel.expireSec} s pour répondre.`)],
      components: [row],
      fetchReply: true,
    });

    let handled = false;
    try {
      const b = await msg.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: config.games.duel.expireSec * 1000,
        filter: (i) => i.user.id === opponent.id,
      });
      handled = true;

      if (b.customId === 'decline') {
        return b.update({ embeds: [baseEmbed(config.colors.danger).setDescription(`<@${opponent.id}> a refusé le duel.`)], components: [] });
      }

      // Re-vérifier les soldes
      if (getUser(guild.id, member.id).coins < wager || getUser(guild.id, opponent.id).coins < wager) {
        return b.update({ embeds: [errorEmbed('Un des deux joueurs n\'a plus assez de coins.')], components: [] });
      }
      removeCoins(guild.id, member.id, wager, `duel vs ${opponent.id}`);
      removeCoins(guild.id, opponent.id, wager, `duel vs ${member.id}`);
      incrementUser(guild.id, member.id, { total_gambled: wager });
      incrementUser(guild.id, opponent.id, { total_gambled: wager });
      trackMission(guild.id, member.id, 'play_games', 1);
      trackMission(guild.id, opponent.id, 'play_games', 1);

      // Résolution : lancer de dés, relance en cas d'égalité
      let r1 = 0; let r2 = 0;
      do { r1 = randInt(1, 6) + randInt(1, 6); r2 = randInt(1, 6) + randInt(1, 6); } while (r1 === r2);
      const winner = r1 > r2 ? member.user : opponent;
      const loser = r1 > r2 ? opponent : member.user;
      const winnerMember = winner.id === member.id ? member : oppMember;
      const pot = wager * 2;

      addCoins(guild.id, winner.id, pot, `duel gagné vs ${loser.id}`);
      incrementUser(guild.id, winner.id, { duels_won: 1, games_won: 1 });
      incrementUser(guild.id, loser.id, { games_lost: 1 });
      trackMission(guild.id, winner.id, 'win_games', 1);
      trackMission(guild.id, winner.id, 'duels_won', 1);
      trackMission(guild.id, winner.id, 'earn_coins', wager);

      const unlocked = checkAchievements({ guildId: guild.id, userId: winner.id, user: getUser(guild.id, winner.id), event: 'duel' });
      if (unlocked.length) await announceAchievements(winnerMember, unlocked, interaction.channel);

      const embed = baseEmbed(config.colors.success)
        .setTitle('⚔️ Résultat du duel')
        .setDescription(`🏆 <@${winner.id}> remporte **${fmt(pot)}** ${config.emojis.coin} !`);

      let files = [];
      if (gfxOn()) {
        const png = await renderDuel({
          p1: { name: member.displayName, avatarURL: member.displayAvatarURL({ extension: 'png', size: 128 }) },
          p2: { name: oppMember.displayName, avatarURL: oppMember.displayAvatarURL({ extension: 'png', size: 128 }) },
          r1, r2, winner: r1 > r2 ? 1 : 2, pot: `${fmt(pot)} 🪙`,
        }).catch(() => null);
        if (png) { embed.setImage('attachment://duel.png'); files = [new AttachmentBuilder(png, { name: 'duel.png' })]; }
      }
      if (!files.length) embed.setDescription(`🎲 <@${member.id}> : **${r1}** · 🎲 <@${opponent.id}> : **${r2}**\n\n` + embed.data.description);
      await b.update({ embeds: [embed], files, components: [] });
    } catch {
      if (!handled) {
        await interaction.editReply({
          embeds: [baseEmbed(config.colors.danger).setDescription('⌛ Le défi a expiré sans réponse.')],
          components: [],
        }).catch(() => {});
      }
    }
  },
};
