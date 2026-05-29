import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { api, API_BASE_URL } from "@/lib/api";
import type { Contract } from "@/lib/types";

export default function History() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Contract[]>("/contracts");
      setContracts(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function download(c: Contract, format: "docx" | "pdf") {
    const url = `${API_BASE_URL}/contracts/${c.id}/download?format=${format}`;
    const token = localStorage.getItem("enastic_token");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = `${c.teacher_name.replace(/\s/g, "_")}_${c.academic_year.replace("/", "-")}.${format}`;
    a.click();
    URL.revokeObjectURL(dlUrl);
  }

  async function remove(id: number) {
    if (!confirm("Supprimer ce contrat ?")) return;
    await api.delete(`/contracts/${id}`);
    load();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Historique des contrats</h2>
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
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => download(c, "docx")}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                        title="Télécharger DOCX"
                      >
                        <Download size={16} />
                      </button>
                      {c.pdf_filename && (
                        <button
                          onClick={() => download(c, "pdf")}
                          className="p-1.5 hover:bg-gray-100 rounded text-red-600"
                          title="Télécharger PDF"
                        >
                          PDF
                        </button>
                      )}
                      <button
                        onClick={() => remove(c.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
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
