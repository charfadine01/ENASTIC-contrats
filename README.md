# ENASTIC Contrats — Desktop (Tauri)

Application Desktop de gestion des contrats de vacations ENASTIC, portée depuis l'application Flask existante. Architecture en trois tiers prête pour un déploiement serveur ultérieur.

## Architecture

```
desktop/   → App Tauri 2 (React + TypeScript + Tailwind v4)
api/       → API REST FastAPI (Python) — réutilise la génération DOCX/PDF
docker-compose.yml → PostgreSQL 16 + pgAdmin
```

L'app Desktop **n'embarque pas** la base de données : elle parle à l'API via HTTP. Pour passer en mode serveur, il suffira de changer la variable `VITE_API_BASE_URL` (et déployer l'API + Postgres sur un serveur distant).

## Prérequis

- **Docker Desktop** (pour PostgreSQL)
- **Python 3.11+**
- **Node.js 20+** et **npm**
- **Rust + Cargo** (`rustup default stable`)
- **LibreOffice** (optionnel, pour la conversion DOCX → PDF)

## Démarrage MVP

### 1. Lancer la base de données

```bash
docker compose up -d
```

PostgreSQL : `localhost:5432` · pgAdmin : http://localhost:5050 (`admin@enastic.local` / `admin`).

### 2. Démarrer l'API

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # éditer SECRET_KEY et ADMIN_PASSWORD
uvicorn app.main:app --reload --port 8000
```

L'API crée automatiquement un compte admin au premier lancement (identifiants depuis `.env`). Doc OpenAPI : http://localhost:8000/docs.

### 3. Lancer l'app Desktop

```bash
cd desktop
npm run tauri dev
```

Au premier lancement, Cargo compile les dépendances Tauri (~5 minutes). Ensuite, démarrage instantané.

## Endpoints MVP disponibles

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Login, retourne JWT |
| GET | `/auth/me` | Utilisateur courant |
| POST | `/contracts/generate` | Génère un contrat DOCX + PDF |
| GET | `/contracts` | Liste les contrats de l'utilisateur |
| GET | `/contracts/{id}/download?format=docx\|pdf` | Téléchargement |
| DELETE | `/contracts/{id}` | Suppression |

## Roadmap post-MVP

- CRUD admin : niveaux, classes, semestres, ECUEs, enseignants
- Import CSV/Excel des données académiques
- Gestion des utilisateurs (admin)
- Profil utilisateur (changement de mot de passe)
- Migrations Alembic (à la place de `create_all`)
- Tests d'intégration (pytest + Playwright)
- Build de l'app pour macOS/Windows/Linux (`npm run tauri build`)
