import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Trash2, Download, FolderDown, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { downloadContract, printContract } from "@/lib/download";
import {
  DEFAULT_NIVEAUX,
  DEFAULT_SEMESTRES,
  GRADES,
  type Classe,
  type ContractGenerateRequest,
  type ContractGenerateResponse,
  type Ecue,
  type EcueInput,
  type Enseignant,
  type Niveau,
  type Semestre,
  type Setting,
} from "@/lib/types";

function emptyEcue(): EcueInput {
  return {
    intitule: "",
    heures_cm: 0,
    heures_td: 0,
    heures_tp: 0,
    niveau: "L1",
    classe: "",
    semestre: "Semestre 1",
  };
}

const currentYear = new Date().getFullYear();

/**
 * Année académique en cours (format « AAAA-AAAA »).
 * Une année académique va de septembre (année N) à août (année N+1).
 * Avant septembre, on est donc encore dans l'année académique (N-1)-(N).
 * Ex. : en mai 2026 → « 2025-2026 » ; en octobre 2026 → « 2026-2027 ».
 */
function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  // getMonth() est 0-indexé : 8 = septembre.
  const startYear = now.getMonth() >= 8 ? y : y - 1;
  return `${startYear}-${startYear + 1}`;
}

export default function GenerateContract() {
  const location = useLocation();
  const navigate = useNavigate();
  const editContractId = (location.state as { editContractId?: number } | null)?.editContractId;
  const [editingId, setEditingId] = useState<number | null>(editContractId ?? null);

  const [form, setForm] = useState<ContractGenerateRequest>({
    nom_enseignant: "",
    grade: "Maître Assistant",
    annee: currentYear,
    annee_academique: currentAcademicYear(),
    ecues: [emptyEcue()],
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ContractGenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Référentiels chargés depuis l'API
  const [enseignants, setEnseignants] = useState<Enseignant[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [semestres, setSemestres] = useState<Semestre[]>([]);
  const [ecuesDb, setEcuesDb] = useState<Ecue[]>([]);
  const [defaultDir, setDefaultDir] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Enseignant[]>("/enseignants").catch(() => ({ data: [] as Enseignant[] })),
      api.get<Niveau[]>("/niveaux").catch(() => ({ data: [] as Niveau[] })),
      api.get<Classe[]>("/classes").catch(() => ({ data: [] as Classe[] })),
      api.get<Semestre[]>("/semestres").catch(() => ({ data: [] as Semestre[] })),
      api.get<Ecue[]>("/ecues").catch(() => ({ data: [] as Ecue[] })),
      api.get<Setting[]>("/settings").catch(() => ({ data: [] as Setting[] })),
    ]).then(([e, n, c, s, ec, st]) => {
      setEnseignants(e.data);
      setNiveaux(n.data);
      setClasses(c.data);
      setSemestres(s.data);
      setEcuesDb(ec.data);
      // Pré-remplir l'année académique depuis les paramètres si défini
      const annee = st.data.find((x) => x.key === "annee_academique_defaut")?.value;
      if (annee && /^\d{4}-\d{4}$/.test(annee)) {
        setForm((prev) => ({ ...prev, annee_academique: annee }));
      }
      // Dossier de téléchargement par défaut
      const dir = st.data.find((x) => x.key === "dossier_telechargement_defaut")?.value;
      if (dir) setDefaultDir(dir);
    });
  }, []);

  // Charger un contrat existant pour édition
  useEffect(() => {
    if (!editContractId) return;
    api
      .get<{
        teacher_name: string;
        teacher_grade: string;
        academic_year: string;
        year: number;
        metadata: {
          ecues?: EcueInput[];
          directeur_general?: string | null;
          arrete?: string | null;
        };
      }>(`/contracts/${editContractId}/full`)
      .then((res) => {
        const c = res.data;
        // Normaliser format année (slash -> tiret)
        const year = (c.academic_year || "").replace("/", "-");
        setForm({
          nom_enseignant: c.teacher_name,
          grade: c.teacher_grade,
          annee: c.year,
          annee_academique: year || currentAcademicYear(),
          ecues:
            c.metadata?.ecues && c.metadata.ecues.length > 0
              ? c.metadata.ecues
              : [emptyEcue()],
        });
        setEditingId(editContractId);
        // Nettoyer le state de navigation pour ne pas recharger en boucle
        navigate(".", { replace: true, state: null });
      })
      .catch(() => {
        // ignore : on reste sur un formulaire vierge
      });
  }, [editContractId, navigate]);

  const niveauOptions = niveaux.length > 0 ? niveaux.map((n) => n.nom) : [...DEFAULT_NIVEAUX];
  const semestreOptions =
    semestres.length > 0 ? semestres.map((s) => s.nom) : [...DEFAULT_SEMESTRES];

  // Récapitulatif des heures pour le résumé avant génération.
  const totals = useMemo(() => {
    const cm = form.ecues.reduce((a, e) => a + (Number(e.heures_cm) || 0), 0);
    const td = form.ecues.reduce((a, e) => a + (Number(e.heures_td) || 0), 0);
    const tp = form.ecues.reduce((a, e) => a + (Number(e.heures_tp) || 0), 0);
    const ecuesValides = form.ecues.filter((e) => e.intitule.trim() !== "").length;
    return { cm, td, tp, total: cm + td + tp, ecuesValides };
  }, [form.ecues]);

  function updateField<K extends keyof ContractGenerateRequest>(
    key: K,
    value: ContractGenerateRequest[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function pickEnseignant(id: number) {
    const e = enseignants.find((x) => x.id === id);
    if (!e) return;
    setForm((prev) => ({ ...prev, nom_enseignant: e.nom_complet, grade: e.grade }));
  }

  function updateEcue(index: number, patch: Partial<EcueInput>) {
    setForm((prev) => ({
      ...prev,
      ecues: prev.ecues.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
  }

  function addEcue() {
    setForm((prev) => ({ ...prev, ecues: [...prev.ecues, emptyEcue()] }));
  }

  function removeEcue(index: number) {
    setForm((prev) => ({
      ...prev,
      ecues: prev.ecues.length > 1 ? prev.ecues.filter((_, i) => i !== index) : prev.ecues,
    }));
  }

  function applyEcueFromDb(rowIndex: number, ecueId: number) {
    const e = ecuesDb.find((x) => x.id === ecueId);
    if (!e) return;
    const classe = classes.find((c) => c.id === e.classe_id);
    const niveau = classe ? niveaux.find((n) => n.id === classe.niveau_id) : undefined;
    const semestre = semestres.find((s) => s.id === e.semestre_id);
    updateEcue(rowIndex, {
      intitule: e.intitule,
      heures_cm: e.heures_cm_defaut,
      heures_td: e.heures_td_defaut,
      heures_tp: e.heures_tp_defaut,
      niveau: niveau?.nom ?? "L1",
      classe: classe?.nom ?? "",
      semestre: semestre?.nom ?? "Semestre 1",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<ContractGenerateResponse>("/contracts/generate", form);
      setResult(res.data);
      // Si on était en mode édition : supprimer l'ancien contrat
      if (editingId !== null) {
        try {
          await api.delete(`/contracts/${editingId}`);
        } catch {
          /* ignore */
        }
        setEditingId(null);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Erreur lors de la génération");
    } finally {
      setSubmitting(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }

  function fileName(format: "docx" | "pdf"): string {
    if (!result) return `contrat.${format}`;
    const teacher = result.contract.teacher_name.replace(/\s/g, "_");
    const year = result.contract.academic_year.replace("/", "-");
    return `Contrat_${teacher}_${year}.${format}`;
  }

  async function handleDownload(format: "docx" | "pdf", saveAs: boolean) {
    if (!result) return;
    setBusy(saveAs ? `as-${format}` : `dl-${format}`);
    try {
      const downloadUrl =
        format === "pdf" ? result.pdf_download_url ?? "" : result.download_url;
      if (!downloadUrl) {
        showToast("PDF non disponible");
        return;
      }
      const path = await downloadContract({
        downloadUrl,
        filename: fileName(format),
        format,
        defaultDir: defaultDir || undefined,
        saveAs,
      });
      if (path) showToast(`Enregistré : ${path}`);
    } catch (err: any) {
      showToast(err?.message ?? "Erreur de téléchargement");
    } finally {
      setBusy(null);
    }
  }

  async function handlePrint() {
    if (!result?.pdf_download_url) {
      showToast("PDF non disponible pour impression");
      return;
    }
    setBusy("print");
    try {
      await printContract(result.pdf_download_url, fileName("pdf"), defaultDir || undefined);
      showToast("PDF ouvert : utilisez ⌘P / Ctrl+P pour imprimer");
    } catch (err: any) {
      showToast(err?.message ?? "Erreur d'impression");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        {editingId !== null ? "Modifier le contrat" : "Nouveau contrat de vacation"}
      </h2>
      {editingId !== null && (
        <div className="mb-4 text-xs bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-700">
          Vous modifiez un contrat existant. À la génération, l'ancienne version sera remplacée.
        </div>
      )}
      <p className="text-sm text-gray-500 mb-6">
        Remplissez les informations puis générez le document Word et PDF.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Informations enseignant</h3>

          {enseignants.length > 0 && (
            <div className="mb-4 flex items-center gap-2 bg-enastic-50 border border-enastic-100 rounded-lg p-3">
              <label className="text-sm text-gray-700 whitespace-nowrap">
                Choisir un enseignant :
              </label>
              <select
                onChange={(e) => e.target.value && pickEnseignant(Number(e.target.value))}
                defaultValue=""
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded bg-white"
              >
                <option value="">— Saisie manuelle —</option>
                {enseignants.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom_complet} ({e.grade})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet *
              </label>
              <input
                type="text"
                required
                value={form.nom_enseignant}
                onChange={(e) => updateField("nom_enseignant", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-enastic-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade *</label>
              <select
                value={form.grade}
                onChange={(e) => updateField("grade", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-enastic-500"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Année *
              </label>
              <input
                type="number"
                required
                min={2000}
                max={2100}
                value={form.annee}
                onChange={(e) => updateField("annee", Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-enastic-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Année académique * (AAAA-AAAA)
              </label>
              <input
                type="text"
                required
                pattern="\d{4}-\d{4}"
                placeholder="2025-2026"
                value={form.annee_academique}
                onChange={(e) => updateField("annee_academique", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-enastic-500"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">ECUEs ({form.ecues.length})</h3>
            <button
              type="button"
              onClick={addEcue}
              className="flex items-center gap-1 text-sm bg-enastic-500 hover:bg-enastic-600 text-white px-3 py-1.5 rounded-lg"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>

          <p className="mb-3 text-xs text-gray-500">
            Pour chaque ligne, choisissez le niveau, la classe/filière puis l'ECUE
            dans la liste : ses heures se remplissent automatiquement et restent
            modifiables.
          </p>

          <div className="space-y-3">
            {form.ecues.map((ecue, idx) => (
              <EcueRow
                key={idx}
                index={idx}
                ecue={ecue}
                ecuesDb={ecuesDb}
                niveaux={niveaux}
                classes={classes}
                niveauOptions={niveauOptions}
                semestreOptions={semestreOptions}
                onPickEcue={(id) => applyEcueFromDb(idx, id)}
                onChange={(patch) => updateEcue(idx, patch)}
                onRemove={form.ecues.length > 1 ? () => removeEcue(idx) : undefined}
              />
            ))}
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="font-medium text-green-800 mb-3">
              ✓ Contrat généré avec succès
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Bloc PDF */}
              {result.pdf_download_url && (
                <div className="bg-white border border-green-200 rounded p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">PDF</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={handlePrint}
                      className="flex items-center gap-1 bg-enastic-500 hover:bg-enastic-600 disabled:bg-gray-300 text-white px-3 py-1.5 rounded text-sm"
                    >
                      <Printer size={14} /> {busy === "print" ? "..." : "Imprimer"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => handleDownload("pdf", false)}
                      className="flex items-center gap-1 bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded text-sm hover:bg-green-100 disabled:opacity-50"
                      title={defaultDir ? `Vers ${defaultDir}` : "Vers Téléchargements"}
                    >
                      <Download size={14} /> {busy === "dl-pdf" ? "..." : "Télécharger"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => handleDownload("pdf", true)}
                      className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <FolderDown size={14} />
                      {busy === "as-pdf" ? "..." : "Enregistrer sous…"}
                    </button>
                  </div>
                </div>
              )}

              {/* Bloc DOCX */}
              <div className="bg-white border border-green-200 rounded p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Word (.docx)</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => handleDownload("docx", false)}
                    className="flex items-center gap-1 bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded text-sm hover:bg-green-100 disabled:opacity-50"
                    title={defaultDir ? `Vers ${defaultDir}` : "Vers Téléchargements"}
                  >
                    <Download size={14} /> {busy === "dl-docx" ? "..." : "Télécharger"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => handleDownload("docx", true)}
                    className="flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    <FolderDown size={14} />
                    {busy === "as-docx" ? "..." : "Enregistrer sous…"}
                  </button>
                </div>
              </div>
            </div>
            {toast && (
              <div className="mt-3 text-xs bg-white border border-green-200 rounded px-3 py-2 text-gray-700">
                {toast}
              </div>
            )}
            {!defaultDir && (
              <div className="mt-3 text-xs text-gray-500">
                💡 Astuce : configurez un <b>dossier de téléchargement par défaut</b> dans
                Paramètres pour éviter le dialog à chaque fois.
              </div>
            )}
          </div>
        )}

        {/* Récapitulatif avant génération */}
        <section className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Récapitulatif</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Enseignant</div>
              <div className="font-medium text-gray-800 truncate">
                {form.nom_enseignant || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Grade</div>
              <div className="font-medium text-gray-800">{form.grade || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Année académique</div>
              <div className="font-medium text-gray-800">{form.annee_academique || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ECUEs</div>
              <div className="font-medium text-gray-800">{totals.ecuesValides}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700 border-t border-gray-200 pt-3">
            <span>
              Total CM : <span className="font-semibold">{totals.cm} h</span>
            </span>
            <span>
              Total TD : <span className="font-semibold">{totals.td} h</span>
            </span>
            <span>
              Total TP : <span className="font-semibold">{totals.tp} h</span>
            </span>
            <span className="text-enastic-700">
              Total général : <span className="font-bold">{totals.total} h</span>
            </span>
          </div>
          {totals.ecuesValides === 0 && (
            <p className="mt-2 text-xs text-amber-600">
              Ajoutez au moins une ECUE avant de générer le contrat.
            </p>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="bg-enastic-500 hover:bg-enastic-600 disabled:bg-gray-300 text-white font-medium px-6 py-2.5 rounded-lg"
          >
            {submitting
              ? "Génération en cours..."
              : editingId !== null
                ? "Régénérer le contrat"
                : "Générer le contrat"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Sous-composant ECUE Row ──────────────────────────────────────────────────

interface EcueRowProps {
  index: number;
  ecue: EcueInput;
  ecuesDb: Ecue[];
  niveaux: Niveau[];
  classes: Classe[];
  niveauOptions: string[];
  semestreOptions: string[];
  onPickEcue: (id: number) => void;
  onChange: (patch: Partial<EcueInput>) => void;
  onRemove?: () => void;
}

function EcueRow({
  index,
  ecue,
  ecuesDb,
  niveaux,
  classes,
  niveauOptions,
  semestreOptions,
  onPickEcue,
  onChange,
  onRemove,
}: EcueRowProps) {
  const selectedNiveau = niveaux.find((n) => n.nom === ecue.niveau);

  // Classes limitées au niveau choisi pour cette ligne (cascade Niveau → Classe).
  const classesForNiveau = useMemo(() => {
    if (!selectedNiveau) return classes;
    return classes.filter((c) => c.niveau_id === selectedNiveau.id);
  }, [classes, selectedNiveau]);

  const selectedClasse = classesForNiveau.find((c) => c.nom === ecue.classe);

  // ECUEs de la classe choisie (proposées dans la liste déroulante de la ligne).
  const ecuesForClasse = useMemo(() => {
    if (!selectedClasse) return [];
    return ecuesDb.filter((e) => e.classe_id === selectedClasse.id);
  }, [ecuesDb, selectedClasse]);

  // ECUE actuellement sélectionnée dans la liste (correspondance par intitulé + classe).
  const currentEcueId =
    ecuesForClasse.find((e) => e.intitule === ecue.intitule)?.id ?? "";

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">ECUE #{index + 1}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-3">
          <label className="block text-xs text-gray-600 mb-1">Niveau</label>
          <select
            value={ecue.niveau}
            onChange={(e) =>
              // Changer de niveau remet à zéro la classe (cascade).
              onChange({ niveau: e.target.value, classe: "" })
            }
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          >
            {niveauOptions.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="col-span-4">
          <label className="block text-xs text-gray-600 mb-1">Classe / Filière</label>
          <select
            value={selectedClasse ? ecue.classe : ""}
            onChange={(e) => onChange({ classe: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
          >
            <option value="">— Choisir —</option>
            {classesForNiveau.map((c) => (
              <option key={c.id} value={c.nom}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-5">
          <label className="block text-xs text-gray-600 mb-1">ECUE *</label>
          <select
            value={currentEcueId}
            disabled={!selectedClasse}
            onChange={(e) => {
              if (e.target.value) onPickEcue(Number(e.target.value));
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">
              {!selectedClasse
                ? "— Choisir une classe d'abord —"
                : ecuesForClasse.length === 0
                  ? "— Aucune ECUE pour cette classe —"
                  : "— Choisir une ECUE —"}
            </option>
            {ecuesForClasse.map((e) => (
              <option key={e.id} value={e.id}>
                {e.intitule}
              </option>
            ))}
          </select>
          {/* Champ requis caché : garantit qu'une ECUE est bien sélectionnée. */}
          <input
            type="text"
            required
            value={ecue.intitule}
            onChange={() => {}}
            tabIndex={-1}
            aria-hidden
            className="sr-only"
          />
        </div>
        <div className="col-span-4">
          <label className="block text-xs text-gray-600 mb-1">Semestre</label>
          <select
            value={ecue.semestre}
            onChange={(e) => onChange({ semestre: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          >
            {semestreOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Heures CM</label>
          <input
            type="number"
            min={0}
            max={99}
            value={ecue.heures_cm}
            onChange={(e) => onChange({ heures_cm: Number(e.target.value) })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-xs text-gray-600 mb-1">Heures TD</label>
          <input
            type="number"
            min={0}
            max={99}
            value={ecue.heures_td}
            onChange={(e) => onChange({ heures_td: Number(e.target.value) })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-xs text-gray-600 mb-1">Heures TP</label>
          <input
            type="number"
            min={0}
            max={99}
            value={ecue.heures_tp}
            onChange={(e) => onChange({ heures_tp: Number(e.target.value) })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          />
        </div>
      </div>
      {ecue.intitule && (
        <p className="mt-2 text-xs text-gray-500">
          ECUE sélectionnée : <span className="font-medium text-gray-700">{ecue.intitule}</span>
        </p>
      )}
    </div>
  );
}
