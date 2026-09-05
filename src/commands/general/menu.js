// ==========================================================================
//  /menu — hub joueur. Une commande pour tout : gains, quêtes, caisse, profil.
// ==========================================================================
import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { config, levelFromXp } from '../../config.js';
import {
  getUser, getRank, countMembers, roleTierForLevel, updateUser, addCoins, addGems, addItem,
} from '../../database/models.js';
import { readyStatus, CLAIMERS, ACTIONS } from '../../lib/collect.js';
import { questFields, claimAllQuests } from '../../lib/quests.js';
import { checkCooldown, nowSec } from '../../lib/cooldowns.js';
import { CASES, RARITIES } from '../../data/cases.js';
import { weighted, randInt, fmt, duration, progressBar, slug } from '../../lib/format.js';
import { grantXp } from '../../lib/leveling.js';
import { trackMission } from '../../lib/missions.js';

const SECTIONS = [
  { value: 'home', label: 'Accueil', emoji: '🏠', desc: 'Ton résumé' },
  { value: 'gains', label: 'Gains', emoji: '💰', desc: 'Daily, work, pêche, mine…' },
  { value: 'quetes', label: 'Quêtes', emoji: '📋', desc: 'Missions du jour / semaine / mois' },
  { value: 'caisses', label: 'Caisses', emoji: '🗃️', desc: 'Caisse gratuite + infos' },
  { value: 'profil', label: 'Profil', emoji: '📊', desc: 'Tes stats complètes' },
];

function navRow(section) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('nav').setPlaceholder('📂 Naviguer…')
      .addOptions(SECTIONS.map((s) => ({ label: s.label, value: s.value, emoji: s.emoji, description: s.desc, default: s.value === section }))),
  );
}

function playerCard(guild, member) {
  const u = getUser(guild.id, member.id);
  const { level, xpIntoLevel, xpNeeded } = levelFromXp(u.xp);
  const rank = getRank(guild.id, member.id, 'xp') ?? '—';
  const tier = roleTierForLevel(guild.id, level);
  return { u, level, xpIntoLevel, xpNeeded, rank, tier };
}

function render(guild, member, section, note) {
  const { u, level, xpIntoLevel, xpNeeded, rank, tier } = playerCard(guild, member);
  const ready = readyStatus(u);
  const nReady = Object.values(ready).filter((r) => r.ready).length;
  const q = questFields(guild.id, member.id);

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
    .setFooter({ text: `Menu · seul ${member.displayName} peut l'utiliser` });
  if (note) embed.setDescription(`✅ ${note}`);

  const rows = [navRow(section)];

  if (section === 'home') {
    embed.setTitle('🏠 Ton menu MTBR')
      .addFields(
        {
          name: `Niveau ${fmt(level)}${u.prestige ? ` · ★${u.prestige}` : ''}`,
          value: `${progressBar(xpIntoLevel, xpNeeded)}\n${fmt(xpIntoLevel)} / ${fmt(xpNeeded)} XP · Rang #${fmt(rank)}/${fmt(countMembers(guild.id))}`
            + (tier ? `\nPalier : <@&${tier.role_id}>` : ''),
          inline: false,
        },
        { name: '🪙 Coins', value: `${fmt(u.coins)} (+ ${fmt(u.bank)} banque)`, inline: true },
        { name: '💎 Gems', value: `${fmt(u.gems)}`, inline: true },
        { name: '​', value: '​', inline: true },
        { name: '💰 Gains prêts', value: nReady ? `**${nReady}** / 6 disponibles` : 'aucun pour l\'instant', inline: true },
        { name: '📋 Quêtes', value: q.claimable ? '**récompenses à récupérer !**' : 'rien à récupérer', inline: true },
      )
      .addFields({
        name: 'Autres commandes',
        value: '🎰 `/machine` `/blackjack` `/roulette` `/pileouface` `/dé` · ⚔️ `/duel` · 🧠 `/quiz`\n'
          + '🗃️ `/caisse` · 🛒 `/boutique` · 🏆 `/classement` · 🤝 `/donner` · 🎒 `/inventaire`',
      });
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('go:gains').setLabel('Récupérer mes gains').setEmoji('💰').setStyle(ButtonStyle.Success).setDisabled(nReady === 0),
      new ButtonBuilder().setCustomId('go:quetes').setLabel('Mes quêtes').setEmoji('📋').setStyle(q.claimable ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('claimall').setLabel('Tout réclamer').setEmoji('✨').setStyle(ButtonStyle.Primary).setDisabled(nReady === 0 && !q.claimable),
    ));
  } else if (section === 'gains') {
    embed.setTitle('💰 Gains réguliers').setDescription(note ? `✅ ${note}` : 'Clique ce qui est prêt. Les grisés reviennent bientôt.');
    const btns = Object.entries(ACTIONS).map(([key, a]) => {
      const st = ready[key];
      const b = new ButtonBuilder().setCustomId(`claim:${key}`).setEmoji(a.emoji);
      if (st.ready) b.setLabel(a.label).setStyle(key === 'crime' ? ButtonStyle.Danger : ButtonStyle.Success);
      else b.setLabel(`${a.label} · ${duration(st.remaining)}`).setStyle(ButtonStyle.Secondary).setDisabled(true);
      return b;
    });
    rows.push(new ActionRowBuilder().addComponents(btns.slice(0, 3)));
    rows.push(new ActionRowBuilder().addComponents(btns.slice(3, 6)));
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('claimready').setLabel('Tout récupérer').setEmoji('⚡').setStyle(ButtonStyle.Primary)
        .setDisabled(!Object.values(ready).some((r) => r.ready)),
    ));
  } else if (section === 'quetes') {
    embed.setTitle('📋 Quêtes').addFields(q.fields);
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('quests_claim').setLabel('🎁 Tout récupérer').setStyle(ButtonStyle.Success).setDisabled(!q.claimable),
      new ButtonBuilder().setCustomId('refresh').setLabel('🔄 Actualiser').setStyle(ButtonStyle.Secondary),
    ));
  } else if (section === 'caisses') {
    const freeCd = checkCooldown(u.last_case, 22 * 3600);
    embed.setTitle('🗃️ Caisses')
      .setDescription(
        (note ? `✅ ${note}\n\n` : '')
        + `**Caisse gratuite** — ${freeCd.ok ? '✅ disponible !' : `revient dans ${duration(freeCd.remaining)}`}\n`
        + `**Caisse Standard** — ${fmt(CASES.standard.price)} ${config.emojis.coin} · \`/caisse ouvrir caisse:standard\`\n`
        + `**Caisse Premium** — ${fmt(CASES.premium.price)} ${config.emojis.gem} · \`/caisse ouvrir caisse:premium\`\n\n`
        + `Les caisses payantes ont l'animation roulette (via \`/caisse\`).`,
      )
      .addFields({ name: 'Raretés', value: Object.values(RARITIES).map((r) => `${r.emoji} ${r.label}`).join(' · ') });
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('case_free').setLabel('Ouvrir la caisse gratuite').setEmoji('🎁').setStyle(ButtonStyle.Success).setDisabled(!freeCd.ok),
    ));
  } else if (section === 'profil') {
    const winrate = (u.games_won + u.games_lost) > 0 ? Math.round((u.games_won / (u.games_won + u.games_lost)) * 100) : 0;
    embed.setTitle('📊 Tes stats')
      .addFields(
        { name: '📈 Progression', value: `Niveau **${fmt(level)}**${u.prestige ? ` · ★${u.prestige}` : ''}\nXP total : **${fmt(u.xp)}**\nRang XP : **#${fmt(rank)}**`, inline: true },
        { name: '💬 Activité', value: `Messages : **${fmt(u.messages)}**\nVocal : **${fmt(Math.floor(u.voice_minutes / 60))} h**\nSérie /daily : **${u.daily_streak}**`, inline: true },
        { name: '🪙 Richesse', value: `Poche : **${fmt(u.coins)}**\nBanque : **${fmt(u.bank)}**\nGems : **${fmt(u.gems)}**`, inline: true },
        { name: '🎰 Casino', value: `V/D : **${u.games_won}**/**${u.games_lost}** (${winrate}%)\nDuels gagnés : **${u.duels_won}**\nPlus gros gain : **${fmt(u.biggest_win)}**`, inline: true },
        { name: '🗃️ Caisses ouvertes', value: `**${fmt(u.cases_opened)}**`, inline: true },
      )
      .setDescription('Détail par période : `/stats` · Succès : `/succès`');
  }

  return { embeds: [embed], components: rows };
}

export default {
  data: new SlashCommandBuilder().setName('menu').setDescription('Ton menu tout-en-un : gains, quêtes, caisse, profil'),

  async execute(interaction) {
    const { guild, member } = interaction;
    let section = 'home';
    const msg = await interaction.reply({ ...render(guild, member, section), fetchReply: true, ephemeral: true });

    const col = msg.createMessageComponentCollector({ time: 180_000 });
    col.on('collect', async (i) => {
      if (i.user.id !== member.id) return i.reply({ content: 'Lance ta propre commande `/menu`.', ephemeral: true });
      col.resetTimer();
      try {
        if (i.customId === 'nav') { section = i.values[0]; return i.update(render(guild, member, section)); }
        if (i.customId === 'refresh') return i.update(render(guild, member, section));
        if (i.customId.startsWith('go:')) { section = i.customId.slice(3); return i.update(render(guild, member, section)); }

        // --- Gains
        if (i.customId.startsWith('claim:')) {
          const key = i.customId.split(':')[1];
          const r = await CLAIMERS[key]({ member, channel: interaction.channel });
          section = 'gains';
          await i.update(render(guild, member, section));
          return i.followUp({ embeds: [r.embed], ephemeral: true });
        }
        if (i.customId === 'claimready' || i.customId === 'claimall') {
          const st = readyStatus(getUser(guild.id, member.id));
          const done = [];
          for (const key of Object.keys(ACTIONS)) {
            if (st[key].ready) {
              const r = await CLAIMERS[key]({ member, channel: interaction.channel });
              if (r.ok) done.push(r.embed.data.title);
            }
          }
          let qtxt = '';
          if (i.customId === 'claimall') {
            const q = await claimAllQuests({ member, channel: interaction.channel });
            if (q.count) {
              const p = [`+${fmt(q.xp)} XP`, `+${fmt(q.coins)} ${config.emojis.coin}`];
              if (q.gems) p.push(`+${fmt(q.gems)} ${config.emojis.gem}`);
              qtxt = `\n📋 Quêtes : **${p.join(' · ')}**`;
            }
          }
          await i.update(render(guild, member, section));
          return i.followUp({
            content: (done.length ? `⚡ Récupéré : ${done.join(', ')}` : 'Rien à récupérer côté gains.') + qtxt,
            ephemeral: true,
          });
        }

        // --- Quêtes
        if (i.customId === 'quests_claim') {
          const q = await claimAllQuests({ member, channel: interaction.channel });
          await i.update(render(guild, member, section));
          const p = [`+${fmt(q.xp)} XP`, `+${fmt(q.coins)} ${config.emojis.coin}`];
          if (q.gems) p.push(`+${fmt(q.gems)} ${config.emojis.gem}`);
          return i.followUp({ content: q.count ? `🎁 ${q.count} récompense(s) : **${p.join(' · ')}**` : 'Rien à récupérer.', ephemeral: true });
        }

        // --- Caisse gratuite (rapide, sans animation)
        if (i.customId === 'case_free') {
          const u = getUser(guild.id, member.id);
          const cd = checkCooldown(u.last_case, 22 * 3600);
          if (!cd.ok) { await i.update(render(guild, member, 'caisses')); return; }
          updateUser(guild.id, member.id, { last_case: nowSec() });
          const gc = CASES.gratuite;
          const rw = { ...weighted(gc.rewards) };
          if (rw.kind === 'coins') rw.amount = randInt(rw.min, rw.max);

          if (rw.kind === 'coins') addCoins(guild.id, member.id, rw.amount, 'caisse gratuite');
          else if (rw.kind === 'gems') addGems(guild.id, member.id, rw.amount, 'caisse gratuite');
          else if (rw.kind === 'xp') await grantXp(member, rw.amount, { channel: interaction.channel, weekly: true, source: 'caisse' });
          else addItem(guild.id, member.id, `skin-${slug(rw.name)}`, 1, { name: rw.name, emoji: rw.emoji, rarity: rw.rarity, value: rw.value, sellable: true });
          updateUser(guild.id, member.id, { cases_opened: u.cases_opened + 1 });
          trackMission(guild.id, member.id, 'cases_opened', 1);

          const rr = RARITIES[rw.rarity];
          const won = rw.kind === 'coins' ? `**${fmt(rw.amount)}** ${config.emojis.coin}`
            : rw.kind === 'gems' ? `**${fmt(rw.amount)}** ${config.emojis.gem}`
              : rw.kind === 'xp' ? `**${fmt(rw.amount)}** XP`
                : `${rw.emoji} **${rw.name}** _(revente ${fmt(rw.value)} ${config.emojis.coin})_`;
          section = 'caisses';
          await i.update(render(guild, member, section, `Caisse gratuite : ${rr.emoji} ${won}`));
          return;
        }
      } catch (err) {
        console.error('[menu]', err);
        if (!i.replied && !i.deferred) i.reply({ content: 'Erreur.', ephemeral: true }).catch(() => {});
      }
    });
    col.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
