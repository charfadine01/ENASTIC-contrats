"""
Point d'entrée standalone pour l'API ENASTIC packagée avec PyInstaller.
Démarre uvicorn sur 127.0.0.1:8000 avec une base SQLite locale
stockée dans le dossier utilisateur (~/Library/Application Support/ENASTIC sur macOS,
%APPDATA%/ENASTIC sur Windows).
"""

import os
import sys
from pathlib import Path


def _app_data_dir() -> Path:
    """Dossier writable pour la BDD et les contrats générés, multi-plateforme."""
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "ENASTIC"
    elif sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home())) / "ENASTIC"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "ENASTIC"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _bundled_resource(rel_path: str) -> str:
    """Retourne le chemin absolu d'une ressource embarquée par PyInstaller."""
    if hasattr(sys, "_MEIPASS"):
        return str(Path(sys._MEIPASS) / rel_path)
    return str(Path(__file__).parent / rel_path)


def main() -> None:
    data_dir = _app_data_dir()

    # Variables d'environnement pour l'app
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{data_dir / 'enastic.db'}")
    os.environ.setdefault(
        "SECRET_KEY",
        "enastic_default_secret_change_me_for_production_32chars",
    )
    os.environ.setdefault("CONTRACTS_DIR", str(data_dir / "contrats_generes"))
    os.environ.setdefault("TEMPLATE_PATH", _bundled_resource("template_contrat.docx"))
    os.environ.setdefault(
        "CORS_ORIGINS",
        "http://localhost:1420,tauri://localhost,http://tauri.localhost",
    )

    # Import après les env vars pour que settings les capte.
    # IMPORTANT : on passe l'objet app directement (pas la string "app.main:app")
    # car PyInstaller ne peut pas faire d'import dynamique au runtime.
    import uvicorn
    from app.main import app as fastapi_app

    uvicorn.run(
        fastapi_app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=False,
    )


if __name__ == "__main__":
    main()
