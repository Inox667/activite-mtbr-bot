// ==========================================================================
//  Bonus d'XP personnels cumulables :
//   - Boost serveur (Nitro boost) ou rôle booster configuré
//   - Port du tag du serveur (Guild Tag / primary guild)
//   - Pub du serveur dans le statut perso (vanity ou texte configuré)
//  Chaque bonus est un pourcentage additif, stocké dans guild_config.
// ==========================================================================

/** Le membre booste-t-il le serveur ? */
export function isBooster(member, g) {
  if (member.premiumSince || member.premiumSinceTimestamp) return true;
  const boosterRole = member.guild.roles.premiumSubscriberRole;
  if (boosterRole && member.roles.cache.has(boosterRole.id)) return true;
  if (g.booster_role_id && member.roles.cache.has(g.booster_role_id)) return true;
  return false;
}

/** Le membre affiche-t-il le tag de CE serveur à côté de son pseudo ? */
export function wearsServerTag(member) {
  const pg = member.user?.primaryGuild;
  return !!(pg && pg.identityEnabled && pg.identityGuildId === member.guild.id);
}

/** Le membre fait-il la pub du serveur dans son statut personnalisé ? */
export function promotesServer(member, g) {
  const needles = [];
  const vanity = member.guild.vanityURLCode;
  if (vanity) {
    needles.push(`discord.gg/${vanity}`.toLowerCase(), `.gg/${vanity}`.toLowerCase());
  }
  if (g.promo_text) needles.push(g.promo_text.toLowerCase());
  if (!needles.length) return false;

  const activities = member.presence?.activities ?? [];
  for (const act of activities) {
    // type 4 = Custom Status ; on regarde aussi le "state"/"name" des autres.
    const text = `${act.state ?? ''} ${act.name ?? ''} ${act.details ?? ''}`.toLowerCase();
    if (needles.some((n) => text.includes(n))) return true;
  }
  return false;
}

/**
 * Multiplicateur d'XP personnel du membre (>= 1) + détail des bonus actifs.
 * @returns {{ multiplier:number, bonus:number, reasons:{label:string,pct:number}[] }}
 */
export function memberXpBonus(member, g) {
  let bonus = 0;
  const reasons = [];

  if (g.booster_bonus > 0 && isBooster(member, g)) {
    bonus += g.booster_bonus;
    reasons.push({ label: '🚀 Boost du serveur', pct: g.booster_bonus });
  }
  if (g.tag_bonus > 0 && wearsServerTag(member)) {
    bonus += g.tag_bonus;
    reasons.push({ label: '🏷️ Tag du serveur', pct: g.tag_bonus });
  }
  if (g.promo_bonus > 0 && promotesServer(member, g)) {
    bonus += g.promo_bonus;
    reasons.push({ label: '📣 Pub dans le statut', pct: g.promo_bonus });
  }

  return { multiplier: 1 + bonus, bonus, reasons };
}
