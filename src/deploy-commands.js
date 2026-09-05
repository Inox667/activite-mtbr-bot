// ==========================================================================
//  Enregistrement des commandes slash auprès de Discord.
//    node src/deploy-commands.js            -> sur ton serveur (instantané)
//    node src/deploy-commands.js --global   -> global (propagation ~1 h)
// ==========================================================================
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isGlobal = process.argv.includes('--global');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN et CLIENT_ID sont requis dans .env');
  process.exit(1);
}
if (!isGlobal && !GUILD_ID) {
  console.error('❌ GUILD_ID requis pour le déploiement serveur (ou utilise --global).');
  process.exit(1);
}

const commands = [];
const commandsDir = join(__dirname, 'commands');
for (const folder of readdirSync(commandsDir)) {
  const folderPath = join(commandsDir, folder);
  for (const file of readdirSync(folderPath).filter((f) => f.endsWith('.js'))) {
    const mod = await import(pathToFileURL(join(folderPath, file)).href);
    const command = mod.default ?? mod;
    if (command?.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(DISCORD_TOKEN);

try {
  console.log(`Déploiement de ${commands.length} commandes (${isGlobal ? 'GLOBAL' : `serveur ${GUILD_ID}`})...`);
  const route = isGlobal
    ? Routes.applicationCommands(CLIENT_ID)
    : Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);
  const data = await rest.put(route, { body: commands });
  console.log(`✅ ${data.length} commandes enregistrées.`);
} catch (err) {
  console.error('❌ Échec du déploiement:', err);
  process.exit(1);
}
