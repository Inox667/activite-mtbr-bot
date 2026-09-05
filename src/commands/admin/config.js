import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { config } from '../../config.js';
import { getGuildConfig, setGuildConfig } from '../../database/models.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Réglages du système d\'XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('xp').setDescription('Activer/désactiver le gain d\'XP')
      .addBooleanOption((o) => o.setName('actif').setDescription('true = XP activée').setRequired(true)))
    .addSubcommand((s) => s.setName('multiplicateur').setDescription('Multiplicateur d\'XP permanent du serveur')
      .addNumberOption((o) => o.setName('valeur').setDescription('Ex : 1.0, 1.5, 2.0').setRequired(true).setMinValue(0.1).setMaxValue(5)))
    .addSubcommand((s) => s.setName('message-levelup').setDescription('Message d\'annonce de level-up ({user} {username} {level} {emoji})')
      .addStringOption((o) => o.setName('texte').setDescription('Le modèle de message').setRequired(true)))
    .addSubcommand((s) => s.setName('mode-levelup').setDescription('Où annoncer les level-up')
      .addStringOption((o) => o.setName('mode').setDescription('mode').setRequired(true).addChoices(
        { name: 'Salon dédié', value: 'channel' },
        { name: 'Salon où le membre parle', value: 'current' },
        { name: 'Message privé', value: 'dm' },
        { name: 'Désactivé', value: 'off' },
      )))
    .addSubcommand((s) => s.setName('ignorer-salon').setDescription('Ajoute/retire un salon sans gain d\'XP')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon').setRequired(true))
      .addBooleanOption((o) => o.setName('ignorer').setDescription('true = ignorer, false = ré-autoriser').setRequired(true)))
    .addSubcommand((s) => s.setName('role-sans-xp').setDescription('Un rôle qui ne gagne pas d\'XP')
      .addRoleOption((o) => o.setName('role').setDescription('Le rôle').setRequired(true))
      .addBooleanOption((o) => o.setName('bloquer').setDescription('true = bloquer, false = débloquer').setRequired(true)))
    .addSubcommand((s) => s.setName('salon-double-xp').setDescription('Un salon où l\'XP de message est doublée')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addBooleanOption((o) => o.setName('actif').setDescription('true = doubler ici').setRequired(true)))
    .addSubcommand((s) => s.setName('bonus-boost').setDescription('Bonus d\'XP pour les boosters du serveur')
      .addNumberOption((o) => o.setName('pourcentage').setDescription('Ex : 50 pour +50 % d\'XP. 0 pour désactiver.').setRequired(true).setMinValue(0).setMaxValue(500))
      .addRoleOption((o) => o.setName('role').setDescription('Rôle booster précis (sinon : boost Nitro détecté automatiquement)')))
    .addSubcommand((s) => s.setName('bonus-tag').setDescription('Bonus d\'XP pour ceux qui portent le tag du serveur')
      .addNumberOption((o) => o.setName('pourcentage').setDescription('Ex : 25 pour +25 % d\'XP. 0 pour désactiver.').setRequired(true).setMinValue(0).setMaxValue(500)))
    .addSubcommand((s) => s.setName('bonus-pub').setDescription('Bonus d\'XP pour ceux qui mettent la pub du serveur dans leur statut')
      .addNumberOption((o) => o.setName('pourcentage').setDescription('Ex : 25 pour +25 % d\'XP. 0 pour désactiver.').setRequired(true).setMinValue(0).setMaxValue(500))
      .addStringOption((o) => o.setName('texte').setDescription('Texte à chercher dans le statut (ex : .gg/mtbr). Le lien vanity est déjà détecté.')))
    .addSubcommand((s) => s.setName('afficher').setDescription('Affiche tous les réglages actuels')),

  async execute(interaction) {
    const g = getGuildConfig(interaction.guild.id);
    const sub = interaction.options.getSubcommand();
    let msg;

    switch (sub) {
      case 'xp': {
        const actif = interaction.options.getBoolean('actif');
        setGuildConfig(interaction.guild.id, { xp_enabled: actif ? 1 : 0 });
        msg = `Gain d'XP **${actif ? 'activé' : 'désactivé'}**.`;
        break;
      }
      case 'multiplicateur': {
        const v = interaction.options.getNumber('valeur');
        setGuildConfig(interaction.guild.id, { xp_multiplier: v });
        msg = `Multiplicateur d'XP du serveur : **×${v}**.`;
        break;
      }
      case 'message-levelup': {
        const texte = interaction.options.getString('texte').slice(0, 500);
        setGuildConfig(interaction.guild.id, { levelup_message: texte });
        msg = `Message de level-up mis à jour :\n> ${texte}`;
        break;
      }
      case 'mode-levelup': {
        const mode = interaction.options.getString('mode');
        setGuildConfig(interaction.guild.id, { levelup_mode: mode });
        msg = `Mode d'annonce : **${mode}**.` + (mode === 'channel' && !g.levelup_channel_id ? '\n⚠️ Définis le salon avec `/setup salon`.' : '');
        break;
      }
      case 'ignorer-salon': {
        const ch = interaction.options.getChannel('salon');
        const ignore = interaction.options.getBoolean('ignorer');
        const set = new Set(g.ignored_channels);
        ignore ? set.add(ch.id) : set.delete(ch.id);
        setGuildConfig(interaction.guild.id, { ignored_channels: [...set] });
        msg = `<#${ch.id}> ${ignore ? 'ne donne plus' : 'donne à nouveau'} d'XP.`;
        break;
      }
      case 'role-sans-xp': {
        const role = interaction.options.getRole('role');
        const block = interaction.options.getBoolean('bloquer');
        const set = new Set(g.no_xp_roles);
        block ? set.add(role.id) : set.delete(role.id);
        setGuildConfig(interaction.guild.id, { no_xp_roles: [...set] });
        msg = `Le rôle <@&${role.id}> ${block ? 'ne gagne plus' : 'gagne à nouveau'} d'XP.`;
        break;
      }
      case 'salon-double-xp': {
        const ch = interaction.options.getChannel('salon');
        const actif = interaction.options.getBoolean('actif');
        const set = new Set(g.double_xp_channels);
        actif ? set.add(ch.id) : set.delete(ch.id);
        setGuildConfig(interaction.guild.id, { double_xp_channels: [...set] });
        msg = `Double XP ${actif ? 'activé' : 'désactivé'} dans <#${ch.id}>.`;
        break;
      }
      case 'bonus-boost': {
        const pct = interaction.options.getNumber('pourcentage');
        const role = interaction.options.getRole('role');
        setGuildConfig(interaction.guild.id, {
          booster_bonus: pct / 100,
          booster_role_id: role ? role.id : g.booster_role_id ?? null,
        });
        msg = pct > 0
          ? `Les **boosters** gagnent maintenant **+${pct} %** d'XP.` + (role ? `\nRôle pris en compte : <@&${role.id}> (en plus du boost Nitro).` : '')
          : 'Bonus booster désactivé.';
        break;
      }
      case 'bonus-tag': {
        const pct = interaction.options.getNumber('pourcentage');
        setGuildConfig(interaction.guild.id, { tag_bonus: pct / 100 });
        msg = pct > 0
          ? `Ceux qui portent le **tag du serveur** gagnent **+${pct} %** d'XP.`
          : 'Bonus tag désactivé.';
        break;
      }
      case 'bonus-pub': {
        const pct = interaction.options.getNumber('pourcentage');
        const texte = interaction.options.getString('texte');
        const patch = { promo_bonus: pct / 100 };
        if (texte !== null) patch.promo_text = texte.slice(0, 100);
        setGuildConfig(interaction.guild.id, patch);
        const vanity = interaction.guild.vanityURLCode;
        msg = pct > 0
          ? `Ceux qui **pub le serveur dans leur statut** gagnent **+${pct} %** d'XP.\n` +
            `Détecté : ${vanity ? `\`discord.gg/${vanity}\`` : '_(pas de lien vanity sur ce serveur)_'}` +
            `${(texte ?? g.promo_text) ? ` et \`${texte ?? g.promo_text}\`` : ''}\n` +
            (process.env.ENABLE_PRESENCE_INTENT === 'true' ? '' : '⚠️ Mets `ENABLE_PRESENCE_INTENT=true` dans `.env` + active PRESENCE INTENT dans le portail, puis relance le bot.')
          : 'Bonus pub désactivé.';
        break;
      }
      case 'afficher': {
        const pctTxt = (v) => (v > 0 ? `+${Math.round(v * 100)} %` : '—');
        return interaction.reply({
          embeds: [baseEmbed(config.colors.info).setTitle('⚙️ Réglages XP')
            .addFields(
              { name: 'XP activée', value: g.xp_enabled ? 'oui' : 'non', inline: true },
              { name: 'Multiplicateur serveur', value: `×${g.xp_multiplier}`, inline: true },
              { name: 'Event XP', value: g.event_expires_at > Date.now() / 1000 ? `×${g.event_multiplier}` : '—', inline: true },
              { name: '🚀 Bonus boost', value: pctTxt(g.booster_bonus) + (g.booster_role_id ? `\n<@&${g.booster_role_id}>` : ''), inline: true },
              { name: '🏷️ Bonus tag', value: pctTxt(g.tag_bonus), inline: true },
              { name: '📣 Bonus pub', value: pctTxt(g.promo_bonus) + (g.promo_text ? `\n\`${g.promo_text}\`` : ''), inline: true },
              { name: 'Salons ignorés', value: g.ignored_channels.map((c) => `<#${c}>`).join(' ') || '—', inline: false },
              { name: 'Salons double XP', value: g.double_xp_channels.map((c) => `<#${c}>`).join(' ') || '—', inline: false },
              { name: 'Rôles sans XP', value: g.no_xp_roles.map((r) => `<@&${r}>`).join(' ') || '—', inline: false },
            )],
          ephemeral: true,
        });
      }
      default:
        return interaction.reply({ embeds: [errorEmbed('Sous-commande inconnue.')], ephemeral: true });
    }

    await interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(msg)], ephemeral: true });
  },
};
