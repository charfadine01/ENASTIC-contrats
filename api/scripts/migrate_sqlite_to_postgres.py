"""
Migration SQLite → PostgreSQL.

Usage :
    python -m scripts.migrate_sqlite_to_postgres \
        --sqlite "./enastic_dev.db" \
        --postgres "postgresql://enastic:enastic_dev_password@localhost:5432/enastic_contrats"
"""

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _expand(p: str) -> str:
    return str(Path(p).expanduser().resolve())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sqlite", required=True, help="Chemin du fichier SQLite source")
    parser.add_argument("--postgres", required=True, help="URL PostgreSQL destination")
    args = parser.parse_args()

    sqlite_path = _expand(args.sqlite)
    if not os.path.exists(sqlite_path):
        sys.exit(f"Fichier SQLite introuvable : {sqlite_path}")

    src_url = f"sqlite:///{sqlite_path}"
    dst_url = args.postgres

    # Charger les modèles depuis le projet (sans déclencher le démarrage de l'app)
    os.environ.setdefault("DATABASE_URL", dst_url)
    os.environ.setdefault("SECRET_KEY", "migration_temp_secret_32chars_padding_xxxx")

    from app.database import Base
    from app.models import Classe, Contract, Ecue, Enseignant, Niveau, Semestre, User

    src_engine = create_engine(src_url)
    dst_engine = create_engine(dst_url)

    print(f"→ Source  : {src_url}")
    print(f"→ Cible   : {dst_url}")
    print("→ Création du schéma cible…")
    Base.metadata.create_all(bind=dst_engine)

    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)
    src = SrcSession()
    dst = DstSession()

    # Ordre d'import respectant les FK
    ordered_models = [User, Niveau, Semestre, Classe, Enseignant, Ecue, Contract]
    for model in ordered_models:
        rows = src.query(model).all()
        print(f"  • {model.__tablename__}: {len(rows)} ligne(s)")
        for row in rows:
            # Extraire les colonnes
            data = {c.name: getattr(row, c.name) for c in model.__table__.columns}
            # Détacher de la session source
            new_row = model(**data)
            dst.merge(new_row)
        dst.commit()
        # Resynchroniser la séquence Postgres pour que les futurs INSERT n'entrent pas en collision
        if rows and dst_url.startswith("postgresql"):
            seq_name = f"{model.__tablename__}_id_seq"
            max_id = max(r.id for r in rows)
            try:
                dst.execute(
                    f"SELECT setval('{seq_name}', {max_id}, true);"  # nosec - identifiers maîtrisés
                )
                dst.commit()
            except Exception as exc:
                print(f"    ! impossible de resynchroniser {seq_name}: {exc}")

    src.close()
    dst.close()
    print("✓ Migration terminée.")


if __name__ == "__main__":
    main()
