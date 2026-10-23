# Plan de réalisation — application de gestion de stock

## 1. Objet du document

Ce document fixe l'architecture et l'ordre de réalisation de l'application de gestion de stock. Il part de l'état actuel : une base PostgreSQL déjà riche (produits, mouvements, ventes, fournisseurs, réceptions, utilisateurs…) et une API Express initialisée avec un premier module `products`.

L'objectif n'est pas seulement de faire fonctionner des écrans. L'application doit rester fiable lorsque le volume de données augmente, compréhensible pour un nouveau développeur, testable, sécurisée et assez souple pour accueillir de nouveaux besoins sans devoir modifier les modules métier déjà stables.

## 2. Principes directeurs

### 2.1 Architecture retenue : monolithe modulaire en couches

Le projet restera une seule application déployable, découpée en modules métiers indépendants. Chaque module regroupe son routage HTTP, ses contrôleurs, ses règles métier, son accès aux données et ses tests.

Ce choix convient au contexte actuel : un domaine métier cohérent, une équipe probablement réduite et le besoin d'avancer sans la complexité opérationnelle des microservices. Il ne s'agit pas d'un « gros dossier controllers » : les frontières des modules sont explicites. Le monolithe modulaire est l'architecture cible ; une extraction vers des services distincts ne sera envisagée que si un besoin concret et mesuré l'impose.

Les responsabilités restent séparées :

```text
Client Web / mobile
        │ HTTP + JSON
        ▼
Routes → Contrôleurs → Services métier → Requêtes du module → PostgreSQL
                         │       │
                         │       └── transactions, règles et événements métier
                         ▼
                 Validation, autorisation, journalisation
```

- Les **routes** déclarent les URL, le verbe HTTP et les middlewares.
- Les **contrôleurs** traduisent HTTP vers le cas d'usage ; ils ne contiennent pas de SQL ni de règle de stock.
- Les **services** portent les invariants métier et coordonnent les transactions.
- Les **requêtes SQL du module** sont regroupées dans un fichier dédié. Un dépôt (`repository`) ne sera introduit que si le volume ou la complexité des accès le justifie.
- PostgreSQL garantit également les contraintes structurelles : clés étrangères, unicité, valeurs positives et intégrité référentielle.

Cette séparation rend les règles testables sans serveur HTTP, évite la duplication SQL et permet de modifier une interface sans toucher au métier. Ajouter une fonctionnalité indépendante consiste à ajouter son module puis à enregistrer son routeur dans le point de composition de l'application ; les modules existants ne changent pas sauf lorsqu'une règle métier est réellement commune.

### 2.2 Règles de conception

- Priorité à la simplicité : pas d'abstraction générique, de couche supplémentaire ou de bibliothèque sans besoin réel.
- Les dépendances vont vers le métier, jamais l'inverse : un service ne dépend pas de `req` ou `res`.
- Une écriture de stock est atomique : mouvement et mise à jour du stock courant se font dans une même transaction.
- Toute donnée externe est validée avant traitement.
- Les messages d'erreur exposés au client sont stables et sans information sensible.
- Les identifiants, dates, unités et montants ont un format documenté et uniforme.
- Les opérations métier importantes sont traçables : auteur, date, référence et motif.

## 3. Architecture cible du dépôt

```text
gestion-stock/
├── backend/
│   ├── src/
│   │   ├── app.js                     # composition Express et middlewares globaux
│   │   ├── server.js                  # démarrage HTTP uniquement
│   │   ├── config/                    # environnement, pool PostgreSQL, logger
│   │   ├── common/                    # seulement erreurs, pagination et utilitaires réellement partagés
│   │   ├── middlewares/               # auth, rôles, validation, erreurs, 404
│   │   ├── modules/
│   │   │   ├── products/
│   │   │   │   ├── product.routes.js
│   │   │   │   ├── product.controller.js
│   │   │   │   ├── product.service.js
│   │   │   │   ├── product.queries.js
│   │   │   │   ├── product.validation.js
│   │   │   │   └── product.test.js
│   │   │   ├── inventory/             # mouvements, ajustements, état du stock
│   │   │   ├── suppliers/
│   │   │   ├── receipts/
│   │   │   ├── sales/
│   │   │   ├── customers/
│   │   │   ├── categories/
│   │   │   ├── units/
│   │   │   ├── users/
│   │   │   └── auth/
│   │   └── routes.js                  # enregistre les routeurs de modules
│   ├── migrations/                    # évolution versionnée du schéma
│   ├── seeds/                         # données de démonstration, jamais les secrets
│   ├── tests/
│   │   ├── integration/
│   │   └── helpers/
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── frontend/                          # à commencer avec un périmètre réduit après le noyau inventaire
│   └── ...
├── docs/
│   ├── api.md
│   ├── regles-metier.md
│   └── decisions/                     # décisions d'architecture datées (ADR)
└── docker-compose.yml                 # optionnel lorsque le déploiement le justifie
```

Le déplacement progressif de `controllers`, `routes` et `config` actuels vers `modules` se fera module par module, avec tests, afin d'éviter une réécriture risquée. Le dossier `common/` ne doit jamais devenir un fourre-tout : un élément n'y entre que s'il est utilisé par plusieurs modules et possède une responsabilité claire.

## 4. Décisions techniques

| Sujet | Décision | Pourquoi |
|---|---|---|
| API | Node.js + Express, REST JSON sous `/api/v1` | Cohérent avec l'existant, simple à consommer et à versionner. |
| Données | PostgreSQL + `pg` paramétré | Les transactions et contraintes relationnelles sont essentielles au stock. |
| Schéma | Migrations versionnées | Le schéma ne doit pas dépendre d'une base locale déjà existante. |
| Validation | Schémas explicites à la frontière HTTP | Évite les entrées invalides et documente les contrats. |
| Authentification | Mots de passe hachés et contrôle de rôles, avant toute mise en production | Protège les opérations sensibles sans surcharger le développement initial. |
| Tests | Un framework de test et Supertest ; base PostgreSQL isolée | Vérifie les règles métier, les routes et les transactions. |
| Documentation | Un contrat API maintenu à jour ; OpenAPI lorsque l'API sert un client distinct | Évite de documenter deux fois trop tôt. |
| Qualité | ESLint + Prettier | Rend le style cohérent et détecte les erreurs tôt. |
| Logs | Logs utiles sans données sensibles ; structure enrichie quand l'exploitation le requiert | L'observabilité progresse avec le produit. |
| Déploiement | Variables d'environnement ; conteneurisation et CI quand les flux principaux sont stables | Évite de retarder le métier par l'infrastructure. |

Les bibliothèques précises seront ajoutées seulement lors de l'étape correspondante, avec leurs versions figées dans `package-lock.json`.

## 5. Contrats API et conventions

### Ressources et versionnement

- Toutes les routes métier commencent par `/api/v1`.
- Les noms sont au pluriel : `/products`, `/suppliers`, `/stock-receipts`.
- Les identifiants sont passés dans l'URL : `GET /api/v1/products/:id`.
- Les listes supportent une pagination uniforme : `page`, `limit`, `sort`, `order` et filtres documentés.
- Une suppression est interdite si elle brise l'historique. On privilégie `is_active=false` ou un statut métier.
- Les opérations métier portent un statut explicite (`draft`, `validated`, `cancelled`) lorsque leur cycle de vie le nécessite.
- Une commande de validation sensible peut recevoir une clé d'idempotence afin qu'une répétition réseau ne crée pas une seconde opération.

### Format de réponse

Une ressource est renvoyée directement à la création ou à la lecture unitaire. Une liste porte des métadonnées de pagination :

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0 }
}
```

Les erreurs suivent un contrat unique :

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données fournies sont invalides.",
    "details": [{ "field": "sku", "message": "Le SKU est requis." }]
  }
}
```

Les codes HTTP sont employés de façon stricte : `201` création, `200` lecture/mise à jour, `204` action sans contenu, `400` requête invalide, `401` non authentifié, `403` non autorisé, `404` absent, `409` conflit métier et `500` erreur non prévue.

## 6. Règles métier critiques à protéger

Ces règles devront être écrites, testées et appliquées au niveau service, avec un renfort par contraintes SQL lorsque possible.

1. Le stock ne peut jamais devenir négatif, sauf si un besoin métier explicite autorise les ruptures contrôlées.
2. Chaque variation de stock produit une ligne immuable dans `stock_movements` avec son type, sa quantité, sa date, son auteur et sa référence.
3. Une réception, une vente, un retour ou un ajustement crée ses lignes métier et ses mouvements dans la même transaction.
4. Une opération validée ne se modifie pas silencieusement : elle est annulée ou compensée par une nouvelle opération traçable.
5. Les prix et coûts sont non négatifs ; les règles de calcul du coût moyen doivent être documentées et testées avec des exemples.
6. Les unités de base et conversions sont contrôlées afin d'empêcher les incohérences de quantité.
7. Les montants restent en `numeric` dans PostgreSQL ; les calculs JavaScript évitent les flottants binaires pour les valeurs monétaires.
8. Les permissions sont vérifiées pour chaque action sensible (prix, ajustement, annulation, utilisateurs).

## 7. Qualité, fiabilité et sécurité

### Qualité du code

- Fonctions courtes, nommées selon l'intention métier et sans effet caché.
- Une règle métier importante reçoit un test ciblé avant ou avec son implémentation.
- Éviter le copier-coller : partager uniquement les comportements vraiment communs dans `common/`.
- Revue systématique de chaque changement : lisibilité, erreurs, performance, tests et compatibilité API.
- Documenter les décisions qui ont des conséquences durables dans `docs/decisions/`.

### Fiabilité des données

- Requêtes toujours paramétrées : jamais de concaténation SQL.
- Transactions explicites avec `BEGIN`, `COMMIT` et `ROLLBACK` pour les cas multi-écritures.
- Verrouillage approprié d'une ligne produit (`SELECT ... FOR UPDATE`) pendant les opérations concurrentes sur le stock.
- Index sur les clés étrangères et les champs fréquemment filtrés ; inspection du plan de requête avant d'ajouter un index non évident.
- Une migration déjà exécutée dans un environnement partagé n'est jamais modifiée : toute correction passe par une nouvelle migration.
- Sauvegardes et procédure de restauration vérifiée avant tout déploiement réel.

### Sécurité

- Les mots de passe et variables `.env` ne sont jamais versionnés ; seul `.env.example` l'est.
- CORS défini par environnement et vérification des rôles côté serveur. Limitation de débit et en-têtes supplémentaires sont ajoutés avant exposition publique.
- Vérification des rôles côté serveur, jamais uniquement dans l'interface.
- Journalisation sans mot de passe, jeton ou donnée sensible.
- Dépendances contrôlées régulièrement (`npm audit`) et mises à jour raisonnées.

### Observabilité

- Les erreurs inattendues incluent le contexte technique dans les logs, pas dans la réponse client.
- La route de santé distingue, lorsque le déploiement le nécessite, application et base (`/health` et `/ready`).
- Identifiant de requête et métriques sont ajoutés lorsque l'application est exploitée par plusieurs utilisateurs ou environnements.

## 8. Stratégie de tests

| Niveau | Objet vérifié | Exemples |
|---|---|---|
| Unitaire | Services et règles pures | calcul de stock, validation d'une transition, permissions. |
| Intégration | Requêtes SQL et PostgreSQL de test | transaction annulée, contrainte SKU, verrouillage produit. |
| API | Routes HTTP complètes | création produit, erreur 409, accès refusé, pagination. |
| Parcours métier | Flux de bout en bout | réception → stock disponible → vente → mouvement correct. |
| Non-régression | Défauts corrigés | chaque bug important devient un test permanent. |

Avant fusion d'un changement : formatage, lint, tests unitaires/intégration et vérification manuelle du flux concerné. Les tests ne doivent jamais utiliser la base de développement.

## 9. Feuille de route de réalisation

Chaque étape se termine avec une démonstration, les tests associés et une mise à jour de la documentation. Une étape n'est pas considérée terminée lorsqu'elle « marche sur ma machine » seulement.

### Phase 0 — Assainissement du socle

1. Créer `README.md`, `.gitignore`, `.env.example` et scripts `dev`, `start`, `test`, `lint`, `format`.
2. Déplacer la configuration PostgreSQL vers des variables d'environnement et valider leur présence au démarrage.
3. Ajouter middleware d'erreurs, réponse 404 et logger minimal.
4. Mettre en place le formatage, le lint et la structure `modules/`.
5. Mettre le schéma actuel sous migrations, puis écrire un seed de démonstration séparé.
6. Supprimer ou déplacer le fichier de sortie temporaire `backend/e_unit_id,` après confirmation qu'il n'est plus utile.

**Critère de sortie :** un clone neuf peut démarrer l'API et une base vide avec une procédure unique et documentée.

### Phase 1 — Référentiels et catalogue produits

1. Terminer les catégories, unités, conversions et produits.
2. Ajouter lecture unitaire, mise à jour, désactivation, recherche, filtres et pagination des produits.
3. Valider les champs, traiter les conflits d'unicité (`SKU`, nom) en `409` et vérifier les clés étrangères.
4. Écrire les tests API et service de ce module.
5. Documenter les routes et exemples de requêtes dans le README ou un document API concis.

**Critère de sortie :** le catalogue peut être administré de façon fiable par API, avec des erreurs explicites et testées.

### Phase 2 — Noyau inventaire

1. Formaliser les types de mouvements : entrée, sortie, ajustement positif/négatif, retour, annulation.
2. Implémenter un service unique responsable de l'écriture des mouvements et du stock courant.
3. Gérer les transactions, l'accès concurrent et les seuils critiques.
4. Ajouter la consultation du stock, l'historique par produit et les alertes de rupture.
5. Tester les scénarios concurrents, les refus de stock insuffisant et l'absence de double validation.

**Critère de sortie :** toute quantité affichée est explicable par un historique cohérent et non modifiable.

### Phase 3 — Approvisionnement et fournisseurs

1. Gérer fournisseurs et associations fournisseur-produit.
2. Créer les réceptions et leurs lignes ; à validation, elles alimentent le stock par le service inventaire.
3. Gérer le coût d'achat, les références fournisseur et le calcul de coût moyen défini.
4. Tester les annulations et corrections sans destruction de l'historique.

**Critère de sortie :** une réception complète et validée augmente le stock et laisse une trace comptable/métier fiable.

### Phase 4 — Clients, ventes et retours

1. Gérer types de clients et clients.
2. Créer vente, lignes de vente, prix appliqué et validation atomique de la sortie de stock.
3. Gérer retours de vente et remise en stock selon les règles définies.
4. Interdire ou traiter explicitement la vente au-delà du stock disponible.

**Critère de sortie :** une vente et son retour conservent la cohérence des montants, des quantités et des mouvements.

### Phase 5 — Interface utilisateur initiale

1. Choisir le framework frontend seulement après confirmation des besoins d'usage (React est une option pragmatique).
2. Construire d'abord catalogue, consultation de stock et ajustement selon les rôles provisoires de développement.
3. Ajouter réceptions et ventes après validation des flux par de vrais utilisateurs.
4. Prévoir une interface accessible : états de chargement, erreurs visibles, navigation clavier et formulaires clairs.

**Critère de sortie :** les utilisateurs pilotes accomplissent catalogue et consultation de stock sans utiliser directement l'API ; leurs retours orientent les écrans suivants.

### Phase 6 — Authentification, droits et préparation à la production

1. Définir les rôles réellement nécessaires et leurs permissions, sans créer de permissions trop fines avant d'en avoir l'usage.
2. Créer connexion, protection des routes et gestion minimale des utilisateurs ; les mots de passe sont hachés.
3. Tester systématiquement les cas autorisé, non authentifié et interdit.
4. Ajouter CORS adapté, limites sur les routes d'authentification et sauvegarde/restauration documentée.
5. Conteneuriser et ajouter une intégration continue seulement si le déploiement ou l'équipe le justifie.

**Critère de sortie :** l'application peut être ouverte à ses premiers utilisateurs dans un environnement contrôlé, sans accès non autorisé aux opérations sensibles.

### Phase 7 — Rapports et exploitation progressive

1. Ajouter les rapports réellement demandés : stock disponible, stock faible, mouvements par période, valorisation ou ventes.
2. Ajouter export CSV/PDF seulement lorsqu'un usage concret le justifie, avec contrôle d'autorisation et limite de volume.
3. Ajouter les métriques, logs structurés, OpenAPI complète et automatisation de déploiement au rythme du nombre d'utilisateurs et des environnements.
4. Réaliser une revue sécurité et performance avant chaque élargissement significatif de l'usage.

**Critère de sortie :** l'exploitation est adaptée à la charge et aux besoins réels, sans infrastructure inutile.

## 10. Ordre de priorité fonctionnelle

L'ordre recommandé est : **socle → catalogue → inventaire → réception → vente → interface initiale → droits de production → rapports**. Le module inventaire est le cœur de la fiabilité ; il doit être consolidé avant de multiplier les écrans et routes secondaires. L'authentification peut être développée plus tôt si le projet est directement exposé à plusieurs utilisateurs, mais elle ne doit pas empêcher la validation locale des premiers flux métier.

Les tables déjà présentes ne signifient pas que toutes les fonctionnalités sont prêtes. Chaque module sera intégré uniquement après validation de ses règles, de ses transactions et de ses tests.

## 11. Definition of Done d'une fonctionnalité

Une fonctionnalité est terminée quand :

1. Son besoin et ses règles métier sont écrits et validés.
2. Son contrat API est documenté.
3. Les validations, autorisations et erreurs attendues sont traitées.
4. Les opérations de données sont transactionnelles si nécessaire.
5. Les tests pertinents passent dans un environnement propre.
6. Le code est formaté, relu et ne contient ni secret ni sortie de débogage.
7. Le parcours est démontré avec des données de test.
8. La fonctionnalité ne crée pas de dépendance cachée vers un autre module ni de modification injustifiée d'un module stable.

## 12. Première action recommandée

Commencer par la **Phase 0**, puis terminer entièrement le module catalogue de la Phase 1. Cette séquence transforme le prototype actuel en fondation fiable avant d'implémenter les règles les plus sensibles : les mouvements de stock et les ventes. Les outils avancés ne seront ajoutés que lorsqu'un besoin précis le justifie.
