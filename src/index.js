// ==========================================================================
//  Point d'entrée du bot MTBR.
// ==========================================================================
import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials, Events } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { replyError } from './lib/embeds.js';
import { startVoiceTracker } from './events/voiceStateUpdate.js';
import { startSchedulers } from './lib/schedulers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant. Copie .env.example vers .env et remplis-le.');
  process.exit(1);
}

// L'intent Presence n'est nécessaire que pour le bonus "pub dans le statut".
// Il faut aussi l'activer dans le Developer Portal (PRESENCE INTENT).
// Active-le ici avec ENABLE_PRESENCE_INTENT=true dans le .env.
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMembers,
];
if (process.env.ENABLE_PRESENCE_INTENT === 'true') {
  intents.push(GatewayIntentBits.GuildPresences);
}

const client = new Client({ intents, partials: [Partials.Channel] });

client.commands = new Collection();
client.cooldowns = new Collection();

// --- Chargement des commandes -------------------------------------------
const commandsDir = join(__dirname, 'commands');
let loaded = 0;
for (const folder of readdirSync(commandsDir)) {
  const folderPath = join(commandsDir, folder);
  for (const file of readdirSync(folderPath).filter((f) => f.endsWith('.js'))) {
    const mod = await import(pathToFileURL(join(folderPath, file)).href);
    const command = mod.default ?? mod;
    if (command?.data && command?.execute) {
      client.commands.set(command.data.name, command);
      loaded++;
    } else {
      console.warn(`[commands] ${folder}/${file} ignoré (data/execute manquant).`);
    }
  }
}
console.log(`[commands] ${loaded} commandes chargées.`);

// --- Interactions -------------------------------------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) await command.autocomplete(interaction);
    }
  } catch (err) {
    console.error(`[interaction] erreur sur /${interaction.commandName}:`, err);
    try { await replyError(interaction, 'Une erreur est survenue pendant l\'exécution de la commande.'); }
    catch { /* ignore */ }
  }
});

// --- Événements de message (XP) ----------------------------------------
const messageEvent = (await import('./events/messageCreate.js')).default;
client.on(Events.MessageCreate, (msg) => messageEvent(msg).catch((e) => console.error('[messageCreate]', e)));

// --- Ready -------------------------------------------------------------
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Connecté en tant que ${c.user.tag}`);
  c.user.setActivity('MTBR • /help', { type: 0 });
  startVoiceTracker(c);
  startSchedulers(c);
});

// On log mais on NE quitte PAS : un bug isolé dans un handler ne doit pas
// faire tomber tout le bot.
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
process.on('exit', (code) => console.error(`[exit] le process se termine avec le code ${code}`));
process.on('beforeExit', (code) => console.error(`[beforeExit] plus rien à faire (code ${code}) — la boucle d'événements s'est vidée`));
process.on('warning', (w) => { if (w.name !== 'DeprecationWarning') console.warn('[warning]', w.name, w.message); });

// --- Arrêt propre : checkpoint WAL + fermeture DB ---------------------
import { db } from './database/db.js';
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[shutdown] ${signal} — fermeture propre…`);
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close(); } catch (e) { console.warn('[shutdown] db:', e.message); }
  try { client.destroy(); } catch { /* ignore */ }
  process.exit(0);
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(sig, () => shutdown(sig));
}
// Checkpoint périodique : persiste le WAL dans la base même si le process est
// tué brutalement (SIGTERM/SIGKILL pas toujours catchable sous Windows).
setInterval(() => {
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* ignore */ }
}, 60_000);

client.login(process.env.DISCORD_TOKEN);
