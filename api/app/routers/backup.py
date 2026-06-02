"""
Sauvegarde & restauration de toutes les données de l'application.

Toutes les données (contrats, académique, enseignants, paramètres, utilisateurs)
vivent dans une unique base SQLite. La sauvegarde la plus fidèle et la plus
simple à restaurer consiste donc à exporter / importer ce fichier complet.

- GET  /backup/export : télécharge une copie cohérente de la base (.db).
- POST /backup/import : remplace TOUTES les données par celles d'un fichier .db
                        de sauvegarde préalablement validé.
"""

import io
import os
import sqlite3
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import text

from app.database import engine
from app.models import User
from app.security import require_admin

router = APIRouter(prefix="/backup", tags=["backup"])

# Tables qui DOIVENT être présentes dans un fichier de sauvegarde valide.
REQUIRED_TABLES = {
    "users",
    "niveaux",
    "classes",
    "semestres",
    "ecues",
    "enseignants",
    "contracts",
    "settings",
}


def _sqlite_file_path() -> str:
    """Chemin du fichier SQLite derrière l'engine courant.

    L'URL est de la forme « sqlite:////chemin/abs/enastic.db » ou
    « sqlite:///chemin/relatif.db ».
    """
    url = engine.url
    if url.get_backend_name() != "sqlite":
        raise HTTPException(
            status_code=400,
            detail="La sauvegarde n'est disponible que pour une base SQLite locale.",
        )
    db_path = url.database
    if not db_path:
        raise HTTPException(status_code=500, detail="Chemin de la base introuvable.")
    return db_path


def _validate_sqlite_backup(path: str) -> None:
    """Vérifie que `path` est un vrai fichier SQLite contenant nos tables."""
    try:
        con = sqlite3.connect(path)
    except sqlite3.Error:
        raise HTTPException(status_code=400, detail="Fichier illisible.")
    try:
        # 1) Intégrité du fichier SQLite.
        try:
            ok = con.execute("PRAGMA integrity_check").fetchone()
        except sqlite3.DatabaseError:
            raise HTTPException(
                status_code=400,
                detail="Ce fichier n'est pas une sauvegarde ENASTIC valide (format SQLite attendu).",
            )
        if not ok or ok[0] != "ok":
            raise HTTPException(status_code=400, detail="Fichier de sauvegarde corrompu.")

        # 2) Présence des tables attendues.
        rows = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        tables = {r[0] for r in rows}
        missing = REQUIRED_TABLES - tables
        if missing:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Ce fichier ne ressemble pas à une sauvegarde ENASTIC "
                    f"(tables manquantes : {', '.join(sorted(missing))})."
                ),
            )
    finally:
        con.close()


@router.get("/export")
def export_backup(_admin: User = Depends(require_admin)) -> StreamingResponse:
    """Télécharge une copie cohérente de toute la base de données."""
    db_path = _sqlite_file_path()
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Base de données introuvable.")

    # Copie cohérente via l'API de sauvegarde SQLite (même si l'app est utilisée).
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
    os.close(tmp_fd)
    try:
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(tmp_path)
        try:
            with dst:
                src.backup(dst)
        finally:
            dst.close()
            src.close()
        with open(tmp_path, "rb") as f:
            data = f.read()
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    headers = {
        "Content-Disposition": 'attachment; filename="enastic-sauvegarde.db"'
    }
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/octet-stream",
        headers=headers,
    )


@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    _admin: User = Depends(require_admin),
) -> dict:
    """Remplace TOUTES les données par celles d'un fichier de sauvegarde.

    Le fichier est d'abord validé (format SQLite + tables ENASTIC) ; ce n'est
    qu'ensuite que la base en service est écrasée, via l'API de sauvegarde
    SQLite (copie du fichier importé vers la base ouverte). Après cela, un
    redémarrage de l'application est recommandé.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Fichier vide.")

    # 1) Écrire le contenu importé dans un fichier temporaire, puis le valider.
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(content)
        _validate_sqlite_backup(tmp_path)

        # 2) Copier la sauvegarde validée DANS la base en service.
        #    On passe par la connexion SQLite brute de l'engine pour écraser
        #    proprement le contenu de la base ouverte.
        raw = engine.raw_connection()
        try:
            live = raw.driver_connection  # sqlite3.Connection sous-jacente
            src = sqlite3.connect(tmp_path)
            try:
                src.backup(live)
                live.commit()
            finally:
                src.close()
        finally:
            raw.close()
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    # 3) Invalider les sessions en cache pour que les nouvelles données soient vues.
    engine.dispose()

    return {
        "status": "ok",
        "message": "Sauvegarde restaurée. Veuillez redémarrer l'application pour finaliser.",
    }
