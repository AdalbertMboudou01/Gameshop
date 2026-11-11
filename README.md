# GameShop

Mini-boutique en ligne de consoles et de jeux vidéo : connexion, catalogue chargé depuis **Strapi**, panier et **paiement fictif** (aucune transaction, aucune donnée bancaire).

**Stack** : Node.js + Express 5 · JavaScript natif (sans build) · SQLite (`node:sqlite`) · Strapi

## Démarrage

Prérequis : **Node.js 22.13+** et le projet Strapi (`strapi-backend`).

```bash
# Terminal 1 — Strapi
cd strapi-backend
npm run develop          # http://localhost:1337

# Terminal 2 — Boutique
cd GameShop
npm install
npm start                # http://127.0.0.1:3000
```

La base SQLite (`data/gameshop.db`) et le compte de démonstration sont créés automatiquement au premier lancement.

## Compte de démonstration

| E-mail | Mot de passe |
| --- | --- |
| `demo@gameshop.test` | `Console2026!` |

Vous pouvez aussi créer un compte depuis **« Créer un compte »**.

## Configuration

Copiez `.env.example` en `.env` pour modifier une valeur. Toutes les variables y sont décrites. Les principales :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `STRAPI_URL` | `http://localhost:1337` | Adresse de Strapi (sans `/api`) |
| `STRAPI_API_TOKEN` | *(vide)* | Jeton en lecture seule, si l'accès public est désactivé |
| `PORT` | `3000` | Port de la boutique |
| `DB_PATH` | `data/gameshop.db` | Fichier SQLite |

## Intégration Strapi

La boutique lit la collection **`article`** (`Product_name`, `Price`, `Picture`) via `GET /api/articles`. Le rôle *Public* doit avoir la permission `find`, ce qui est le cas par défaut. Seuls les articles **publiés** apparaissent dans la boutique.

Les comptes clients, les paniers et les commandes sont stockés dans la base SQLite de la boutique, comme l'impose l'énoncé.

## Fonctionnalités

- Connexion et inscription, avec « Se souvenir de moi »
- Catalogue : recherche par nom et navigation par tranche de prix
- Panier : quantités, retrait, total recalculé par le serveur
- Paiement fictif : un double clic ne crée qu'une commande, et les prix sont revérifiés avant de payer
- Confirmation de commande avec référence

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm start` | Lance la boutique |
| `npm run dev` | Lance avec redémarrage automatique |
| `npm run check` | Lint + tests unitaires et d'intégration |
| `npm run test:e2e` | Parcours complet dans Chrome, sur ordinateur et sur mobile (Strapi et la boutique doivent tourner) |
| `npm run seed -- --reset` | Réinitialise le mot de passe du compte de démo |

## Structure

```
server/    API Express : routes HTTP → services métier → accès SQLite, client Strapi
public/    Front monopage : core/ (API, routeur, état), components/, views/
tests/     Tests unitaires (node:test) et parcours navigateur (Playwright)
```

## Sécurité

- Mots de passe hachés (scrypt), sessions dans un cookie `HttpOnly`
- Protection CSRF et limitation des tentatives de connexion et d'inscription
- **Jamais versionnés** : la base SQLite (`data/`) et les fichiers `.env`

Le mot de passe de démonstration est public : il ne protège qu'un compte de test. En production, changez `DEMO_PASSWORD`, passez `SHOW_DEMO_ACCOUNT=false` et `COOKIE_SECURE=true`.
