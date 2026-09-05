# Héberger « Activité MTBR » sur bot-hosting.net (gratuit, 24/7)

Le fichier prêt à envoyer : **`activite-mtbr-bot.zip`** (sur ton Bureau).
Il contient tout le bot **sauf** `node_modules` (réinstallé par l'hébergeur) et
`.env` (les identifiants se mettent dans le panneau).

---

## 1. Créer le compte et le serveur

1. Va sur **https://bot-hosting.net** → **Sign in with Discord** → autorise.
2. Il faut **rejoindre leur serveur Discord** (bouton sur le site) pour débloquer
   l'offre gratuite.
3. Onglet **Create Server** (ou « Servers » → « + »).
   - Type / logiciel : **Node.js**
   - Plan : **Free**
   - Crée.

## 2. Choisir la bonne version de Node

Dans ton serveur → onglet **Startup** (ou **Settings**) :
- **Node version : 22** (ou plus). ⚠️ **Obligatoire** — le bot ne démarre pas en
  dessous de 22.

## 3. Envoyer les fichiers

Onglet **Files** (gestionnaire de fichiers) :
1. En haut à droite : **Upload** → choisis `activite-mtbr-bot.zip` depuis ton Bureau.
2. Une fois envoyé : clic droit sur le zip → **Unarchive** (décompresser).
3. Supprime le fichier `.zip` après décompression.
4. Vérifie que tu vois bien à la racine : `src/`, `package.json`, `data/`, etc.
   (Si tout s'est décompressé dans un sous-dossier `activite-mtbr-bot/`, entre
   dedans, sélectionne tout, **Move** vers la racine `/`.)

## 4. Régler la commande de démarrage

Onglet **Startup** :
- **Bot JS File** (ou « Main file » / « startup command ») : `src/index.js`
- Si un champ « install command » existe : `npm install`
- Active « Install / update on start » si l'option existe (sinon on installera à la main, étape 6).

## 5. Mettre les identifiants (à la place du .env)

Onglet **Startup** → section **Variables** (ou **Environment**). Ajoute 3 variables :

| Nom | Valeur |
|---|---|
| `DISCORD_TOKEN` | le token de l'application **Activité MTBR** (Developer Portal → Bot → Reset Token) |
| `CLIENT_ID` | `1544079540446306355` |
| `GUILD_ID` | `1543713010244124834` |

> S'il n'y a pas de section Variables : dans **Files**, crée un fichier nommé
> `.env` et colle dedans les 3 lignes `NOM=valeur`.

## 6. Démarrer

1. Onglet **Console** → bouton **Start**.
2. Attends l'installation des dépendances (1-3 min, tu verras défiler `npm install`).
3. Quand tu vois :
   ```
   ✅ Connecté en tant que Activité MTBR#1736
   ```
   → le bot est en ligne.

## 7. Enregistrer les commandes (une seule fois)

Dans la **Console** du panneau, tape :
```
npm run deploy
```
Tu dois voir `✅ 41 commandes enregistrées.`
Ça n'est à refaire que si on ajoute/retire des commandes.

---

## Important

- **Ne ré-uploade jamais** le dossier `data/` : il contient la progression des
  membres, les rôles liés et la config. Si tu mets à jour le code plus tard,
  n'écrase **que** `src/` (et `package.json` si besoin).
- L'hébergeur garde les fichiers entre les redémarrages — ta base de données est
  conservée.
- Si le bot tombe, le panneau a un bouton **Restart** (et souvent une option
  « auto-restart on crash » dans Startup).
- Offre gratuite = ressources limitées et pas de garantie de dispo. Pour un petit
  serveur c'est suffisant. Si un jour tu veux du solide : Oracle Cloud (gratuit à
  vie, mais carte bancaire pour la vérif).

## Mettre à jour le bot plus tard

1. Je te donne les fichiers modifiés (ou un nouveau zip **sans `data/`**).
2. Panneau → **Files** → tu remplaces les fichiers dans `src/`.
3. **Restart**. Si `package.json` a changé : re-lance `npm install` en console.
