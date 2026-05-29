import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Edit, FolderDown, Printer, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { downloadContract, printContract } from "@/lib/download";
import type { Contract, Setting } from "@/lib/types";

export default function History() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultDir, setDefaultDir] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Historique des contrats</h2>

      {toast && (
        <div className="mb-3 text-xs bg-white border border-green-200 rounded px-3 py-2 text-gray-700">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : contracts.length === 0 ? (
        <div className="text-gray-500 bg-white border border-gray-200 rounded-xl p-8 text-center">
          Aucun contrat généré pour l'instant.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Enseignant</th>
                <th className="text-left px-4 py-3 font-medium">Grade</th>
                <th className="text-left px-4 py-3 font-medium">Année</th>
                <th className="text-left px-4 py-3 font-medium">ECUEs</th>
                <th className="text-left px-4 py-3 font-medium">Créé le</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
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
