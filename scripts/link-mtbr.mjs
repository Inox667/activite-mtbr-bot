// ==========================================================================
//  Script à usage unique : lie les rôles de palier et les salons du serveur
//  MTBR au bot, directement en base (IDs fournis par le proprio du serveur).
//  Usage : node scripts/link-mtbr.mjs
// ==========================================================================
import { setLevelRole, clearLevelRoles, setGuildConfig, getLevelRoles, getGuildConfig } from '../src/database/models.js';

const GUILD_ID = '1543713010244124834';

const ROLES = {
  1: '1543752301641076776',
  5: '1543752328451203182',
  10: '1543752358838804481',
  15: '1543752395174051850',
  20: '1543752421547708546',
  25: '1543752446478786661',
  30: '1543752474240745593',
  40: '1543752506146947103',
  50: '1543752532013355038',
  60: '1543752558990852127',
  70: '1543752586962931722',
  80: '1543752619552542811',
  90: '1543752657297080420',
  100: '1543752687089094726',
  150: '1543752714654191696',
};

const CHANNELS = {
  levelup_channel_id: '1543742018855903252',   // 📈┆level-up
  announce_channel_id: '1544081538290028628',  // 📢┆annonces-activité
};

clearLevelRoles(GUILD_ID);
for (const [level, roleId] of Object.entries(ROLES)) {
  setLevelRole(GUILD_ID, Number(level), roleId);
}
setGuildConfig(GUILD_ID, { ...CHANNELS, levelup_mode: 'channel' });

console.log('Rôles de palier liés :', getLevelRoles(GUILD_ID).length);
const g = getGuildConfig(GUILD_ID);
console.log('Salon level-up  :', g.levelup_channel_id);
console.log('Salon annonces  :', g.announce_channel_id);
console.log('Mode level-up   :', g.levelup_mode);
console.log('\n✅ Configuration MTBR appliquée.');
