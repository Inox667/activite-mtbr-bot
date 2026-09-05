import { SlashCommandBuilder } from 'discord.js';
import { getUser, transferCoins } from '../../database/models.js';
import { config } from '../../config.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt, parseAmount } from '../../lib/format.js';
import { trackMission } from '../../lib/missions.js';
import { checkAchievements } from '../../lib/achievements.js';
import { announceAchievements } from '../../lib/leveling.js';

export default {
  data: new SlashCommandBuilder()
    .setName('donner')
    .setDescription('Donne des coins à un autre membre')
    .addUserOption((o) => o.setName('membre').setDescription('Le bénéficiaire').setRequired(true))
    .addStringOption((o) => o.setName('montant').setDescription('Ex : 100, 2.5k, half, all').setRequired(true)),

  async execute(interaction) {
    const { guild, user } = interaction;
    const target = interaction.options.getUser('membre');
    if (target.bot) return interaction.reply({ embeds: [errorEmbed('Tu ne peux pas donner à un bot.')], ephemeral: true });
    if (target.id === user.id) return interaction.reply({ embeds: [errorEmbed('Tu ne peux pas te donner à toi-même.')], ephemeral: true });

    const u = getUser(guild.id, user.id);
    const amount = parseAmount(interaction.options.getString('montant'), u.coins);
    if (amount == null || amount < config.economy.give.minAmount) {
      return interaction.reply({ embeds: [errorEmbed('Montant invalide.')], ephemeral: true });
    }
    if (amount > u.coins) {
      return interaction.reply({ embeds: [errorEmbed(`Tu n'as que **${fmt(u.coins)}** ${config.emojis.coin} en poche.`)], ephemeral: true });
    }

    const ok = transferCoins(guild.id, user.id, target.id, amount, 'don');
    if (!ok) return interaction.reply({ embeds: [errorEmbed('Transfert impossible.')], ephemeral: true });

    trackMission(guild.id, user.id, 'gift', 1);
    const unlocked = checkAchievements({ guildId: guild.id, userId: target.id, user: getUser(guild.id, target.id), event: 'gift' });
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (unlocked.length && targetMember) await announceAchievements(targetMember, unlocked, interaction.channel);

    await interaction.reply({
      embeds: [baseEmbed(config.colors.success).setDescription(
        `<@${user.id}> a donné **${fmt(amount)}** ${config.emojis.coin} à <@${target.id}> 🤝`,
      )],
    });
  },
};
