# Migration SQLite → PostgreSQL

L'API fonctionne **par défaut sur SQLite** (fichier local) pour un usage mono-poste. Quand vous serez prêt à passer en multi-utilisateurs sur serveur, voici comment basculer vers PostgreSQL **sans perdre les données existantes**.

## Pourquoi migrer ?

| Aspect | SQLite | PostgreSQL |
|---|---|---|
| Installation | Aucune | Docker ou serveur |
| Multi-utilisateurs simultanés | Non recommandé (lock) | Oui, des milliers |
| Sauvegarde | Copie du fichier `.db` | `pg_dump` + réplication |
| Réseau | Accès local uniquement | Accessible via TCP |
| Limite pratique | ~100 Mo de données | Téraoctets |

## Étape 1 — Démarrer PostgreSQL via Docker

```bash
cd /Users/drcharfadine/Desktop/C_V_S-ENASTIC-Desktop
docker compose up -d
```

Cela démarre :
- **PostgreSQL 16** sur `localhost:5432` (user: `enastic`, pwd: `enastic_dev_password`, db: `enastic_contrats`)
- **pgAdmin** sur http://localhost:5050 (`admin@enastic.local` / `admin`)

Vérifier :
```bash
docker compose ps
docker exec enastic_postgres pg_isready -U enastic
```

## Étape 2 — Exporter les données SQLite

L'API embarquée stocke sa BDD dans :
- **macOS** : `~/Library/Application Support/ENASTIC/enastic.db`
- **Windows** : `%APPDATA%/ENASTIC/enastic.db`
- **Linux** : `~/.local/share/ENASTIC/enastic.db`

Si vous lancez l'API en dev (uvicorn), la BDD est dans `api/enastic_dev.db`.

Lancer le script de migration fourni :
```bash
cd api
source .venv/bin/activate
python -m scripts.migrate_sqlite_to_postgres \
  --sqlite "~/Library/Application Support/ENASTIC/enastic.db" \
  --postgres "postgresql://enastic:enastic_dev_password@localhost:5432/enastic_contrats"
```

Le script :
1. Lit toutes les tables SQLite via SQLAlchemy
2. Crée le schéma PostgreSQL (via `Base.metadata.create_all`)
3. Copie toutes les lignes (users, niveaux, classes, semestres, ecues, enseignants, contracts) en préservant les IDs

## Étape 3 — Pointer l'API vers PostgreSQL

### Si vous lancez l'API en dev (uvicorn)

```bash
DATABASE_URL='postgresql://enastic:enastic_dev_password@localhost:5432/enastic_contrats' \
SECRET_KEY='votre_clef_secrete_de_minimum_32_caracteres' \
uvicorn app.main:app --port 8000
```

### Si vous utilisez l'app desktop (binaire embarqué)

Le binaire `enastic-api` lit `DATABASE_URL` depuis l'environnement. Sur macOS, vous pouvez créer un fichier de config user :

```bash
mkdir -p ~/Library/Application\ Support/ENASTIC
cat > ~/Library/Application\ Support/ENASTIC/.env <<EOF
DATABASE_URL=postgresql://enastic:enastic_dev_password@localhost:5432/enastic_contrats
SECRET_KEY=votre_clef_secrete_de_minimum_32_caracteres
EOF
```

Puis modifier `api/run_api.py` pour charger ce fichier au démarrage (déjà supporté via `python-dotenv` si vous décommentez le chargement).

## Étape 4 — Vérifier

```bash
# Tester l'auth
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Lister les contrats
TOKEN=...
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/contracts
```

## Étape 5 — Passer en production (serveur distant)

Déployer l'API + Postgres sur un serveur (VPS, Cloud Run, etc.), puis :

1. Build une nouvelle version de l'app Tauri pointant vers l'URL serveur :
   ```bash
   # Dans desktop/.env.production
   VITE_API_BASE_URL=https://api.enastic.td
   ```
2. **Retirer le sidecar** dans `tauri.conf.json` (supprimer `externalBin` et la logique de spawn dans `lib.rs`).
3. Rebuild : `npm run tauri:build` — l'app sera 10× plus légère (pas d'API embarquée).

## Rollback

Si vous voulez revenir à SQLite, il suffit de relancer l'API sans `DATABASE_URL` (ou avec `sqlite:///...`). Vos données SQLite sont intactes — la migration n'a fait que copier vers Postgres.
