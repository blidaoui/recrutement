# Plateforme Intelligente de Recrutement (IA)

Plateforme web de recrutement avec matching automatique CV ↔ offres d'emploi basé sur l'IA, messagerie temps réel et tableau de bord analytique.

## Stack technique

- **Frontend** : React 18 (Vite) + React Router v6 + Axios + Recharts
- **Backend** : Node.js + Express + Socket.io
- **Base de données** : PostgreSQL + Prisma ORM
- **IA** : extraction de compétences via Gemini AI (`@google/genai`) avec fallback automatique sur référentiel + synonymes, algorithme de scoring de matching
- **Authentification** : Google OAuth 2.0 (Passport.js) + JWT (cookie httpOnly)
- **Email** : Nodemailer (SMTP) — réinitialisation de mot de passe

## Structure du projet

```
recrutement-ia-platform/
├── backend/
│   ├── prisma/schema.prisma          # Modèle de données PostgreSQL
│   └── src/
│       ├── server.js                 # Point d'entrée Express + Socket.io
│       ├── config/
│       │   ├── db.js                 # Client Prisma
│       │   ├── passport.js           # Stratégie Google OAuth
│       │   └── multer.js             # Upload pièces jointes (messages)
│       ├── middleware/auth.js        # Vérification JWT + guards de rôle
│       ├── routes/                   # Routes REST (auth, cv, offres, candidatures, messages, admin, stats, profile)
│       ├── controllers/              # Logique métier
│       ├── services/ia/
│       │   ├── skillsReference.js    # Référentiel de compétences + synonymes (fallback)
│       │   ├── extractSkills.js      # Extraction IA (Gemini) avec fallback référentiel
│       │   ├── extractText.js        # Parsing PDF / DOCX
│       │   ├── matching.js           # Algorithme de scoring CV ↔ offre
│       │   └── parseCvDetails.js     # Extraction email / téléphone depuis CV
│       └── utils/
│           ├── email.js              # Envoi email via SMTP (Nodemailer)
│           ├── emailValidation.js    # Validation format email
│           └── deleteUserWithRelations.js  # Suppression en cascade (transaction)
└── frontend/
    └── src/
        ├── api/
        │   ├── axios.js              # Client HTTP (baseURL: /api)
        │   └── socket.js             # Client Socket.io
        ├── context/AuthContext.jsx   # Session utilisateur (login, register, logout)
        ├── components/               # Avatar, Navbar, CVUpload, OffreCard, CandidatureList, Toast...
        └── pages/                    # Login, Offres, CandidatDashboard, RecruteurDashboard, AdminDashboard, Messagerie, ProfileSection, ResetPassword
```

## Démarrage

### 1. Base de données

Installer PostgreSQL localement, ou utiliser un service cloud (Neon, Supabase, Railway...).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Remplir .env (voir section Variables d'environnement ci-dessous)
npx prisma migrate dev --name init
npm run dev
```

Le serveur démarre sur `http://localhost:5000`.

#### Tests

Pour lancer la suite de tests automatisés (Vitest) :
```bash
cd backend
npm test
```
La suite couvre : l'authentification, la gestion des offres, le matching IA, l'upload de CV, les statistiques et la messagerie temps réel (Socket.io).

### 3. Frontend

```bash
cd frontend
npm install
# Créer le fichier .env dans frontend/
echo VITE_API_URL=http://localhost:5000 > .env
npm run dev
```

L'application démarre sur `http://localhost:5173`.

> **Pourquoi `VITE_API_URL` ?**
> En développement, Vite proxifie `/api` et `/uploads` vers `http://localhost:5000` (voir `vite.config.js`).
> `VITE_API_URL` est utilisé uniquement pour construire les URLs absolues des photos de profil et des fichiers CV (qui ne passent pas par le proxy axios).
> En production, mettez-y l'URL publique de votre backend.

### 4. Configurer Google OAuth

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Identifiants
2. Créer un identifiant OAuth 2.0 (type "Application Web")
3. URI de redirection autorisée : `http://localhost:5000/api/auth/google/callback`
4. Copier le Client ID et Client Secret dans le `.env` du backend

### 5. Configurer Gemini AI (optionnel)

1. Aller sur [Google AI Studio](https://aistudio.google.com/) → Get API key
2. Copier la clé dans le `.env` du backend : `GEMINI_API_KEY=your_key`
3. Sans cette clé, l'extraction de compétences bascule automatiquement sur le référentiel local (`skillsReference.js`) — aucune fonctionnalité ne casse.

## Variables d'environnement

### `backend/.env`

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DATABASE_URL="postgresql://user:password@localhost:5432/recrutement_ia?schema=public"

JWT_SECRET=change_this_secret_key
JWT_EXPIRES_IN=7d

SESSION_SECRET=change_this_session_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Gemini AI (optionnel — fallback sur skillsReference.js si absent)
GEMINI_API_KEY=your_gemini_api_key

# SMTP (optionnel — si absent, les liens de réinitialisation s'affichent dans la console)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM="Plateforme IA Recrutement <no-reply@example.com>"
```

### `frontend/.env`

```env
VITE_API_URL=http://localhost:5000
```

## Fonctionnement de l'extraction de compétences IA

L'extraction suit une logique en deux niveaux :

1. **Gemini AI** (si `GEMINI_API_KEY` est défini) — le modèle `gemini-1.5-flash` analyse le texte brut du CV et retourne directement un tableau JSON de compétences normalisées, sans être limité à un référentiel prédéfini.
2. **Fallback référentiel** (si la clé est absente ou si l'appel Gemini échoue) — comparaison du texte au référentiel `skillsReference.js` (150+ compétences sur 13 domaines) avec gestion des synonymes et vérification de frontière de mot pour éviter les faux positifs.

Le client Gemini est instancié de façon paresseuse (uniquement au moment de l'appel) pour ne pas bloquer le démarrage du serveur si la clé est manquante.

## Fonctionnement du matching IA

1. **Upload du CV** (PDF/DOCX) → extraction du texte brut (`pdf-parse` / `mammoth`)
2. **Extraction des compétences** → Gemini AI ou fallback référentiel (voir ci-dessus)
3. **Scoring** → à la candidature, comparaison des compétences du CV avec celles requises par l'offre :
   - Score de base = (compétences communes / compétences requises) × 100
   - Bonus jusqu'à +10 pts pour les compétences supplémentaires du candidat
4. Le recruteur visualise ses candidatures **triées automatiquement par score décroissant**

## Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| `CANDIDAT` | Upload CV, postuler aux offres, messagerie, profil |
| `RECRUTEUR` | Publier/gérer des offres, voir les candidatures classées par IA, messagerie, statistiques |
| `ADMIN` | Tout ce qui précède + gestion des comptes utilisateurs, statistiques globales |

## Fonctionnalités principales

- Authentification email/mot de passe + Google OAuth 2.0
- Réinitialisation de mot de passe par email (token SHA-256, expiration 1h)
- Upload et analyse automatique de CV (PDF/DOCX) — extraction de compétences par Gemini AI avec fallback référentiel
- Coordonnées extraites du CV (email, téléphone) affichées automatiquement sans action manuelle
- Matching CV ↔ offre avec score en pourcentage
- Messagerie temps réel (Socket.io) avec pièces jointes (images, fichiers)
- Édition et suppression de ses propres messages en temps réel
- Notifications de messages non lus en temps réel
- Tableau de bord analytique (graphiques Recharts) pour recruteurs et admins
- Gestion des comptes utilisateurs (activation/désactivation, suppression) par l'admin
