// ==========================================================================
//  XP vocal : balayage périodique (toutes les 60 s) des salons vocaux.
//  Chaque humain éligible reçoit config.leveling.voice.xpPerMinute.
// ==========================================================================
import { config } from '../config.js';
import { getGuildConfig, incrementUser, effectiveXpMultiplier, bumpActivity } from '../database/models.js';
import { grantXp } from '../lib/leveling.js';
import { trackMission, currentMissionDay } from '../lib/missions.js';
import { memberXpBonus } from '../lib/xpBonus.js';

function eligibleMembers(channel) {
  const humans = channel.members.filter((m) => !m.user.bot);
  if (config.leveling.voice.requireOthers && humans.size < 2) return [];
  return [...humans.values()].filter((m) => {
    const vs = m.voice;
    if (config.leveling.voice.ignoreAfk && channel.guild.afkChannelId === channel.id) return false;
    if (config.leveling.voice.ignoreMutedOrDeaf && (vs.selfMute || vs.selfDeaf || vs.mute || vs.deaf)) return false;
    return true;
  });
}

export function startVoiceTracker(client) {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      const g = getGuildConfig(guild.id);
      if (!g.xp_enabled) continue;

      for (const channel of guild.channels.cache.values()) {
        if (channel.type !== 2) continue; // GuildVoice
        if (g.ignored_channels.includes(channel.id)) continue;

        const day = currentMissionDay();
        for (const member of eligibleMembers(channel)) {
          incrementUser(guild.id, member.id, { voice_minutes: 1 });
          bumpActivity(guild.id, member.id, day, { voice_minutes: 1 });
          trackMission(guild.id, member.id, 'voice', 1);
          const amount = config.leveling.voice.xpPerMinute
            * effectiveXpMultiplier(guild.id)
            * memberXpBonus(member, g).multiplier;
          try {
            const res = await grantXp(member, amount, { source: 'voice', silent: false });
            bumpActivity(guild.id, member.id, day, { xp: res.gained ?? Math.round(amount) });
          } catch (e) {
            console.warn('[voice] grantXp:', e.message);
          }
        }
      }
    }
  }, 60_000);
}
