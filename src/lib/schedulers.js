// ==========================================================================
//  Tâches planifiées : reset hebdomadaire du classement + podium.
// ==========================================================================
import { config } from '../config.js';
import {
  getGuildConfig, setGuildConfig, resetWeekly, addCoins, addGems,
} from '../database/models.js';
import { baseEmbed } from './embeds.js';
import { fmt } from './format.js';

/** Prochain timestamp (s) correspondant au jour/heure de reset configurés. */
export function nextWeeklyReset(from = new Date()) {
  const { resetDay, resetHour } = config.weeklyLeaderboard;
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(resetHour);
  let diff = (resetDay - d.getDay() + 7) % 7;
  if (diff === 0 && d.getTime() <= from.getTime()) diff = 7;
  d.setDate(d.getDate() + diff);
  return Math.floor(d.getTime() / 1000);
}

async function runWeeklyReset(client, guild) {
  const top = resetWeekly(guild.id); // [{user_id, value, ...}]
  setGuildConfig(guild.id, { weekly_reset_at: nextWeeklyReset() });

  const g = getGuildConfig(guild.id);
  const chId = g.announce_channel_id || g.levelup_channel_id;
  const ch = chId && guild.channels.cache.get(chId);

  const medals = ['🥇', '🥈', '🥉'];
  const lines = [];
  for (let i = 0; i < top.length; i++) {
    const prize = config.weeklyLeaderboard.podiumCoins[i] ?? 0;
    const gemPrize = config.weeklyLeaderboard.podiumGems[i] ?? 0;
    if (prize) addCoins(guild.id, top[i].user_id, prize, 'podium hebdo');
    if (gemPrize) addGems(guild.id, top[i].user_id, gemPrize, 'podium hebdo');
    const rw = [prize && `+${fmt(prize)} ${config.emojis.coin}`, gemPrize && `+${fmt(gemPrize)} ${config.emojis.gem}`].filter(Boolean).join(' ');
    lines.push(`${medals[i]} <@${top[i].user_id}> — **${fmt(top[i].value)}** XP` + (rw ? ` (${rw})` : ''));
  }

  if (ch?.isTextBased()) {
    const embed = baseEmbed(config.colors.coins)
      .setTitle('🏆 Classement hebdomadaire — Résultats')
      .setDescription(lines.length ? lines.join('\n') : 'Personne n\'a gagné d\'XP cette semaine.')
      .setFooter({ text: 'Le classement repart de zéro. Bonne semaine !' });
    try { await ch.send({ embeds: [embed] }); } catch { /* ignore */ }
  }
  console.log(`[scheduler] reset hebdo effectué pour ${guild.name}`);
}

export function startSchedulers(client) {
  const tick = async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const guild of client.guilds.cache.values()) {
      const g = getGuildConfig(guild.id);
      if (!g.weekly_reset_at) {
        setGuildConfig(guild.id, { weekly_reset_at: nextWeeklyReset() });
        continue;
      }
      if (now >= g.weekly_reset_at) {
        try { await runWeeklyReset(client, guild); }
        catch (e) { console.error('[scheduler] reset hebdo:', e); }
      }
    }
  };
  tick();
  setInterval(tick, 5 * 60_000);
}
