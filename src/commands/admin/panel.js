// ==========================================================================
//  /panel — panneau d'administration interactif (boutons + menus + modals).
//  Regroupe tout ce qui est éparpillé dans /config, /xp-admin, /eco-admin,
//  /setup et /boutique-admin en une seule interface simple.
// ==========================================================================
import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType,
} from 'discord.js';
import { config, levelFromXp, totalXpForLevel } from '../../config.js';
import {
  getGuildConfig, setGuildConfig, getUser, updateUser,
  addCoins, removeCoins, addGems, removeGems,
  getLevelRoles, setLevelRole, clearLevelRoles,
  getShopItems, getShopItem, upsertShopItem,
} from '../../database/models.js';
import { grantXp, syncLevelRoles } from '../../lib/leveling.js';
import { nowSec } from '../../lib/cooldowns.js';
import { fmt } from '../../lib/format.js';

const C = config.colors;
const SEED = [
  { item_id: 'boost-xp-500', name: 'Boost XP +500', emoji: '✨', price: 1500, type: 'consumable', description: 'Ajoute 500 XP.', data: { effect: 'xp', value: 500 } },
  { item_id: 'sac-de-coins', name: 'Sac de coins', emoji: '💰', price: 900, type: 'consumable', description: 'Contient 1 000 coins.', data: { effect: 'coins', value: 1000 } },
  { item_id: 'caisse-mystere', name: 'Caisse mystère', emoji: '🎁', price: 1200, type: 'consumable', description: 'Récompense aléatoire.', data: { effect: 'lootbox' } },
  { item_id: 'trophee-collector', name: 'Trophée du collectionneur', emoji: '🏆', price: 25000, type: 'collectible', description: 'Objet de prestige.' },
  { item_id: 'boost-xp-5000', name: 'Boost XP +5000', emoji: '🌟', price: 8, type: 'consumable', currency: 'gems', description: 'Ajoute 5 000 XP.', data: { effect: 'xp', value: 5000 } },
  { item_id: 'coffre-premium', name: 'Coffre premium', emoji: '🧰', price: 10, type: 'consumable', currency: 'gems', description: 'Grosse récompense aléatoire.', data: { effect: 'lootbox' } },
  { item_id: 'badge-vip', name: 'Badge VIP', emoji: '💎', price: 40, type: 'badge', currency: 'gems', description: 'Le badge le plus classe.' },
];

const SECTIONS = [
  { value: 'home', label: 'Accueil', emoji: '🏠', desc: 'Vue d\'ensemble' },
  { value: 'xp', label: 'Système XP', emoji: '🎚️', desc: 'Activer, multiplicateur, event ×2' },
  { value: 'bonus', label: 'Bonus d\'XP', emoji: '✨', desc: 'Boost / tag / pub' },
  { value: 'member', label: 'Gérer un membre', emoji: '👤', desc: 'Coins, gems, XP, niveau' },
  { value: 'channels', label: 'Salons', emoji: '📢', desc: 'Level-up, annonces, ignorés, double XP' },
  { value: 'roles', label: 'Rôles de palier', emoji: '🎭', desc: 'Détecter, resynchroniser' },
  { value: 'shop', label: 'Boutique', emoji: '🛒', desc: 'Articles par défaut, liste' },
];

function pctTxt(v) { return v > 0 ? `+${Math.round(v * 100)} %` : '—'; }

// ---- Rendu -----------------------------------------------------------
function render(guild, state, note) {
  const g = getGuildConfig(guild.id);
  const section = SECTIONS.find((s) => s.value === state.section) ?? SECTIONS[0];

  const embed = new EmbedBuilder()
    .setColor(C.primary)
    .setTitle('🛠️ Panneau d\'administration — MTBR')
    .setFooter({ text: `Section : ${section.label} · seul ${state.invokerTag} peut utiliser ce panneau` })
    .setTimestamp();

  if (note) embed.setDescription(`✅ ${note}`);

  if (state.section === 'home') {
    const roles = getLevelRoles(guild.id).length;
    embed.addFields(
      { name: '🎚️ XP', value: `${g.xp_enabled ? 'activée' : 'désactivée'} · ×${g.xp_multiplier}` + (g.event_expires_at > nowSec() ? ` · event ×${g.event_multiplier}` : ''), inline: true },
      { name: '✨ Bonus', value: `boost ${pctTxt(g.booster_bonus)} · tag ${pctTxt(g.tag_bonus)} · pub ${pctTxt(g.promo_bonus)}`, inline: true },
      { name: '🎭 Rôles de palier', value: `${roles}/${config.levelRoles.length} liés`, inline: true },
      { name: '📢 Salon level-up', value: g.levelup_channel_id ? `<#${g.levelup_channel_id}>` : '_non défini_', inline: true },
      { name: '📢 Salon annonces', value: g.announce_channel_id ? `<#${g.announce_channel_id}>` : '_non défini_', inline: true },
      { name: '🛒 Boutique', value: `${getShopItems(guild.id, true).length} article(s)`, inline: true },
    );
  } else if (state.section === 'xp') {
    embed.addFields(
      { name: 'État', value: g.xp_enabled ? '🟢 XP activée' : '🔴 XP désactivée', inline: true },
      { name: 'Multiplicateur serveur', value: `×${g.xp_multiplier}`, inline: true },
      { name: 'Event XP', value: g.event_expires_at > nowSec() ? `×${g.event_multiplier} (actif)` : '—', inline: true },
    );
  } else if (state.section === 'bonus') {
    embed.addFields(
      { name: '🚀 Boost du serveur', value: pctTxt(g.booster_bonus), inline: true },
      { name: '🏷️ Tag du serveur', value: pctTxt(g.tag_bonus), inline: true },
      { name: '📣 Pub dans le statut', value: pctTxt(g.promo_bonus) + (g.promo_text ? `\n\`${g.promo_text}\`` : ''), inline: true },
    );
    if (g.promo_bonus > 0 && process.env.ENABLE_PRESENCE_INTENT !== 'true') {
      embed.addFields({ name: '⚠️ Pub inactive', value: 'Mets `ENABLE_PRESENCE_INTENT=true` dans `.env` + PRESENCE INTENT dans le portail, puis relance.' });
    }
  } else if (state.section === 'member') {
    if (state.userId) {
      const u = getUser(guild.id, state.userId);
      const { level } = levelFromXp(u.xp);
      embed.addFields(
        { name: 'Membre', value: `<@${state.userId}>`, inline: false },
        { name: '🪙 Coins', value: fmt(u.coins), inline: true },
        { name: '🏦 Banque', value: fmt(u.bank), inline: true },
        { name: '💎 Gems', value: fmt(u.gems), inline: true },
        { name: '✨ XP', value: `${fmt(u.xp)} (niv. ${level})`, inline: true },
        { name: '⭐ Prestige', value: `${u.prestige}`, inline: true },
      );
    } else {
      embed.setDescription((note ? `✅ ${note}\n\n` : '') + 'Choisis un membre dans le menu ci-dessous.');
    }
  } else if (state.section === 'channels') {
    embed.addFields(
      { name: 'Level-up', value: g.levelup_channel_id ? `<#${g.levelup_channel_id}>` : '_non défini_', inline: true },
      { name: 'Annonces', value: g.announce_channel_id ? `<#${g.announce_channel_id}>` : '_non défini_', inline: true },
      { name: 'Salons ignorés', value: g.ignored_channels.map((c) => `<#${c}>`).join(' ') || '_aucun_', inline: false },
      { name: 'Salons double XP', value: g.double_xp_channels.map((c) => `<#${c}>`).join(' ') || '_aucun_', inline: false },
    );
    embed.setDescription((note ? `✅ ${note}\n\n` : '') + (state.channelId ? `Salon sélectionné : <#${state.channelId}>` : 'Choisis un salon puis clique une action.'));
  } else if (state.section === 'roles') {
    const rows = getLevelRoles(guild.id);
    embed.addFields({
      name: `Rôles de palier liés (${rows.length}/${config.levelRoles.length})`,
      value: config.levelRoles.map((r) => {
        const found = rows.find((x) => x.level === r.level);
        return `${found ? '✅' : '❌'} Niv. ${r.level} — ${found ? `<@&${found.role_id}>` : r.name}`;
      }).join('\n').slice(0, 1024),
    });
  } else if (state.section === 'shop') {
    const items = getShopItems(guild.id, true);
    embed.addFields({
      name: `Articles (${items.length})`,
      value: items.map((i) => `${i.enabled ? '🟢' : '⚪'} ${i.emoji} ${i.name} — ${fmt(i.price)} ${i.currency === 'gems' ? '💎' : '🪙'}`).join('\n').slice(0, 1024) || '_Aucun article._',
    });
  }

  return { embeds: [embed], components: components(guild, state) };
}

function menuRow(state) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('nav').setPlaceholder('📂 Choisir une section…')
      .addOptions(SECTIONS.map((s) => ({
        label: s.label, value: s.value, description: s.desc, emoji: s.emoji, default: s.value === state.section,
      }))),
  );
}

function btn(id, label, style = ButtonStyle.Secondary, emoji) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
}

function components(guild, state) {
  const rows = [menuRow(state)];

  if (state.section === 'xp') {
    rows.push(new ActionRowBuilder().addComponents(
      btn('xp:on', 'XP ON', ButtonStyle.Success),
      btn('xp:off', 'XP OFF', ButtonStyle.Danger),
      btn('xp:mult', 'Multiplicateur…', ButtonStyle.Primary),
      btn('xp:event', 'Event ×2 (24 h)', ButtonStyle.Primary),
      btn('xp:event_stop', 'Stop event'),
    ));
  } else if (state.section === 'bonus') {
    rows.push(new ActionRowBuilder().addComponents(
      btn('bonus:boost', 'Bonus boost %…', ButtonStyle.Primary, '🚀'),
      btn('bonus:tag', 'Bonus tag %…', ButtonStyle.Primary, '🏷️'),
      btn('bonus:pub', 'Bonus pub %…', ButtonStyle.Primary, '📣'),
    ));
  } else if (state.section === 'member') {
    rows.push(new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId('member_pick').setPlaceholder('👤 Choisir un membre…').setMaxValues(1),
    ));
    const dis = !state.userId;
    rows.push(new ActionRowBuilder().addComponents(
      btn('m:coins+', '+ Coins', ButtonStyle.Success).setDisabled(dis),
      btn('m:coins-', '− Coins', ButtonStyle.Danger).setDisabled(dis),
      btn('m:gems+', '+ Gems', ButtonStyle.Success).setDisabled(dis),
      btn('m:gems-', '− Gems', ButtonStyle.Danger).setDisabled(dis),
    ));
    rows.push(new ActionRowBuilder().addComponents(
      btn('m:xp+', '+ XP', ButtonStyle.Success).setDisabled(dis),
      btn('m:xp-', '− XP', ButtonStyle.Danger).setDisabled(dis),
      btn('m:level', 'Définir niveau…', ButtonStyle.Primary).setDisabled(dis),
      btn('m:reset', 'Reset XP', ButtonStyle.Danger).setDisabled(dis),
    ));
  } else if (state.section === 'channels') {
    rows.push(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('channel_pick').setPlaceholder('📢 Choisir un salon…')
        .addChannelTypes(ChannelType.GuildText).setMaxValues(1),
    ));
    const dis = !state.channelId;
    rows.push(new ActionRowBuilder().addComponents(
      btn('c:levelup', '= Level-up', ButtonStyle.Primary).setDisabled(dis),
      btn('c:announce', '= Annonces', ButtonStyle.Primary).setDisabled(dis),
      btn('c:ignore', 'Toggle ignoré', ButtonStyle.Secondary).setDisabled(dis),
      btn('c:double', 'Toggle double XP', ButtonStyle.Secondary).setDisabled(dis),
    ));
  } else if (state.section === 'roles') {
    rows.push(new ActionRowBuilder().addComponents(
      btn('r:detect', 'Détecter par nom', ButtonStyle.Primary, '🔍'),
      btn('r:sync', 'Resynchroniser tout le monde', ButtonStyle.Secondary, '🔄'),
    ));
  } else if (state.section === 'shop') {
    rows.push(new ActionRowBuilder().addComponents(
      btn('s:seed', 'Ajouter les articles par défaut', ButtonStyle.Success, '📦'),
    ));
  }

  return rows;
}

// ---- Modals ---------------------------------------------------------
function numberModal(id, title, label, placeholder = 'ex : 100') {
  return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('value').setLabel(label).setStyle(TextInputStyle.Short)
        .setPlaceholder(placeholder).setRequired(true),
    ),
  );
}

async function askNumber(btnInter, title, label, placeholder) {
  const id = `m_${btnInter.id}`;
  await btnInter.showModal(numberModal(id, title, label, placeholder));
  const sub = await btnInter.awaitModalSubmit({ time: 120_000, filter: (i) => i.customId === id }).catch(() => null);
  if (!sub) return null;
  await sub.deferUpdate();
  const raw = sub.fields.getTextInputValue('value').replace(/\s|,/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? { n, sub } : { n: null, sub };
}

// ---- Commande ------------------------------------------------------
export default {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Panneau d\'administration tout-en-un')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guild = interaction.guild;
    const state = { section: 'home', userId: null, channelId: null, invokerTag: interaction.user.username };

    const msg = await interaction.reply({ ...render(guild, state), fetchReply: true });

    const col = msg.createMessageComponentCollector({ time: 5 * 60_000 });

    col.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'Ce panneau n\'est pas le tien. Lance ta propre commande `/panel`.', ephemeral: true });
      }
      col.resetTimer();

      try {
        // --- Navigation
        if (i.customId === 'nav') {
          state.section = i.values[0];
          return i.update(render(guild, state));
        }
        if (i.customId === 'member_pick') {
          state.userId = i.values[0];
          return i.update(render(guild, state));
        }
        if (i.customId === 'channel_pick') {
          state.channelId = i.values[0];
          return i.update(render(guild, state));
        }

        // --- Section XP
        if (i.customId === 'xp:on') { setGuildConfig(guild.id, { xp_enabled: 1 }); return i.update(render(guild, state, 'Gain d\'XP activé.')); }
        if (i.customId === 'xp:off') { setGuildConfig(guild.id, { xp_enabled: 0 }); return i.update(render(guild, state, 'Gain d\'XP désactivé.')); }
        if (i.customId === 'xp:event_stop') { setGuildConfig(guild.id, { event_multiplier: 1, event_expires_at: 0 }); return i.update(render(guild, state, 'Event XP arrêté.')); }
        if (i.customId === 'xp:event') {
          setGuildConfig(guild.id, { event_multiplier: 2, event_expires_at: nowSec() + 24 * 3600 });
          return i.update(render(guild, state, 'Event ×2 lancé pour 24 h.'));
        }
        if (i.customId === 'xp:mult') {
          const r = await askNumber(i, 'Multiplicateur d\'XP serveur', 'Valeur (0.1 à 5)', 'ex : 1.5');
          if (!r) return;
          if (r.n == null || r.n < 0.1 || r.n > 5) return r.sub.followUp({ content: 'Valeur invalide (0.1 – 5).', ephemeral: true });
          setGuildConfig(guild.id, { xp_multiplier: r.n });
          return msg.edit(render(guild, state, `Multiplicateur serveur : ×${r.n}.`));
        }

        // --- Section Bonus
        if (i.customId.startsWith('bonus:')) {
          const kind = i.customId.split(':')[1];
          const map = { boost: ['booster_bonus', 'Bonus boost'], tag: ['tag_bonus', 'Bonus tag'], pub: ['promo_bonus', 'Bonus pub'] };
          const [key, name] = map[kind];
          const r = await askNumber(i, name, 'Pourcentage (0 = désactivé, max 500)', 'ex : 50');
          if (!r) return;
          if (r.n == null || r.n < 0 || r.n > 500) return r.sub.followUp({ content: 'Pourcentage invalide (0 – 500).', ephemeral: true });
          setGuildConfig(guild.id, { [key]: r.n / 100 });
          return msg.edit(render(guild, state, `${name} : ${r.n > 0 ? `+${r.n} %` : 'désactivé'}.`));
        }

        // --- Section Membre
        if (i.customId.startsWith('m:')) {
          if (!state.userId) return i.reply({ content: 'Choisis d\'abord un membre.', ephemeral: true });
          const uid = state.userId;
          const member = await guild.members.fetch(uid).catch(() => null);
          const act = i.customId.split(':')[1];

          if (act === 'reset') {
            updateUser(guild.id, uid, { xp: 0, weekly_xp: 0, level: 0 });
            if (member) await syncLevelRoles(member, 0);
            return i.update(render(guild, state, `XP de <@${uid}> remise à zéro.`));
          }

          const labels = {
            'coins+': ['Ajouter des coins', 'Montant'], 'coins-': ['Retirer des coins', 'Montant'],
            'gems+': ['Ajouter des gems', 'Montant'], 'gems-': ['Retirer des gems', 'Montant'],
            'xp+': ['Ajouter de l\'XP', 'Montant'], 'xp-': ['Retirer de l\'XP', 'Montant'],
            level: ['Définir le niveau', `Niveau (0 à ${config.leveling.maxLevel})`],
          };
          const r = await askNumber(i, labels[act][0], labels[act][1], 'ex : 1000');
          if (!r) return;
          if (r.n == null || r.n < 0) return r.sub.followUp({ content: 'Valeur invalide.', ephemeral: true });
          const amount = Math.floor(r.n);
          let done = '';

          if (act === 'coins+') { addCoins(guild.id, uid, amount, `panel:${interaction.user.id}`); done = `+${fmt(amount)} coins`; }
          else if (act === 'coins-') { const u = getUser(guild.id, uid); removeCoins(guild.id, uid, Math.min(amount, u.coins), `panel:${interaction.user.id}`); done = `−${fmt(amount)} coins`; }
          else if (act === 'gems+') { addGems(guild.id, uid, amount, `panel:${interaction.user.id}`); done = `+${fmt(amount)} gems`; }
          else if (act === 'gems-') { const u = getUser(guild.id, uid); removeGems(guild.id, uid, Math.min(amount, u.gems), `panel:${interaction.user.id}`); done = `−${fmt(amount)} gems`; }
          else if (act === 'xp+') { if (member) await grantXp(member, amount, { channel: interaction.channel, weekly: false, source: 'panel' }); done = `+${fmt(amount)} XP`; }
          else if (act === 'xp-') { if (member) { const res = await grantXp(member, -amount, { weekly: false, source: 'panel', silent: true }); await syncLevelRoles(member, res.newLevel); } done = `−${fmt(amount)} XP`; }
          else if (act === 'level') {
            if (r.n > config.leveling.maxLevel) return r.sub.followUp({ content: `Niveau max ${config.leveling.maxLevel}.`, ephemeral: true });
            updateUser(guild.id, uid, { xp: totalXpForLevel(amount), level: amount });
            if (member) await syncLevelRoles(member, amount);
            done = `niveau ${amount}`;
          }
          return msg.edit(render(guild, state, `<@${uid}> : ${done}.`));
        }

        // --- Section Salons
        if (i.customId.startsWith('c:')) {
          if (!state.channelId) return i.reply({ content: 'Choisis d\'abord un salon.', ephemeral: true });
          const ch = state.channelId;
          const act = i.customId.split(':')[1];
          const g = getGuildConfig(guild.id);
          if (act === 'levelup') { setGuildConfig(guild.id, { levelup_channel_id: ch, levelup_mode: 'channel' }); return i.update(render(guild, state, `Salon level-up : <#${ch}>.`)); }
          if (act === 'announce') { setGuildConfig(guild.id, { announce_channel_id: ch }); return i.update(render(guild, state, `Salon annonces : <#${ch}>.`)); }
          if (act === 'ignore') {
            const set = new Set(g.ignored_channels);
            const on = !set.has(ch); on ? set.add(ch) : set.delete(ch);
            setGuildConfig(guild.id, { ignored_channels: [...set] });
            return i.update(render(guild, state, `<#${ch}> ${on ? 'ne donne plus' : 'redonne'} d'XP.`));
          }
          if (act === 'double') {
            const set = new Set(g.double_xp_channels);
            const on = !set.has(ch); on ? set.add(ch) : set.delete(ch);
            setGuildConfig(guild.id, { double_xp_channels: [...set] });
            return i.update(render(guild, state, `Double XP ${on ? 'activé' : 'désactivé'} dans <#${ch}>.`));
          }
        }

        // --- Section Rôles
        if (i.customId === 'r:detect') {
          await i.deferUpdate();
          await guild.roles.fetch();
          clearLevelRoles(guild.id);
          let ok = 0;
          for (const entry of config.levelRoles) {
            const role = guild.roles.cache.find((rr) => rr.name.toLowerCase().includes(entry.name.toLowerCase())
              || new RegExp(`\\b(lvl|niv(?:eau)?)\\s*${entry.level}\\b`, 'i').test(rr.name));
            if (role) { setLevelRole(guild.id, entry.level, role.id); ok++; }
          }
          return msg.edit(render(guild, state, `${ok}/${config.levelRoles.length} rôles de palier détectés et liés.`));
        }
        if (i.customId === 'r:sync') {
          if (!getLevelRoles(guild.id).length) return i.reply({ content: 'Fais d\'abord « Détecter par nom ».', ephemeral: true });
          await i.deferUpdate();
          const members = await guild.members.fetch();
          let n = 0;
          for (const m of members.values()) {
            if (m.user.bot) continue;
            await syncLevelRoles(m, levelFromXp(getUser(guild.id, m.id).xp).level);
            n++;
          }
          return msg.edit(render(guild, state, `Rôles recalculés pour ${n} membres.`));
        }

        // --- Section Boutique
        if (i.customId === 's:seed') {
          let n = 0;
          for (const it of SEED) if (!getShopItem(guild.id, it.item_id)) { upsertShopItem(guild.id, { ...it, enabled: 1 }); n++; }
          return i.update(render(guild, state, `${n} article(s) par défaut ajouté(s).`));
        }
      } catch (err) {
        console.error('[panel]', err);
        if (!i.replied && !i.deferred) i.reply({ content: 'Erreur pendant l\'action.', ephemeral: true }).catch(() => {});
      }
    });

    col.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
