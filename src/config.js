// ==========================================================================
//  Configuration centrale du bot MTBR
//  Toutes les valeurs "de jeu" ajustables sont ici. La config par-serveur
//  modifiable en jeu (salons ignorés, multiplicateurs, etc.) est stockée en
//  base de données via /config et /setup.
// ==========================================================================

export const config = {
  // Couleurs des embeds (hex)
  colors: {
    primary: 0x5865f2,
    success: 0x57f287,
    danger: 0xed4245,
    warning: 0xfee75c,
    xp: 0x9b59b6,
    coins: 0xf1c40f,
    info: 0x3498db,
  },

  // Emojis "texte" utilisés un peu partout
  emojis: {
    coin: '🪙',
    gem: '💎',
    xp: '✨',
    level: '📊',
    trophy: '🏆',
    up: '⬆️',
  },

  // ----- Système d'XP -----
  leveling: {
    maxLevel: 150,            // niveau maximum de progression
    message: {
      min: 15,               // XP minimum par message
      max: 25,               // XP maximum par message
      cooldownSec: 60,       // délai anti-spam entre deux gains d'XP par message
      minLength: 2,          // longueur minimale du message pour compter
    },
    voice: {
      xpPerMinute: 5,        // XP par minute passée en vocal
      requireOthers: true,   // il faut au moins 2 humains connectés
      ignoreMutedOrDeaf: true, // pas d'XP si mute micro OU casque coupé
      ignoreAfk: true,       // pas d'XP dans le salon AFK
    },
  },

  // ----- Rôles de palier (attribués automatiquement au level-up) -----
  // On mappe un niveau -> nom exact du rôle sur le serveur.
  // /setup roles détecte les IDs à partir de ces noms.
  // Politique : rôle UNIQUE (le bot retire l'ancien palier et met le nouveau).
  levelRoles: [
    { level: 1, name: 'Arrivant' },
    { level: 5, name: 'Novice' },
    { level: 10, name: 'Apprenti' },
    { level: 15, name: 'Connaisseur' },
    { level: 20, name: 'Habitué' },
    { level: 25, name: 'Membre Actif' },
    { level: 30, name: 'Fidèle' },
    { level: 40, name: 'Vétéran' },
    { level: 50, name: 'Élite' },
    { level: 60, name: 'Expert' },
    { level: 70, name: 'Maître' },
    { level: 80, name: 'Roi/Reine' },
    { level: 90, name: 'Légende' },
    { level: 100, name: 'Mythe' },
    { level: 150, name: 'Dieu de MTBR' },
  ],

  // ----- Économie -----
  economy: {
    startingBalance: 0,
    daily: { amount: 250, streakBonus: 25, streakMax: 500, cooldownHours: 22 },
    weekly: { amount: 1500, cooldownHours: 24 * 7 },
    work: {
      min: 80, max: 220, cooldownMin: 60,
      messages: [
        'Tu as réparé la moto de {user} et gagné {amount} {coin}.',
        'Livraison de pizzas terminée : {amount} {coin} en poche.',
        'Tu as streamé 4 h sur Twitch : {amount} {coin} de dons.',
        'Tu as tondu la pelouse du serveur : {amount} {coin}.',
        'Mission freelance bouclée : {amount} {coin}.',
        'Tu as vendu tes vieux jeux : {amount} {coin}.',
      ],
    },
    crime: {
      min: 200, max: 600, cooldownMin: 120, successRate: 0.55,
      fineMin: 150, fineMax: 450,
      successMessages: [
        'Tu as braqué le distributeur du coin : +{amount} {coin}.',
        'Cambriolage réussi sans laisser de traces : +{amount} {coin}.',
        'Tu as revendu des NFT douteux : +{amount} {coin}.',
      ],
      failMessages: [
        'La police t\'a chopé. Amende de {amount} {coin}.',
        'Ton plan a foiré, tu paies {amount} {coin} de caution.',
        'Un témoin t\'a balancé : {amount} {coin} d\'amende.',
      ],
    },
    give: { minAmount: 1, taxRate: 0 },
    robbery: {
      enabled: true, cooldownMin: 180, successRate: 0.4,
      maxStealPercent: 0.25, minVictimBalance: 200,
      failFineMin: 100, failFineMax: 300,
    },
  },

  // ----- Jeux -----
  games: {
    minBet: 10,
    maxBet: 100000,
    coinflip: { payout: 2 },      // mise x2 si gagné
    dice: { payout: 6 },          // deviner le dé -> mise x6
    slots: {
      // symbole -> poids (probabilité relative) et multiplicateur (3 identiques)
      reel: [
        { s: '🍒', w: 30, x: 3 },
        { s: '🍋', w: 25, x: 4 },
        { s: '🔔', w: 18, x: 6 },
        { s: '⭐', w: 12, x: 10 },
        { s: '💎', w: 6, x: 25 },
        { s: '7️⃣', w: 3, x: 77 },
      ],
      twoMatchPayout: 1.5,        // 2 symboles identiques -> mise x1.5
    },
    roulette: { straightPayout: 36, colorPayout: 2, dozenPayout: 3, parityPayout: 2 },
    blackjack: { blackjackPayout: 2.5, winPayout: 2 },
    duel: { minWager: 50, expireSec: 120 },
    trivia: { reward: 60, timeSec: 20, streakBonus: 15 },
    fishing: { cooldownSec: 45 },
    mining: { cooldownSec: 45 },
  },

  // ----- Missions / quêtes -----
  missions: {
    resetHour: 0,       // reset quotidien à minuit (heure locale du serveur)
    daily: {
      count: 4,
      allDoneBonus: { xp: 150, coins: 100, gems: 0 },
    },
    weekly: {
      count: 4,
      resetDay: 1,      // lundi
      allDoneBonus: { xp: 1000, coins: 500, gems: 3 },
    },
    monthly: {
      count: 2,
      allDoneBonus: { xp: 5000, coins: 2500, gems: 15 },
    },
  },

  // ----- Prestige -----
  prestige: {
    requiredLevel: 150,
    xpMultiplierPerStar: 0.10,   // +10 % d'XP par étoile de prestige
    coinReward: 25000,
    gemReward: 10,
    maxStars: 10,
  },

  // ----- Classement hebdomadaire -----
  weeklyLeaderboard: {
    resetDay: 1,   // 1 = lundi (0 = dimanche)
    resetHour: 0,
    podiumCoins: [3000, 1500, 750],
    podiumGems: [5, 3, 2],
  },
};

// Formule d'XP (style MEE6) : XP nécessaire pour passer du niveau n au n+1.
export function xpForLevel(n) {
  return 5 * n * n + 50 * n + 100;
}

// XP cumulée totale requise pour atteindre le niveau L (niveau 0 = 0 XP).
export function totalXpForLevel(L) {
  let total = 0;
  for (let n = 0; n < L; n++) total += xpForLevel(n);
  return total;
}

// À partir d'une XP totale, renvoie { level, xpIntoLevel, xpNeeded }.
export function levelFromXp(totalXp) {
  let level = 0;
  let remaining = totalXp;
  while (level < config.leveling.maxLevel && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return {
    level,
    xpIntoLevel: Math.floor(remaining),
    xpNeeded: xpForLevel(level),
  };
}
