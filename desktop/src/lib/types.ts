export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: "admin" | "enseignant";
  is_active: boolean;
  created_at?: string;
  last_login?: string | null;
}

export interface Contract {
  id: number;
  uuid: string;
  teacher_name: string;
  teacher_grade: string;
  academic_year: string;
  year: number;
  filename: string;
  pdf_filename: string | null;
  ecue_count: number;
  created_at: string;
}

export interface EcueInput {
  intitule: string;
  heures_cm: number;
  heures_td: number;
  heures_tp: number;
  niveau: string;
  classe: string;
  semestre: string;
}

export interface ContractGenerateRequest {
  nom_enseignant: string;
  grade: string;
  annee: number;
  annee_academique: string;
  directeur_general?: string | null;
  arrete?: string | null;
  ecues: EcueInput[];
}

export interface ContractGenerateResponse {
  contract: Contract;
  download_url: string;
  pdf_download_url: string | null;
}

export interface Niveau {
  id: number;
  nom: string;
  ordre: number;
}

export interface Classe {
  id: number;
  nom: string;
  niveau_id: number;
}

export interface Semestre {
  id: number;
  nom: string;
  ordre: number;
}

export interface Ecue {
  id: number;
  intitule: string;
  classe_id: number;
  semestre_id: number;
  heures_cm_defaut: number;
  heures_td_defaut: number;
  heures_tp_defaut: number;
}

export interface Enseignant {
  id: number;
  nom_complet: string;
  grade: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface Setting {
  key: string;
  value: string;
  label: string;
  description: string | null;
}

export const GRADES = [
  "Professeur",
  "Maître de Conférences",
  "Maître Assistant",
  "Assistant d'Université",
  "Assistant",
] as const;

export const DEFAULT_NIVEAUX = ["L1", "L2", "L3", "M1", "M2"] as const;
export const DEFAULT_SEMESTRES = [
  "Semestre 1",
  "Semestre 2",
  "Semestre 3",
  "Semestre 4",
  "Semestre 5",
  "Semestre 6",
] as const;
