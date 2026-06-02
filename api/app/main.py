import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import (
    academic,
    auth,
    backup,
    contracts,
    imports,
    settings as settings_router,
    stats,
    users,
)
from app.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _ensure_admin() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == settings.admin_username).first()
        if not existing:
            admin = User(
                username=settings.admin_username,
                email=settings.admin_email,
                password_hash=hash_password(settings.admin_password),
                full_name="Administrateur",
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            logger.info("Compte admin initial créé: %s", settings.admin_username)

        # Initialiser les paramètres globaux
        settings_router.ensure_default_settings(db)
    finally:
        db.close()


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)
    _ensure_admin()

    app = FastAPI(title="ENASTIC Contrats API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(contracts.router)
    app.include_router(academic.router)
    app.include_router(users.router)
    app.include_router(imports.router)
    app.include_router(settings_router.router)
    app.include_router(backup.router)
    app.include_router(stats.router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
