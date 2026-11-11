# GameShop

Mini-boutique en ligne de consoles et de jeux vidéo, de la connexion du client à la confirmation d'un **paiement fictif**.

- Catalogue chargé en direct depuis l'**API Strapi**
- Comptes clients stockés dans **SQLite**, mots de passe hachés
- Panier recalculé par le serveur après chaque modification
- Paiement simulé : **aucune transaction, aucune donnée bancaire demandée**
- Pensé pour mobile et ordinateur, navigable au clavier

| | |
| --- | --- |
| Front | Application monopage en JavaScript natif (modules ES, sans étape de build) |
| Serveur | Node.js + Express 5 |
| Données | Strapi (articles) · SQLite via `node:sqlite` (comptes, sessions, paniers, commandes) |
| Tests | `node:test` (unitaires, intégration API) · Playwright (parcours navigateur) |

---

## Sommaire

1. [Démarrage rapide](#démarrage-rapide)
2. [Compte de démonstration](#compte-de-démonstration)
3. [Configuration](#configuration)
4. [Intégration Strapi](#intégration-strapi)
5. [Fonctionnalités](#fonctionnalités)
6. [Scripts](#scripts)
7. [Tests](#tests)
8. [Architecture](#architecture)
9. [Sécurité et données sensibles](#sécurité-et-données-sensibles)
10. [Accessibilité](#accessibilité)
11. [Limites connues](#limites-connues)

---

## Démarrage rapide

### Prérequis

- **Node.js 22.13 ou plus récent** (testé avec Node 24), pour le module natif `node:sqlite`
- Le projet **Strapi** (`strapi-backend`) installé et démarré

### Lancement

Deux terminaux sont nécessaires.

```bash
# Terminal 1 — Strapi (source du catalogue)
cd C:\Users\adalb\Strapi\strapi-backend
npm run develop                  # http://localhost:1337
```

```bash
# Terminal 2 — Boutique
cd C:\Users\adalb\E-commerce\GameShop
npm install
npm start                        # http://127.0.0.1:3000
```

Ouvrez ensuite **http://127.0.0.1:3000**.

Au premier démarrage, la base `data/gameshop.db` et le compte de démonstration sont créés automatiquement. Aucune autre étape n'est nécessaire.

> Pour tester depuis un téléphone sur le même réseau Wi-Fi, lancez la boutique avec `HOST=0.0.0.0` (PowerShell : `$env:HOST="0.0.0.0"; npm start`), puis ouvrez `http://<adresse-IP-du-PC>:3000` sur le téléphone.

---

## Compte de démonstration

| E-mail | Mot de passe |
| --- | --- |
| `demo@gameshop.test` | `Console2026!` |

Le lien « Utiliser le compte de démonstration », sous le formulaire de connexion, remplit les champs automatiquement. Vous pouvez aussi créer votre propre compte depuis **« Créer un compte »**.

- `npm run seed -- --reset` remet le mot de passe de démonstration à sa valeur d'origine.
- `SHOW_DEMO_ACCOUNT=false` masque ce lien.

---

## Configuration

La configuration passe par des variables d'environnement. Pour en modifier une, copiez `.env.example` en `.env` : `npm start` lit ce fichier automatiquement. **Le fichier `.env` n'est jamais versionné.**

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `STRAPI_URL` | `http://localhost:1337` | URL de base de Strapi, **sans** `/api` |
| `STRAPI_API_TOKEN` | *(vide)* | Jeton Strapi en lecture seule, facultatif (voir [Intégration Strapi](#intégration-strapi)) |
| `STRAPI_TIMEOUT_MS` | `6000` | Délai maximal d'une requête vers Strapi |
| `CATALOGUE_CACHE_MS` | `10000` | Durée du cache du catalogue côté serveur |
| `HOST` / `PORT` | `127.0.0.1` / `3000` | Adresse d'écoute de la boutique |
| `DB_PATH` | `data/gameshop.db` | Fichier SQLite de la boutique |
| `SESSION_TTL_HOURS` | `12` | Durée d'une session standard |
| `SESSION_REMEMBER_DAYS` | `30` | Durée d'une session avec « Se souvenir de moi » |
| `COOKIE_SECURE` | `false` | À passer à `true` derrière HTTPS |
| `DEMO_EMAIL` / `DEMO_PASSWORD` / `DEMO_NAME` | voir ci-dessus | Compte de démonstration |
| `SHOW_DEMO_ACCOUNT` | `true` | Affiche le raccourci vers le compte de démo |
| `REGISTER_MAX_PER_HOUR` | `10` | Inscriptions maximum par heure et par adresse IP |

Les valeurs sont validées au démarrage. Une valeur invalide, comme `PORT=abc` ou une `STRAPI_URL` mal formée, arrête le serveur avec un message explicite.

---

## Intégration Strapi

La boutique lit les articles dans Strapi et ne lui envoie jamais rien.

| Élément | Détail |
| --- | --- |
| Modèle | Collection `article` : `Product_name` (texte), `Price` (décimal), `Picture` (média) |
| Route | `GET /api/articles?populate=Picture&sort=Product_name:asc&pagination[pageSize]=100` |
| Permission | Rôle **Public** → *Article* → `find` (déjà activée) |
| Articles visibles | Uniquement les articles **publiés** (les brouillons sont ignorés par l'API) |
| Images | Les fichiers `/uploads/…` de Strapi sont relayés sous `/media/uploads/…` (même origine, images uniquement) |

**Si l'accès public est retiré**, créez un jeton dans Strapi (*Settings → API Tokens*, type *Read-only*) et renseignez-le dans `STRAPI_API_TOKEN`.

**Pour ajouter un produit**, créez un *Article* dans l'admin Strapi (`http://localhost:1337/admin`), puis **publiez-le**. Il apparaît dans la boutique en 10 secondes au plus, le temps que le cache expire.

**Pourquoi le panier n'utilise pas les routes Strapi.** Le backend Strapi expose aussi `/api/mon-panier` et `/api/commandes/payer`. Ces routes sont liées aux utilisateurs de Strapi, alors que l'énoncé impose des comptes clients dans SQLite. De plus, aucune permission ne les ouvre. Le panier et les commandes sont donc gérés par la boutique, dans sa propre base.

---

## Fonctionnalités

| Écran | Adresse | Contenu |
| --- | --- | --- |
| Connexion | `/connexion` | E-mail et mot de passe, afficher/masquer le mot de passe, « Se souvenir de moi », message clair si les identifiants sont incorrects |
| Inscription | `/inscription` | Nom, e-mail, mot de passe (8 caractères minimum, dont une lettre et un chiffre) et confirmation. Le client est connecté dès la création du compte ; un e-mail déjà utilisé est refusé |
| Catalogue | `/` | Recherche par nom, navigation par tranche de prix, grille de produits. Les filtres sont dans l'URL (`/?q=ps&prix=100-500`) : on peut partager un lien ou revenir en arrière |
| Panier | `/panier` | Quantités de 1 à 99, retrait, total recalculé par le serveur |
| Paiement | `/paiement` | Récapitulatif et confirmation du **paiement fictif** |
| Confirmation | `/confirmation/GS-XXXXXXXX` | Référence, date, détail et total ; la page reste disponible après rechargement |

Toutes les pages, sauf la connexion et l'inscription, demandent d'être connecté. Après connexion, le client revient sur la page qu'il avait demandée.

**États prévus** : squelettes pendant le chargement, erreur avec bouton « Réessayer » si Strapi ne répond pas, catalogue vide, aucun résultat de recherche, panier vide, identifiants incorrects, confirmation du paiement.

**Garanties sur le paiement**
- Les prix sont toujours relus dans Strapi au moment de payer. Un prix envoyé par le navigateur est ignoré.
- Si un prix a changé ou si un article a été retiré, le client est prévenu et doit revalider.
- Un double clic ne crée qu'une seule commande.

---

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm start` | Démarre la boutique |
| `npm run dev` | Démarre avec redémarrage automatique à chaque modification |
| `npm run seed` | Crée le compte de démonstration s'il manque (`-- --reset` pour réinitialiser son mot de passe) |
| `npm run lint` | Analyse statique du code (ESLint) |
| `npm test` | Tests unitaires et d'intégration de l'API |
| `npm run check` | Lint + tests, à lancer avant chaque commit |
| `npm run test:e2e` | Parcours complet dans le navigateur, sur ordinateur et sur mobile |

---

## Tests

### Tests unitaires et d'intégration — `npm test`

Ils ne demandent ni Strapi ni la boutique démarrée : Strapi est simulé et la base SQLite est créée en mémoire. Ils couvrent :
- la connexion, l'inscription et les sessions ;
- le calcul du panier en centimes ;
- le paiement : idempotence et changement de prix ;
- la protection CSRF ;
- les filtres du catalogue, la configuration et les cookies.

### Parcours navigateur — `npm run test:e2e`

Pilote **Google Chrome** (ou Edge avec `BROWSER_CHANNEL=msedge`) en deux formats : ordinateur (1366 × 900) et mobile (390 × 844).

**Prérequis** : Strapi et la boutique doivent être démarrés.

Le parcours vérifie :
- la connexion, avec les erreurs de saisie ;
- le chargement des articles depuis Strapi ;
- les filtres et la recherche ;
- l'ajout et le retrait d'articles, et le total ;
- le paiement fictif et la confirmation ;
- l'inscription ;
- la navigation au clavier et l'absence de défilement horizontal.

Les inscriptions de test utilisent une instance temporaire avec une base jetable : **votre base n'est pas modifiée**, en dehors du panier et des commandes du compte de démonstration.

Les captures d'écran sont enregistrées dans `test-results/`, ou dans le dossier indiqué par `SCREENSHOT_DIR`.

---

## Architecture

```
navigateur ──► Express (server/)
                 ├── /api/*          routes HTTP ─► services métier ─► repositories (SQLite)
                 │                                         └──────────► client Strapi (cache)
                 ├── /media/uploads  relais des images Strapi
                 └── /*              application monopage (public/)
```

**Serveur, en couches.** Chaque couche ne dépend que de celle du dessous. Toutes les dépendances sont assemblées dans `server/app.js`, ce qui permet de tester avec une base en mémoire et un faux Strapi.

| Dossier | Responsabilité |
| --- | --- |
| `server/http/` | Lecture et validation des requêtes, cookies, en-têtes de sécurité, conversion des erreurs en JSON |
| `server/services/` | Règles métier : authentification, inscription, panier, paiement |
| `server/repositories/` | Accès SQLite (seul endroit contenant du SQL) |
| `server/catalogue/` | Client de l'API Strapi et conversion des articles |
| `server/lib/` | Utilitaires : erreurs, montants, hachage, limitation des tentatives |
| `server/db/` | Schéma SQL et ouverture de la base |

**Front.** `public/js/core/` regroupe l'infrastructure : API, état, routeur, filtres, DOM. `public/js/components/` contient les éléments réutilisables et `public/js/views/` une vue par page. Les vues ne communiquent avec le serveur que par `core/api.js`, ce que vérifie ESLint.

**Conventions**
- Les montants circulent en **centimes entiers**.
- Les erreurs suivent le format `{ error: { code, message, field? } }`.
- Le DOM est construit sans `innerHTML` pour les données.

<details>
<summary>Arborescence complète</summary>

```
server/
  index.js                    démarrage : config, base, compte de démo, écoute
  app.js                      assemblage repositories → services → routes
  config.js                   variables d'environnement validées
  db/                         schema.sql, ouverture de la base, transactions
  lib/                        errors, money, passwords (scrypt), rate-limiter
  repositories/               customers, sessions, cart, orders
  catalogue/                  strapi-catalogue (client + cache), strapi-mapper
  services/                   auth-service, account-rules, accounts, cart-service, checkout-service
  http/
    validation.js, cookies.js
    middleware/               security (en-têtes, CSRF), session, errors
    routes/                   auth, shop (catalogue, panier, paiement), media, public-config
public/
  index.html, css/styles.css, img/favicon.svg
  js/app.js                   routes, garde d'accès, démarrage
  js/config.js                constantes partagées avec le serveur
  js/core/                    api, store, router, catalogue-filters, dom, icons, format
  js/components/              header, auth-layout, form-field, feedback, layout,
                              cart-line, order-summary, product-image
  js/views/                   login, register, catalogue, cart, checkout, confirmation, notfound
scripts/seed.js               création du compte de démonstration
tests/unit/                   tests node:test
tests/e2e.mjs                 parcours navigateur ordinateur + mobile
```

</details>

---

## Sécurité et données sensibles

**Mots de passe**
- Hachés avec **scrypt** (sel aléatoire, comparaison en temps constant). Ils ne sont jamais stockés ni journalisés en clair.
- Le temps de réponse est le même que l'e-mail existe ou non, pour ne pas révéler les comptes.

**Sessions**
- Jeton aléatoire dans un cookie `HttpOnly` et `SameSite=Lax`. Seule son empreinte SHA-256 est stockée en base.

**Requêtes**
- Corps JSON obligatoire et vérification de l'en-tête `Origin` pour toute requête modifiante (protection CSRF).
- Content-Security-Policy stricte, sans script inline.

**Limitation des tentatives**
- 8 échecs de connexion par tranche de 10 minutes (par IP et par e-mail).
- 10 inscriptions par heure et par IP.

**Ce qui n'est jamais versionné** (voir `.gitignore`) :

| Fichier | Contenu |
| --- | --- |
| `data/`, `*.db`, `*.sqlite` | Base SQLite : comptes clients, hachages de mots de passe, sessions, paniers, commandes |
| `.env`, `.env.*` | Variables d'environnement, dont un éventuel jeton d'API Strapi (seul `.env.example` est versionné) |
| `*.pem`, `*.key`, `*.crt`… | Clés et certificats |
| `test-results/` | Captures d'écran des tests |

Le mot de passe de démonstration figure volontairement dans ce README, dans `.env.example` et dans le code (valeur par défaut). Il ne protège qu'un compte de test. **Pour un déploiement réel**, définissez un `DEMO_PASSWORD` différent, passez `SHOW_DEMO_ACCOUNT=false` et activez `COOKIE_SECURE=true` derrière HTTPS.

---

## Accessibilité

- Lien « Aller au contenu principal », focus clavier visible, focus placé sur le titre à chaque changement de page.
- Changements de panier et de total annoncés aux lecteurs d'écran.
- Libellés explicites, y compris lorsque seul un placeholder est visible, et cibles tactiles de 44 px minimum.
- Mise en page pensée d'abord pour le mobile. Respect de `prefers-reduced-motion` et du mode contraste élevé.

---

## Limites connues

- **Mot de passe oublié** : le lien affiche un message. La réinitialisation n'est pas disponible, car elle demanderait l'envoi d'e-mails.
- **Navigation par prix uniquement** : les articles Strapi n'ont ni plateforme ni catégorie. Ajouter ces champs dans Strapi permettrait de naviguer par PlayStation, Xbox, etc.
- **Limitation des tentatives en mémoire** : elle est remise à zéro au redémarrage et suppose une seule instance du serveur.
- **Historique des commandes** : les commandes sont enregistrées, mais il n'existe pas encore de page « Mes commandes ».
