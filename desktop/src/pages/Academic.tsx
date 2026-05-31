import { useEffect, useState, type ReactNode } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { api, API_BASE_URL } from "@/lib/api";
import type {
  Classe,
  Ecue,
  Enseignant,
  ImportResult,
  Niveau,
  Semestre,
} from "@/lib/types";
import { GRADES } from "@/lib/types";

type Tab = "niveaux" | "classes" | "semestres" | "ecues" | "enseignants";

const TABS: { key: Tab; label: string }[] = [
  { key: "niveaux", label: "Niveaux" },
  { key: "classes", label: "Classes" },
  { key: "semestres", label: "Semestres" },
  { key: "ecues", label: "ECUEs" },
  { key: "enseignants", label: "Enseignants" },
];

export default function Academic() {
  const [tab, setTab] = useState<Tab>("niveaux");

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Données académiques</h2>
      <p className="text-sm text-gray-500 mb-6">
        Gérez les référentiels utilisés dans les contrats.
      </p>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors " +
              (tab === t.key
                ? "border-enastic-500 text-enastic-600"
                : "border-transparent text-gray-500 hover:text-gray-700")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "niveaux" && <NiveauxPanel />}
      {tab === "classes" && <ClassesPanel />}
      {tab === "semestres" && <SemestresPanel />}
      {tab === "ecues" && <EcuesPanel />}
      {tab === "enseignants" && <EnseignantsPanel />}
    </div>
  );
}

// ─── Niveaux ──────────────────────────────────────────────────────────────────

function NiveauxPanel() {
  const [items, setItems] = useState<Niveau[]>([]);
  const [nom, setNom] = useState("");
  const [ordre, setOrdre] = useState(0);

  async function load() {
    const res = await api.get<Niveau[]>("/niveaux");
    setItems(res.data);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!nom.trim()) return;
    await api.post("/niveaux", { nom, ordre });
    setNom("");
    setOrdre(0);
    load();
  }
  async function remove(id: number) {
    if (!confirm("Supprimer ce niveau ?")) return;
    await api.delete(`/niveaux/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white p-3 rounded-lg border border-gray-200">
        <input
          placeholder="Nom (ex: L1)"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
        />
        <input
          type="number"
          placeholder="Ordre"
          value={ordre}
          onChange={(e) => setOrdre(Number(e.target.value))}
          className="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded"
        />
        <button
          onClick={create}
          className="flex items-center gap-1 bg-enastic-500 hover:bg-enastic-600 text-white px-3 py-1.5 rounded text-sm"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <SimpleTable
        headers={["Nom", "Ordre", ""]}
        rows={items.map((n) => [
          n.nom,
          n.ordre,
          <DeleteButton key={n.id} onClick={() => remove(n.id)} />,
        ])}
      />
    </div>
  );
}

// ─── Classes ──────────────────────────────────────────────────────────────────

function ClassesPanel() {
  const [items, setItems] = useState<Classe[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [nom, setNom] = useState("");
  const [niveauId, setNiveauId] = useState<number | "">("");

  async function load() {
    const [c, n] = await Promise.all([
      api.get<Classe[]>("/classes"),
      api.get<Niveau[]>("/niveaux"),
    ]);
    setItems(c.data);
    setNiveaux(n.data);
    if (n.data.length > 0 && niveauId === "") setNiveauId(n.data[0].id);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!nom.trim() || niveauId === "") return;
    await api.post("/classes", { nom, niveau_id: niveauId });
    setNom("");
    load();
  }
  async function remove(id: number) {
    if (!confirm("Supprimer cette classe ?")) return;
    await api.delete(`/classes/${id}`);
    load();
  }

  const niveauName = (id: number) => niveaux.find((n) => n.id === id)?.nom ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white p-3 rounded-lg border border-gray-200">
        <input
          placeholder="Nom de la classe / filière"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
        />
        <select
          value={niveauId}
          onChange={(e) => setNiveauId(Number(e.target.value))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded"
        >
          {niveaux.map((n) => (
            <option key={n.id} value={n.id}>
              {n.nom}
            </option>
          ))}
        </select>
        <button
          onClick={create}
          className="flex items-center gap-1 bg-enastic-500 hover:bg-enastic-600 text-white px-3 py-1.5 rounded text-sm"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <SimpleTable
        headers={["Classe", "Niveau", ""]}
        rows={items.map((c) => [
          c.nom,
          niveauName(c.niveau_id),
          <DeleteButton key={c.id} onClick={() => remove(c.id)} />,
        ])}
      />
    </div>
  );
}

// ─── Semestres ────────────────────────────────────────────────────────────────

function SemestresPanel() {
  const [items, setItems] = useState<Semestre[]>([]);
  const [nom, setNom] = useState("");
  const [ordre, setOrdre] = useState(0);

  async function load() {
    const res = await api.get<Semestre[]>("/semestres");
    setItems(res.data);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!nom.trim()) return;
    await api.post("/semestres", { nom, ordre });
    setNom("");
    setOrdre(0);
    load();
  }
  async function remove(id: number) {
    if (!confirm("Supprimer ce semestre ?")) return;
    await api.delete(`/semestres/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white p-3 rounded-lg border border-gray-200">
        <input
          placeholder="Nom (ex: Semestre 1)"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
        />
        <input
          type="number"
          placeholder="Ordre"
          value={ordre}
          onChange={(e) => setOrdre(Number(e.target.value))}
          className="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded"
        />
        <button
          onClick={create}
          className="flex items-center gap-1 bg-enastic-500 hover:bg-enastic-600 text-white px-3 py-1.5 rounded text-sm"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <SimpleTable
        headers={["Nom", "Ordre", ""]}
        rows={items.map((s) => [
          s.nom,
          s.ordre,
          <DeleteButton key={s.id} onClick={() => remove(s.id)} />,
        ])}
      />
    </div>
  );
}

// ─── ECUEs ────────────────────────────────────────────────────────────────────

function EcuesPanel() {
  const [items, setItems] = useState<Ecue[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [semestres, setSemestres] = useState<Semestre[]>([]);
  const [form, setForm] = useState({
    intitule: "",
    classe_id: 0,
    semestre_id: 0,
    heures_cm_defaut: 0,
    heures_td_defaut: 0,
    heures_tp_defaut: 0,
  });

  async function load() {
    const [e, c, s] = await Promise.all([
      api.get<Ecue[]>("/ecues"),
      api.get<Classe[]>("/classes"),
      api.get<Semestre[]>("/semestres"),
    ]);
    setItems(e.data);
    setClasses(c.data);
    setSemestres(s.data);
    setForm((prev) => ({
      ...prev,
      classe_id: prev.classe_id || c.data[0]?.id || 0,
      semestre_id: prev.semestre_id || s.data[0]?.id || 0,
    }));
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!form.intitule.trim() || !form.classe_id || !form.semestre_id) return;
    await api.post("/ecues", form);
    setForm({ ...form, intitule: "", heures_cm_defaut: 0, heures_td_defaut: 0, heures_tp_defaut: 0 });
    load();
  }
  async function remove(id: number) {
    if (!confirm("Supprimer cet ECUE ?")) return;
    await api.delete(`/ecues/${id}`);
    load();
  }

  const classeName = (id: number) => classes.find((c) => c.id === id)?.nom ?? "—";
  const semestreName = (id: number) => semestres.find((s) => s.id === id)?.nom ?? "—";

  return (
    <div className="space-y-4">
      <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2">
        <input
          placeholder="Intitulé de l'ECUE"
          value={form.intitule}
          onChange={(e) => setForm({ ...form, intitule: e.target.value })}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
        />
        <div className="grid grid-cols-5 gap-2">
          <select
            value={form.classe_id}
            onChange={(e) => setForm({ ...form, classe_id: Number(e.target.value) })}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
          <select
            value={form.semestre_id}
            onChange={(e) => setForm({ ...form, semestre_id: Number(e.target.value) })}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded"
          >
            {semestres.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={99}
            placeholder="CM"
            value={form.heures_cm_defaut}
            onChange={(e) => setForm({ ...form, heures_cm_defaut: Number(e.target.value) })}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded"
          />
          <input
            type="number"
            min={0}
            max={99}
            placeholder="TD"
            value={form.heures_td_defaut}
            onChange={(e) => setForm({ ...form, heures_td_defaut: Number(e.target.value) })}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded"
          />
          <input
            type="number"
            min={0}
            max={99}
            placeholder="TP"
            value={form.heures_tp_defaut}
            onChange={(e) => setForm({ ...form, heures_tp_defaut: Number(e.target.value) })}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded"
          />
        </div>
        <button
          onClick={create}
          className="flex items-center gap-1 bg-enastic-500 hover:bg-enastic-600 text-white px-3 py-1.5 rounded text-sm"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <SimpleTable
        headers={["Intitulé", "Classe", "Semestre", "CM", "TD", "TP", ""]}
        rows={items.map((e) => [
          e.intitule,
          classeName(e.classe_id),
          semestreName(e.semestre_id),
          e.heures_cm_defaut,
          e.heures_td_defaut,
          e.heures_tp_defaut,
          <DeleteButton key={e.id} onClick={() => remove(e.id)} />,
        ])}
      />
      <CsvImport
        endpoint="/import/academic"
        templateKind="academic"
        hint="Un fichier = 1 niveau + 1 classe + 1 semestre. En haut : niveau, classe, semestre (une valeur par ligne), puis le tableau « ecue | heures_cm | heures_td | heures_tp ». Import additif : les ECUEs existantes sont mises à jour, les nouvelles ajoutées, rien n'est supprimé."
        onDone={load}
      />
    </div>
  );
}

// ─── Enseignants ──────────────────────────────────────────────────────────────

function EnseignantsPanel() {
  const [items, setItems] = useState<Enseignant[]>([]);
  const [nom, setNom] = useState("");
  const [grade, setGrade] = useState<string>(GRADES[2]);

  async function load() {
    const res = await api.get<Enseignant[]>("/enseignants");
    setItems(res.data);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!nom.trim()) return;
    await api.post("/enseignants", { nom_complet: nom, grade });
    setNom("");
    load();
  }
  async function remove(id: number) {
    if (!confirm("Supprimer cet enseignant ?")) return;
    await api.delete(`/enseignants/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-white p-3 rounded-lg border border-gray-200">
        <input
          placeholder="Nom complet"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
        />
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded"
        >
          {GRADES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <button
          onClick={create}
          className="flex items-center gap-1 bg-enastic-500 hover:bg-enastic-600 text-white px-3 py-1.5 rounded text-sm"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <SimpleTable
        headers={["Nom complet", "Grade", ""]}
        rows={items.map((e) => [
          e.nom_complet,
          e.grade,
          <DeleteButton key={e.id} onClick={() => remove(e.id)} />,
        ])}
      />
      <CsvImport
        endpoint="/import/enseignants"
        templateKind="enseignants"
        hint="Colonnes : nom_complet, grade"
        onDone={load}
      />
    </div>
  );
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function SimpleTable({
  headers,
  rows,
}: {
  headers: (string | number)[];
  rows: (string | number | ReactNode)[][];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-center text-gray-400" colSpan={headers.length}>
                Aucune donnée
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-red-500 hover:text-red-700">
      <Trash2 size={16} />
    </button>
  );
}

function CsvImport({
  endpoint,
  templateKind,
  hint,
  onDone,
}: {
  endpoint: string;
  templateKind: "enseignants" | "academic";
  hint: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<ImportResult>(endpoint, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      onDone();
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function downloadTemplate(fmt: "csv" | "xlsx") {
    const token = localStorage.getItem("enastic_token");
    const res = await fetch(`${API_BASE_URL}/import/template/${templateKind}.${fmt}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele_${templateKind}.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium text-sm text-gray-800 flex items-center gap-1">
            <Upload size={14} /> Importer une liste (CSV ou Excel)
          </div>
          <div className="text-xs text-gray-500">{hint}</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadTemplate("xlsx")}
            className="flex items-center gap-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded text-sm"
          >
            <Download size={14} /> Modèle .xlsx
          </button>
          <button
            type="button"
            onClick={() => downloadTemplate("csv")}
            className="flex items-center gap-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded text-sm"
          >
            <Download size={14} /> Modèle .csv
          </button>
          <label className="cursor-pointer bg-enastic-500 hover:bg-enastic-600 text-white px-3 py-1.5 rounded text-sm">
            {busy ? "Import..." : "Charger un fichier"}
            <input
              type="file"
              accept=".csv,.xlsx"
              hidden
              onChange={handleUpload}
              disabled={busy}
            />
          </label>
        </div>
      </div>
      {result && (
        <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded p-2">
          <b className="text-gray-800">Résultat :</b> Créés {result.created} · Mis à jour{" "}
          {result.updated} · Ignorés {result.skipped}
          {result.errors.length > 0 && (
            <div className="text-red-600 mt-1">{result.errors.slice(0, 5).join(" — ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
