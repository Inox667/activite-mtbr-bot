// ==========================================================================
//  Caisses à ouvrir (style "skins") : raretés, contenu, prix.
//  kind: 'coins' (min/max) | 'gems' (amount) | 'item' (collectible, value coins)
// ==========================================================================

// Charte de couleurs des raretés (identique partout : embeds, roulette, légendes).
//  Commun = blanc · Peu commun = bleu · Rare = violet · Épique = rose
//  Légendaire = rouge · Exceptionnel = jaune
export const RARITIES = {
  commun: { label: 'Commun', color: 0xdbe4ee, hex: '#dbe4ee', emoji: '⚪' },
  peu_commun: { label: 'Peu commun', color: 0x3b82f6, hex: '#3b82f6', emoji: '🔵' },
  rare: { label: 'Rare', color: 0xa855f7, hex: '#a855f7', emoji: '🟣' },
  epique: { label: 'Épique', color: 0xec4899, hex: '#ec4899', emoji: '🩷' },
  legendaire: { label: 'Légendaire', color: 0xef4444, hex: '#ef4444', emoji: '🔴' },
  exceptionnel: { label: 'Exceptionnel', color: 0xeab308, hex: '#eab308', emoji: '🟡' },
};

// Contenu commun réutilisé (petits gains coins).
// Les poids sont très déséquilibrés vers le commun : les bons lots sont rares.
const commonCoins = [
  { name: 'Poignée de pièces', emoji: '🪙', rarity: 'commun', weight: 55, kind: 'coins', min: 100, max: 300 },
  { name: 'Petit magot', emoji: '💵', rarity: 'commun', weight: 42, kind: 'coins', min: 250, max: 550 },
  { name: 'Bourse remplie', emoji: '👛', rarity: 'peu_commun', weight: 12, kind: 'coins', min: 500, max: 1100 },
];

export const CASES = {
  gratuite: {
    id: 'gratuite',
    name: 'Caisse Gratuite',
    emoji: '🎁',
    price: 0,
    currency: 'coins',
    dailyFree: true,
    rewards: [
      ...commonCoins,
      { name: 'Jeton porte-bonheur', emoji: '🍀', rarity: 'rare', weight: 4, kind: 'item', value: 800 },
      { name: 'Coffret d\'XP', emoji: '✨', rarity: 'rare', weight: 3, kind: 'xp', amount: 400 },
      { name: 'Éclat de gemme', emoji: '💎', rarity: 'epique', weight: 1, kind: 'gems', amount: 1 },
      { name: 'Trophée poussiéreux', emoji: '🏆', rarity: 'legendaire', weight: 0.4, kind: 'item', value: 5000 },
    ],
  },

  standard: {
    id: 'standard',
    name: 'Caisse Standard',
    emoji: '📦',
    price: 600,
    currency: 'coins',
    rewards: [
      ...commonCoins,
      { name: 'Liasse de billets', emoji: '💰', rarity: 'peu_commun', weight: 12, kind: 'coins', min: 800, max: 1600 },
      { name: 'Montre plaquée or', emoji: '⌚', rarity: 'rare', weight: 5, kind: 'item', value: 2200 },
      { name: 'Chaîne en or', emoji: '📿', rarity: 'rare', weight: 4, kind: 'item', value: 3000 },
      { name: 'Coffre-fort portable', emoji: '🔐', rarity: 'epique', weight: 2, kind: 'coins', min: 4000, max: 8000 },
      { name: 'Sac de gemmes', emoji: '💎', rarity: 'epique', weight: 1.5, kind: 'gems', amount: 3 },
      { name: 'Lingot d\'or', emoji: '🥇', rarity: 'legendaire', weight: 0.7, kind: 'item', value: 12000 },
      { name: 'Diamant brut', emoji: '💠', rarity: 'exceptionnel', weight: 0.3, kind: 'gems', amount: 8 },
    ],
  },

  premium: {
    id: 'premium',
    name: 'Caisse Premium',
    emoji: '🧰',
    price: 10,
    currency: 'gems',
    rewards: [
      { name: 'Butin garanti', emoji: '💵', rarity: 'peu_commun', weight: 36, kind: 'coins', min: 3000, max: 6000 },
      { name: 'Grosse liasse', emoji: '💰', rarity: 'rare', weight: 20, kind: 'coins', min: 6000, max: 12000 },
      { name: 'Statuette dorée', emoji: '🗿', rarity: 'rare', weight: 11, kind: 'item', value: 9000 },
      { name: 'Pluie de gemmes', emoji: '💎', rarity: 'epique', weight: 7, kind: 'gems', amount: 6 },
      { name: 'Coffret d\'XP majeur', emoji: '🌟', rarity: 'epique', weight: 6, kind: 'xp', amount: 3000 },
      { name: 'Montre sertie', emoji: '⌚', rarity: 'legendaire', weight: 2.5, kind: 'item', value: 25000 },
      { name: 'Couronne', emoji: '👑', rarity: 'legendaire', weight: 1.2, kind: 'item', value: 40000 },
      { name: 'Coffre au trésor', emoji: '💎', rarity: 'exceptionnel', weight: 0.6, kind: 'gems', amount: 20 },
    ],
  },
};

export function getCase(id) {
  return CASES[id] ?? null;
}
