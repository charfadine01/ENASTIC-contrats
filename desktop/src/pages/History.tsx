import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Download, Edit, FolderDown, Printer, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { downloadContract, printContract } from "@/lib/download";
import type { Contract, Setting } from "@/lib/types";

type SortKey = "teacher_name" | "academic_year" | "created_at";

export default function History() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultDir, setDefaultDir] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Recherche / filtres / tri (tout côté client)
  const [query, setQuery] = useState("");
  const [filtreAnnee, setFiltreAnnee] = useState("");
  const [filtreGrade, setFiltreGrade] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api.get<Contract[]>("/contracts"),
        api.get<Setting[]>("/settings").catch(() => ({ data: [] as Setting[] })),
      ]);
      setContracts(c.data);
      const dir = s.data.find((x) => x.key === "dossier_telechargement_defaut")?.value;
      if (dir) setDefaultDir(dir);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function fileName(c: Contract, format: "docx" | "pdf"): string {
    return `Contrat_${c.teacher_name.replace(/\s/g, "_")}_${c.academic_year.replace(
      "/",
      "-",
    )}.${format}`;
  }

  async function handleDownload(c: Contract, format: "docx" | "pdf", saveAs: boolean) {
    setBusy(`${c.id}-${saveAs ? "as" : "dl"}-${format}`);
    try {
      const path = await downloadContract({
        downloadUrl: `/contracts/${c.id}/download?format=${format}`,
        filename: fileName(c, format),
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

  async function handlePrint(c: Contract) {
    if (!c.pdf_filename) {
      showToast("PDF non disponible");
      return;
    }
    setBusy(`${c.id}-print`);
    try {
      await printContract(
        `/contracts/${c.id}/download?format=pdf`,
        fileName(c, "pdf"),
        defaultDir || undefined,
      );
      showToast("PDF ouvert : utilisez ⌘P / Ctrl+P pour imprimer");
    } catch (err: any) {
      showToast(err?.message ?? "Erreur d'impression");
    } finally {
      setBusy(null);
    }
  }

  function editContract(c: Contract) {
    // Naviguer vers la page Nouveau contrat avec l'ID dans le state
    navigate("/", { state: { editContractId: c.id } });
  }

  async function remove(id: number) {
    if (!confirm("Supprimer ce contrat ?")) return;
    await api.delete(`/contracts/${id}`);
    load();
  }

  // Valeurs distinctes pour alimenter les filtres.
  const annees = useMemo(
    () => Array.from(new Set(contracts.map((c) => c.academic_year))).sort().reverse(),
    [contracts],
  );
  const grades = useMemo(
    () => Array.from(new Set(contracts.map((c) => c.teacher_grade))).sort(),
    [contracts],
  );

  // Liste filtrée + triée.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = contracts.filter((c) => {
      if (q && !c.teacher_name.toLowerCase().includes(q)) return false;
      if (filtreAnnee && c.academic_year !== filtreAnnee) return false;
      if (filtreGrade && c.teacher_grade !== filtreGrade) return false;
      return true;
    });
    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp: number;
      if (sortKey === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), "fr", { numeric: true });
      }
      return cmp * dir;
    });
  }, [contracts, query, filtreAnnee, filtreGrade, sortKey, sortAsc]);

  const filtreActif = query.trim() !== "" || filtreAnnee !== "" || filtreGrade !== "";

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      // Par défaut : noms A→Z ; dates/années plus récentes d'abord.
      setSortAsc(key === "teacher_name");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortAsc ? (
      <ArrowUp size={12} className="inline ml-1" />
    ) : (
      <ArrowDown size={12} className="inline ml-1" />
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Historique des contrats</h2>

      {toast && (
        <div className="mb-3 text-xs bg-white border border-green-200 rounded px-3 py-2 text-gray-700">
          {toast}
        </div>
      )}

      {!loading && contracts.length > 0 && (
        <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un enseignant…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-enastic-500"
              />
            </div>
            <select
              value={filtreAnnee}
              onChange={(e) => setFiltreAnnee(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
            >
              <option value="">Toutes les années</option>
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={filtreGrade}
              onChange={(e) => setFiltreGrade(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
            >
              <option value="">Tous les grades</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {filtreActif && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFiltreAnnee("");
                  setFiltreGrade("");
                }}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                Réinitialiser
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {filtered.length} / {contracts.length} contrat{contracts.length > 1 ? "s" : ""}
            {filtreActif ? " (filtrés)" : ""}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : contracts.length === 0 ? (
        <div className="text-gray-500 bg-white border border-gray-200 rounded-xl p-8 text-center">
          Aucun contrat généré pour l'instant.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500 bg-white border border-gray-200 rounded-xl p-8 text-center">
          Aucun contrat ne correspond à votre recherche.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:text-enastic-600"
                  onClick={() => toggleSort("teacher_name")}
                >
                  Enseignant
                  <SortIcon k="teacher_name" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Grade</th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:text-enastic-600"
                  onClick={() => toggleSort("academic_year")}
                >
                  Année
                  <SortIcon k="academic_year" />
                </th>
                <th className="text-left px-4 py-3 font-medium">ECUEs</th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:text-enastic-600"
                  onClick={() => toggleSort("created_at")}
                >
                  Créé le
                  <SortIcon k="created_at" />
                </th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">{c.teacher_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.teacher_grade}</td>
                  <td className="px-4 py-3">{c.academic_year}</td>
                  <td className="px-4 py-3">{c.ecue_count}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {c.pdf_filename && (
                        <button
                          disabled={busy !== null}
                          onClick={() => handlePrint(c)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-enastic-500 hover:bg-enastic-600 disabled:bg-gray-300 text-white rounded"
                          title="Imprimer (ouvre le PDF)"
                        >
                          <Printer size={12} />
                          {busy === `${c.id}-print` ? "..." : "Imprimer"}
                        </button>
                      )}
                      {c.pdf_filename && (
                        <button
                          disabled={busy !== null}
                          onClick={() => handleDownload(c, "pdf", false)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded disabled:opacity-50"
                          title="Télécharger PDF"
                        >
                          <Download size={12} /> PDF
                        </button>
                      )}
                      <button
                        disabled={busy !== null}
                        onClick={() => handleDownload(c, "docx", false)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded disabled:opacity-50"
                        title="Télécharger DOCX"
                      >
                        <Download size={12} /> DOCX
                      </button>
                      <button
                        disabled={busy !== null}
                        onClick={() => handleDownload(c, c.pdf_filename ? "pdf" : "docx", true)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-50"
                        title="Enregistrer sous..."
                      >
                        <FolderDown size={14} />
                      </button>
                      <button
                        onClick={() => editContract(c)}
                        className="p-1 hover:bg-blue-50 rounded text-blue-600"
                        title="Modifier ce contrat"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="p-1 hover:bg-red-50 rounded text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
