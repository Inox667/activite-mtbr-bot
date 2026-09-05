import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../../config.js';
import {
  upsertShopItem, deleteShopItem, getShopItem, getShopItems,
} from '../../database/models.js';
import { baseEmbed, errorEmbed } from '../../lib/embeds.js';
import { fmt } from '../../lib/format.js';

const slug = (s) => (s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32) || 'item');

const DEFAULT_ITEMS = [
  { item_id: 'boost-xp-500', name: 'Boost XP +500', emoji: '✨', price: 1500, type: 'consumable', description: 'Ajoute instantanément 500 XP.', data: { effect: 'xp', value: 500 } },
  { item_id: 'sac-de-coins', name: 'Sac de coins', emoji: '💰', price: 900, type: 'consumable', description: 'Contient 1 000 coins.', data: { effect: 'coins', value: 1000 } },
  { item_id: 'caisse-mystere', name: 'Caisse mystère', emoji: '🎁', price: 1200, type: 'consumable', description: 'Récompense aléatoire (200 à 10 000 coins).', data: { effect: 'lootbox' } },
  { item_id: 'trophee-collector', name: 'Trophée du collectionneur', emoji: '🏆', price: 25000, type: 'collectible', description: 'Un objet de prestige à exposer dans ton inventaire.' },
  // Articles premium (payables en gems 💎)
  { item_id: 'boost-xp-5000', name: 'Boost XP +5000', emoji: '🌟', price: 8, type: 'consumable', currency: 'gems', description: 'Ajoute 5 000 XP d\'un coup.', data: { effect: 'xp', value: 5000 } },
  { item_id: 'coffre-premium', name: 'Coffre premium', emoji: '🧰', price: 10, type: 'consumable', currency: 'gems', description: 'Grosse récompense aléatoire en coins.', data: { effect: 'lootbox' } },
  { item_id: 'badge-vip', name: 'Badge VIP', emoji: '💎', price: 40, type: 'badge', currency: 'gems', description: 'Le badge le plus classe du serveur.' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('boutique-admin')
    .setDescription('Gérer les articles de la boutique')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('seed').setDescription('Crée un lot d\'articles par défaut'))
    .addSubcommand((s) => s.setName('ajouter-role').setDescription('Article qui donne un rôle Discord')
      .addRoleOption((o) => o.setName('role').setDescription('Le rôle à vendre').setRequired(true))
      .addIntegerOption((o) => o.setName('prix').setDescription('Prix en coins').setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName('nom').setDescription('Nom affiché (défaut : nom du rôle)'))
      .addStringOption((o) => o.setName('emoji').setDescription('Emoji'))
      .addStringOption((o) => o.setName('description').setDescription('Description'))
      .addIntegerOption((o) => o.setName('stock').setDescription('Stock limité (défaut illimité)')))
    .addSubcommand((s) => s.setName('ajouter-consommable').setDescription('Objet à effet (coins / xp / caisse)')
      .addStringOption((o) => o.setName('nom').setDescription('Nom').setRequired(true))
      .addIntegerOption((o) => o.setName('prix').setDescription('Prix').setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName('effet').setDescription('effet').setRequired(true).addChoices(
        { name: 'Donner des coins', value: 'coins' },
        { name: 'Donner de l\'XP', value: 'xp' },
        { name: 'Caisse mystère', value: 'lootbox' },
      ))
      .addIntegerOption((o) => o.setName('valeur').setDescription('Montant (pour coins / xp)'))
      .addStringOption((o) => o.setName('monnaie').setDescription('coins (défaut) ou gems').addChoices(
        { name: 'Coins 🪙', value: 'coins' }, { name: 'Gems 💎', value: 'gems' }))
      .addStringOption((o) => o.setName('emoji').setDescription('Emoji'))
      .addStringOption((o) => o.setName('description').setDescription('Description')))
    .addSubcommand((s) => s.setName('ajouter-objet').setDescription('Objet de collection ou badge')
      .addStringOption((o) => o.setName('nom').setDescription('Nom').setRequired(true))
      .addIntegerOption((o) => o.setName('prix').setDescription('Prix').setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName('type').setDescription('type').addChoices(
        { name: 'Objet de collection', value: 'collectible' }, { name: 'Badge', value: 'badge' }))
      .addStringOption((o) => o.setName('monnaie').setDescription('coins (défaut) ou gems').addChoices(
        { name: 'Coins 🪙', value: 'coins' }, { name: 'Gems 💎', value: 'gems' }))
      .addStringOption((o) => o.setName('emoji').setDescription('Emoji'))
      .addStringOption((o) => o.setName('description').setDescription('Description')))
    .addSubcommand((s) => s.setName('retirer').setDescription('Supprime un article')
      .addStringOption((o) => o.setName('id').setDescription('Identifiant').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('activer').setDescription('Active ou masque un article')
      .addStringOption((o) => o.setName('id').setDescription('Identifiant').setRequired(true).setAutocomplete(true))
      .addBooleanOption((o) => o.setName('actif').setDescription('true = visible').setRequired(true)))
    .addSubcommand((s) => s.setName('liste').setDescription('Tous les articles (même masqués)')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const items = getShopItems(interaction.guild.id, true)
      .filter((i) => i.item_id.includes(focused) || i.name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(items.map((i) => ({ name: `${i.name} (${i.item_id})`, value: i.item_id })));
  },

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'seed') {
      let n = 0;
      for (const it of DEFAULT_ITEMS) {
        if (!getShopItem(guildId, it.item_id)) { upsertShopItem(guildId, { ...it, enabled: 1, sort: n }); n++; }
      }
      return interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(`**${n}** article(s) par défaut ajouté(s).`)], ephemeral: true });
    }

    if (sub === 'liste') {
      const items = getShopItems(guildId, true);
      if (!items.length) return interaction.reply({ content: 'Aucun article.', ephemeral: true });
      const lines = items.map((i) => `${i.enabled ? '🟢' : '⚪'} \`${i.item_id}\` — ${i.emoji} ${i.name} · ${fmt(i.price)} ${i.currency === 'gems' ? config.emojis.gem : config.emojis.coin} · ${i.type}${i.stock >= 0 ? ` · stock ${i.stock}` : ''}`);
      return interaction.reply({ embeds: [baseEmbed(config.colors.info).setTitle('Articles').setDescription(lines.join('\n'))], ephemeral: true });
    }

    if (sub === 'retirer') {
      const id = interaction.options.getString('id');
      if (!getShopItem(guildId, id)) return interaction.reply({ embeds: [errorEmbed('Article introuvable.')], ephemeral: true });
      deleteShopItem(guildId, id);
      return interaction.reply({ embeds: [baseEmbed(config.colors.warning).setDescription(`Article \`${id}\` supprimé.`)], ephemeral: true });
    }

    if (sub === 'activer') {
      const id = interaction.options.getString('id');
      const item = getShopItem(guildId, id);
      if (!item) return interaction.reply({ embeds: [errorEmbed('Article introuvable.')], ephemeral: true });
      const actif = interaction.options.getBoolean('actif');
      upsertShopItem(guildId, { ...item, enabled: actif ? 1 : 0 });
      return interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(`\`${id}\` est maintenant **${actif ? 'visible' : 'masqué'}**.`)], ephemeral: true });
    }

    // Ajouts
    const price = interaction.options.getInteger('prix');
    const emoji = interaction.options.getString('emoji') ?? undefined;
    const description = interaction.options.getString('description') ?? '';
    const currency = interaction.options.getString('monnaie') ?? 'coins';
    const count = getShopItems(guildId, true).length;

    if (sub === 'ajouter-role') {
      const role = interaction.options.getRole('role');
      const name = interaction.options.getString('nom') ?? role.name;
      const id = slug(name);
      if (interaction.guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
        return interaction.reply({ embeds: [errorEmbed('Ce rôle est au-dessus du mien : je ne pourrai pas l\'attribuer. Monte mon rôle dans la hiérarchie.')], ephemeral: true });
      }
      upsertShopItem(guildId, {
        item_id: id, name, emoji: emoji ?? '🎭', price, type: 'role', description,
        data: { role_id: role.id }, stock: interaction.options.getInteger('stock') ?? -1, enabled: 1, sort: count,
      });
      return interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(`Rôle **${name}** ajouté à la boutique (\`${id}\`, ${fmt(price)} ${config.emojis.coin}).`)], ephemeral: true });
    }

    if (sub === 'ajouter-consommable') {
      const name = interaction.options.getString('nom');
      const effet = interaction.options.getString('effet');
      const valeur = interaction.options.getInteger('valeur') ?? 0;
      if ((effet === 'coins' || effet === 'xp') && valeur <= 0) {
        return interaction.reply({ embeds: [errorEmbed('Précise une `valeur` positive pour cet effet.')], ephemeral: true });
      }
      const id = slug(name);
      upsertShopItem(guildId, {
        item_id: id, name, emoji: emoji ?? '🧪', price, type: 'consumable', description, currency,
        data: { effect: effet, value: valeur }, enabled: 1, sort: count,
      });
      return interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(`Consommable **${name}** ajouté (\`${id}\`).`)], ephemeral: true });
    }

    // ajouter-objet
    const name = interaction.options.getString('nom');
    const type = interaction.options.getString('type') ?? 'collectible';
    const id = slug(name);
    upsertShopItem(guildId, {
      item_id: id, name, emoji: emoji ?? (type === 'badge' ? '🏅' : '🎁'), price, type, description, currency,
      enabled: 1, sort: count,
    });
    return interaction.reply({ embeds: [baseEmbed(config.colors.success).setDescription(`Objet **${name}** ajouté (\`${id}\`).`)], ephemeral: true });
  },
};
