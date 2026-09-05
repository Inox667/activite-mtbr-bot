// Diagnostic : identité du bot, serveur, autres bots, permissions, commandes.
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, PermissionsBitField } from 'discord.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('clientReady', async (c) => {
  console.log('== BOT ==');
  console.log('tag :', c.user.tag, '| id :', c.user.id);
  console.log('CLIENT_ID .env :', CLIENT_ID, CLIENT_ID === c.user.id ? '(OK)' : '(⚠️ NE CORRESPOND PAS)');

  const guild = c.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.log('\n⚠️ Le bot N\'EST PAS sur le serveur', GUILD_ID);
    console.log('Serveurs du bot :', [...c.guilds.cache.values()].map((g) => `${g.name} (${g.id})`).join(', ') || 'aucun');
    process.exit(0);
  }
  console.log('\n== SERVEUR ==');
  console.log(guild.name, '|', guild.memberCount, 'membres');

  const me = await guild.members.fetchMe();
  const perms = me.permissions;
  console.log('\n== PERMISSIONS DU BOT ==');
  for (const p of ['Administrator', 'ManageRoles', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ViewChannel', 'UseApplicationCommands', 'ManageGuild']) {
    console.log(' ', p, ':', perms.has(PermissionsBitField.Flags[p]) ? '✅' : '❌');
  }
  console.log('  Rôle le plus haut du bot :', me.roles.highest.name, `(position ${me.roles.highest.position})`);

  console.log('\n== AUTRES BOTS SUR LE SERVEUR ==');
  const members = await guild.members.fetch();
  const bots = members.filter((m) => m.user.bot);
  for (const b of bots.values()) console.log(' ', b.user.tag, '| id', b.user.id, b.user.id === c.user.id ? '← CE BOT' : '');

  console.log('\n== COMMANDES ENREGISTRÉES (cette app, ce serveur) ==');
  const rest = new REST().setToken(DISCORD_TOKEN);
  const cmds = await rest.get(Routes.applicationGuildCommands(c.user.id, GUILD_ID));
  console.log(' ', cmds.length, 'commandes :', cmds.map((x) => x.name).slice(0, 8).join(', '), '…');
  const globalCmds = await rest.get(Routes.applicationCommands(c.user.id));
  console.log('  (global :', globalCmds.length, ')');

  process.exit(0);
});

client.on('error', (e) => { console.error('client error', e.message); process.exit(1); });
client.login(DISCORD_TOKEN).catch((e) => { console.error('LOGIN ÉCHOUÉ :', e.message); process.exit(1); });
setTimeout(() => { console.error('timeout'); process.exit(1); }, 20000);
