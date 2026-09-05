// ==========================================================================
//  Helpers partagés pour les jeux d'argent : validation de mise, cartes,
//  règlement (stats, missions, succès).
// ==========================================================================
import { config } from '../config.js';
import {
  getUser, addCoins, removeCoins, incrementUser, updateUser,
} from '../database/models.js';
import { checkAchievements } from './achievements.js';
import { announceAchievements } from './leveling.js';
import { trackMission } from './missions.js';
import { parseAmount, fmt } from './format.js';
import { errorEmbed } from './embeds.js';

/**
 * Valide et retire la mise d'un joueur.
 * @returns {{ok:true, bet:number} | {ok:false, embed:EmbedBuilder}}
 */
export function takeBet(guildId, userId, rawBet) {
  const u = getUser(guildId, userId);
  const bet = parseAmount(rawBet, u.coins);
  if (bet == null || Number.isNaN(bet)) {
    return { ok: false, embed: errorEmbed('Mise invalide. Exemples : `100`, `2.5k`, `all`, `half`.') };
  }
  if (bet < config.games.minBet) {
    return { ok: false, embed: errorEmbed(`Mise minimum : **${fmt(config.games.minBet)}** ${config.emojis.coin}.`) };
  }
  if (bet > config.games.maxBet) {
    return { ok: false, embed: errorEmbed(`Mise maximum : **${fmt(config.games.maxBet)}** ${config.emojis.coin}.`) };
  }
  if (bet > u.coins) {
    return { ok: false, embed: errorEmbed(`Tu n'as que **${fmt(u.coins)}** ${config.emojis.coin} en poche.`) };
  }
  removeCoins(guildId, userId, bet, 'mise casino');
  incrementUser(guildId, userId, { total_gambled: bet });
  trackMission(guildId, userId, 'play_games', 1);
  return { ok: true, bet };
}

/**
 * Règle le résultat d'un jeu.
 * @param member GuildMember
 * @param {number} bet mise déjà retirée
 * @param {number} winnings gains bruts crédités (0 = perdu). Le "net" = winnings - bet.
 * @param {object} [opts] { channel, reason }
 * @returns {Promise<{net:number, unlocked:Array}>}
 */
export async function settleGame(member, bet, winnings, opts = {}) {
  const { channel = null, reason = 'jeu' } = opts;
  const guildId = member.guild.id;
  const userId = member.id;
  const net = winnings - bet;

  if (winnings > 0) addCoins(guildId, userId, winnings, reason);

  if (net > 0) {
    incrementUser(guildId, userId, { games_won: 1 });
    trackMission(guildId, userId, 'win_games', 1);
    trackMission(guildId, userId, 'earn_coins', net);
    const u = getUser(guildId, userId);
    if (net > u.biggest_win) updateUser(guildId, userId, { biggest_win: net });
  } else if (net < 0) {
    incrementUser(guildId, userId, { games_lost: 1 });
  }

  const user = getUser(guildId, userId);
  const unlocked = checkAchievements({ guildId, userId, user, event: 'game', payload: { bet, winnings, net } });
  if (unlocked.length) await announceAchievements(member, unlocked, channel);

  return { net, unlocked };
}

// ----- Cartes ---------------------------------------------------------
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function freshDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardStr(c) {
  return `${c.r}${c.s}`;
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 'A') { aces++; total += 11; }
    else if (['K', 'Q', 'J', '10'].includes(c.r)) total += 10;
    else total += parseInt(c.r, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
