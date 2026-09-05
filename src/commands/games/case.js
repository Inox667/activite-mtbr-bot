import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { config } from '../../config.js';
import {
  getUser, updateUser, incrementUser, addCoins, removeCoins, addGems, removeGems, addItem,
} from '../../database/models.js';
import { grantXp, announceAchievements } from '../../lib/leveling.js';
import { checkAchievements } from '../../lib/achievements.js';
import { trackMission } from '../../lib/missions.js';
import { checkCooldown, nowSec } from '../../lib/cooldowns.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt, weighted, randInt, slug } from '../../lib/format.js';
import { CASES, getCase, RARITIES } from '../../data/cases.js';
import { renderCaseGif, renderCaseReel, caseGifAvailable, caseReelAvailable } from '../../lib/caseRender.js';

const FREE_COOLDOWN_H = 22;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STRIP_LEN = 64;
const WINNER_IDX = 54;
const RARITY_RANK = ['commun', 'peu_commun', 'rare', 'epique', 'legendaire', 'exceptionnel'];

/** Bande d'objets tirés au hasard avec le gain placé à l'index gagnant. */
function buildStrip(gameCase, winner) {
  const strip = Array.from({ length: STRIP_LEN }, () => weighted(gameCase.rewards));
  strip[WINNER_IDX] = winner;
  // Évite un objet identique juste à côté du gagnant (lisibilité).
  for (const j of [WINNER_IDX - 1, WINNER_IDX + 1]) {
    let guard = 0;
    while (strip[j]?.name === winner.name && guard++ < 20) strip[j] = weighted(gameCase.rewards);
  }
  return strip;
}

function rollReward(gameCase) {
  const r = weighted(gameCase.rewards);
  const out = { ...r };
  if (r.kind === 'coins') out.amount = randInt(r.min, r.max);
  return out;
}

function rewardText(rw) {
  if (rw.kind === 'coins') return `**${fmt(rw.amount)}** ${config.emojis.coin}`;
  if (rw.kind === 'gems') return `**${fmt(rw.amount)}** ${config.emojis.gem}`;
  if (rw.kind === 'xp') return `**${fmt(rw.amount)}** ${config.emojis.xp} XP`;
  return `${rw.emoji} **${rw.name}** _(revente ${fmt(rw.value)} ${config.emojis.coin})_`;
}

async function grantReward(member, rw) {
  const { guild } = member;
  if (rw.kind === 'coins') addCoins(guild.id, member.id, rw.amount, 'caisse');
  else if (rw.kind === 'gems') addGems(guild.id, member.id, rw.amount, 'caisse');
  else if (rw.kind === 'xp') await grantXp(member, rw.amount, { channel: null, weekly: true, source: 'caisse' });
  else {
    addItem(guild.id, member.id, `skin-${slug(rw.name)}`, 1, {
      name: rw.name, emoji: rw.emoji, rarity: rw.rarity, value: rw.value, source: 'caisse', sellable: true,
    });
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('caisse')
    .setDescription('Ouvre une caisse et tente ta chance à la roulette')
    .addSubcommand((s) => s.setName('liste').setDescription('Voir les caisses disponibles'))
    .addSubcommand((s) => s.setName('gratuite').setDescription('Ouvre ta caisse gratuite quotidienne'))
    .addSubcommand((s) => s.setName('ouvrir').setDescription('Ouvre une caisse payante')
      .addStringOption((o) => o.setName('caisse').setDescription('Quelle caisse').setRequired(true).addChoices(
        { name: '📦 Standard — 600 🪙', value: 'standard' },
        { name: '🧰 Premium — 10 💎', value: 'premium' },
      ))
      .addIntegerOption((o) => o.setName('quantite').setDescription('Nombre de caisses (1-5)').setMinValue(1).setMaxValue(5))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild, member } = interaction;

    if (sub === 'liste') {
      const embed = baseEmbed(config.colors.primary).setTitle('🗃️ Caisses');
      for (const c of Object.values(CASES)) {
        const best = [...c.rewards].sort((a, b) => (RARITIES[b.rarity].color) - 0)[0];
        const top = c.rewards.filter((r) => r.rarity === 'exceptionnel' || r.rarity === 'legendaire')
          .map((r) => `${r.emoji} ${r.name}`).slice(0, 3).join(', ');
        embed.addFields({
          name: `${c.emoji} ${c.name} — ${c.price === 0 ? 'gratuite (1×/jour)' : `${fmt(c.price)} ${c.currency === 'gems' ? config.emojis.gem : config.emojis.coin}`}`,
          value: `${c.rewards.length} récompenses possibles.\nGros lots : ${top || '—'}\n\`${c.dailyFree ? '/caisse gratuite' : `/caisse ouvrir caisse:${c.id}`}\``,
        });
      }
      embed.addFields({ name: 'Raretés', value: Object.values(RARITIES).map((r) => `${r.emoji} ${r.label}`).join(' · ') });
      return interaction.reply({ embeds: [embed] });
    }

    // --- Résolution de la caisse ---
    const isFree = sub === 'gratuite';
    const gameCase = getCase(isFree ? 'gratuite' : interaction.options.getString('caisse'));
    if (!gameCase) return interaction.reply({ embeds: [errorEmbed('Caisse inconnue.')], ephemeral: true });
    const qty = isFree ? 1 : (interaction.options.getInteger('quantite') ?? 1);

    const u = getUser(guild.id, member.id);

    if (isFree) {
      const cd = checkCooldown(u.last_case, FREE_COOLDOWN_H * 3600);
      if (!cd.ok) {
        return interaction.reply({ embeds: [errorEmbed(`Ta caisse gratuite revient dans **<t:${cd.readyAt}:R>**.`)], ephemeral: true });
      }
      updateUser(guild.id, member.id, { last_case: nowSec() });
    } else {
      const cost = gameCase.price * qty;
      const cur = gameCase.currency;
      const bal = cur === 'gems' ? u.gems : u.coins;
      const emoji = cur === 'gems' ? config.emojis.gem : config.emojis.coin;
      if (bal < cost) {
        return interaction.reply({ embeds: [errorEmbed(`Il te faut **${fmt(cost)}** ${emoji} (tu as ${fmt(bal)}).`)], ephemeral: true });
      }
      const paid = cur === 'gems'
        ? removeGems(guild.id, member.id, cost, `caisse ${gameCase.id} x${qty}`)
        : removeCoins(guild.id, member.id, cost, `caisse ${gameCase.id} x${qty}`);
      if (!paid) return interaction.reply({ embeds: [errorEmbed('Paiement impossible.')], ephemeral: true });
    }

    await interaction.deferReply();
    // Animation GIF fluide, uniquement pour une ouverture unique.
    const animate = qty === 1;

    const results = [];
    for (let k = 0; k < qty; k++) {
      const rw = rollReward(gameCase);
      results.push(rw);
      const rr = RARITIES[rw.rarity];

      if (animate) {
        const strip = buildStrip(gameCase, rw);
        const spinEmbed = baseEmbed(config.colors.warning)
          .setTitle(`${gameCase.emoji} ${gameCase.name}`)
          .setDescription('🎰 La roulette tourne…');

        let gif = null;
        if (caseGifAvailable()) gif = await renderCaseGif(strip, WINNER_IDX).catch(() => null);

        if (gif) {
          await interaction.editReply({
            embeds: [spinEmbed.setImage('attachment://roulette.gif')],
            files: [new AttachmentBuilder(gif.buffer, { name: 'roulette.gif' })],
          });
          await sleep(gif.spinMs + 900); // laisse l'anim se terminer + voir le gain
        } else if (caseReelAvailable()) {
          // Fallback : image fixe du résultat centré sous le marqueur
          const png = await renderCaseReel(strip, { markerIndex: WINNER_IDX }).catch(() => null);
          await interaction.editReply(png
            ? { embeds: [spinEmbed], files: [new AttachmentBuilder(png, { name: 'reel.png' })] }
            : { embeds: [spinEmbed] });
          await sleep(1200);
        } else {
          await interaction.editReply({ embeds: [spinEmbed] });
          await sleep(800);
        }
      }

      await grantReward(member, rw);
    }

    incrementUser(guild.id, member.id, { cases_opened: qty });
    trackMission(guild.id, member.id, 'cases_opened', qty);

    // Succès (compteur + rareté obtenue)
    const bestRarity = results.map((r) => r.rarity);
    for (const rarity of new Set([...bestRarity])) {
      const unlocked = checkAchievements({
        guildId: guild.id, userId: member.id, user: getUser(guild.id, member.id),
        event: 'case', payload: { rarity },
      });
      if (unlocked.length) await announceAchievements(member, unlocked, interaction.channel);
    }

    // Récap
    const after = getUser(guild.id, member.id);
    const best = results.reduce((a, b) => (RARITY_RANK.indexOf(b.rarity) > RARITY_RANK.indexOf(a.rarity) ? b : a), results[0]);
    const lines = results.map((rw) => `${RARITIES[rw.rarity].emoji} ${rewardText(rw)}`);
    const embed = baseEmbed(RARITIES[best.rarity].color)
      .setTitle(`${gameCase.emoji} ${gameCase.name} — ${qty > 1 ? `${qty} ouvertures` : 'résultat'}`)
      .setDescription(lines.join('\n'))
      .addFields(
        { name: 'Solde', value: `${fmt(after.coins)} ${config.emojis.coin} · ${fmt(after.gems)} ${config.emojis.gem}`, inline: true },
        { name: 'Caisses ouvertes', value: `${fmt(after.cases_opened)}`, inline: true },
      )
      .setFooter({ text: results.some((r) => r.kind === 'item') ? 'Revends tes objets avec /vendre' : 'Bonne chance pour la prochaine !' });
    await interaction.editReply({ embeds: [embed], files: [] });
  },
};
