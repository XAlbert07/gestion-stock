# Backend — Gestion de stock

## Prérequis

- Node.js 22 ou plus récent ;
- PostgreSQL 16 ou plus récent.

## Installation

```bash
cd backend
npm install
cp .env.example .env
```

Renseignez les valeurs PostgreSQL dans `.env`. Ce fichier est local et ne doit jamais être versionné.

## Commandes

```bash
npm run dev          # démarre l'API avec rechargement
npm start            # démarre l'API
npm test             # exécute les tests isolés
npm run lint         # vérifie le code
npm run format       # formate les fichiers JavaScript
npm run db:migrate   # applique les migrations PostgreSQL
npm run db:seed      # ajoute les données de démonstration
npm run bootstrap:admin # crée le premier administrateur depuis les variables ADMIN_*
```

Appliquez les migrations avant le premier démarrage sur une base neuve. La migration initiale crée l'ensemble du schéma métier. Sur la base historique déjà complète, `db:migrate` enregistre cette migration comme référence sans recréer les tables. Le seed est optionnel et peut être relancé sans créer de doublons.

## Routes disponibles

- `GET /api/health`
- `GET /api/health/ready` (vérifie aussi la connexion PostgreSQL; `503` si indisponible)
- `GET /api/categories`, `POST /api/categories`
- `GET /api/units`, `POST /api/units`
- `GET /api/products` (pagination : `page`, `limit`, recherche : `search`, filtre : `category_id`)
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id` (mise à jour ou désactivation avec `is_active: false`)
- `GET /api/products/:id/units`, `POST /api/products/:id/units` (conversions)
- `GET /api/inventory/products/:productId/stock`
- `GET /api/inventory/products/:productId/movements`
- `POST /api/inventory/adjustments` (`product_id`, `direction`, `quantity`, `reason`)
- `POST /api/inventory/operations/:operationId/cancel`
- `GET /api/suppliers`, `POST /api/suppliers`
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/receipts`, `POST /api/receipts` (brouillon authentifié)
- `GET /api/receipts/:id`, `GET /api/receipts/:id/items`
- `POST /api/receipts/:id/items`, `POST /api/receipts/:id/complete` (authentifiés)
- `GET/POST /api/customers/types`, `GET/POST /api/customers`
- `GET/POST /api/sales`, `GET /api/sales/:id`, `GET/POST /api/sales/:id/items`, `POST /api/sales/:id/complete`
- `POST /api/sales/:saleId/returns`, `GET/POST /api/sales/returns/:returnId/items`, `POST /api/sales/returns/:returnId/complete`

La création d'un produit attend `name`, `sku`, `category_id` et `base_unit_id`.

Toutes les routes métier exigent une session valide, y compris les lectures. Seules `GET /api/health` et `POST /api/auth/login` sont publiques; `GET /api/auth/me` est authentifiée. La première version utilise une authentification commune sans permissions fines par rôle.

L'API applique les en-têtes de sécurité Helmet, limite le corps JSON à 100 ko et plafonne les connexions à 10 tentatives par adresse IP sur 15 minutes. `TRUST_PROXY_HOPS` vaut `0` par défaut. Derrière un proxy inverse, ne le configurez qu'au nombre exact de proxys de confiance et rendez l'API inaccessible en accès direct; le stockage mémoire du limiteur convient à une instance, pas à plusieurs instances réparties.

`GET /api/health` est un contrôle de vie du processus HTTP; `GET /api/health/ready` est le contrôle de disponibilité qui interroge PostgreSQL sans renvoyer de détail technique en cas d'échec. Pour les secrets, générer une valeur aléatoire (par exemple `openssl rand -hex 32` pour `JWT_SECRET`) et la fournir via le gestionnaire de secrets de l'environnement, jamais dans Git ou les journaux. La CI audite les dépendances de production; les dépendances de développement font aussi l'objet d'une revue périodique.

## Règles de développement

- Ne placez aucun secret dans le code ou dans Git.
- N'utilisez pas la base de développement pour les tests automatisés.
- N'éditez jamais une migration déjà appliquée dans un environnement partagé : créez une nouvelle migration.
- Une réception validée ne s'annule pas dans la première version ; toute correction passe par un ajustement de stock traçable.
- Le journal consolidé du projet est disponible dans `../JOURNAL_PROJET.md`.

## CI et sauvegarde PostgreSQL

Le workflow GitHub Actions vérifie le backend et le frontend à chaque push et pull request. Il lance les migrations puis les tests d'intégration sur un service PostgreSQL 16 éphémère; les secrets du workflow sont réservés aux tests et ne doivent pas être réutilisés.

Pour une sauvegarde manuelle, utiliser un compte PostgreSQL dédié et un fichier `.pgpass` protégé (permissions `0600`) plutôt que de placer le mot de passe dans la commande ou l'historique du terminal :

```bash
pg_dump --format=custom --no-owner --no-acl --file=gestion_stock_$(date +%F_%H%M).dump gestion_stock
```

Conserver les sauvegardes hors du serveur de base, avec une rétention définie par l'exploitant. Une commande `pg_dump` réussie ne prouve pas qu'une sauvegarde est exploitable : tester régulièrement sa restauration. Restaurer d'abord vers une base **nouvelle et isolée**, jamais avec `--clean` sur la base active :

```bash
createdb gestion_stock_restore_test
pg_restore --exit-on-error --no-owner --no-acl --dbname=gestion_stock_restore_test gestion_stock_YYYY-MM-DD_HHMM.dump
```

Vérifier ensuite les migrations, les tables et quelques comptages métier avant de considérer le test réussi. Les commandes d'exemple supposent que l'accès PostgreSQL est configuré dans `.pgpass`; les noms de base, emplacement, chiffrement, rétention et surveillance doivent être adaptés à l'hébergement choisi. La restauration de test n'est pas une procédure de bascule en production.
