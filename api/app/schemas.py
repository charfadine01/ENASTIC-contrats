from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ─── Auth & Users ─────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    full_name: str | None
    role: str
    is_active: bool
    created_at: datetime
    last_login: datetime | None


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=6, max_length=255)
    full_name: str | None = None
    role: str = Field(default="enseignant", pattern="^(admin|enseignant)$")
    is_active: bool = True


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role: str | None = Field(default=None, pattern="^(admin|enseignant)$")
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=255)


class ProfileUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=6, max_length=255)


# ─── Academic data ────────────────────────────────────────────────────────────

class NiveauBase(BaseModel):
    nom: str = Field(min_length=1, max_length=32)
    ordre: int = 0


class NiveauCreate(NiveauBase):
    pass


class NiveauOut(NiveauBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ClasseBase(BaseModel):
    nom: str = Field(min_length=1, max_length=128)
    niveau_id: int


class ClasseCreate(ClasseBase):
    pass


class ClasseOut(ClasseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SemestreBase(BaseModel):
    nom: str = Field(min_length=1, max_length=64)
    ordre: int = 0


class SemestreCreate(SemestreBase):
    pass


class SemestreOut(SemestreBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class EcueBase(BaseModel):
    intitule: str = Field(min_length=1, max_length=255)
    classe_id: int
    semestre_id: int
    heures_cm_defaut: int = Field(default=0, ge=0, le=99)
    heures_td_defaut: int = Field(default=0, ge=0, le=99)
    heures_tp_defaut: int = Field(default=0, ge=0, le=99)


class EcueCreate(EcueBase):
    pass


class EcueOut(EcueBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class EnseignantBase(BaseModel):
    nom_complet: str = Field(min_length=1, max_length=255)
    grade: str = Field(min_length=1, max_length=128)


class EnseignantCreate(EnseignantBase):
    pass


class EnseignantOut(EnseignantBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ─── Contracts ────────────────────────────────────────────────────────────────

class EcueInput(BaseModel):
    intitule: str = Field(min_length=1, max_length=255)
    heures_cm: int = Field(ge=0, le=99)
    heures_td: int = Field(ge=0, le=99)
    heures_tp: int = Field(ge=0, le=99)
    niveau: str
    classe: str
    semestre: str


class ContractGenerateRequest(BaseModel):
    nom_enseignant: str = Field(min_length=1, max_length=255)
    grade: str
    annee: int = Field(ge=2000, le=2100)
    annee_academique: str = Field(pattern=r"^\d{4}-\d{4}$")
    directeur_general: str | None = None
    arrete: str | None = None
    ecues: list[EcueInput] = Field(min_length=1)


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    teacher_name: str
    teacher_grade: str
    academic_year: str
    year: int
    filename: str
    pdf_filename: str | None
    ecue_count: int
    created_at: datetime


class ContractGenerateResponse(BaseModel):
    contract: ContractOut
    download_url: str
    pdf_download_url: str | None


# ─── Import ───────────────────────────────────────────────────────────────────

class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


# ─── Settings ─────────────────────────────────────────────────────────────────

class SettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: str
    label: str
    description: str | None


class SettingUpdate(BaseModel):
    value: str
