// ==========================================================================
//  Rendu + réclamation des quêtes (partagé entre /quetes et /menu).
// ==========================================================================
import { config } from '../config.js';
import {
  addCoins, addGems, claimMission, claimAllDoneBonus, hasAllDoneBonus,
} from '../database/models.js';
import { grantXp } from './leveling.js';
import { ensureMissions, missionLabel, allMissionsDone } from './missions.js';
import { fmt, progressBar } from './format.js';

export const SCOPES = [
  { scope: 'daily', title: '🗓️ Journalier', reset: 'reset à minuit', bonus: config.missions.daily.allDoneBonus },
  { scope: 'weekly', title: '📅 Hebdomadaire', reset: 'reset lundi', bonus: config.missions.weekly.allDoneBonus },
  { scope: 'monthly', title: '🏆 Mensuel', reset: 'reset le 1er', bonus: config.missions.monthly.allDoneBonus },
];

function rewardLine(m) {
  const p = [`+${fmt(m.xp_reward)} XP`, `+${fmt(m.reward)} ${config.emojis.coin}`];
  if (m.gem_reward > 0) p.push(`+${fmt(m.gem_reward)} ${config.emojis.gem}`);
  return p.join(' · ');
}
function bonusLine(b) {
  const p = [`+${fmt(b.xp)} XP`, `+${fmt(b.coins)} ${config.emojis.coin}`];
  if (b.gems > 0) p.push(`+${fmt(b.gems)} ${config.emojis.gem}`);
  return p.join(' · ');
}

/** Champs d'embed décrivant toutes les quêtes + s'il y a quelque chose à réclamer. */
export function questFields(guildId, userId) {
  const data = ensureMissions(guildId, userId);
  const fields = [];
  let claimable = false;

  for (const s of SCOPES) {
    const { key, missions } = data[s.scope];
    const lines = missions.map((m) => {
      const done = m.progress >= m.target;
      const state = m.claimed ? '✅' : done ? '🎁 **à récupérer**' : progressBar(m.progress, m.target, 10);
      return `**${missionLabel(s.scope, m.mission_id, m.target)}**\n${rewardLine(m)} — ${m.progress.toLocaleString('fr-FR')}/${m.target.toLocaleString('fr-FR')} ${state}`;
    });
    const all = allMissionsDone(missions);
    const bonusDone = hasAllDoneBonus(guildId, userId, key);
    const doneCount = missions.filter((m) => m.progress >= m.target).length;
    lines.push(
      `\n🏅 **Bonus « tout terminer »** — ${bonusLine(s.bonus)}\n`
      + (bonusDone ? '✅ récupéré' : all ? '🎁 **disponible !**' : `${doneCount}/${missions.length} quêtes terminées`),
    );
    if (missions.some((m) => m.progress >= m.target && !m.claimed) || (all && !bonusDone)) claimable = true;
    fields.push({ name: `${s.title} · ${s.reset}`, value: lines.join('\n\n').slice(0, 1024) });
  }
  return { fields, claimable, data };
}

/** Réclame toutes les récompenses de quête disponibles. */
export async function claimAllQuests({ member, channel }) {
  const guildId = member.guild.id;
  const userId = member.id;
  let xp = 0; let coins = 0; let gems = 0; let count = 0;

  for (const s of SCOPES) {
    const { key, missions } = ensureMissions(guildId, userId)[s.scope];
    for (const m of missions) {
      if (m.progress >= m.target && !m.claimed) {
        const c = claimMission(guildId, userId, key, m.mission_id);
        if (c) { coins += c.reward; xp += c.xp_reward; gems += c.gem_reward; count++; }
      }
    }
    const fresh = ensureMissions(guildId, userId)[s.scope];
    if (allMissionsDone(fresh.missions) && !hasAllDoneBonus(guildId, userId, key)
      && claimAllDoneBonus(guildId, userId, key)) {
      xp += s.bonus.xp; coins += s.bonus.coins; gems += s.bonus.gems; count++;
    }
  }

  if (coins) addCoins(guildId, userId, coins, 'quêtes');
  if (gems) addGems(guildId, userId, gems, 'quêtes');
  if (xp) await grantXp(member, xp, { channel, weekly: true, source: 'quetes' });

  return { xp, coins, gems, count };
}
