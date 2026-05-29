import csv
import io
from typing import Iterable

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Classe, Ecue, Enseignant, Niveau, Semestre
from app.schemas import ImportResult
from app.security import require_admin

router = APIRouter(prefix="/import", tags=["imports"])


# ─── Lecture polymorphique CSV / XLSX ─────────────────────────────────────────


def _read_csv(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return [{(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in reader]


def _read_xlsx(content: bytes) -> list[dict]:
    wb = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    if ws is None:
        return []
    rows: list[dict] = []
    headers: list[str] = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        cells = [("" if v is None else str(v)).strip() for v in row]
        if i == 0:
            headers = [h.lower() for h in cells]
            continue
        if not any(cells):
            continue
        rows.append({headers[j]: cells[j] for j in range(min(len(headers), len(cells)))})
    return rows


def _read_upload(file: UploadFile) -> list[dict]:
    filename = (file.filename or "").lower()
    content = file.file.read()
    if filename.endswith(".xlsx"):
        return _read_xlsx(content)
    if filename.endswith(".csv"):
        return _read_csv(content)
    raise HTTPException(status_code=400, detail="Format non supporté (utilisez .csv ou .xlsx)")


# ─── Endpoints d'import ───────────────────────────────────────────────────────


@router.post("/enseignants", response_model=ImportResult)
def import_enseignants(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
) -> ImportResult:
    """Colonnes attendues : nom_complet, grade."""
    rows = _read_upload(file)
    created = updated = skipped = 0
    errors: list[str] = []

    for i, row in enumerate(rows, start=2):
        nom = row.get("nom_complet") or row.get("nom") or ""
        grade = row.get("grade") or ""
        if not nom or not grade:
            errors.append(f"Ligne {i}: nom_complet et grade requis")
            skipped += 1
            continue

        existing = db.query(Enseignant).filter(Enseignant.nom_complet == nom).first()
        if existing:
            existing.grade = grade
            updated += 1
        else:
            db.add(Enseignant(nom_complet=nom, grade=grade))
            created += 1

    db.commit()
    return ImportResult(created=created, updated=updated, skipped=skipped, errors=errors)


@router.post("/academic", response_model=ImportResult)
def import_academic(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
) -> ImportResult:
    """
    Import hiérarchique des données académiques.

    Colonnes attendues :
        niveau, classe, semestre, ecue, heures_cm, heures_td, heures_tp
    """
    rows = _read_upload(file)
    created = updated = skipped = 0
    errors: list[str] = []

    niveaux_cache: dict[str, Niveau] = {}
    classes_cache: dict[tuple[int, str], Classe] = {}
    semestres_cache: dict[str, Semestre] = {}

    for i, row in enumerate(rows, start=2):
        niveau_nom = row.get("niveau", "")
        classe_nom = row.get("classe", "")
        semestre_nom = row.get("semestre", "")
        ecue_nom = row.get("ecue") or row.get("intitule") or ""

        if not all([niveau_nom, classe_nom, semestre_nom, ecue_nom]):
            errors.append(f"Ligne {i}: niveau/classe/semestre/ecue requis")
            skipped += 1
            continue

        niveau = niveaux_cache.get(niveau_nom)
        if not niveau:
            niveau = db.query(Niveau).filter(Niveau.nom == niveau_nom).first()
            if not niveau:
                niveau = Niveau(nom=niveau_nom)
                db.add(niveau)
                db.flush()
            niveaux_cache[niveau_nom] = niveau

        classe_key = (niveau.id, classe_nom)
        classe = classes_cache.get(classe_key)
        if not classe:
            classe = (
                db.query(Classe)
                .filter(Classe.niveau_id == niveau.id, Classe.nom == classe_nom)
                .first()
            )
            if not classe:
                classe = Classe(nom=classe_nom, niveau_id=niveau.id)
                db.add(classe)
                db.flush()
            classes_cache[classe_key] = classe

        semestre = semestres_cache.get(semestre_nom)
        if not semestre:
            semestre = db.query(Semestre).filter(Semestre.nom == semestre_nom).first()
            if not semestre:
                semestre = Semestre(nom=semestre_nom)
                db.add(semestre)
                db.flush()
            semestres_cache[semestre_nom] = semestre

        def _int(field: str) -> int:
            try:
                return max(0, min(99, int(row.get(field, "0") or 0)))
            except ValueError:
                return 0

        heures_cm = _int("heures_cm")
        heures_td = _int("heures_td")
        heures_tp = _int("heures_tp")

        existing_ecue = (
            db.query(Ecue)
            .filter(
                Ecue.intitule == ecue_nom,
                Ecue.classe_id == classe.id,
                Ecue.semestre_id == semestre.id,
            )
            .first()
        )
        if existing_ecue:
            existing_ecue.heures_cm_defaut = heures_cm
            existing_ecue.heures_td_defaut = heures_td
            existing_ecue.heures_tp_defaut = heures_tp
            updated += 1
        else:
            db.add(
                Ecue(
                    intitule=ecue_nom,
                    classe_id=classe.id,
                    semestre_id=semestre.id,
                    heures_cm_defaut=heures_cm,
                    heures_td_defaut=heures_td,
                    heures_tp_defaut=heures_tp,
                )
            )
            created += 1

    db.commit()
    return ImportResult(created=created, updated=updated, skipped=skipped, errors=errors)


# ─── Téléchargement de modèles ────────────────────────────────────────────────


TEMPLATES: dict[str, dict] = {
    "enseignants": {
        "headers": ["nom_complet", "grade"],
        "sample": [
            ["Dr CHARFADINE MAHAMAT", "Maître Assistant"],
            ["Dr HAGGAR BACHAR SALIM", "Professeur"],
            ["MOUKHTAR HASSAN MAHAMAT", "Maître de Conférences"],
        ],
    },
    "academic": {
        "headers": ["niveau", "classe", "semestre", "ecue", "heures_cm", "heures_td", "heures_tp"],
        "sample": [
            ["L1", "Informatique", "Semestre 1", "Introduction à l'algorithmique", "20", "10", "5"],
            ["L2", "Informatique", "Semestre 3", "Bases de données relationnelles", "15", "8", "12"],
            ["L3", "Informatique", "Semestre 5", "Réseaux et protocoles", "18", "6", "10"],
            ["M1", "Informatique", "Semestre 1", "Génie logiciel avancé", "14", "8", "6"],
        ],
    },
}


def _csv_template(template: dict) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(template["headers"])
    for row in template["sample"]:
        writer.writerow(row)
    return buf.getvalue().encode("utf-8")


def _xlsx_template(template: dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Modèle"
    ws.append(template["headers"])
    for row in template["sample"]:
        ws.append(row)
    # Largeur automatique des colonnes
    for col_idx, header in enumerate(template["headers"], start=1):
        ws.column_dimensions[chr(64 + col_idx)].width = max(15, len(header) + 4)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


@router.get("/template/{kind}.{fmt}")
def download_template(
    kind: str,
    fmt: str,
    _=Depends(require_admin),
) -> StreamingResponse:
    """Télécharge un modèle CSV ou XLSX (kind: enseignants | academic ; fmt: csv | xlsx)."""
    if kind not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Type de modèle inconnu")
    template = TEMPLATES[kind]
    if fmt == "csv":
        content = _csv_template(template)
        media = "text/csv"
        filename = f"modele_{kind}.csv"
    elif fmt == "xlsx":
        content = _xlsx_template(template)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"modele_{kind}.xlsx"
    else:
        raise HTTPException(status_code=400, detail="Format invalide (csv ou xlsx)")

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
