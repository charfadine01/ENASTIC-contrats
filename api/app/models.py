from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text  # noqa: F401
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="enseignant", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)

    contracts: Mapped[list["Contract"]] = relationship(back_populates="user")


class Niveau(Base):
    __tablename__ = "niveaux"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    ordre: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    classes: Mapped[list["Classe"]] = relationship(back_populates="niveau", cascade="all, delete-orphan")


class Classe(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(128), nullable=False)
    niveau_id: Mapped[int] = mapped_column(ForeignKey("niveaux.id", ondelete="CASCADE"), nullable=False)

    niveau: Mapped["Niveau"] = relationship(back_populates="classes")
    ecues: Mapped[list["Ecue"]] = relationship(back_populates="classe", cascade="all, delete-orphan")


class Semestre(Base):
    __tablename__ = "semestres"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    ordre: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    ecues: Mapped[list["Ecue"]] = relationship(back_populates="semestre")


class Ecue(Base):
    __tablename__ = "ecues"

    id: Mapped[int] = mapped_column(primary_key=True)
    intitule: Mapped[str] = mapped_column(String(255), nullable=False)
    classe_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    semestre_id: Mapped[int] = mapped_column(ForeignKey("semestres.id"), nullable=False)
    heures_cm_defaut: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    heures_td_defaut: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    heures_tp_defaut: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    classe: Mapped["Classe"] = relationship(back_populates="ecues")
    semestre: Mapped["Semestre"] = relationship(back_populates="ecues")


class Enseignant(Base):
    __tablename__ = "enseignants"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom_complet: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    grade: Mapped[str] = mapped_column(String(128), nullable=False)


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("enseignants.id"))
    teacher_name: Mapped[str] = mapped_column(String(255), nullable=False)
    teacher_grade: Mapped[str] = mapped_column(String(128), nullable=False)
    academic_year: Mapped[str] = mapped_column(String(16), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    pdf_filename: Mapped[str | None] = mapped_column(String(512))
    ecue_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    contract_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="contracts")


class Setting(Base):
    """Paramètres globaux clé/valeur de l'application (admin only)."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="", nullable=False)
    label: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
