# Journal technique — Gestion de stock

Ce document est la référence unique pour suivre le projet. Il consigne les choix d'architecture, les fonctionnalités réellement implémentées, les contrôles effectués et les prochaines décisions. Il remplace le suivi par documents séparés pour les travaux futurs.

## 1. Vision et principes

L'application est un monolithe modulaire Node.js, Express et PostgreSQL. Son objectif principal est de garantir la fiabilité du stock et la traçabilité des opérations avant de multiplier les écrans ou les fonctions secondaires.

Principes appliqués :

- modules métier indépendants ;
- routes → contrôleurs → services → requêtes SQL ;
- transactions PostgreSQL pour toute opération qui modifie le stock ;
- contraintes SQL pour l'intégrité des données ;
- historique de stock immuable : une correction crée une nouvelle opération ;
- validation des entrées, erreurs JSON cohérentes et tests ciblés ;
- pas d'abstraction ou d'infrastructure ajoutée sans besoin réel.

## 2. Architecture retenue

```text
backend/src/
├── config/             environnement et PostgreSQL
├── common/             erreurs applicatives communes
├── middlewares/        404, erreurs, authentification
├── modules/
│   ├── auth/           connexion et session JWT
│   ├── catalog/        catégories et unités
│   ├── inventory/      stock, ajustements, mouvements, annulations
│   ├── products/       produits et conversions d'unités
│   ├── receipts/       brouillons et validation de réceptions
│   └── suppliers/      fournisseurs
├── routes/             route technique de santé
└── server.js           démarrage HTTP
```

Une nouvelle fonctionnalité est ajoutée comme module. Elle ne modifie les modules existants que lorsqu'elle partage une règle métier réelle, par exemple une réception qui utilise les écritures contrôlées de stock.

## 3. État des implémentations

### 3.1 Socle technique — terminé

- Configuration PostgreSQL par `.env`, modèle `.env.example` et validation au démarrage.
- Scripts npm : démarrage, développement, tests, lint, formatage, migration, seed et création du premier administrateur.
- Migrations SQL versionnées ; le schéma PostgreSQL existant est enregistré comme migration initiale.
- Seed de démonstration relançable.
- Gestion uniforme des erreurs HTTP et route 404.
- ESLint, Prettier, Jest et Supertest.
- Dépendances de production auditées sans vulnérabilité connue au dernier contrôle.

### 3.2 Catalogue — terminé

- Catégories et unités : lecture et création.
- Produits : création, lecture unitaire, liste paginée, recherche, filtre par catégorie, mise à jour et désactivation réversible.
- Unités de vente et facteurs de conversion par produit.
- Le stock et le coût moyen ne sont jamais modifiés par les routes Catalogue.

### 3.3 Inventaire — terminé

- Consultation du stock courant et de l'historique des mouvements.
- Ajustements d'entrée ou de sortie authentifiés.
- Verrouillage de la ligne produit pendant l'écriture ; refus d'un stock négatif.
- Une opération produit une opération métier, une ligne d'opération, un mouvement et une mise à jour du stock dans la même transaction.
- Annulation générique par opération compensatoire ; une opération ne peut pas être annulée deux fois.

### 3.4 Fournisseurs — amorcé

- Lecture des fournisseurs actifs.
- Création de fournisseur avec validation des informations de contact.
- Les associations fournisseur-produit sont mises à jour lors d'une réception validée : dernier prix d'achat mémorisé.

### 3.5 Utilisateurs et droits minimaux — terminé

- Création idempotente du premier administrateur via `npm run bootstrap:admin` et les variables `ADMIN_*` locales.
- Mots de passe hachés avec bcrypt.
- Connexion par jeton JWT et consultation de la session courante.
- Les écritures d'inventaire et de réception exigent un jeton valide et enregistrent l'auteur.

### 3.6 Réceptions — flux principal livré

- Création de réception au statut `DRAFT`.
- Ajout de lignes uniquement tant que la réception est un brouillon.
- Contrôle du produit, de l'unité et de son facteur de conversion.
- Validation atomique d'une réception :
  1. création d'une opération `RECEIPT` ;
  2. création des lignes d'opération et mouvements d'entrée ;
  3. augmentation du stock ;
  4. calcul du nouveau coût moyen pondéré ;
  5. mise à jour du dernier prix fournisseur ;
  6. passage de la réception à `COMPLETED`.

### 3.7 Clients, ventes et retours — flux principal livré

- Types de clients et clients : lecture et création.
- Vente au statut `DRAFT`, avec client facultatif.
- Ajout de lignes de vente seulement tant que le brouillon n'est pas validé.
- Validation atomique : verrouillage des produits, contrôle du stock disponible, création d'une opération `SALE`, mouvements de sortie, baisse du stock, total de vente et passage à `COMPLETED`.
- Une validation qui dépasse le stock disponible est refusée et annulée intégralement par la transaction.
- Retours de vente : brouillon lié à une vente validée, lignes limitées à la quantité vendue non déjà retournée et validation atomique avec mouvement d'entrée de stock.

## 4. Décisions métier actives

### Stock et traçabilité

- Le stock ne devient jamais négatif.
- Chaque variation de stock laisse un mouvement immuable dans `stock_movements`.
- Les quantités sont stockées dans l'unité de base après conversion.
- Les montants restent en `numeric` côté PostgreSQL.

### Réceptions validées

Une réception `COMPLETED` **n'est pas annulable** dans la première version.

Raison : après une réception, des ventes, ajustements ou réceptions suivantes peuvent avoir modifié le stock et le coût moyen. Annuler naïvement l'opération produirait une valorisation incohérente. En cas d'erreur :

1. conserver la réception historique ;
2. créer un ajustement de stock avec motif ;
3. créer une réception correcte si nécessaire.

Cette règle est volontairement stricte et sera réexaminée seulement lorsqu'une politique comptable complète de correction du coût moyen aura été définie.

### Sécurité

- Les secrets restent dans `.env`, jamais dans Git.
- Le jeton JWT est obligatoire pour les écritures sensibles.
- Le compte administrateur local est créé par script et son mot de passe doit être remplacé avant tout usage partagé ou déploiement.

## 5. Routes disponibles

| Domaine | Routes principales |
|---|---|
| Santé | `GET /api/health` |
| Authentification | `POST /api/auth/login`, `GET /api/auth/me` |
| Catalogue | `GET/POST /api/categories`, `GET/POST /api/units` |
| Produits | `GET/POST /api/products`, `GET/PATCH /api/products/:id`, `GET/POST /api/products/:id/units` |
| Inventaire | `GET /api/inventory/products/:id/stock`, `GET /api/inventory/products/:id/movements`, `POST /api/inventory/adjustments`, `POST /api/inventory/operations/:id/cancel` |
| Fournisseurs | `GET/POST /api/suppliers` |
| Réceptions | `GET/POST /api/receipts`, `GET /api/receipts/:id`, `GET/POST /api/receipts/:id/items`, `POST /api/receipts/:id/complete` |
| Clients | `GET/POST /api/customers`, `GET/POST /api/customers/types` |
| Ventes et retours | `GET/POST /api/sales`, `GET /api/sales/:id`, `GET/POST /api/sales/:id/items`, `POST /api/sales/:id/complete`, routes `/api/sales/:saleId/returns...` |

Les routes d'écriture d'inventaire et de réception demandent `Authorization: Bearer <jeton>`.

## 6. Vérifications réalisées

- `npm run check` réussit : lint, formatage et tests automatisés.
- 34 tests automatisés couvrent notamment santé, 404, validation, accès authentifié/non authentifié, limitation de connexion, en-têtes HTTP, erreurs inventaire, règles de réception, vente et retour excessif.
- Le frontend dispose de cinq tests UI ciblés (React Testing Library/Vitest); `npm test`, `npm run build` et `npm run lint` passent.
- Connexion administrateur et consultation de session vérifiées sur PostgreSQL réel.
- Lecture réelle vérifiée pour produits, catégories, unités, fournisseurs, stock, mouvements et réceptions.
- Un parcours API complet a été exécuté sur une base PostgreSQL 16 isolée et jetable : réception de 20 unités, vente de 2, retour de 1, refus du dépassement de retour (`409`), stock final attendu et observé à 19. Aucun appel d'écriture n'a ciblé la base `gestion_stock`.

## 7. Limites connues

- Le compte PostgreSQL de développement ne peut pas créer de base; les essais d'intégration futurs devront utiliser un conteneur isolé ou une base de test provisionnée explicitement.
- L'essai réel a validé l'API et PostgreSQL, mais pas un navigateur réel connecté à cette API; les cinq tests d'interface utilisent un réseau simulé.
- Les rôles sont disponibles en base, mais seul le rôle `ADMIN` est créé par le bootstrap. La gestion complète des utilisateurs et autorisations fines viendra avant ouverture multi-utilisateur.

## 8. Prochaine étape

Les phases 1 à 5 sont terminées : socle backend métier, interface, parcours Réceptions/Ventes/Retours, tests UI ciblés et parcours API vérifié sur PostgreSQL isolé. La prochaine phase est la **Phase 6 : préparation à la production** (sécurité, configuration, déploiement et sauvegardes). L'essai navigateur connecté à l'API reste une amélioration de validation, pas un test déjà effectué.

### Décision frontend

Le frontend utilisera **React avec Vite**, **Tailwind CSS v4** et une bibliothèque de composants accessible et réutilisable telle que **shadcn/ui**. Tailwind fournit les fondations de styles et la bibliothèque fournit des composants assemblables ; ni l'un ni l'autre ne doit porter les règles métier, qui restent dans l'API.

Le design system sera posé dès la fondation, sans surconstruire :

1. **Tokens** : couleurs sémantiques, typographie, espacements, rayons, ombres et états (succès, alerte, erreur, information).
2. **Composants UI génériques** : bouton, champ, sélection, dialogue, tableau, badge, alerte, onglets, carte et état vide.
3. **Composants métier** : montant, quantité avec unité, statut d'opération, indicateur de stock, ligne d'article et formulaire de mouvement.
4. **Règles** : accessibilité clavier, contraste, retours de validation, chargements et erreurs cohérents, responsive mobile et bureau.

La Phase 5 a été menée par incréments utilisables : fondation visuelle, authentification, Catalogue et stock, puis Réceptions, Ventes et Retours.

### Phase 5 — fondation réalisée

- Projet `frontend/` créé avec React, Vite et TypeScript.
- Tailwind CSS v4 configuré avec son plugin Vite. Les tokens CSS nommés (`background`, `foreground`, `primary`, `muted`, `success`, `warning`, `destructive`…) alimentent les classes Tailwind ; thèmes clair et sombre sont prévus.
- `components.json` ajouté pour permettre l'usage du CLI shadcn/ui avec les alias du projet. Les composants sont conservés dans le dépôt et personnalisables.
- Icônes Lucide, CVA, Radix Slot, `clsx` et `tailwind-merge` installés pour construire les composants.
- Composants génériques créés : `Button`, `Input`, `Label`, `Card` et `Badge`, avec variantes, focus clavier et états désactivés.
- Première coque responsive : en-tête, navigation, cartes de synthèse et aperçu des états métier. Les données restent vides tant que les écrans ne sont pas connectés à l'API.
- `npm run build` et `npm run lint` frontend validés.

### Phase 5 — première tranche d'accès réalisée

- Client HTTP partagé : base d'URL configurable par `VITE_API_URL`, erreurs API normalisées et ajout centralisé du jeton Bearer.
- Proxy Vite `/api` vers `http://localhost:3000` en développement afin d'éviter une dépendance CORS locale ; le serveur backend doit être démarré séparément.
- Connexion fonctionnelle côté interface via `POST /api/auth/login`, avec erreurs lisibles et état de soumission.
- Session conservée dans `sessionStorage` (durée de l'onglet, contrairement à une persistance longue dans `localStorage`) puis revalidée via `GET /api/auth/me` au rechargement.
- Routes React Router : `/connexion`, `/app` et pages réservées protégées par un garde côté client. La protection effective des données demeure assurée par les middlewares backend, pas par le routeur frontend.
- Coque privée affiche le compte connecté, le rôle et permet la déconnexion. Les liens Catalogue, Stock, Réceptions et Ventes sont des pages explicites de disponibilité, pas encore des écrans métier.
- `npm run build` et `npm run lint` frontend passent sans erreur ni avertissement après séparation du fournisseur de session et du contexte.
- Vérification locale réelle : frontend servi en HTTP 200, proxy `/api/health` en 200, contrat de refus de connexion en `401 INVALID_CREDENTIALS` et session anonyme en `401 UNAUTHORIZED`.
- La connexion réussie avec un compte valide et son affichage dans le navigateur restent à vérifier avec des identifiants administrateur autorisés ; aucun secret de compte n'a été lu ou utilisé. Aucun test navigateur automatisé n'est encore configuré.

### Phase 5 — lecture du Catalogue réalisée

- La page Catalogue consomme `GET /api/products`, `GET /api/categories` et `GET /api/units` via le client API partagé.
- Recherche par nom ou SKU avec temporisation courte, filtre par catégorie, option d'inclusion des produits désactivés et pagination de 20 lignes ; ces filtres correspondent aux paramètres déjà pris en charge par le backend.
- La liste présente référence, catégorie, stock courant avec unité de base, seuil critique et état actif/désactivé. Le faible stock est signalé lorsque le stock courant est inférieur ou égal au seuil.
- États de chargement, d'erreur/réessai et de résultat vide prévus ; les requêtes devenues obsolètes sont annulées pour éviter qu'une ancienne réponse remplace les filtres récents.
- Les catégories et unités sont chargées une fois indépendamment des pages de produits, et leurs libellés sont mis en correspondance côté interface sans modifier le contrat backend.
- Vérification réelle locale via le proxy : liste produits `200` (3 lignes sur la base courante), catégories `200`, unités `200`. `npm run build` et `npm run lint` frontend validés.
- La consultation est livrée ; création, modification et gestion des unités de vente ne sont pas incluses dans cette tranche.

### Phase 5 — consultation du stock réalisée

- Depuis chaque produit du Catalogue, un lien ouvre `/app/stock/:productId`. La navigation Stock mène aussi à une page d'entrée qui renvoie au Catalogue pour choisir un produit.
- La page de détail appelle en parallèle `GET /api/inventory/products/:id/stock` et `GET /api/inventory/products/:id/movements?limit=50` via un adaptateur API du domaine Inventaire.
- Elle présente le niveau courant, l'unité de base, le seuil critique, le statut actif/inactif et les mouvements récents (date, type d'opération, entrée/sortie, quantité signée, note).
- Le vocabulaire des opérations est traduit côté interface ; les données et règles métier continuent de provenir du backend. Les écritures d'ajustement et annulations ne font pas partie de cette page de consultation.
- États de chargement, d'erreur avec nouvelle tentative et d'historique vide sont traités. Les opérations sont annulables côté client lors d'un changement de produit ou d'un démontage de page.
- Vérification réelle locale via l'API : stock `200` avec les champs attendus ; mouvements `200`. La base courante contient 3 produits mais aucun mouvement, donc le rendu d'une ligne de mouvement n'a pas pu être constaté avec les données actuelles.
- `npm run build` et `npm run lint` frontend passent sans erreur ni avertissement.

### Phase 5 — parcours Réceptions implémenté

- La route `/app/receptions` affiche l'historique des réceptions, leur fournisseur, leur référence, leur date et leur statut, avec états de chargement, erreur/réessai et liste vide.
- La page permet de créer un brouillon authentifié en choisissant un fournisseur actif, en renseignant une référence et une note facultative. Le formulaire bloque proprement lorsque aucun fournisseur actif n'est disponible.
- La route `/app/receptions/:receiptId` présente les informations du brouillon et ses lignes. L'ajout d'un article permet de rechercher un produit actif, de sélectionner son unité de base ou une unité convertie, puis de saisir quantité et prix d'achat.
- Le détail indique les conversions enregistrées et un total indicatif; la validation métier et les écritures de stock restent exclusivement effectuées par l'API.
- La validation exige une confirmation explicite et informe qu'elle est irréversible dans cette version. Les erreurs d'API sont affichées sans reproduire les règles métier côté navigateur.
- Le tableau de bord reflète désormais l'intégration du parcours Réceptions; les Ventes restent à connecter.
- Contrats vérifiés en lecture sur l'API locale : réceptions `200` (aucune ligne), fournisseurs `200` (aucun fournisseur actif), produits `200` (3 produits), unités d'un produit `200`. Aucun brouillon, fournisseur, article ou mouvement n'a été créé pour les besoins de vérification.
- `npm run build` et `npm run lint` frontend sont les contrôles de livraison; un essai complet de création/validation avec la base actuelle n'est pas possible sans créer des données métier réelles. La validation avec fournisseur existant, authentification valide et rendu des lignes reste donc à faire.
- Limite de sécurité constatée dans le contrat backend existant : `POST /api/suppliers` ne semble pas protégé par authentification. Le frontend n'ajoute pas de création fournisseur et ne s'appuie pas sur cette route; il faudra corriger/protéger ce point avant d'exposer la gestion des fournisseurs.

### Phase 5 — parcours principal des Ventes implémenté

- La route `/app/ventes` affiche l'historique, les clients associés, les références, dates, totaux et statuts, avec états de chargement, erreur/réessai et liste vide.
- La création authentifiée d'un brouillon accepte un client facultatif et une référence; elle ouvre ensuite le détail `/app/ventes/:saleId`.
- Le détail d'un brouillon permet de rechercher un produit actif, de choisir une unité disponible (base ou conversion enregistrée), puis de saisir quantité et prix unitaire.
- Le total est calculé à partir des montants de lignes retournés par l'API. Une confirmation avertit l'utilisateur que le stock disponible sera contrôlé et décrémenté par le backend.
- Le tableau de bord et la navigation présentent désormais les parcours Ventes et Retours comme disponibles.
- `npm run build` et `npm run lint` frontend réussissent. Le parcours authentifié a également été exercé sur PostgreSQL isolé (voir « intégration API/PostgreSQL vérifiée »).
- Contrôle en lecture seule de la base de développement : `GET /api/sales` et `GET /api/customers` répondent `200` avec des listes vides; `GET /api/products` répond `200` avec 3 produits, tous à stock nul. Aucune écriture n'a ciblé cette base.

### Phase 5 — parcours des retours de vente implémenté

- Une vente validée permet de créer un brouillon de retour avec référence et motif facultatif.
- La route `/app/ventes/retours/:returnId` charge le retour, la vente d'origine, ses lignes et les unités nécessaires à l'affichage.
- Une ligne retournée doit référencer une ligne réellement vendue. L'interface empêche de sélectionner deux fois la même ligne dans le brouillon courant et borne la quantité à celle vendue; l'API reste l'autorité pour cumuler les retours antérieurs et rejeter tout dépassement.
- Une confirmation explicite précède la validation et précise que les articles seront remis en stock. Le remboursement financier n'est pas géré par ce parcours ni par les opérations de stock du backend.
- Build de production frontend et lint réussis après formatage des fichiers de ventes. Le seul retour créé pendant les essais a été dans la base isolée éphémère; la base de développement est restée inchangée.

### Phase 5 — socle de tests UI réalisé

- Vitest et jsdom sont intégrés au projet Vite; React Testing Library et `user-event` vérifient les interfaces par les rôles, libellés et actions visibles, sans coupler les tests à l'état interne des composants.
- `npm test` exécute cinq tests ciblés : absence de fournisseur pour une réception, ajout d'une ligne authentifiée de réception, création de vente avec client facultatif, impossibilité de valider une vente vide et présentation à l'utilisateur d'un refus API sur quantité de retour.
- Les appels réseau des tests sont simulés; aucune base ni donnée métier réelle n'est modifiée. Cela couvre les contrats d'interface mais ne remplace pas l'essai d'intégration avec API et PostgreSQL isolés.
- Vérifications finales : les 5 tests passent, `npm run build` réussit et `npm run lint` ne signale pas d'erreur.

### Phase 5 — intégration API/PostgreSQL vérifiée

- La première exécution de `npm run db:migrate` sur une base vide a révélé que `001_initial_schema.sql` vide la recherche PostgreSQL (`search_path`); l'inscription ensuite non qualifiée de la migration échouait.
- `backend/scripts/migrate.js` qualifie désormais explicitement `public.schema_migrations`, ce qui permet de migrer une base neuve même lorsque le `search_path` est vide. La migration initiale a ensuite réussi sur PostgreSQL 16 isolé.
- Après seed et création d'un administrateur de test éphémère, les appels HTTP authentifiés ont parcouru une réception, une vente et un retour. Le contrôle du retour excessif a répondu `409`; le stock final du produit de test était `19.000`, comme attendu.
- La base a été exécutée dans un conteneur temporaire nommé `gestion-stock-e2e-db`, sans volume persistant. L'API, le serveur frontend de test et le conteneur ont été arrêtés après vérification; les données de test éphémères ont été supprimées avec le conteneur.

### Prochaine sous-étape

La Phase 6 a commencé par l'audit initial ci-dessous. Ne pas déployer avant d'avoir une cible et des choix d'hébergement confirmés.

### Phase 6 — audit initial de préparation à la production (18 octobre 2026)

Audit statique du dépôt et des configurations visibles. Aucun secret n'a été affiché, aucune donnée n'a été modifiée et aucun déploiement n'a été effectué. Le dossier n'a pas de métadonnées Git; l'audit ne peut donc pas établir si un fichier a déjà été suivi/versionné dans l'historique.

#### Constats et priorités

1. **Bloquant — autorisation des écritures incomplète.** Plusieurs routes d'écriture ne passent pas par `requireAuth` : création/modification de produits, création de catégories/unités, création de fournisseurs et de clients/types. Même certaines lectures métier sensibles restent publiques. Les opérations d'inventaire et la plupart des écritures de réception/vente/retour sont authentifiées, mais l'ensemble n'est pas cohérent. Avant toute exposition réseau, établir une matrice routes × droits, protéger toutes les écritures, puis ajouter des rôles/permissions adaptés aux utilisateurs prévus. Le contrôle par jeton seul ne remplace pas les droits métier.
2. **Élevé — permissions du secret local (corrigé localement).** `backend/.env` avait les permissions Unix `664`; elles ont été réduites à `600`. L'historique Git ne peut pas être audité car ce dossier n'a pas de métadonnées Git. Ne pas déployer ce fichier; renouveler ses secrets si une lecture par d'autres comptes est suspectée.
3. **Élevé — protection du serveur (partiellement corrigée).** Helmet ajoute les en-têtes de sécurité, le JSON est plafonné à 100 ko et le login est limité à 10 requêtes par IP/15 minutes. Restent à définir selon l'hébergement : CORS/origines, TLS au point d'entrée, configuration du proxy de confiance et protections devant un déploiement multi-instance.
4. **Élevé — aucun dispositif de déploiement ou reprise n'est livré.** Aucun fichier de conteneurisation, pipeline CI, procédure de déploiement/rollback, ni documentation de sauvegarde/restauration n'a été trouvé. Il faut définir fréquence/rétention, emplacement séparé, chiffrement et test de restauration avant d'héberger des données réelles.
5. **Moyen — configuration de production insuffisamment explicitée.** `backend/.env.example` décrit un environnement local, mais il n'y a pas de configuration de production distincte documentée. La config DB ne prévoit pas d'options TLS; le serveur écoute sur son port sans orchestration, arrêt gracieux ni contrôle de readiness connecté à PostgreSQL. `TRUST_PROXY_HOPS` est maintenant explicite (0 par défaut), mais doit refléter exactement la topologie de confiance choisie. La route `/api/health` répond `ok` sans vérifier la base. À cadrer selon la plateforme retenue, sans ajouter de mécanismes inutiles au développement local.
6. **Moyen — jeton côté navigateur.** Le JWT est stocké dans `sessionStorage`, accessible à tout JavaScript de la page; une faille XSS pourrait donc le compromettre. À arbitrer avant production entre maintien temporaire avec protections XSS strictes et migration vers cookie `HttpOnly`, `Secure`, `SameSite` (avec les implications CSRF/CORS correspondantes).
7. **Moyen — validation de maintenance.** Les scripts lint/tests/build sont présents, mais aucun pipeline automatisé n'a été trouvé. Intégrer ces contrôles dans une CI simple avant fusion/livraison; conserver les migrations versionnées et tester restauration et rollback sur environnement isolé.

#### Choix raisonnable pour une architecture de production

Garder le monolithe modulaire actuel (API Node/Express, PostgreSQL et frontend React statique). Pour le premier déploiement, préférer une plateforme simple et supportée : TLS et terminaison HTTPS par un reverse proxy ou service géré, API accessible uniquement via ce point d'entrée, PostgreSQL non exposé publiquement et sauvegardes automatisées hors serveur. N'introduire conteneurs, orchestration ou services séparés que si la cible l'exige; ces outils ne sont pas une fin en soi.

#### Suite proposée, dans l'ordre

1. Corriger les permissions du `.env` local et revoir/renouveler les secrets si nécessaire; ne jamais les copier dans un dépôt ou une image.
2. Confirmer les utilisateurs et actions permises, établir la matrice d'accès, puis sécuriser les routes et tester les refus (401/403).
3. Définir la cible d'hébergement, les noms de domaine/origines, le modèle TLS, le stockage des secrets, les ressources et le modèle de compte PostgreSQL à privilèges minimaux.
4. Implémenter les mesures HTTP et de session adaptées à cette cible, avec tests couvrant auth, autorisations, limites et erreurs.
5. Ajouter un contrôle CI minimal (tests backend/frontend, lint, build) et une procédure de livraison/retour arrière vérifiée sur environnement de préproduction.
6. Mettre en place les sauvegardes, la rétention et un test documenté de restauration; convenir des objectifs de reprise (RPO/RTO).
7. Réaliser une recette navigateur/API, vérifier logs sans secrets, supervision, readiness DB et checklist de mise en production; alors seulement décider de la mise en ligne.

La phase 6 reste **en cours** : cet audit est un diagnostic, pas une mise en production. Il reste deux phases au total (phase 6 puis phase 7 Rapports). Les routes métier sont désormais authentifiées; les rôles fins, le choix d'hébergement et les objectifs de reprise conditionnent les travaux suivants.

### Phase 6 — authentification commune des routes métier

Décision provisoire pour la première version : l'application est réservée aux utilisateurs connectés; il n'y a pas encore de permissions fines par rôle. Seules la santé (`GET /api/health`) et la connexion (`POST /api/auth/login`) sont publiques. La session courante reste authentifiée.

- Les routes de Catalogue, Produits, Inventaire, Fournisseurs, Réceptions, Clients, Ventes et Retours exigent maintenant un JWT valide pour les lectures comme pour les écritures. L'authentification est appliquée au niveau de chaque routeur métier; les règles restent visibles près du domaine et le 404 global demeure intact.
- Le client API frontend ajoute le jeton conservé en `sessionStorage` aux requêtes métier; les écrans n'ont pas besoin de dupliquer cette plomberie. La connexion n'envoie pas de jeton de session obsolète.
- Des tests backend vérifient le refus sans jeton sur les domaines métier et gardent publiques la santé et la route de connexion. Les contrôles frontend restent verts.
- Vérifications : backend `npm run check` réussi (33 tests); frontend `npm test` (5 tests), `npm run lint` et `npm run build` réussis.
- Limite assumée : tout utilisateur disposant d'un jeton valide a les mêmes droits d'application pour le moment. Les rôles stockés dans le jeton ne sont pas utilisés comme permissions; définir les rôles avant l'ouverture à plusieurs profils.

Cette première étape a amélioré la barrière d'accès. À ce moment du suivi, les autres volets de la phase 6 (protections HTTP, configuration/infra, sauvegardes et restauration, CI et recette de production) restaient à traiter; leur progression est consignée ci-dessous.

### Phase 6 — protections HTTP, limitation de connexion et secrets locaux

- Les permissions de `backend/.env` sont passées de `664` à `600`. Le fichier lui-même et ses valeurs n'ont pas été modifiés ni affichés.
- Helmet est appliqué à l'API. La directive CSP `upgrade-insecure-requests` est omise hors production pour préserver le développement local; les en-têtes de base (dont `nosniff`) sont vérifiés par test.
- Le corps JSON est limité à 100 ko. Le point d'entrée de connexion applique un plafond de 10 tentatives par IP sur 15 minutes, avec en-têtes RateLimit standard et réponse JSON `429`.
- `TRUST_PROXY_HOPS` permet de définir explicitement le nombre de proxys de confiance (défaut `0`). En production, la valeur doit correspondre exactement au trajet réseau et l'API ne doit pas être joignable directement. Le limiteur utilise son stockage mémoire, donc un stockage partagé serait requis avant un déploiement multi-instance.
- Vérification : `backend npm run check` réussit avec 34 tests. `npm audit --omit=dev` signale 0 vulnérabilité connue dans l'arbre de production. L'audit complet npm signale 22 vulnérabilités (19 modérées, 3 élevées) associées à l'arbre d'outils de développement, notamment Jest/Nodemon; les remèdes proposés impliquent des changements de version majeurs incohérents (dont des rétrogradations) et n'ont pas été appliqués automatiquement.

La Phase 6 continue : restent notamment le traitement raisonné des alertes de dépendances de développement, les rôles/permissions si plusieurs profils sont prévus, les détails TLS/CORS/proxy et PostgreSQL, le pipeline CI, la sauvegarde/restauration testée, puis la recette sur une cible réelle.

### Conception fonctionnelle cible et plan d'implémentation — gestion quotidienne du stock

**Statut : conception préparée, aucune fonctionnalité de ce plan n'est considérée comme implémentée.** Ce périmètre est intégré au journal consolidé afin de garder au même endroit les décisions et leur historique. La revue/validation de cette conception précède le prochain lot de code.

#### 1. Pourquoi le périmètre est complété

L'interface actuelle permet de consulter le catalogue et le stock, mais ne présente pas les formulaires de gestion des catégories, unités, produits ou ajustements. La réception est le seul parcours d'interface permettant d'ajouter des quantités au stock. Le contrôle en lecture seule de la base locale a trouvé la catégorie « Boissons », trois produits (Coca-Cola, Fanta, Sprite) et zéro quantité en stock pour chacun. Ces éléments sont l'état de la base de développement au contrôle, pas une liste de produits à conserver comme données réelles. Le seed de démonstration décrit un autre jeu de données.

La Phase 6 ne doit donc pas conclure à la préparation à la production tant que les opérations quotidiennes indispensables ne sont pas réalisables et vérifiables depuis l'interface. La Phase 7 (rapports plus complets) demeure après ce socle.

#### 2. Hypothèses de conception à valider avant le code

- **Monnaie : XOF (FCFA BCEAO), hypothèse liée au contexte Burkina Faso.** L'interface affiche « F CFA »; les contrats et calculs utilisent le code explicite `XOF` pour ne pas confondre avec le FCFA d'Afrique centrale (`XAF`). Si le logiciel vise un pays de la CEMAC, le code devra être revu avant les migrations. Le Burkina Faso fait partie de l'UMOA, qui partage le FCFA émis par la BCEAO; le code ISO 4217 XOF et l'absence de sous-unité sont à prendre dans la liste courante de l'agence ISO 4217. Sources : [BCEAO — unité monétaire commune de l'UMOA](https://www.bceao.int/fr/content/emission-des-signes-monetaires-et-entretien-de-la-circulation-fiduciaire), [SIX — rôle d'agence de maintenance ISO 4217](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html), [SIX — liste officielle des devises courantes](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml).
- **Établissement :** un commerce, un seul magasin/lieu de stock pour la première version. Pas de multi-entrepôts avant qu'un besoin réel le justifie.
- **Quantités :** l'unité de base peut être fractionnaire jusqu'à trois décimales, comme dans le schéma actuel; les conversions restent explicites et positives.
- **Prix :** le prix saisi, les montants de ligne et les totaux présentés au client sont des FCFA entiers. Proposition de calcul : montant de ligne arrondi au FCFA le plus proche, puis total égal à la somme des lignes arrondies. Cette convention doit être validée avant le code, en particulier si des règles fiscales/factures sont requises.
- **Schéma monétaire actuel :** plusieurs prix/totaux et le coût moyen sont en `numeric(14,2)` dans `001_initial_schema.sql`. La migration doit recenser les valeurs existantes, définir leur conversion et tester qu'aucun centime non nul n'est perdu; ne pas modifier la migration initiale déjà appliquée.
- **Coût de stock :** le coût moyen pondéré peut comporter une fraction interne même si le prix public est en FCFA entier; garder une précision décimale suffisante côté PostgreSQL et arrondir seulement à l'affichage. Ne pas calculer les montants avec des flottants JavaScript.
- **Périmètre comptable :** la première version suit les achats, les ventes et le coût/stock pour l'exploitation. Elle ne remplace pas une comptabilité, ne calcule pas de taxes et ne délivre pas de facture fiscale sans règles locales explicitement confirmées.
- **Utilisateurs :** le rôle ADMIN existant est suffisant pour une première utilisation individuelle. Si plusieurs personnes utilisent le logiciel, définir les droits (gestionnaire, magasinier, caissier) avant d'ouvrir les opérations aux comptes concernés.

#### 3. Fonctions que l'application doit proposer

**A. Référentiels et catalogue**

- Créer, renommer et désactiver une catégorie; empêcher sa suppression si des produits l'utilisent.
- Créer des unités de mesure et des conversions par produit (ex. carton contenant 24 bouteilles); interdire une conversion nulle ou négative.
- Créer et modifier un produit : nom, SKU/référence unique, catégorie, unité de base, seuil d'alerte, description facultative et actif/inactif.
- Saisir les prix d'achat sur chaque réception et un prix de vente FCFA exploitable dans le parcours de vente. Conserver les prix par type de client/unité seulement si cela correspond au besoin réel; réutiliser la table `product_prices` existante au lieu de créer un deuxième mécanisme.
- Préserver l'historique : une catégorie/unité/produit déjà référencé est désactivé ou archivé, pas effacé physiquement.

**B. Stock initial, corrections et inventaire**

- À la création d'un produit, autoriser un stock initial facultatif; si quantité initiale supérieure à zéro, saisir également son coût d'entrée pour ne pas valoriser ce stock à zéro.
- Pour le stock déjà présent au démarrage du logiciel, fournir un parcours d'ouverture/inventaire qui enregistre les quantités physiques et leur coût de départ. Confirmer ce stock une fois avant les réceptions/ventes ordinaires; ne pas le réimporter à chaque démarrage.
- Pour une correction courante, choisir le produit, l'unité/quantité ou la quantité réellement comptée, puis donner un motif obligatoire (casse, perte, erreur de comptage, etc.). Afficher la différence qui sera appliquée et demander confirmation.
- Calculer l'écart depuis la quantité réelle au sein d'une transaction qui verrouille le produit; éviter que deux inventaires concurrents écrasent ou doublent une correction.
- Chaque création initiale ou correction génère opération, ligne et mouvement traçables; le solde courant est mis à jour dans la même transaction. Il ne doit jamais être éditable directement dans un formulaire produit.
- Garder l'interdiction de stock négatif et la règle de correction/annulation compensatoire déjà retenues.

**C. Fournisseurs et réceptions**

- Créer, modifier et désactiver un fournisseur (nom requis, contacts facultatifs, référence fournisseur facultative).
- Continuer le parcours réception existant : brouillon → lignes produit/unité/quantité/prix d'achat en FCFA → contrôle/récapitulatif → confirmation → réception validée.
- Seule la validation crédite le stock et met à jour le coût moyen; éviter les doubles validations et les modifications silencieuses après validation.
- Afficher l'historique filtrable par fournisseur, période, état et référence. Une réception validée n'est pas supprimée; la correction passe par une opération de stock traçable.
- Le bon de commande fournisseur et la gestion des paiements ne sont pas indispensables à la première mise en service; les planifier seulement si l'approvisionnement l'exige.

**D. Ventes, retours et relation client**

- Conserver les parcours de vente et de retour déjà livrés; compléter leur usage avec les prix FCFA, le prix sélectionné explicite, le total de ligne et le total de vente.
- Ajouter et gérer les clients et catégories de clients si le commerçant veut rattacher des ventes nominatives; permettre les ventes sans client pour le comptoir.
- Une vente validée diminue le stock dans la transaction; une vente dépassant le disponible échoue intégralement.
- Un retour lié à une vente validée remet en stock les quantités retournées dans les limites vendues. Le remboursement ou le paiement reste hors périmètre tant qu'une règle commerciale n'est pas définie.

**E. Consultation, alertes et rapports**

- Catalogue : recherche SKU/nom, filtre catégorie/actif, état du stock, seuil et unité.
- Stock : quantité par article, zéro/stock faible, fiche produit et mouvements complets filtrables par dates/type.
- Tableau de bord de base : nombre d'articles actifs, ruptures/alertes, opérations récentes. Ces indicateurs doivent venir de l'API, et non de valeurs statiques.
- Rapports après les formulaires : stock courant, mouvements par période, réceptions et ventes par période, produits les plus vendus, valeur de stock indicative basée sur les coûts connus. Signaler clairement les limites; ces rapports ne sont pas des états comptables.
- Les filtres et tris côté API doivent être paginés et cohérents; exporter CSV seulement si un besoin opérationnel est confirmé.

#### 4. Parcours utilisateur cible

```text
Configurer catégories et unités
        ↓
Créer les produits et prix de vente
        ↓
Saisir le stock de départ (quantité physique + coût)
        ↓
Réceptions validées ───────────→ Stock augmente et coût moyen se met à jour
Ventes validées ───────────────→ Stock diminue (refus si quantité insuffisante)
Retours validés ───────────────→ Stock revient
Inventaire / correction motivée → Écart compensatoire et mouvement historisé
        ↓
Consulter stock, mouvements et alertes
```

#### 5. Architecture d'implémentation

- Garder le **monolithe modulaire** déjà en place : React/Vite/Tailwind pour les écrans, API REST Express pour les cas d'usage, PostgreSQL pour les contraintes, transactions et historique. Aucun microservice, moteur générique de formulaire ou couche de dépôt supplémentaire n'est nécessaire.
- Étendre les modules existants `catalog`, `products`, `inventory`, `suppliers`, `receipts`, `sales` et `customers`; éviter des modules parallèles pour des entités déjà présentes.
- Pour une fonctionnalité, garder le flux `route → contrôleur → service métier → requêtes SQL`. Les contrôleurs ne portent pas de calcul de stock; le service inventaire orchestre les écritures atomiques.
- Ajouter les routes d'administration aux modules existants et les protéger par authentification; protéger séparément les actions sensibles si des rôles sont introduits.
- Réutiliser les composants UI communs seulement là où il y a répétition réelle : formulaire accessible, champs/prix FCFA, sélection produit/unité, états chargement/erreur, confirmation d'une validation. Ne pas créer un générateur CRUD universel.
- Créer une nouvelle migration versionnée; ne jamais modifier `001_initial_schema.sql` déjà appliquée. La migration monétaire doit commencer par mesurer les données existantes et vérifier qu'aucune valeur avec centimes ne serait arrondie silencieusement.
- Les documents validés et mouvements restent append-only; le stock courant est une projection cohérente, contrôlée et reconstruisible à partir des opérations selon les règles métier.

#### 6. Ordre d'implémentation et critères de fin

**Lot 0 — valider la conception, avant tout nouveau code**

Valider pays/code XOF, règle d'arrondi FCFA, un seul magasin, unité/quantité fractionnaire, saisie du stock de départ et coût, utilisateurs prévus, besoin ou non de prix par type de client. Examiner les données locales et sauvegarder avant toute migration; ne pas adopter automatiquement les données démo comme données du commerce.

**Lot 1 — administration des référentiels et produits**

Écrans de gestion catégories/unités, formulaire produit créer/modifier/désactiver, validation SKU unique, prix de vente XOF et validations serveur. Terminé lorsque les référentiels et produits peuvent être gérés dans l'interface et que les ventes/réceptions réutilisent bien ces produits.

**Lot 2 — stock initial et ajustement/inventaire**

Parcours de stock initial valorisé, entrée/sortie manuelle avec motif, comptage physique et mouvement traçable; confirmation avant validation. Terminé lorsque les soldes restent exacts après deux opérations concurrentes, qu'aucun solde négatif n'est accepté et que les opérations sont visibles dans l'historique.

**Lot 3 — gestion fournisseurs et parcours de réceptions complet**

Formulaires fournisseurs et recette de bout en bout brouillon → lignes → validation → stock/coût; états vide et erreurs utiles. Terminé lorsqu'une réception confirmée crédite une seule fois la bonne quantité au bon coût.

**Lot 4 — prix FCFA et flux de vente/retour consolidés**

Affichage et saisie uniforme des prix XOF; compléter l'application des prix produits dans les ventes, et vérifier vente, refus pour stock insuffisant, retour borné aux quantités vendues. Terminé lorsque les montants visibles correspondent exactement aux lignes et totaux enregistrés.

**Lot 5 — consultation et rapports opérationnels de base**

Indicateurs réels du tableau de bord, produits en rupture/faibles, filtres d'historique et premier état de stock. Les rapports financiers avancés restent en phase 7.

**Lot 6 — qualité, permissions et préparation réelle de mise en service**

Définir les rôles selon le nombre d'utilisateurs, tests API/UI et PostgreSQL jetable, audit de précision FCFA, tests de migration/restauration, CI, sauvegardes et choix d'hébergement. Pas de mise en production tant qu'une restauration n'a pas été testée.

#### 7. Critères de qualité applicables à chaque lot

- Une règle métier a un test de service/API; un parcours UI important a un test orienté utilisateur; les flux de stock sont également vérifiés sur PostgreSQL isolé.
- Validation côté serveur, contraintes SQL, transactions et verrous protègent les règles même si l'interface est contournée.
- Aucun montant monétaire ne passe par un calcul binaire flottant; les cas de quantité fractionnaire, conversion d'unité et arrondi FCFA sont testés.
- États de chargement, erreur, succès, liste vide, confirmation et protection contre double soumission sont présents là où nécessaires.
- Accessibilité : libellés explicites, clavier, focus visible, erreurs proches des champs et confirmation compréhensible; responsive pour écran étroit.
- Lint, formatage, tests backend/frontend et build passent; le seed reste uniquement de démonstration; aucun essai métier ne modifie la base de développement sans accord explicite.
- Les nouvelles fonctions sont documentées dans ce journal unique avec décision, fichiers/modules, migrations, tests et limites connues.

#### 8. Hors périmètre de la première version (à confirmer si besoin réel)

Multi-entrepôts, transferts inter-sites, lots/séries/péremption, codes-barres, fabrication/kits, commandes fournisseurs automatisées, comptabilité/factures fiscales, paiements, multi-devise, application mobile native et synchronisation hors ligne. Les règles de réapprovisionnement automatiques et multi-entrepôts existent dans les ERP mais n'ont d'intérêt qu'une fois les seuils et lieux de stockage du commerce définis; elles ne seront pas ajoutées par anticipation. Voir par exemple [Odoo — réapprovisionnement](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment.html) et [réapprovisionnement inter-entrepôts](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/resupply_warehouses.html).

**Prochaine étape : revue de cette conception et validation des hypothèses du lot 0. Aucun nouveau formulaire ni changement de schéma monétaire n'a été implémenté dans cette étape de planification.**

#### 9. Compte rendu — démarrage et livraison partielle du Lot 1

**État au 18 octobre 2026 : Lot 1 en cours; la Phase 6 reste en cours.** La validation utilisateur a autorisé le démarrage du Lot 1. Le contenu ci-dessous rectifie la prochaine étape indiquée à la section précédente, qui décrivait l'état avant validation.

Livré dans cette tranche :

- Ajout d'écrans pour créer et modifier un produit, avec catégorie, unité de base, seuil d'alerte, description et statut actif/inactif. Le stock n'est jamais modifié depuis la fiche produit.
- Ajout d'une page de gestion des catégories et unités, avec création et renommage.
- Ajout de boutons d'accès depuis le catalogue et d'une action « Modifier » pour chaque produit.
- Extension des API existantes pour renommer catégorie/unité; validations et conflits d'unicité restent traités côté serveur.
- Ajout de tests UI ciblés sur création d'un produit et d'une catégorie.

Choix et limites constatés pendant l'implémentation :

- Les tables actuelles de catégories et unités n'ont pas de colonne `is_active`. Pour ne pas introduire une migration non nécessaire ni casser les références historiques, cette version permet le renommage, mais pas la désactivation ou suppression. Un référentiel utilisé reste conservé.
- Le prix commercial n'est pas ajouté au formulaire produit : le schéma possède déjà `product_prices`, indexé par unité et type de client. Une saisie naïve sur le produit créerait un deuxième modèle de prix incohérent. Le prix de vente FCFA reste à intégrer au lot de vente après décision sur le prix par défaut et les types de client; aucun montant ni format monétaire n'a été modifié dans ce lot.
- La désactivation est disponible pour les produits seulement; le parcours ventes/réceptions existant reste propriétaire de ses règles de sélection des produits actifs.

Vérifications observées : `npm run check` côté backend passe (ESLint, Prettier, 35 tests); côté frontend, `npm run lint`, `npm run build` et `npm test` passent (7 tests au total, dont 2 tests de gestion catalogue). Aucun essai d'intégration n'a écrit dans la base de développement.


#### 10. Compte rendu — vérification intégrée du catalogue et livraison du Lot 2

**État : Phase 6 en cours; cœur catalogue vérifié; Lot 2 implémenté et vérifié sur PostgreSQL isolé.** La base de développement n'a reçu aucune écriture.

Vérification du Lot 1 : le test PostgreSQL a exercé via l'API l'ajout et le renommage d'une catégorie, l'ajout et le renommage d'une unité, puis la création et la modification d'un produit. Le choix de ne pas créer un modèle de prix parallèle reste valable; le tarif de vente FCFA n'est pas encore exposé et demeure au Lot 4.

Lot 2 livré :

- Migration versionnée `002_opening_stock_and_counts.sql` : nouveau type d'opération `OPENING_BALANCE`, type de correction, quantité comptée et coût unitaire historisés. La migration initiale n'a pas été réécrite.
- Route authentifiée `POST /api/inventory/opening-stock` : saisie unique par produit sans mouvement antérieur, avec quantité positive, motif et coût unitaire entier en F CFA. Le verrou produit sérialise les demandes concurrentes; stock, coût moyen et trace sont écrits dans la même transaction.
- Route `POST /api/inventory/counts` : comptage physique, différence calculée sous verrou, refus d'un comptage sans changement. Un écart positif exige son coût d'achat; le coût moyen est recalculé dans PostgreSQL. Une baisse conserve le coût moyen et ne peut pas créer de stock négatif.
- Protection des ouvertures et comptages contre l'annulation générique : une correction ultérieure se fait par un nouveau comptage qui conserve la piste d'audit.
- Interface depuis la fiche stock d'un produit : saisie du stock initial pour un produit vierge ou comptage physique; aperçu du delta, motif requis, confirmation explicite, états erreur et succès. Les mouvements affichent le libellé « Stock initial ».
- Les entrées par l'ancienne route d'ajustement exigent également un coût unitaire afin de mettre à jour le coût moyen.

Vérifications observées : migrations 001 et 002 appliquées à un conteneur PostgreSQL 16 jetable. Trois tests d'intégration API/PostgreSQL passent : CRUD catégories/unités/produits, ouverture et recomptage valorisés, protection contre les doublons/annulations/écarts négatifs et deux soumissions concurrentes. Backend : `npm run check` passe (39 tests actifs; 3 tests d'intégration opt-in sautés dans la suite standard). Frontend : lint, build et 8 tests passent. Le conteneur dédié a été arrêté et supprimé après les tests.

Limites à garder visibles :

- Pas de stock multi-entrepôt; le stock initial est enregistré produit par produit.
- Les coûts de stock sont stockés dans la précision existante `numeric(14,2)`; le coût saisi est un montant entier en F CFA, le coût moyen interne peut rester décimal.
- Aucun prix de vente FCFA ni migration générale de tous les montants monétaires n'est livré; ce travail reste au Lot 4 et exige la convention de calcul/arrondi déjà notée.
- La revue visuelle sur navigateur et une démonstration avec un jeu d'essai métier restent à faire. Ne pas utiliser la base locale réelle pour la recette sans validation explicite.

**Suite :** revue visuelle du parcours Lot 2 depuis le navigateur, ensuite Lot 3 — gestion complète des fournisseurs/réceptions. À la fin des opérations fonctionnelles prévues (Lots 1 à 5), le Lot 6 regroupera les tests de reprise, permissions, sauvegarde et préparation de production.

#### 11. Compte rendu — fournisseurs et réception de bout en bout

**État actuel : Phase 6 en cours; Lots 1 à 3 livrés sur leur socle fonctionnel.** La revue visuelle manuelle reste à faire : l'outil navigateur de cette session ne fournit aucun navigateur. Les serveurs locaux répondent (`frontend :5173` HTTP 200, `backend :3000/api/health` retourne `{"status":"ok"}`), mais cela ne remplace pas l'inspection visuelle ni la recette par l'utilisateur.

Livré dans la suite du Lot 3 :

- Page Fournisseurs accessible dans la navigation et depuis Réceptions : création, modification, activation/désactivation, affichage contrôlé des fournisseurs inactifs. La désactivation conserve les références et l'historique.
- API fournisseurs : `GET /api/suppliers?include_inactive=true` et `PATCH /api/suppliers/:id`; les parcours existants continuent à ne proposer que les fournisseurs actifs.
- L'API refuse maintenant la création d'un brouillon de réception si son fournisseur est désactivé ou absent; le choix d'interface seul n'est pas la seule protection.
- La fiche de réception renvoie le nom du fournisseur même pour l'historique.
- Prix d'achat de nouvelles réceptions limités à des montants entiers en F CFA; champ de saisie et affichage identifiés F CFA. Les lignes sont arrondies au FCFA le plus proche puis additionnées. Le calcul utilise des entiers (`BigInt`) côté interface; les calculs de coût moyen restent dans PostgreSQL.
- Compatibilité de lecture maintenue pour les prix décimaux éventuellement présents dans les anciennes réceptions : ils sont affichés arrondis au FCFA, mais l'API n'accepte plus de fraction pour les nouveaux prix d'achat.

Recette réelle dans PostgreSQL 16 jetable : quatre tests d'intégration API couvrent le catalogue, les fournisseurs et le cycle brouillon → ligne produit/prix → validation → stock/coût, le refus d'une seconde validation et l'archivage par désactivation du fournisseur. Le test confirme aussi qu'un prix d'achat décimal est rejeté, qu'un fournisseur désactivé ne permet pas un nouveau brouillon et que la réception passée conserve le nom du fournisseur. Backend `npm run check` : 40 tests passent et les 4 tests PostgreSQL sont ignorés par défaut; suite opt-in PostgreSQL : 4 tests passent. Frontend lint/build et 10 tests passent. Aucun essai n'a écrit dans la base de développement; le conteneur de test dédié a été arrêté et supprimé.

**Prochaine étape : Lot 4 — prix de vente et flux de vente en F CFA.** Réutiliser `product_prices` (ne pas dupliquer le tarif); auditer les prix existants et les types clients, définir le prix de vente par défaut utilisé au comptoir, puis uniformiser les montants affichés/saisis et leurs arrondis dans création de tarif, vente, retours et récapitulatifs. Ne pas convertir en bloc les colonnes historiques `numeric(14,2)` sans d'abord recenser leurs valeurs et prouver la conversion. La revue visuelle en navigateur demeure à faire lorsque l'utilisateur peut ouvrir l'application localement.

#### 12. Compte rendu — Lot 4 : tarifs par client et ventes en F CFA

**État : Phase 6 toujours en cours; Lots 1 à 4 livrés et vérifiés fonctionnellement.** Aucun changement n'a été exécuté sur la base de développement. Le Lot 4 réutilise le modèle `product_prices` existant, sans ajouter de table de tarifs ni convertir les montants historiques.

Livré :

- Migration additive `003_sales_pricing_fcfa.sql` : ajout du type de client à la vente, avec clé étrangère. La colonne reste nullable pour lire les ventes préexistantes; les nouvelles ventes exigent le type via validation API. Aucune réécriture ou conversion des totaux historiques.
- Page Clients : création des types de client et des clients à partir des API existantes. Une vente nominative reprend obligatoirement le type enregistré du client; pour une vente sans client, l'utilisateur sélectionne explicitement le type tarifaire. Aucun prix « comptoir » caché ni valeur de tarif par défaut arbitraire.
- Page Tarifs par produit : saisie d'un prix entier en F CFA selon type de client et unité de vente. Un changement archive l'ancien tarif et crée une nouvelle version; l'historique demeure visible. Seules l'unité de base du produit et les unités de vente qui lui sont effectivement associées sont acceptées.
- Consultation du tarif exact disponible pour une vente; l'ajout d'une ligne relit le prix actif côté serveur. Le champ de prix manuel a été supprimé. Une valeur envoyée en plus par un client API ne change donc pas le montant retenu.
- Le montant de chaque ligne et le total de vente sont arrondis au FCFA le plus proche, demi supérieur, à partir de la quantité exacte (jusqu'à trois décimales) et du tarif unitaire entier. Le calcul côté interface utilise `BigInt`; PostgreSQL calcule le total avec `round(quantity * unit_price, 0)` pour éviter une double précision/arrondi en centimes. Les tarifs fractionnaires préexistants restent lisibles, mais sont refusés en vente jusqu'à correction explicite dans la page Tarifs.
- Les prix de vente affichés dans vente et retour indiquent maintenant F CFA. Une vente ancienne liée à un client peut encore retrouver son type depuis la fiche client; une ancienne vente anonyme sans type ne peut pas être tarifée automatiquement et nécessite un nouveau brouillon.

Architecture et limites : les routes de tarifs restent dans `products`, car le prix est une propriété commerciale du produit et la table existante porte déjà le couple produit/type/unité; les ventes consomment ce service, mais gardent le prix appliqué comme instantané dans `sale_items`. Une contrainte globale de prix entier n'a pas été ajoutée au schéma : elle empêcherait même d'archiver proprement certaines anciennes lignes décimales au premier changement. Les API d'écriture valident désormais l'entier FCFA et le chemin de vente refuse explicitement toute ancienne valeur fractionnaire. Les transactions de changement de tarif conservent l'historique et la contrainte d'unicité active existante.

Vérifications : `npm run check` backend passe (42 tests actifs; les tests PostgreSQL sont opt-in); la suite PostgreSQL 16 jetable passe (5 tests, dont le cycle tarif → vente, la valeur unitaire imposée par le serveur, l'archivage du tarif remplacé et l'arrondi d'une ligne de 2,495 F CFA à 2 F CFA). Frontend lint, build et tests passent (10 tests). Le conteneur PostgreSQL dédié est isolé et supprimé après la vérification. Pas de revue visuelle navigateur dans cette session : aucun navigateur n'est fourni par l'environnement.

**Suite : Lot 5 — indicateurs de tableau de bord, ruptures/stock faible et filtres d'historique, puis un premier état de stock.** Conserver la revue visuelle de l'application locale comme recette utilisateur à réaliser avec le navigateur disponible, sans confondre cette recette avec les tests automatisés.

#### 13. Compte rendu — Lot 5 : tableau de bord et consultation du stock

**État : Phase 6 toujours en cours; Lots 1 à 5 livrés et vérifiés fonctionnellement.** Aucun changement n'a été exécuté sur la base de développement.

Livré :

- Le tableau de bord utilise maintenant des indicateurs PostgreSQL réels : produits actifs, ruptures, stocks positifs au seuil critique ou en dessous, mouvements des sept derniers jours et huit derniers mouvements. Les raccourcis « Ruptures » et « Stock faible » ouvrent les filtres correspondants.
- La page « État du stock » liste les produits actifs, permet une recherche nom/SKU, filtre tous les produits, les stocks faibles ou les ruptures et pagine les résultats par 20. Le seuil faible exclut les ruptures afin que les deux alertes restent distinctes.
- L'historique d'un produit peut être filtré par dates de début/fin et type d'opération. L'API valide le format et l'ordre des dates; le résultat reste limité aux 50 mouvements les plus récents correspondant aux filtres, conformément à la capacité d'affichage actuelle.
- Les nouvelles requêtes sont ajoutées au module Inventaire existant (`routes → contrôleur → service → requêtes SQL`); aucun nouveau sous-système ni table n'a été introduit. Les paramètres de recherche et filtres sont validés côté serveur et les listes sont calculées à partir du solde et du journal existants.

Vérifications : backend `npm run check` passe (42 tests actifs; 6 tests PostgreSQL ignorés par défaut). Sur PostgreSQL 16 jetable, migrations 001 à 003 et suite opt-in passent (6 tests), dont indicateurs, état filtré et historique par période/type. Frontend lint, build et tests passent (10 tests). Le conteneur de test a été supprimé. La revue visuelle manuelle n'a pas été effectuée dans cette session; aucune vérification navigateur n'est revendiquée.

**Suite : Lot 6 — audit qualité et préparation opérationnelle.** Vérifier les rôles réellement nécessaires avant de définir des permissions (ne pas inventer de matrice multi-utilisateur), les erreurs et validations des parcours, les migrations sur une base vierge et existante, la procédure de sauvegarde/restauration sur une copie isolée, puis CI/configuration et les prérequis d'hébergement. Faire également la recette visuelle des parcours avec l'utilisateur. La Phase 6 ne sera pas déclarée terminée avant ces vérifications; les rapports avancés restent en Phase 7.

#### 14. Compte rendu — démarrage du Lot 6 : qualité et préparation opérationnelle

**État au 19 octobre 2026 : Phase 6 en cours; Lots 1 à 5 vérifiés; Lot 6 entamé, non terminé.** La base de développement n'a pas été utilisée pour les essais.

Audit et décisions :

- L'application possède actuellement le rôle `ADMIN` et une authentification commune sur les routes métier, sans permissions fines. Aucune matrice supplémentaire n'a été créée : elle dépend du nombre et des responsabilités des utilisateurs, qui restent à confirmer. La version mono-rôle est donc une limite connue, pas une permission configurée par écran.
- L'hébergement n'est pas choisi. Le workflow CI emploie des secrets fictifs réservés à l'environnement d'essai; ils ne sont pas à reprendre pour un déploiement.
- Les sauvegardes PostgreSQL s'appuient sur `pg_dump` au format custom; la restauration de contrôle cible une base nouvelle. Rétention, chiffrement, stockage hors site, alertes et responsable restent à décider avec l'hébergeur.

Réalisé :

- Ajout de `.github/workflows/ci.yml` : Node.js 22, PostgreSQL 16 temporaire, migrations, vérifications/tests backend, tests d'intégration PostgreSQL, puis lint/build/tests frontend. Permissions du jeton CI limitées à la lecture du dépôt.
- Documentation d'une procédure de sauvegarde et de restauration dans `backend/README.md`, qui privilégie la restauration dans une nouvelle base plutôt que l'écrasement d'une base active; rappel de protéger les identifiants avec `.pgpass`.
- Test de migration sur base neuve (001–003), sur un schéma historique constitué de la migration 001 (enregistrement de la référence puis application de 002–003), et réexécution sans changement.
- Test PostgreSQL 16 sur base isolée : six tests d'intégration passent. Une assertion de filtre a été assouplie pour rester valable si la base de test contient déjà des fixtures d'une exécution précédente.
- Sauvegarde `pg_dump -Fc` puis restauration `pg_restore` vers une nouvelle base : le nombre de catégories et l'enregistrement témoin sont identiques après restauration.

Vérifications : backend `npm run check` passe (42 tests actifs; tests PostgreSQL exclus de cette commande par défaut); les six tests d'intégration PostgreSQL passent séparément. Frontend lint, build et tests passent (10 tests). Le test de restauration a été fait avec PostgreSQL 16 isolé. Le conteneur et ses bases de test ont été supprimés après vérification.

Reste avant de conclure la Phase 6 : recette visuelle manuelle des écrans; choix des profils d'utilisateur et des permissions seulement si le besoin est confirmé; choix d'hébergement et paramétrage réel des secrets, réseau/proxy/TLS; politique de sauvegarde/rétention et répétition planifiée d'une restauration; vérification du workflow dans un dépôt GitHub (aucun push/CI distant n'a été effectué); audit de mise en service. Les tests automatisés ne remplacent pas ces validations.

**Suite : poursuivre le Lot 6 par une revue de mise en service ciblée et traiter les constats reproductibles.** Ne pas déclarer l'application prête pour production avant le choix de l'environnement, la recette visuelle et une procédure de restauration adaptée et retestée sur cet environnement.

#### 15. Compte rendu — disponibilité applicative et audit des dépendances

Ajouté au Lot 6 :

- `GET /api/health` reste le contrôle de vie HTTP. Le nouvel endpoint public `GET /api/health/ready` interroge PostgreSQL; il répond `200` si la base répond et `503` sans détail de connexion sinon. Les deux comportements sont testés.
- Le workflow CI audite les dépendances runtime du backend et toutes celles du frontend avant les contrôles habituels.
- Le README décrit désormais les deux sondes et la génération d'un secret JWT aléatoire via `openssl`.

Vérifications : backend `npm run check` passe avec 43 tests actifs (6 tests PostgreSQL opt-in); `npm audit --omit=dev --audit-level=high` ne trouve aucune vulnérabilité runtime. L'audit complet backend signale cependant 22 vulnérabilités de dépendances de développement (3 hautes, 19 modérées, notamment dans les arbres `nodemon/chokidar/braces` et `jest/sprintf-js`). `npm audit fix --dry-run` indique des corrections nécessitant des downgrades majeurs; aucune mise à jour risquée n'a été appliquée. Frontend lint/build passent et son audit npm ne trouve aucune vulnérabilité.

**Point qualité non résolu :** la suite frontend Vitest a échoué dans cette session (4 tests en dépassement du délai de 5 s lors d'une exécution, 5 lors d'une autre; un test de réception ciblé ne trouve pas l'option produit attendue). Le même test frontend avait passé lors de la vérification du Lot 5, et aucun fichier frontend n'a été modifié dans cette tranche; cela ne suffit pas à conclure à un simple ralentissement. Le test doit être diagnostiqué et repasser avant de fermer le Lot 6. La recette visuelle manuelle n'a pas été faite.

**État : Lot 6 toujours en cours.** Restent l'analyse et le traitement sûr des alertes dev, le diagnostic du test UI, la recette visuelle, ainsi que les décisions d'hébergement, de profils, de réseau et de politique opérationnelle des sauvegardes. Pas de mise en production ni de test CI distant.

#### 16. Compte rendu — stabilisation des tests UI et réduction des alertes élevées

Suite aux constats précédents :

- Les tests UI attendaient des contrôles ou cliquaient avant la fin des chargements asynchrones. Ils synchronisent maintenant explicitement les options de catégorie, d'unité et de type client ainsi que les listes fournisseur/produits/stock; le test réception vérifie aussi la requête de liste attendue. Les attentes asynchrones de Testing Library sont configurées à 5 secondes; Vitest utilise un worker et un délai maximal de 15 secondes pour éviter les courses entre tests et les dépassements sous charge.
- Après ces ajustements, la commande standard `npm test` passe sur les 4 fichiers et les 10 tests. Lint, build et audit npm frontend passent également; zéro vulnérabilité frontend.
- Nodemon a été retiré du backend au profit de `node --watch`, disponible dans la version minimale Node 22 déjà exigée par le projet. Cela retire l'arbre `nodemon/chokidar/braces` et ses trois alertes élevées. `npm run check` backend passe (43 tests actifs; 6 intégrations exclues par défaut), `npm audit --audit-level=high` ne signale plus de vulnérabilité élevée, et l'audit runtime reste à zéro.
- Il reste 19 alertes modérées dans les outils de test backend via l'arbre Jest → Babel Istanbul → js-yaml/argparse → sprintf-js. Le registre consulté ne propose pas de version de `sprintf-js` au-delà de la plage signalée; la correction npm automatique rétrograderait Jest en version majeure. Aucun override incompatible n'a été ajouté. Le workflow CI bloque maintenant les vulnérabilités élevées, mais laisse ces modérées visibles.

La suite frontend avait échoué plusieurs fois sous les délais par défaut pendant la charge locale, puis a réussi avec les attentes explicites et l'exécution sérialisée. La recette visuelle utilisateur reste distincte et non réalisée.

**État : Lot 6 toujours partiel.** Le diagnostic UI est résolu et les contrôles locaux passent. Restent la recette visuelle, le choix d'hébergement, les paramètres réseau/TLS/CORS correspondant à ce choix, une politique réelle de sauvegarde/rétention, les permissions si plusieurs profils sont requis, et l'exécution de la CI sur le dépôt distant. La présence de 19 alertes modérées de dépendances de test doit rester documentée; ne pas dégrader Jest pour obtenir un audit artificiellement vide.

#### 17. Audit de sécurité local avant hébergement (19 octobre 2026)

**Périmètre : revue statique du dépôt et contrôles locaux non destructifs.** Aucun service public n'a été ciblé, aucune donnée métier n'a été modifiée et aucun pentest externe n'a été effectué. Render/Vercel ne sont pas encore configurés; ceci ne constitue donc pas une recette de sécurité de production.

Vérifications observées :

- Les routeurs métier (catalogue, produits, inventaire, fournisseurs, réceptions, clients et ventes/retours) appliquent `requireAuth`; les tests API confirment notamment le refus `401` sans jeton. Les routes publiques restent la santé, la disponibilité et la connexion.
- Helmet est actif, le corps JSON est plafonné à 100 ko et la connexion est limitée à 10 tentatives par fenêtre de 15 minutes. Les requêtes SQL inspectées utilisent des paramètres PostgreSQL; aucun usage de `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou `new Function` n'a été trouvé dans les sources examinées.
- Backend : 43 tests réussissent; 6 tests d'intégration PostgreSQL sont ignorés sans base isolée. `npm audit --omit=dev --audit-level=high` rapporte zéro vulnérabilité de production connue.
- Frontend : Oxlint réussit et `npm audit --audit-level=high` rapporte zéro vulnérabilité connue. L'exécution de Vitest et la compilation TypeScript/Vite sont restées anormalement longues sans produire de résultat; elles ont été interrompues et ne sont donc pas déclarées réussies dans cet audit.

Risques et suites avant production :

1. **Élevé — jeton accessible au JavaScript.** Le JWT est stocké dans `sessionStorage`; une faille XSS future pourrait permettre son vol. Garder une politique stricte de dépendances et de rendu; réévaluer une session par cookie `HttpOnly`, `Secure`, `SameSite` si le modèle de déploiement le permet, en traitant aussi CSRF/CORS.
2. **À définir selon les utilisateurs — absence de permissions fines.** Tout compte authentifié possède les mêmes capacités. Ne créer une matrice de rôles qu'après confirmation des profils réels; avant cela, limiter l'accès aux comptes de confiance et éviter le partage du compte administrateur.
3. **Bloquant au déploiement Vercel/Render — origines et transport.** La politique CORS n'est pas configurée dans l'API. Avant mise en service, autoriser uniquement les origines Vercel attendues, vérifier HTTPS, configurer `TRUST_PROXY_HOPS` pour la topologie réelle et conserver PostgreSQL privé derrière l'API.
4. **Opérationnel — pentest dynamique encore nécessaire.** Après création d'une préproduction avec base sans données réelles, vérifier les accès anonymes, les sessions, l'isolation des opérations, les validations et erreurs, puis tester sauvegarde/restauration et configuration HTTP. Ne pas exécuter ces essais sur le site public sans périmètre autorisé.

**Conclusion :** les contrôles locaux existants sont encourageants, mais le pentest n'est pas terminé et l'application n'est pas encore qualifiée pour la production. Cette revue ne change pas l'état du Lot 6, qui reste partiel.

#### 18. Correctif — faux message réseau dans le formulaire Stock initial

Le 19 octobre 2026, la capture de l'écran `/app/stock/:productId/initial` montrait le produit et son unité chargés malgré le message « Impossible de joindre le serveur ». Les contrôles de santé HTTP et la disponibilité PostgreSQL répondaient `200`; les trois routes appelées par le formulaire (`stock`, `mouvements`, `unités`) étaient également accessibles via le proxy Vite et renvoyaient `401` sans jeton, conformément à leur protection.

Cause établie dans le parcours local : React `StrictMode` annule l'effet initial en développement avant de le remonter. L'annulation du `fetch` était convertie par le client API en erreur réseau générique, puis affichée par le formulaire malgré la réussite de la nouvelle requête. Le formulaire Stock initial ignore désormais l'erreur et la fin de chargement lorsque son `AbortController` a été annulé; les erreurs réseau réelles restent affichées.

Un test de régression reproduit l'annulation dans `StrictMode`. Vérifications frontend : 11 tests réussis, Oxlint réussi et build TypeScript/Vite réussi. Aucune donnée métier ni base n'a été modifiée. Après rechargement de la page locale, la bannière ne doit plus s'afficher si les appels courants réussissent.

Après la capture suivante, le clic de confirmation retournait un vrai `500`. Inspection en lecture seule de la base de développement : seule `001_initial_schema.sql` était enregistrée; la contrainte SQL des opérations ne permettait donc pas `OPENING_BALANCE`. Pour résoudre ce défaut de schéma, `npm run db:migrate` a appliqué les migrations manquantes `002_opening_stock_and_counts.sql` et `003_sales_pricing_fcfa.sql`. Vérification après migration : les trois migrations sont enregistrées, la contrainte accepte `OPENING_BALANCE`, l'état `/api/health/ready` est `ok`, et le produit `COCA-33` conserve `current_stock = 0.000` avec zéro mouvement. La transaction en échec n'avait donc créé aucun stock. L'utilisateur peut maintenant retenter la saisie une fois; aucun mouvement n'a été créé par l'assistant.

#### 19. Revue de cohérence des parcours et rapports de ventes — conception en attente de validation

À la demande de l'utilisateur, pause sur l'ajout de fonctions et revue des parcours existants. Il s'agit ici d'une inspection des écrans, routes et requêtes du dépôt, pas encore d'un test d'utilisabilité avec un opérateur réel. Aucun écran ni comportement métier n'a été modifié dans cette revue.

**Constat vérifié :**

- La navigation principale sépare Tableau de bord, Catalogue, Stock, Réceptions, Fournisseurs, Ventes et Clients.
- Le tableau de bord actuel présente produits actifs, ruptures, stock faible, mouvements des sept derniers jours et derniers mouvements. Il ne présente ni chiffre de ventes ni nombre de ventes par période.
- La page Ventes charge une liste globale (`GET /api/sales`) sans filtre date ou statut dans l'interface/API de liste. La saisie se fait comme brouillon, avec choix d'un type tarifaire, ajout de lignes, puis validation qui retire le stock.
- Une vente validée porte `sold_at` et `total_amount`; un retour validé porte `returned_at` et des lignes valorisées. Il n'existe pas encore de rapport périodique ni de journal de paiement. La valeur d'un retour ne doit donc pas être présentée automatiquement comme un remboursement d'argent ou un chiffre d'affaires net sans règle métier confirmée.
- Le parcours stock initial est accessible depuis le stock d'un produit et ne doit être fait qu'une fois; les réceptions enregistrent les approvisionnements récurrents. Cette distinction et la séquence des ventes brouillon → lignes → validation ne sont pas encore assez synthétisées dans la navigation pour un nouvel utilisateur.

**Proposition de rapport à valider avant implémentation :**

1. Filtres rapides : aujourd'hui, cette semaine, ce mois, période personnalisée; dates interprétées selon le fuseau de l'exploitation (`Africa/Ouagadougou` si Burkina Faso confirmé).
2. Résumé : nombre de ventes validées, montant total de ces ventes en F CFA, quantité d'articles vendus; afficher séparément les ventes en brouillon, qui ne sont ni réalisées ni déduites du stock.
3. Retours validés visibles séparément (nombre, quantités et valeur des articles retournés). Ne calculer une somme « nette encaissée » qu'après décision sur les paiements et remboursements réellement suivis par l'application.
4. Historique filtré par période, référence et état; détail des lignes et totaux cohérents avec les ventes validées. Prévoir l'export seulement après validation du rapport de base.
5. Ajouter un accès « Rapports » ou une synthèse claire depuis Ventes/Tableau de bord, sans multiplier les cartes et sous-menus avant d'avoir confirmé les besoins.

**Proposition de suite :** valider d'abord le vocabulaire et les indicateurs du rapport; ensuite faire une revue guidée des parcours quotidiens avec l'utilisateur (créer un produit, saisir le stock de départ, réceptionner, vendre, consulter les résultats), corriger les ruptures de compréhension prioritaires, puis implémenter le rapport périodique avec tests métier. La conception reste en attente de validation; aucune de ces fonctions de rapport n'est considérée comme livrée.

#### 20. Revue élargie des incohérences et frictions — constats de code à valider avec l'utilisateur

La revue a été élargie à la demande de l'utilisateur. Les points ci-dessous sont vérifiés dans les écrans et contrats actuels; leur priorité métier doit être confirmée avec l'utilisateur. Aucun code fonctionnel n'a été changé.

**Priorité élevée — chiffres et dates compréhensibles :**

1. La liste de ventes affiche une colonne « Créée le » basée sur `created_at`, alors que la date d'une vente effective est `sold_at` (renseignée seulement lors de sa validation). Un brouillon créé un jour et validé un autre peut donc être attribué au mauvais jour si l'utilisateur lit la liste comme un journal des ventes. Le rapport accepté en principe doit s'appuyer sur `sold_at` pour les ventes validées; les brouillons doivent rester séparés.
2. La liste de ventes ne filtre ni par date ni par statut et la requête backend charge l'ensemble des ventes sans pagination (`ORDER BY created_at DESC`). La consultation devient à la fois imprécise et moins maniable à mesure que l'historique croît.
3. Le retour remet des marchandises dans le stock et conserve une valeur par ligne, mais aucun encaissement/remboursement n'est enregistré. Le libellé « Retour » pourrait donc être compris comme une opération financière alors qu'il s'agit aujourd'hui d'un retour physique d'articles. Séparer clairement retour de stock et remboursement/paiement dans les libellés et rapports.

**Priorité élevée — parcours bloqués par des prérequis non guidés :**

4. La création de produit dépend de catégories et unités déjà créées; la création de vente dépend d'un type de client et de tarifs actifs par produit/type/unité; la réception dépend d'un fournisseur actif. Les conditions sont parfois signalées, mais aucun assistant de première configuration ne guide l'utilisateur dans cet ordre. En particulier, l'absence de tarif est détectée lors de l'ajout d'une ligne à la vente, après que le brouillon a été créé, et le message ne mène pas directement au tarif à corriger.
5. La page Ventes présente simultanément « Nouvelle vente » et « Historique », mais le parcours de création est réparti sur plusieurs écrans (brouillon → articles → validation). Le vocabulaire et les étapes devraient rendre explicite ce qui modifie déjà le stock et à quel moment.
6. « Saisir le stock initial », « Comptage physique » et « Réception » sont trois parcours distincts qui peuvent tous faire entrer des quantités. Leur différence est métier (stock existant au démarrage, correction après inventaire, nouvel approvisionnement), mais elle n'est pas expliquée depuis un point central. Il faut conserver les règles de sécurité métier tout en offrant une aide courte au bon moment.

**Priorité moyenne — cohérence et charge cognitive :**

7. Le tableau de bord contient une carte « Fonctions disponibles » avec des badges statiques qui ne naviguent pas, en plus du menu principal; elle promet une interaction qu'elle ne fournit pas et répète la navigation.
8. Le vocabulaire oscille entre « produits », « articles », « stock », « inventaire », « opérations » et « mouvements ». Stabiliser les libellés visibles selon les tâches de l'utilisateur et réserver les termes techniques aux détails.
9. Les références de ventes et de réceptions sont obligatoires et saisies manuellement. Clarifier si ce champ désigne une référence externe (ticket/bon du fournisseur) ou une référence générée par le logiciel; sinon l'utilisateur doit inventer un numéro et risque les doublons ou des valeurs peu utiles.
10. Le menu présente Fournisseurs et Clients comme destinations de même niveau que les tâches récurrentes. Réévaluer si ces référentiels sont mieux regroupés dans une zone « Configuration / Référentiels », avec des raccourcis depuis les opérations qui en ont besoin.

**Ordre de résolution proposé :** (1) confirmer les termes et le comportement financier des retours; (2) corriger le rapport et la date de vente; (3) rendre le parcours Ventes guidé, avec navigation directe vers le prérequis manquant; (4) clarifier les trois mouvements d'entrée/correction de stock; (5) simplifier tableau de bord et menu. Tester ensuite une journée type avec l'utilisateur avant de déclarer l'expérience cohérente. Les rapports et ces correctifs ne sont pas encore implémentés.

#### 21. Plan de tâches actualisé — séparation serveur/client

Ce plan transforme les constats des sections 19 et 20 en tâches réalisables. Il distingue les responsabilités du serveur (règles métier, intégrité, calculs et données) de celles du client (guidage et présentation). Le serveur reste l'autorité : toute règle qui protège les stocks, les ventes ou les montants doit être validée côté serveur, même si le formulaire la prévalide aussi. Ce plan est une proposition; les décisions métier signalées comme préalables restent à confirmer avant leur implémentation. Aucun travail de cette liste n'est déclaré livré par cette mise à jour.

**Tâche 0 — Décisions métier et périmètre**

- **À décider :** confirmer le fuseau horaire de l'exploitation; définir la période « semaine » (lundi–dimanche proposé); dire si le rapport représente les ventes validées ou les paiements encaissés; décider si l'application doit suivre les paiements et remboursements; confirmer si une vente sans client nominatif est permise et comment est choisi son tarif; décider si une référence de vente/réception est interne ou externe.
- **Serveur :** documenter les états et transitions existants et leurs invariants; ne pas introduire le suivi financier des paiements sans décision explicite.
- **Client :** harmoniser les libellés à partir des décisions validées; ne pas présenter des indicateurs financiers ambigus.
- **Critère de sortie :** décisions consignées ici et approuvées avant de coder les tâches qui en dépendent.

**Tâche 1 — Dates, états et liste de ventes fiable**

- **Serveur :** étendre la liste des ventes avec filtres validés (dates, état et recherche/référence selon le besoin); utiliser `sold_at` pour dater les ventes validées et `created_at` pour les brouillons; exclure les brouillons des agrégats de ventes; valider les bornes et l'ordre de période; ajouter pagination ou limite explicite pour éviter de charger un historique sans borne.
- **Client :** distinguer visuellement brouillon et vente validée; afficher la date cohérente avec l'état; proposer filtres de période/état, recherche et navigation dans les pages; conserver des états chargement, vide et erreur compréhensibles.
- **Critères d'acceptation :** un brouillon créé avant la période mais validé dans la période est compté à `sold_at`; un brouillon n'est jamais compté comme vente; filtres combinés et pagination sont testés.

**Tâche 2 — Rapport périodique des ventes**

- **Serveur :** fournir les agrégats de ventes validées pour une période selon le fuseau retenu : nombre, montant total en FCFA et quantité vendue; renvoyer séparément les retours validés (nombre, quantités et valeur des articles retournés) sans qualifier cette valeur de remboursement; protéger les calculs contre les doubles comptes et préciser le sens de chaque champ dans le contrat API.
- **Client :** créer une vue rapport sobre avec aujourd'hui, semaine, mois et plage personnalisée; montrer les ventes et retours dans des sections distinctes; nommer le montant « ventes validées » et non « encaissé » tant qu'aucun paiement n'est suivi; permettre d'aller de l'indicateur à la liste filtrée correspondante.
- **Critères d'acceptation :** tests de bornes temporelles/fuseau, ventes validées, brouillons, retours et montants FCFA; les totaux visibles correspondent aux détails de la période.
- **Dépendance :** Tâche 0 pour fuseau, définition de la semaine et politique financière des retours.

**Tâche 3 — Paiements et remboursements (option conditionnelle)**

- **Précondition :** réaliser cette tâche uniquement si l'utilisateur confirme le suivi d'argent encaissé/remboursé. Elle n'est pas nécessaire pour produire le rapport de ventes de la Tâche 2.
- **Serveur :** concevoir une représentation minimale des paiements et remboursements, méthodes, dates et lien à la vente/au retour; définir paiements partiels, annulation, idempotence et droits; calculer les montants réellement encaissés selon des règles explicites et transactionnelles.
- **Client :** permettre l'enregistrement et la consultation d'un paiement/remboursement avec statuts et soldes clairement distincts du total de vente.
- **Critères de sortie :** règles financières approuvées, migration réversible/compatible, tests de transactions et cas partiels; aucun chiffre « encaissé » ne doit apparaître avant cette livraison.

**Tâche 4 — Parcours de vente et prérequis**

- **Serveur :** conserver les validations autoritaires du type client, tarif actif, unité et quantité; retourner des erreurs structurées avec un code/action exploitable, sans exposer de détails internes; empêcher la validation d'une vente dont les lignes ou tarifs ne sont plus valides.
- **Client :** rendre explicite le parcours brouillon → ajout des articles → validation et le moment où le stock diminue; détecter les prérequis manquants avant de créer un brouillon quand c'est possible; proposer un lien direct vers la création du type ou la correction du tarif et revenir au parcours après configuration si cela peut se faire simplement.
- **Critères d'acceptation :** chaque blocage connu indique la cause et la prochaine action; le serveur refuse aussi les requêtes invalides directes; tests du parcours avec et sans client nominatif selon la décision Tâche 0.

**Tâche 5 — Choix guidé des opérations de stock**

- **Serveur :** vérifier/documenter les invariants de `OPENING_BALANCE`, réception et comptage/correction; chaque opération conserve type, produit, quantité, coût/motif/date et auteur selon le modèle existant; refuser les transitions incohérentes et assurer l'atomicité entre journal et solde.
- **Client :** depuis Stock, présenter les trois intentions avec une explication courte : « démarrage du logiciel », « livraison fournisseur », « correction après comptage »; afficher des formulaires adaptés et confirmer l'effet attendu avant enregistrement.
- **Critères d'acceptation :** les trois scénarios produisent des mouvements identifiables et un solde cohérent; les erreurs de stock insuffisant/conflit sont explicites; tests serveur et parcours client couvrent chaque opération.

**Tâche 6 — Cohérence des repères et références**

- **Serveur :** garder des contrats API et noms de champs stables; si les références sont générées par le serveur, assurer unicité et format; si elles sont externes, distinguer leur champ d'une référence interne générée.
- **Client :** choisir un vocabulaire métier cohérent (« produits », « ventes », « réceptions », « mouvements de stock »); retirer la carte statique « Fonctions disponibles » ou la transformer en raccourcis réellement accessibles; garder Fournisseurs/Clients faciles à atteindre depuis leurs flux de travail sans créer une hiérarchie de navigation superflue.
- **Critères d'acceptation :** aucune commande présentée comme interactive ne reste sans action; les références sont clairement étiquetées et leur saisie suit la décision Tâche 0; revue des libellés sur les principaux écrans.

**Tâche 7 — Recette intégrée et clôture**

- **Serveur :** tests unitaires/intégration des filtres, règles, arrondis FCFA, mouvements, états et erreurs; vérifier migrations sur base vierge et existante si le schéma évolue.
- **Client :** tests des états d'interface et parcours; recette manuelle guidée d'une journée type : configuration minimale, stock initial, réception, vente, rapport de période, retour, correction d'inventaire.
- **Critères de sortie :** CI verte, aucune régression du stock ni des historiques, termes compris par l'utilisateur, limites connues consignées. Une revue manuelle réelle est requise avant de déclarer l'expérience utilisateur validée.

**Ordre et dépendances :** Tâche 0 → Tâche 1 → Tâche 2; Tâche 4 peut être menée en parallèle après les décisions nécessaires de Tâche 0; Tâche 5 suit l'audit de ses invariants existants; Tâche 6 se fait après stabilisation des termes; Tâche 7 vérifie l'ensemble. La Tâche 3 est conditionnelle et indépendante du rapport de ventes. Priorité de livraison recommandée : Tâches 0, 1 et 2 (répondre au besoin de suivi journalier), puis 4 et 5 (réduire les blocages et erreurs d'opération), puis 6 et 7. Les tâches restent « à faire » tant que leurs critères de sortie ne sont pas satisfaits et consignés.

#### 22. Compte rendu d’implémentation — tâches 0 à 6, recette partielle

**État :** implémentation du suivi des ventes et des principaux repères de parcours effectuée dans le serveur et le client. La validation PostgreSQL isolée et la recette visuelle utilisateur restent à faire; le lot complet n'est donc pas déclaré terminé. Aucun enregistrement métier n'a été créé/modifié par cette implémentation et aucune migration de la base locale n'a été exécutée.

**Décisions retenues pour avancer sans créer de nouvelle comptabilité :**

- Une vente du rapport signifie une vente **validée**, datée par `sold_at`; un brouillon reste distinct et n'entre pas dans les montants de vente.
- Le fuseau des rapports est `Africa/Ouagadougou` (UTC+0) et la semaine commence le lundi. Les périodes sont inclusives côté dates locales, matérialisées en bornes timestamp exclusives pour la fin.
- Le montant est nommé « ventes » et non « encaissé ». L'application n'enregistre toujours aucun paiement. Un retour est une réintégration physique d'articles; sa valeur n'est ni un remboursement, ni un chiffre d'affaires net.
- La vente sans client nominatif reste permise, comportement déjà pris en charge; le type de tarif doit désormais être choisi explicitement au lieu d'être présélectionné silencieusement.
- Les références existantes restent saisies par l'équipe. Le formulaire précise qu'il s'agit du ticket ou d'une référence interne; la génération automatique n'est pas ajoutée.
- **Tâche 3 paiements/remboursements non implémentée**, car conditionnelle et sans décision/périmètre approuvé pour gérer les paiements partiels ou méthodes d'encaissement.

**Réalisations par tâche :**

- **Tâche 0 — appliquée comme hypothèses de travail ci-dessus.** Pas de nouveau modèle financier introduit.
- **Tâche 1 — implémentée :** `GET /api/sales` accepte dates, statut, recherche par référence/client, pagination (20 par défaut, 100 maximum). Les ventes validées sont filtrées/triées selon `sold_at`; brouillons et annulations utilisent `created_at`. La réponse contient données, total et page. L'écran Ventes expose les filtres et distingue la date de validation de celle de création d'un brouillon.
- **Tâche 2 — implémentée côté API et interface :** `GET /api/sales/report` retourne ventes validées (nombre, montant FCFA), retours physiques (nombre, valeur des articles) et quantités ventilées par unité de vente, avec le fuseau et la période. La ventilation évite d'additionner bouteilles, cartons et autres unités dans un total trompeur. L'écran Ventes propose aujourd'hui, semaine, mois et dates personnalisées; il avertit que le montant n'est pas un encaissement et sépare les retours. Aucun export ni chiffre net n'a été ajouté.
- **Tâche 3 — volontairement non commencée** pour les raisons explicitées.
- **Tâche 4 — améliorations client réalisées; règles serveur conservées :** les validations de type de client, produit/unité et tarif actif restent autoritaires côté serveur. Un tarif absent ou fractionnaire affiche un lien vers le tarif du produit; un type tarifaire absent mène à la gestion des clients. Le type de tarif d'une vente anonyme exige désormais un choix explicite. Le stock reste contrôlé à la validation, moment où la sortie est enregistrée.
- **Tâche 5 — guidage client réalisé, règles serveur auditées :** l'écran stock distingue stock initial (démarrage), livraison (réception) et correction après comptage, avec accès direct aux réceptions. Le serveur verrouille le produit et contrôle stock initial unique, quantité comptée non négative, coût requis pour une entrée et absence d'annulation directe du stock initial/comptage; les mouvements/solde sont enregistrés dans la transaction. Aucun changement métier serveur n'était nécessaire.
- **Tâche 6 — principaux irritants corrigés :** suppression de la carte « Fonctions disponibles » non interactive du tableau de bord; ajout de liens vers la configuration des catégories/unités, types tarifaires et tarifs manquants; vocabulaire de retour clarifié comme retour de marchandises et absence explicite de remboursement; référence de vente expliquée comme saisie manuelle. Les destinations Fournisseurs/Clients restent dans le menu principal pour éviter une refonte de navigation sans preuve suffisante.
- **Tâche 7 — partielle :** test frontend du rapport, tests de validation des filtres API et test d'intégration PostgreSQL ajouté. La recette manuelle de la journée type n'a pas été effectuée.

**Fichiers principaux touchés :** requêtes/validation/contrôleur/services/routes du module Ventes backend; contrat API et écrans Ventes, détail de vente/retour, Stock, formulaire Produit, tableau de bord frontend; tests API et intégration PostgreSQL; aucun nouveau schéma ou modèle de paiement.

**Vérifications observées :** frontend : 12 tests passent, compilation TypeScript/Vite réussie, Oxlint réussi. Backend `npm run check` : lint et format réussis, 52 tests passent; 7 tests PostgreSQL sont ignorés par défaut. Le test d'intégration existant a été étendu aux filtres et au rapport, mais n'a pas pu être exécuté : PostgreSQL local répond, cependant aucune configuration `.env` ne cible une base nommée `*_test`; la base de développement n'a pas été utilisée comme substitut.

**Suite :** lancer la suite opt-in sur une base PostgreSQL de test isolée (CI ou base dédiée), corriger toute erreur révélée; puis faire la recette visuelle avec l'utilisateur sur une journée type. Après retour utilisateur, ajuster les libellés/parcours et décider séparément si le suivi des paiements mérite une tâche dédiée. Le statut utilisateur/recette reste « en cours » tant que ces deux contrôles ne sont pas réalisés.

#### 23. Plan des tâches restantes — qualification locale

Ce plan complète la Tâche 7 de la section 21. Il ne prévoit pas de nouvelle fonctionnalité métier; il sert à vérifier les changements déjà réalisés sans toucher aux données de développement. Les deux tâches sont requises avant de qualifier l'expérience comme terminée localement.

**Tâche 8 — Exécuter et qualifier l'intégration sur PostgreSQL isolé**

- **Serveur / base de test :** lancer PostgreSQL 16 avec une base dédiée dont le nom se termine par `_test`; configurer l'exécution avec des identifiants de test uniquement; appliquer `npm run db:migrate` sur cette base neuve; exécuter `RUN_POSTGRES_INTEGRATION=1 npx jest --runInBand --runTestsByPath tests/inventory.postgres.integration.test.js` depuis `backend`.
- **Vérifications à couvrir :** migrations complètes; création des fixtures temporaires; ventes datées par `sold_at` et brouillons datés par `created_at`; filtres et pagination; inclusion/exclusion aux bornes de dates de Ouagadougou; agrégat FCFA; ventilation des quantités par unité; retours physiques séparés; nettoyage des seules lignes créées par le test.
- **Client :** aucun changement attendu si les contrats serveur sont confirmés. Si le contrat diffère, mettre à jour typage et tests frontend uniquement après avoir corrigé/validé la réponse API.
- **Sécurité de la procédure :** ne jamais remplacer la base `*_test` par la base locale de développement; vérifier le nom cible avant toute commande de migration; ne pas réutiliser les identifiants de production.
- **Critères de sortie :** migrations et suite d'intégration passent sur cette base dédiée; tests unitaires backend toujours verts; aucune donnée métier de développement n'est modifiée; résultat et versions PostgreSQL/Node sont consignés dans ce journal. Si l'environnement local ne permet pas une base sûre, utiliser la CI déjà configurée et consigner son résultat, sans bricoler la base de développement.

**Tâche 9 — Recette visuelle et métier avec l'utilisateur**

- **Préparation serveur :** démarrer backend et frontend avec la configuration locale habituelle; vérifier `/api/health/ready`; utiliser l'application locale et des données de démonstration/test, jamais des opérations artificielles dans une base partagée ou de production.
- **Parcours client à exécuter :** (1) consulter Stock et vérifier les libellés stock initial/livraison/comptage; (2) vérifier la page Produit et le lien catégories/unités si prérequis absent; (3) créer une vente anonyme et constater que le type de tarif doit être choisi; (4) ouvrir un produit sans tarif actif et suivre le lien vers le tarif puis revenir à la vente; (5) valider une vente et confirmer la baisse du stock; (6) consulter aujourd'hui/semaine/mois et une période personnalisée, vérifier date, total FCFA et quantités par unité; (7) confirmer qu'un brouillon n'est pas compté comme vente validée; (8) enregistrer un retour physique et vérifier l'entrée de stock ainsi que l'avertissement qu'aucun remboursement n'est enregistré; (9) faire un comptage qui corrige le stock et retrouver le mouvement dans l'historique.
- **Contrôles ergonomiques :** vérifier écran étroit et bureau, textes lisibles, filtres faciles à comprendre, états chargement/vide/erreur, liens de résolution visibles et absence de doubles interprétations. Noter chaque blocage avec écran, action, résultat attendu/observé et capture si utile.
- **Serveur :** contrôler la cohérence des valeurs via API/stock/rapport et les messages de validation; ne pas interpréter une valeur de vente comme un paiement encaissé.
- **Critères de sortie :** parcours terminé sans erreur bloquante; chaque écart est corrigé ou consigné avec décision; l'utilisateur confirme que les termes et chiffres correspondent à son activité. La recette est déclarée faite uniquement après cette confirmation.

**Ordre :** terminer Tâche 8 d'abord, afin de détecter les défauts serveur/SQL avant la recette; corriger et relancer les contrôles concernés; ensuite réaliser la Tâche 9 dans le navigateur. La comptabilité des paiements et remboursements reste une décision de produit distincte et n'est pas un critère de fin de ces deux tâches.

#### 24. Plan — page publique de présentation pour le portfolio

**Objectif :** permettre à un recruteur/client de comprendre et de voir le logiciel sans compte, tout en gardant l'espace de gestion et ses données derrière la connexion. Le lien principal du portfolio dirigera vers cette page, pas vers `/connexion`. Ce livrable est une vitrine informative; il ne donne pas accès à une démo interactive ni à l'API métier.

**Choix retenu :** créer une page React publique `/presentation` dans le frontend existant, avec captures réelles et explications concises. Ne pas créer de backend public, de compte visiteur, de base de démonstration ou de deuxième application. L'application opérationnelle `/app` garde son authentification et ses protections actuelles. La route de présentation doit être déclarée avant la route de redirection générique de `App.tsx`.

**Tâche P1 — Préparer des visuels sûrs et représentatifs**

- Recenser les écrans réellement disponibles : tableau de bord, catalogue, état du stock, réception, vente et rapport périodique.
- Capturer les écrans depuis la version locale du frontend et vérifier leur fidélité à l'interface réelle.
- N'utiliser que des données de démonstration fictives et vérifiées; masquer toute information personnelle, email, jeton, secret, URL privée ou donnée client. Si l'environnement local contient des informations non publiables, préparer des captures après remplacement par des données synthétiques, jamais faire de capture de la production.
- Choisir peu d'images, lisibles sur ordinateur et téléphone, avec un texte alternatif descriptif. Optimiser le poids des fichiers pour le chargement public.
- **Critère de sortie :** chaque visuel est lisible, correspond à une fonctionnalité implémentée et ne révèle aucune donnée sensible.

**Tâche P2 — Construire la page publique côté client**

- Ajouter `/presentation` sans `RequireAuth`; conserver `/app` et ses routes métier sous `RequireAuth`.
- Concevoir une page responsive cohérente avec le design system existant : titre et proposition de valeur, captures légendées des principaux parcours, liste des capacités effectivement présentes, choix techniques/réalisation, limites connues et liens pertinents (portfolio, dépôt si public).
- Ajouter un lien secondaire vers la connexion avec une mention explicite « Espace de gestion — accès réservé ». Ce lien n'est pas le moyen principal de découvrir le projet.
- La page ne doit faire aucun appel aux API métier, afficher aucun formulaire de login comme première vue, créer ni modifier aucun enregistrement, et ne promettre aucune fonctionnalité non implémentée (notamment encaissements/remboursements).
- Ne pas construire une simulation de l'application : les captures représentent l'interface et le texte explique ses capacités; toute interaction montrée doit être un vrai lien de navigation de la vitrine.
- **Critère de sortie :** ouverture de `/presentation` dans une session déconnectée affiche immédiatement la vitrine; le lien `/app` ou de connexion continue d'exiger l'authentification.

**Tâche P3 — Présentation du projet et exactitude du contenu**

- Rédiger en français simple une description du problème traité, des principaux flux (catalogue → stock/réception → vente/rapport) et des choix d'architecture réellement présents.
- Mentionner les qualités vérifiées (tests/build, cohérence de stock, montants FCFA) uniquement avec leurs preuves; distinguer ce qui est livré de ce qui reste à valider.
- Présenter explicitement le projet comme réalisation de portfolio, pas comme service commercial ou logiciel prêt à gérer des données réelles.
- **Critère de sortie :** chaque affirmation est vérifiable dans le dépôt ou l'interface, et les limites ne sont pas cachées.

**Tâche P4 — Tests, accessibilité et publication**

- Ajouter un test frontend garantissant que `/presentation` est consultable sans session et qu'aucun chargement API n'est requis; vérifier aussi que `/app` reste protégé.
- Vérifier navigation clavier, titres, contraste, textes alternatifs et affichage mobile; tester le chargement direct de l'URL `/presentation` sur Vercel.
- Contrôler qu'aucun secret n'est injecté dans le bundle public et que les images/metadata n'incluent pas d'information locale sensible.
- Faire une revue manuelle de la page publiée et remplacer dans le portfolio son lien vers la connexion par l'URL publique de présentation.
- **Critère de sortie :** tests et build frontend réussis; accès direct public fonctionnel; l'espace `/app` demande toujours un compte; contenu et visuels relus.

**Hors périmètre :** compte démo partagé, accès en lecture seule à une base, données de démo publiques, mode de simulation interactif, nouvelles API, ou promesse d'un produit prêt pour exploitation réelle. Une démo manipulable pourra être réévaluée séparément si le portfolio en a réellement besoin.

**Ordre :** P1 (visuels sûrs) → P2 (route et page) → P3 (contenu) → P4 (tests, revue et mise à jour du lien portfolio). La vitrine ne sera pas déclarée prête avant la vérification visuelle des captures et l'ouverture de l'URL publique sans connexion.

#### 25. Compte rendu — première implémentation de la vitrine portfolio

**État :** la page publique fonctionne en local aux routes `/` et `/presentation`. Le parcours métier reste sous authentification. La vitrine est implémentée et qualifiée par tests/build/lint, mais elle n'est pas encore publiée et la tâche P1 de captures réelles n'est pas terminée; ne pas considérer le lien portfolio comme prêt tant que la revue visuelle et le déploiement Vercel ne sont pas effectués.

**Réalisé :**

- Ajout d'une page responsive en français présentant l'objectif, les fonctions présentes, le flux catalogue → réception → stock → ventes, les technologies réellement utilisées et les limites connues (notamment absence de suivi des paiements/remboursements).
- `/` et `/presentation` affichent la vitrine sans session. Le fournisseur d'authentification ne vérifie pas `/auth/me` sur ces routes, même si un ancien jeton navigateur existe; la page ne requiert pas l'API métier.
- `/connexion` reste disponible depuis la vitrine avec un libellé indiquant l'accès réservé. Les pages `/app` gardent leur garde d'authentification; les chemins inconnus redirigent vers la présentation publique.
- Le visuel de tête est un diagramme conceptuel, explicitement étiqueté comme illustration et non comme capture. Aucune métrique, donnée de client ou interface simulée n'est présentée comme réelle.
- Ajout de tests couvrant les deux routes publiques avec jeton présent et absence d'appel réseau, ainsi que le maintien de la protection de `/app` sans session.

**Vérifications observées :** frontend `npm test` : 5 fichiers et 15 tests réussis; `npm run build` : TypeScript et bundle Vite de production réussis; `npm run lint` : Oxlint réussi.

**À faire avant de considérer la vitrine prête :** (1) capturer quelques écrans authentiques sur l'environnement local avec données synthétiques vérifiées; remplacer ou compléter le diagramme seulement après revue de confidentialité et de lisibilité; (2) contrôler clavier, contrastes et affichage mobile dans un navigateur; (3) déployer le frontend sur Vercel et tester une ouverture directe de `/` et `/presentation`, tout en confirmant que `/app` reste protégé; (4) remplacer le lien du portfolio par l'URL publiée. Aucun compte de démonstration ni accès public aux données métier ne sera créé.

**Limite de vérification :** aucun contrôle visuel navigateur ni déploiement distant n'a été effectué dans cette implémentation; les tests automatisés ne prouvent pas ces points. L'environnement de travail ne contient pas de dépôt Git détectable à la racine du dossier ni dans `frontend`/`backend`, donc aucun statut de diff Git n'est disponible.

#### 26. Annulation de la vitrine publique

À la demande de l'utilisateur, la première implémentation décrite en section 25 a été retirée : suppression de la page `presentation-page.tsx` et de son test, suppression des routes `/` et `/presentation`, et restauration de la redirection générique vers `/app`. Le fournisseur d'authentification reprend son comportement antérieur sans exception liée à la vitrine. Le plan de présentation de la section 24 est conservé comme proposition non réalisée; aucune URL portfolio publique n'est actuellement fournie par cette modification.

**Vérification après retrait :** frontend `npm test` : 4 fichiers et 12 tests réussis; `npm run build` : compilation TypeScript et bundle Vite réussis; `npm run lint` : Oxlint réussi.

#### 27. Pagination des réceptions et découpage des pages volumineuses

Deux chantiers ont été menés à la demande de l'utilisateur : la pagination de la liste des réceptions, côté backend et côté frontend, puis l'extraction de composants hors des pages frontend les plus volumineuses. Aucune règle métier, aucune route publique et aucun schéma de base de données n'ont été modifiés.

**État — pagination des réceptions (backend).** Le contrat de liste suit désormais le modèle déjà utilisé par le catalogue : `page` (défaut 1, minimum 1), `limit` (défaut 20, maximum 100) et `search` (100 caractères au plus), avec l'erreur `VALIDATION_ERROR` « La pagination est invalide. » en cas de valeurs incorrectes. La validation est centralisée dans `listFilters` (`backend/src/modules/receipts/receipt.validation.js:44`), la requête dans `findAll` (`receipt.queries.js:3`) avec filtre `stock_receipts.is_active = true`, recherche `ILIKE` sur la référence et le nom du fournisseur, tri `created_at DESC, id DESC`, `LIMIT/OFFSET` et `COUNT(*)::int AS total`, et le service `listReceipts` (`receipt.service.js:55`) renvoie `{ items, total, page, limit }`. Le contrôleur transmet directement `req.query` filtré.

**État — pagination des réceptions (frontend).** `receipts-api.ts` expose `PaginatedReceipts = { items, total, page, limit }` et `listReceipts(params, signal)` construit par `URLSearchParams`. `receipts-page.tsx` conserve `page`, `limit`, `currentResponse`, `pageCount`, `firstItem` et `lastItem`, et affiche le pied de pagination habituel (« Précédent », « Page X / Y », « Suivant »), avec les mêmes protections que le catalogue : clé de requête sérialisée, `AbortController` et nettoyage.

**État — découpage des pages.** Quatre pages ont été allégées sans changer leur comportement :

- `sale-detail-page.tsx` de 918 à 427 lignes, avec `sale-status.tsx`, `sale-item-row.tsx` et `sale-item-form.tsx` extraits dans `frontend/src/features/sales/components/` ;
- `sale-return-detail-page.tsx` de 588 à 399 lignes, avec `return-item-form.tsx`, `return-item-row.tsx` et `return-status.tsx` ;
- `stock-page.tsx` de 742 à 425 lignes, avec `movement-row.tsx` (qui porte aussi `MovementTypeBadge`) dans `frontend/src/features/inventory/components/` ;
- `sales-page.tsx` de 754 à 691 lignes, avec `sale-row.tsx` et `metric-card.tsx`.

Les composants extraits reçoivent leurs données par props et ne réintroduisent aucune requête propre ; les types restent ceux des modules d'API existants (`StockMovement` utilise `created_at` et `base_quantity`, `SaleReturnItem` n'a pas de statut, `CatalogProduct` n'a pas de `units`).

**Décisions retenues.** La pagination serveur est préférée à un filtrage client, conformément au modèle déjà en place sur le catalogue, afin que la volumétrie des réceptions ne dégrade pas le chargement. Le découpage s'est limité à des extractions mécaniques, sans refonte visuelle ni nouvelle abstraction : l'objectif était la lisibilité des fichiers, pas un changement d'architecture. `sales-page.tsx` reste à 691 lignes (formulaire de création et filtres encore en ligne) ; c'est acceptable et non bloquant.

**Critères de sortie et preuves.** Backend : `npm run check` réussi (6 suites, 52 tests, 7 tests PostgreSQL ignorés faute de base dédiée). Frontend : `npm test` réussi (4 fichiers, 12 tests), `npm run lint` (Oxlint) sans erreur, `npm run build` réussi (1976 modules, 2,66 s, `index-2PApKN9L.js` 434,93 kB / 120,99 kB gzip).

**Limites de vérification.** Aucun contrôle manuel dans un navigateur n'a été effectué ; les tests automatisés et le build ne prouvent ni le rendu visuel, ni le comportement de la pagination sur de gros volumes réels. Aucun dépôt Git n'est détectable à la racine du projet, donc aucun diff n'est disponible pour attester l'étendue exacte des modifications.
