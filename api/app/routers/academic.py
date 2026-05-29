from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Classe, Ecue, Enseignant, Niveau, Semestre
from app.schemas import (
    ClasseCreate,
    ClasseOut,
    EcueCreate,
    EcueOut,
    EnseignantCreate,
    EnseignantOut,
    NiveauCreate,
    NiveauOut,
    SemestreCreate,
    SemestreOut,
)
from app.security import get_current_user, require_admin

router = APIRouter(tags=["academic"])


# ─── Niveaux ──────────────────────────────────────────────────────────────────

@router.get("/niveaux", response_model=list[NiveauOut])
def list_niveaux(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Niveau).order_by(Niveau.ordre, Niveau.nom).all()


@router.post("/niveaux", response_model=NiveauOut, status_code=status.HTTP_201_CREATED)
def create_niveau(payload: NiveauCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    niveau = Niveau(**payload.model_dump())
    db.add(niveau)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Niveau déjà existant")
    db.refresh(niveau)
    return niveau


@router.put("/niveaux/{niveau_id}", response_model=NiveauOut)
def update_niveau(
    niveau_id: int, payload: NiveauCreate, db: Session = Depends(get_db), _=Depends(require_admin)
):
    niveau = db.query(Niveau).filter(Niveau.id == niveau_id).first()
    if not niveau:
        raise HTTPException(status_code=404, detail="Niveau introuvable")
    for k, v in payload.model_dump().items():
        setattr(niveau, k, v)
    db.commit()
    db.refresh(niveau)
    return niveau


@router.delete("/niveaux/{niveau_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_niveau(niveau_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    niveau = db.query(Niveau).filter(Niveau.id == niveau_id).first()
    if not niveau:
        raise HTTPException(status_code=404, detail="Niveau introuvable")
    db.delete(niveau)
    db.commit()


# ─── Classes ──────────────────────────────────────────────────────────────────

@router.get("/classes", response_model=list[ClasseOut])
def list_classes(
    niveau_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(Classe)
    if niveau_id is not None:
        query = query.filter(Classe.niveau_id == niveau_id)
    return query.order_by(Classe.nom).all()


@router.post("/classes", response_model=ClasseOut, status_code=status.HTTP_201_CREATED)
def create_classe(payload: ClasseCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if not db.query(Niveau).filter(Niveau.id == payload.niveau_id).first():
        raise HTTPException(status_code=400, detail="Niveau parent introuvable")
    classe = Classe(**payload.model_dump())
    db.add(classe)
    db.commit()
    db.refresh(classe)
    return classe


@router.put("/classes/{classe_id}", response_model=ClasseOut)
def update_classe(
    classe_id: int, payload: ClasseCreate, db: Session = Depends(get_db), _=Depends(require_admin)
):
    classe = db.query(Classe).filter(Classe.id == classe_id).first()
    if not classe:
        raise HTTPException(status_code=404, detail="Classe introuvable")
    for k, v in payload.model_dump().items():
        setattr(classe, k, v)
    db.commit()
    db.refresh(classe)
    return classe


@router.delete("/classes/{classe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_classe(classe_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    classe = db.query(Classe).filter(Classe.id == classe_id).first()
    if not classe:
        raise HTTPException(status_code=404, detail="Classe introuvable")
    db.delete(classe)
    db.commit()


# ─── Semestres ────────────────────────────────────────────────────────────────

@router.get("/semestres", response_model=list[SemestreOut])
def list_semestres(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Semestre).order_by(Semestre.ordre, Semestre.nom).all()


@router.post("/semestres", response_model=SemestreOut, status_code=status.HTTP_201_CREATED)
def create_semestre(payload: SemestreCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    semestre = Semestre(**payload.model_dump())
    db.add(semestre)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Semestre déjà existant")
    db.refresh(semestre)
    return semestre


@router.put("/semestres/{semestre_id}", response_model=SemestreOut)
def update_semestre(
    semestre_id: int,
    payload: SemestreCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    semestre = db.query(Semestre).filter(Semestre.id == semestre_id).first()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre introuvable")
    for k, v in payload.model_dump().items():
        setattr(semestre, k, v)
    db.commit()
    db.refresh(semestre)
    return semestre


@router.delete("/semestres/{semestre_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_semestre(semestre_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    semestre = db.query(Semestre).filter(Semestre.id == semestre_id).first()
    if not semestre:
        raise HTTPException(status_code=404, detail="Semestre introuvable")
    db.delete(semestre)
    db.commit()


# ─── ECUEs ────────────────────────────────────────────────────────────────────

@router.get("/ecues", response_model=list[EcueOut])
def list_ecues(
    classe_id: int | None = None,
    semestre_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(Ecue)
    if classe_id is not None:
        query = query.filter(Ecue.classe_id == classe_id)
    if semestre_id is not None:
        query = query.filter(Ecue.semestre_id == semestre_id)
    return query.order_by(Ecue.intitule).all()


@router.post("/ecues", response_model=EcueOut, status_code=status.HTTP_201_CREATED)
def create_ecue(payload: EcueCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if not db.query(Classe).filter(Classe.id == payload.classe_id).first():
        raise HTTPException(status_code=400, detail="Classe parent introuvable")
    if not db.query(Semestre).filter(Semestre.id == payload.semestre_id).first():
        raise HTTPException(status_code=400, detail="Semestre parent introuvable")
    ecue = Ecue(**payload.model_dump())
    db.add(ecue)
    db.commit()
    db.refresh(ecue)
    return ecue


@router.put("/ecues/{ecue_id}", response_model=EcueOut)
def update_ecue(
    ecue_id: int, payload: EcueCreate, db: Session = Depends(get_db), _=Depends(require_admin)
):
    ecue = db.query(Ecue).filter(Ecue.id == ecue_id).first()
    if not ecue:
        raise HTTPException(status_code=404, detail="ECUE introuvable")
    for k, v in payload.model_dump().items():
        setattr(ecue, k, v)
    db.commit()
    db.refresh(ecue)
    return ecue


@router.delete("/ecues/{ecue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ecue(ecue_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    ecue = db.query(Ecue).filter(Ecue.id == ecue_id).first()
    if not ecue:
        raise HTTPException(status_code=404, detail="ECUE introuvable")
    db.delete(ecue)
    db.commit()


# ─── Enseignants ──────────────────────────────────────────────────────────────

@router.get("/enseignants", response_model=list[EnseignantOut])
def list_enseignants(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Enseignant).order_by(Enseignant.nom_complet).all()


@router.post("/enseignants", response_model=EnseignantOut, status_code=status.HTTP_201_CREATED)
def create_enseignant(
    payload: EnseignantCreate, db: Session = Depends(get_db), _=Depends(require_admin)
):
    enseignant = Enseignant(**payload.model_dump())
    db.add(enseignant)
    db.commit()
    db.refresh(enseignant)
    return enseignant


@router.put("/enseignants/{enseignant_id}", response_model=EnseignantOut)
def update_enseignant(
    enseignant_id: int,
    payload: EnseignantCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    enseignant = db.query(Enseignant).filter(Enseignant.id == enseignant_id).first()
    if not enseignant:
        raise HTTPException(status_code=404, detail="Enseignant introuvable")
    for k, v in payload.model_dump().items():
        setattr(enseignant, k, v)
    db.commit()
    db.refresh(enseignant)
    return enseignant


@router.delete("/enseignants/{enseignant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enseignant(
    enseignant_id: int, db: Session = Depends(get_db), _=Depends(require_admin)
):
    enseignant = db.query(Enseignant).filter(Enseignant.id == enseignant_id).first()
    if not enseignant:
        raise HTTPException(status_code=404, detail="Enseignant introuvable")
    db.delete(enseignant)
    db.commit()
