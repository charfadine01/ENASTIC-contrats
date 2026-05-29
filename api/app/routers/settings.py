from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Setting, User
from app.schemas import SettingOut, SettingUpdate
from app.security import get_current_user, require_admin

router = APIRouter(prefix="/settings", tags=["settings"])


# Paramètres par défaut créés au premier démarrage
DEFAULT_SETTINGS: list[dict] = [
    {
        "key": "directeur_general",
        "value": "Dr HAGGAR BACHAR SALIM",
        "label": "Nom du Directeur Général",
        "description": "Apparaît dans la zone de signature de tous les contrats.",
    },
    {
        "key": "arrete",
        "value": "052/PM/2000",
        "label": "Numéro de l'arrêté",
        "description": "Référence légale citée à l'Article 3 des contrats.",
    },
    {
        "key": "annee_academique_defaut",
        "value": "2025-2026",
        "label": "Année académique par défaut",
        "description": "Pré-remplit le champ année académique dans le formulaire de nouveau contrat.",
    },
    {
        "key": "etablissement_nom",
        "value": "ENASTIC",
        "label": "Nom court de l'établissement",
        "description": "Apparaît dans les titres et l'en-tête de l'application.",
    },
    {
        "key": "etablissement_libelle",
        "value": "Ecole Nationale Supérieure des Technologies de l'Information et de la Communication",
        "label": "Libellé complet de l'établissement",
        "description": "Utilisé dans la zone de signature des contrats.",
    },
    {
        "key": "dossier_telechargement_defaut",
        "value": "",
        "label": "Dossier de téléchargement par défaut",
        "description": "Chemin où les contrats téléchargés sont enregistrés directement (laisser vide pour utiliser le dossier Téléchargements du système). Le bouton « Télécharger sous… » permet toujours de choisir un autre emplacement à la volée.",
    },
]


def ensure_default_settings(db: Session) -> None:
    """Crée les paramètres manquants au démarrage de l'API."""
    for default in DEFAULT_SETTINGS:
        existing = db.query(Setting).filter(Setting.key == default["key"]).first()
        if existing:
            # Mettre à jour label/description (mais pas la valeur configurée par l'admin)
            existing.label = default["label"]
            existing.description = default["description"]
        else:
            db.add(Setting(**default))
    db.commit()


def get_setting(db: Session, key: str, default: str = "") -> str:
    """Helper pour lire une valeur de paramètre depuis le code."""
    s = db.query(Setting).filter(Setting.key == key).first()
    return s.value if s else default


@router.get("", response_model=list[SettingOut])
def list_settings(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[Setting]:
    """Tous les utilisateurs authentifiés peuvent lire les paramètres
    (pour pré-remplir les formulaires avec les valeurs courantes)."""
    return db.query(Setting).order_by(Setting.key).all()


@router.put("/{key}", response_model=SettingOut)
def update_setting(
    key: str,
    payload: SettingUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> Setting:
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Paramètre introuvable")
    setting.value = payload.value
    setting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(setting)
    return setting
