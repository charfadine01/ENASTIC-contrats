import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.document_generator import ContractGenerator, DocumentGeneratorError
from app.models import Contract, User
from app.routers.settings import get_setting
from app.schemas import ContractGenerateRequest, ContractGenerateResponse, ContractOut
from app.security import get_current_user

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _generator() -> ContractGenerator:
    try:
        return ContractGenerator(settings.template_path, settings.contracts_dir)
    except DocumentGeneratorError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/generate", response_model=ContractGenerateResponse)
def generate_contract(
    payload: ContractGenerateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ContractGenerateResponse:
    # Si DG/arrêté non fournis dans la requête, lire les valeurs paramétrées
    directeur_general = payload.directeur_general or get_setting(
        db, "directeur_general", "Dr HAGGAR BACHAR SALIM"
    )
    arrete = payload.arrete or get_setting(db, "arrete", "052/PM/2000")

    data = {
        "nom_enseignant": payload.nom_enseignant,
        "grade": payload.grade,
        "annee": payload.annee,
        "annee_academique": payload.annee_academique,
        "directeur_general": directeur_general,
        "arrete": arrete,
        "ecues": [e.model_dump() for e in payload.ecues],
    }

    gen = _generator()
    result = gen.generate(data)

    contract = Contract(
        uuid=result["uuid"],
        user_id=current.id,
        teacher_name=payload.nom_enseignant,
        teacher_grade=payload.grade,
        academic_year=payload.annee_academique,
        year=payload.annee,
        filename=result["docx_filename"],
        pdf_filename=result["pdf_filename"],
        ecue_count=len(payload.ecues),
        contract_metadata={
            "verification_hash": result["verification_hash"],
            "display_filename": result["display_filename"],
            "ecues": data["ecues"],
            "directeur_general": directeur_general,
            "arrete": arrete,
        },
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    return ContractGenerateResponse(
        contract=ContractOut.model_validate(contract),
        download_url=f"/contracts/{contract.id}/download",
        pdf_download_url=f"/contracts/{contract.id}/download?format=pdf" if contract.pdf_filename else None,
    )


@router.get("/{contract_id}/full")
def get_contract_full(
    contract_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    """Retourne le contrat avec les metadata (ECUEs, DG, arrêté) pour pré-remplir
    le formulaire lors d'une édition."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    if current.role != "admin" and contract.user_id != current.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return {
        "id": contract.id,
        "uuid": contract.uuid,
        "teacher_name": contract.teacher_name,
        "teacher_grade": contract.teacher_grade,
        "academic_year": contract.academic_year,
        "year": contract.year,
        "ecue_count": contract.ecue_count,
        "metadata": contract.contract_metadata or {},
    }


@router.get("", response_model=list[ContractOut])
def list_contracts(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[Contract]:
    query = db.query(Contract).order_by(Contract.created_at.desc())
    if current.role != "admin":
        query = query.filter(Contract.user_id == current.id)
    return query.all()


@router.get("/{contract_id}/download")
def download_contract(
    contract_id: int,
    format: str = "docx",
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> FileResponse:
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    if current.role != "admin" and contract.user_id != current.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    if format == "pdf":
        if not contract.pdf_filename:
            raise HTTPException(status_code=404, detail="PDF non disponible pour ce contrat")
        filename = contract.pdf_filename
        media_type = "application/pdf"
    else:
        filename = contract.filename
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    path = os.path.join(settings.contracts_dir, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Fichier introuvable sur disque")

    display = contract.contract_metadata.get("display_filename") if contract.contract_metadata else filename
    if format == "pdf" and display:
        display = display.replace(".docx", ".pdf")

    return FileResponse(path, media_type=media_type, filename=display or filename)


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    if current.role != "admin" and contract.user_id != current.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    for fname in (contract.filename, contract.pdf_filename):
        if fname:
            fpath = os.path.join(settings.contracts_dir, fname)
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
            except OSError:
                pass

    db.delete(contract)
    db.commit()
