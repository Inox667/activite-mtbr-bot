// ==========================================================================
//  Définition des succès + logique de vérification.
//  Chaque succès : { id, name, emoji, description, secret?, check(ctx) }
//  ctx = { user (ligne DB), guildId, userId, event, payload }
// ==========================================================================
import { unlockAchievement, addCoins, addGems } from '../database/models.js';
import { levelFromXp } from '../config.js';

export const ACHIEVEMENTS = [
  { id: 'first_message', name: 'Premiers mots', emoji: '💬', reward: 100,
    description: 'Envoyer ton premier message compté.',
    check: (c) => c.user.messages >= 1 },
  { id: 'chatterbox', name: 'Moulin à paroles', emoji: '🗣️', reward: 500,
    description: 'Atteindre 1 000 messages.',
    check: (c) => c.user.messages >= 1000 },
  { id: 'chat_legend', name: 'Pilier du chat', emoji: '📣', reward: 2500,
    description: 'Atteindre 10 000 messages.',
    check: (c) => c.user.messages >= 10000 },
  { id: 'voice_rookie', name: 'Micro ouvert', emoji: '🎙️', reward: 250,
    description: 'Passer 1 heure en vocal.',
    check: (c) => c.user.voice_minutes >= 60 },
  { id: 'voice_addict', name: 'Résident du vocal', emoji: '🔊', reward: 1500,
    description: 'Passer 24 heures en vocal.',
    check: (c) => c.user.voice_minutes >= 1440 },

  { id: 'level_5', name: 'Novice', emoji: '🌱', reward: 150,
    description: 'Atteindre le niveau 5.',
    check: (c) => levelFromXp(c.user.xp).level >= 5 },
  { id: 'level_25', name: 'Membre actif', emoji: '🦊', reward: 750,
    description: 'Atteindre le niveau 25.',
    check: (c) => levelFromXp(c.user.xp).level >= 25 },
  { id: 'level_50', name: 'Élite', emoji: '🐯', reward: 2000,
    description: 'Atteindre le niveau 50.',
    check: (c) => levelFromXp(c.user.xp).level >= 50 },
  { id: 'level_100', name: 'Mythe', emoji: '⚡', reward: 6000, gems: 5,
    description: 'Atteindre le niveau 100.',
    check: (c) => levelFromXp(c.user.xp).level >= 100 },
  { id: 'level_150', name: 'Dieu de MTBR', emoji: '🔥', reward: 15000, gems: 15,
    description: 'Atteindre le niveau maximum.',
    check: (c) => levelFromXp(c.user.xp).level >= 150 },

  { id: 'first_prestige', name: 'Renaissance', emoji: '⭐', reward: 5000, gems: 5,
    description: 'Passer prestige au moins une fois.',
    check: (c) => c.user.prestige >= 1 },
  { id: 'prestige_master', name: 'Constellation', emoji: '🌌', reward: 50000, gems: 30,
    description: 'Atteindre le prestige 5.',
    check: (c) => c.user.prestige >= 5 },

  { id: 'rich_10k', name: 'Aisé', emoji: '💰', reward: 500,
    description: 'Posséder 10 000 coins (poche + banque).',
    check: (c) => c.user.coins + c.user.bank >= 10000 },
  { id: 'rich_100k', name: 'Fortuné', emoji: '🤑', reward: 2500,
    description: 'Posséder 100 000 coins.',
    check: (c) => c.user.coins + c.user.bank >= 100000 },
  { id: 'rich_1m', name: 'Millionnaire', emoji: '🏦', reward: 25000, gems: 10,
    description: 'Posséder 1 000 000 coins.',
    check: (c) => c.user.coins + c.user.bank >= 1000000 },

  { id: 'daily_7', name: 'Habitude', emoji: '📅', reward: 400,
    description: 'Série de 7 /daily.',
    check: (c) => c.user.daily_streak >= 7 },
  { id: 'daily_30', name: 'Discipline de fer', emoji: '🗓️', reward: 3000,
    description: 'Série de 30 /daily.',
    check: (c) => c.user.daily_streak >= 30 },

  { id: 'gambler', name: 'Flambeur', emoji: '🎰', reward: 1000,
    description: 'Miser 100 000 coins cumulés dans les jeux.',
    check: (c) => c.user.total_gambled >= 100000 },
  { id: 'high_roller', name: 'Gros bras du casino', emoji: '💸', reward: 10000, gems: 8,
    description: 'Miser 1 000 000 coins cumulés.',
    check: (c) => c.user.total_gambled >= 1000000 },
  { id: 'big_win', name: 'Jackpot', emoji: '🎉', reward: 2000,
    description: 'Gagner 50 000 coins en un seul jeu.',
    check: (c) => c.user.biggest_win >= 50000 },
  { id: 'duelist', name: 'Duelliste', emoji: '⚔️', reward: 1500,
    description: 'Gagner 10 duels.',
    check: (c) => c.user.duels_won >= 10 },
  { id: 'gladiator', name: 'Gladiateur', emoji: '🛡️', reward: 8000, gems: 8,
    description: 'Gagner 100 duels.',
    check: (c) => c.user.duels_won >= 100 },
  { id: 'trivia_streak', name: 'Cerveau', emoji: '🧠', reward: 1200,
    description: 'Série de 10 bonnes réponses au quiz.',
    check: (c) => c.user.trivia_streak >= 10 },

  { id: 'case_10', name: 'Curieux', emoji: '🗃️', reward: 800,
    description: 'Ouvrir 10 caisses.',
    check: (c) => c.user.cases_opened >= 10 },
  { id: 'case_100', name: 'Accro aux caisses', emoji: '🎰', reward: 5000, gems: 5,
    description: 'Ouvrir 100 caisses.',
    check: (c) => c.user.cases_opened >= 100 },
  { id: 'case_jackpot', name: 'Coup de chance', emoji: '🍀', reward: 3000,
    description: 'Obtenir un objet Exceptionnel dans une caisse.',
    check: (c) => c.event === 'case' && c.payload?.rarity === 'exceptionnel' },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export function getAchievement(id) {
  return BY_ID.get(id);
}

/**
 * Vérifie tous les succès pour un utilisateur et débloque ceux atteints.
 * @returns {Array} succès nouvellement débloqués (pour annonce)
 */
export function checkAchievements(ctx) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    try {
      if (a.check(ctx) && unlockAchievement(ctx.guildId, ctx.userId, a.id)) {
        if (a.reward) addCoins(ctx.guildId, ctx.userId, a.reward, `succès:${a.id}`);
        if (a.gems) addGems(ctx.guildId, ctx.userId, a.gems, `succès:${a.id}`);
        unlocked.push(a);
      }
    } catch { /* check défensif */ }
  }
  return unlocked;
}
