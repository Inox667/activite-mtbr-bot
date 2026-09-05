import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed } from '../../lib/embeds.js';
import { config } from '../../config.js';

const SECTIONS = [
  {
    name: '⭐ Le plus simple',
    value: '**`/menu`** — ton hub tout-en-un : récupérer tes gains, tes quêtes, ta caisse gratuite et voir ton profil, en quelques clics.',
  },
  {
    name: '📊 Niveaux',
    value: [
      '`/rank` — ta carte de rang · `/stats` — stats détaillées · `/profil` — fiche',
      '`/niveaux` — rôles de palier · `/bonus` — tes bonus d\'XP · `/classement <type>`',
    ].join('\n'),
  },
  {
    name: '🪙 Économie',
    value: [
      '`/solde` · `/daily` · `/weekly` · `/work` · `/crime` · `/pêche` · `/mine`',
      '`/donner` · `/banque` · `/vendre` · `/historique`',
    ].join('\n'),
  },
  {
    name: '🎰 Jeux & caisses',
    value: [
      '`/machine` · `/blackjack` · `/roulette` · `/pileouface` · `/dé`',
      '`/duel <membre> <mise>` · `/quiz`',
      '`/caisse` — ouvre une caisse à la roulette animée',
    ].join('\n'),
  },
  {
    name: '🛒 Boutique & progression',
    value: [
      '`/boutique` · `/acheter` · `/inventaire` · `/utiliser`',
      '`/succès` · `/quetes` · `/prestige`',
    ].join('\n'),
  },
  {
    name: '⚙️ Admin',
    value: '**`/panel`** — panneau tout-en-un. En détaillé : `/setup` `/config` `/xp-admin` `/eco-admin` `/boutique-admin` `/event-xp`',
  },
];

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('Aide du bot MTBR'),
  async execute(interaction) {
    const embed = baseEmbed(config.colors.primary)
      .setTitle('🎮 Bot MTBR')
      .setDescription('Nouveau ? Tape **`/menu`** — tout se fait de là.\nMonnaies : 🪙 coins (courant) · 💎 gems (premium, via quêtes/succès/podium).')
      .addFields(SECTIONS)
      .setFooter({ text: 'Montants : 100, 2.5k, 1m, all, half.' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
