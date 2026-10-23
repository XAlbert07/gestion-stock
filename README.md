# Gestion Stock

Application web de gestion de stock pour petites et moyennes entreprises. Permet de gérer le catalogue produits, les fournisseurs, les réceptions, les ventes, les retours, les inventaires et le suivi des mouvements de stock.

## Fonctionnalités

- **Catalogue** : Gestion des produits, catégories et fournisseurs
- **Réceptions** : Enregistrement des bons de réception et mise à jour automatique du stock
- **Ventes** : Création de ventes, facturation, gestion des clients
- **Retours** : Gestion des retours ventes/réceptions
- **Inventaire** : Comptages de stock avec ajustements
- **Mouvements** : Historique complet des mouvements de stock
- **Tableau de bord** : Statistiques et indicateurs clés
- **Authentification** : Système d'authentification JWT avec rôles

## Stack technique

### Backend
- **Runtime** : Node.js
- **Framework** : Express.js
- **Base de données** : PostgreSQL
- **Authentification** : JWT (jsonwebtoken)
- **Validation** : express-validator
- **Tests** : Jest

### Frontend
- **Framework** : React 19 + TypeScript
- **Build** : Vite
- **Routing** : React Router 7
- **UI** : Tailwind CSS + shadcn/ui
- **Formulaires** : React Hook Form + Zod
- **Tests** : Vitest + Testing Library

## Prérequis

- Node.js 18+ 
- PostgreSQL 14+
- npm ou yarn

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/XAlbert07/gestion-stock.git
cd gestion-stock
```

### 2. Configuration Backend

```bash
cd backend
npm install
cp .env.example .env
```

Configurer les variables dans `.env` :
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/gestion_stock
JWT_SECRET=votre_secret_jwt
JWT_EXPIRES_IN=7d
```

### 3. Configuration Base de données

```bash
# Créer la base de données
createdb gestion_stock

# Exécuter les migrations
npm run db:migrate

# Créer un utilisateur administrateur
npm run bootstrap:admin
```

### 4. Configuration Frontend

```bash
cd ../frontend
npm install
cp .env.example .env  # Si disponible
```

## Démarrage

### Développement

**Backend** (dans le dossier `backend/`) :
```bash
npm run dev
```
L'API sera disponible sur `http://localhost:3000`

**Frontend** (dans le dossier `frontend/`) :
```bash
npm run dev
```
L'application sera disponible sur `http://localhost:5173`

## Scripts disponibles

### Backend
- `npm run dev` - Démarrage en mode développement
- `npm run start` - Démarrage en production
- `npm run db:migrate` - Exécution des migrations
- `npm run db:seed` - Insertion des données de test
- `npm run bootstrap:admin` - Création de l'administrateur
- `npm test` - Exécution des tests
- `npm run check` - Vérification du code

### Frontend
- `npm run dev` - Démarrage en mode développement
- `npm run build` - Build de production
- `npm run preview` - Prévisualisation du build
- `npm run lint` - Vérification ESLint/Oxlint
- `npm test` - Exécution des tests
- `npm run check` - Vérification TypeScript

## Structure du projet

```
gestion-stock/
├── backend/          # API REST Node.js/Express
│   ├── src/          # Code source
│   ├── migrations/   # Migrations PostgreSQL
│   ├── seeds/        # Données de test
│   └── tests/        # Tests
└── frontend/         # Application React/TypeScript
    └── src/          # Code source
```

## Licence

Ce projet est privé.
