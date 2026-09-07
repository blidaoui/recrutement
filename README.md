# Plateforme Intelligente de Recrutement (IA)

Plateforme web de recrutement avec matching automatique CV ↔ offres d'emploi basé sur l'IA.

## Stack technique

- **Frontend** : React (Vite) + React Router + Axios
- **Backend** : Node.js + Express
- **Base de données** : PostgreSQL + Prisma ORM
- **IA** : extraction de compétences (NLP par référentiel) + algorithme de scoring de matching
- **Authentification** : Google OAuth 2.0 (Passport.js) + JWT (cookie httpOnly)

## Structure du projet

```
recrutement-ia-platform/
├── backend/
│   ├── prisma/schema.prisma        # Modèle de données PostgreSQL
│   └── src/
│       ├── server.js               # Point d'entrée Express
│       ├── config/                 # DB (Prisma) + stratégie Google OAuth
│       ├── middleware/auth.js      # Vérification JWT + rôles
│       ├── routes/                 # Routes REST
│       ├── controllers/            # Logique métier des routes
│       └── services/ia/            # Cœur IA : extraction texte, skills, matching
└── frontend/
    └── src/
        ├── api/axios.js            # Client HTTP configuré
        ├── context/AuthContext.jsx # Gestion de la session utilisateur
        ├── pages/                  # Home, Login, Offres, Dashboards
        └── components/             # Navbar, OffreCard, CVUpload, CandidatureList
```

## Démarrage

### 1. Base de données
Installer PostgreSQL localement, ou utiliser un service cloud (Neon, Supabase, Railway...).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Remplir .env : DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, SESSION_SECRET
npx prisma migrate dev --name init
npm run dev
```
Le serveur démarre sur `http://localhost:5000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```
L'application démarre sur `http://localhost:5173`.

### 4. Configurer Google OAuth
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Identifiants
2. Créer un identifiant OAuth 2.0 (type "Application Web")
3. URI de redirection autorisée : `http://localhost:5000/api/auth/google/callback`
4. Copier le Client ID et Client Secret dans le fichier `.env` du backend

## Fonctionnement du matching IA

1. **Upload du CV** (PDF/DOCX) → extraction du texte brut (`pdf-parse` / `mammoth`)
2. **Extraction des compétences** → comparaison du texte à un référentiel de compétences avec gestion des synonymes (`services/ia/extractSkills.js`)
3. **Matching** → à la candidature, comparaison des compétences du CV avec celles requises par l'offre, calcul d'un score en % avec bonus pour compétences additionnelles (`services/ia/matching.js`)
4. Le recruteur visualise ses candidatures **triées automatiquement par score de matching décroissant**

## Pistes d'amélioration (pour la soutenance)

- Remplacer le matching par mots-clés par des **embeddings sémantiques** (ex. `@xenova/transformers`, exécutable en pur Node.js sans API externe) pour matcher les synonymes non listés
- Ajouter un système de **notifications** (email) lors d'un nouveau matching à fort score
- Dashboard recruteur avec **statistiques** (taux de matching moyen, nombre de candidatures par offre)
- Historisation des versions de CV pour comparer l'évolution du score dans le temps

## Notes importantes

- Ce code est un **squelette fonctionnel complet** pensé pour démarrer rapidement un PFE : la logique métier (auth, upload, extraction, matching) est réelle et opérationnelle, mais mérite d'être renforcée (validation des entrées, gestion d'erreurs plus fine, tests) avant une mise en production.
- Le référentiel de compétences (`skillsReference.js`) est volontairement simple à enrichir : ajoutez vos propres compétences/synonymes selon le domaine métier ciblé.
