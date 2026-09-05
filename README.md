# 🎮 Bot MTBR — Système de jeu Discord complet

XP & niveaux, rôles de palier automatiques, économie, boutique, casino, quiz,
duels, succès, missions quotidiennes, prestige et classements (global + hebdo).

- **Node.js** (≥ 22.5) + **discord.js v14**
- **SQLite** via le module natif `node:sqlite` — *aucune compilation, aucune base à installer*
- Un seul fichier de données : `data/mtbr.db`

---

## 1. Créer l'application Discord

1. Va sur https://discord.com/developers/applications → **New Application**.
2. Onglet **Bot** → **Reset Token** → copie le token.
3. Onglet **Bot** → active **MESSAGE CONTENT INTENT**, **SERVER MEMBERS INTENT**,
   **PRESENCE INTENT** facultatif.
4. Onglet **OAuth2 → URL Generator** : coche `bot` + `applications.commands`,
   puis dans les permissions : `Manage Roles`, `Send Messages`, `Embed Links`,
   `Attach Files`, `Read Message History`, `View Channels`, `Connect` (pour lire le vocal).
5. Ouvre l'URL générée et invite le bot sur ton serveur.
6. **Important : dans Paramètres du serveur → Rôles, place le rôle du bot AU-DESSUS
   de tous les rôles de palier** (Arrivant → Dieu de MTBR), sinon il ne pourra pas
   les attribuer.

## 2. Configurer le projet

```bash
npm install
```

Copie `.env.example` en `.env` et remplis :

```
DISCORD_TOKEN=le_token_du_bot
CLIENT_ID=application_id
GUILD_ID=id_de_ton_serveur   # clic droit sur le serveur (mode dev activé) → Copier l'identifiant
```

## 3. Enregistrer les commandes

```bash
npm run deploy
```

(déploiement instantané sur ton serveur. `npm run deploy:global` pour toutes les
guildes, propagation ~1 h.)

## 4. Lancer le bot

```bash
npm start
```

## 5. Configuration in-game (une seule fois)

Dans Discord, avec un compte qui a la permission **Gérer le serveur** :

| Commande | Effet |
|---|---|
| `/setup roles` | Détecte les 15 rôles de palier par leur nom et les lie au bot |
| `/setup salon levelup:#salon annonces:#salon` | Salons des level-up / succès / podium hebdo |
| `/setup sync-roles` | Recalcule le rôle de palier de tous les membres (utile la 1ʳᵉ fois) |
| `/boutique-admin seed` | Remplit la boutique avec des articles de départ |
| `/config …` | Multiplicateur d'XP, salons ignorés, message de level-up, double XP… |
| `/setup etat` | Voir la configuration actuelle |

---

## Fonctionnement de l'XP

- **Messages** : 15–25 XP par message, une fois toutes les 60 s.
- **Vocal** : 5 XP/minute si tu n'es pas seul et micro/casque activés.
- **Jeux, quiz, missions, succès** : donnent des coins (et parfois de l'XP).
- Courbe : `5·n² + 50·n + 100` XP pour passer le niveau *n* (comme MEE6).
  Niveau max : **150**.
- **Rôles de palier — rôle unique** : au passage d'un palier, le bot retire
  l'ancien rôle et met le nouveau (niv. 5 → enlève *Arrivant*, met *Novice*).

## Rôles de palier attendus (noms exacts sur le serveur)

`Arrivant` (1) · `Novice` (5) · `Apprenti` (10) · `Connaisseur` (15) ·
`Habitué` (20) · `Membre Actif` (25) · `Fidèle` (30) · `Vétéran` (40) ·
`Élite` (50) · `Expert` (60) · `Maître` (70) · `Roi/Reine` (80) ·
`Légende` (90) · `Mythe` (100) · `Dieu de MTBR` (150)

Tu peux ajuster niveaux, noms, taux, prix, gains… dans **`src/config.js`**.

## Deux monnaies

- 🪙 **coins** : gagnés partout (messages via quêtes, /daily, /work, casino…), dépensés à la boutique et au casino.
- 💎 **gems** : monnaie premium, gagnée via les **quêtes hebdo/mensuelles**, les **gros succès**, le **podium hebdo** et le **prestige**. Sert à acheter les articles premium de la boutique.

## Bonus d'XP (boosters / tag / pub)

Configurables par un admin, cumulables, en pourcentage :

| Commande | Bonus pour… | Détection |
|---|---|---|
| `/config bonus-boost <%> [role]` | les **boosters** du serveur | boost Nitro auto + rôle optionnel |
| `/config bonus-tag <%>` | ceux qui **portent le tag** du serveur | fonctionnalité « Tag de serveur » de Discord |
| `/config bonus-pub <%> [texte]` | ceux qui **pub le serveur** dans leur statut | lien vanity (auto) ou texte configuré |

`/config afficher` récapitule tout. Les membres voient leur multiplicateur avec `/bonus`.

⚠️ Le bonus « pub » nécessite `ENABLE_PRESENCE_INTENT=true` dans `.env` **et**
l'activation de **PRESENCE INTENT** dans le Developer Portal (onglet Bot), puis un
redémarrage. Les bonus boost et tag marchent sans ça.

## Quêtes

`/quetes` affiche 3 paliers :
- **Journalier** (4 quêtes) — reset à minuit
- **Hebdomadaire** (4 quêtes) — reset lundi
- **Mensuel** (2 quêtes) — reset le 1er

Chaque quête donne XP + coins (+ gems pour hebdo/mensuel). Finir toutes les quêtes
d'un palier donne un **bonus**. Bouton « 🎁 Tout récupérer ».

## Commande principale : `/menu`

Le hub joueur. Une seule commande pour presque tout :
- **Gains** : boutons daily / weekly / work / crime / pêche / mine — verts quand
  c'est prêt, grisés avec le compte à rebours sinon. Bouton « Tout récupérer ».
- **Quêtes** : les 3 paliers + « Tout récupérer ».
- **Caisses** : ouvre la caisse gratuite en un clic.
- **Profil** : stats complètes.
- Accueil : carte du joueur + bouton « Tout réclamer » (gains + quêtes d'un coup).

Menu éphémère (visible seulement par toi). `/help` pour la liste complète.

## Toutes les commandes

`/help` liste tout. Aperçu :

- **Niveaux** : `/rank` `/stats` `/bonus` `/profil` `/niveaux` `/classement`
- **Économie** : `/solde` `/daily` `/weekly` `/work` `/crime` `/pêche` `/mine`
  `/donner` `/banque` `/vendre` `/historique`
- **Casino** : `/pileouface` `/dé` `/machine` `/blackjack` `/roulette` `/duel` `/quiz`
- **Caisses** : `/caisse liste` `/caisse gratuite` (1×/jour) `/caisse ouvrir` — roulette animée, gagne coins / gems / XP / objets collector ; `/vendre` pour revendre les objets
- **Boutique** : `/boutique` `/acheter` `/inventaire` `/utiliser`
- **Progression** : `/succès` `/quetes` `/prestige`
- **Admin** : **`/panel`** (panneau tout-en-un) — ou en détaillé : `/setup` `/config`
  `/xp-admin` `/eco-admin` `/boutique-admin` `/event-xp`

### `/panel` — panneau d'administration

Une seule commande, une interface à boutons/menus. Sections :
**Système XP** (on/off, multiplicateur, event ×2) · **Bonus d'XP** (boost/tag/pub) ·
**Gérer un membre** (choisir un membre → +/- coins, gems, XP, définir niveau, reset) ·
**Salons** (choisir un salon → level-up / annonces / ignoré / double XP) ·
**Rôles de palier** (détecter, resynchroniser) · **Boutique** (articles par défaut).
Réservé à « Gérer le serveur », utilisable seulement par la personne qui l'ouvre.

## Sauvegarde & arrêt

Tout est dans `data/mtbr.db`. Pour arrêter le bot proprement : **Ctrl+C** dans la
fenêtre (il fait un checkpoint et ferme la base). Ne supprime **jamais** les
fichiers `data/mtbr.db-wal` / `data/mtbr.db-shm` pendant que le bot tourne — ils
contiennent des données pas encore écrites dans `mtbr.db`.

Pour sauvegarder : arrête le bot (Ctrl+C), puis copie `data/mtbr.db`.
Ne lance jamais deux instances du bot sur le même `data/mtbr.db` en même temps.

## Hébergement 24/7

Le bot tourne tant que `npm start` est lancé. Pour qu'il reste en ligne quand ton
PC est éteint, héberge-le sur un petit VPS ou un service type Railway / Render
(Node ≥ 22.5) et lance `npm run deploy` puis `npm start` là-bas.
