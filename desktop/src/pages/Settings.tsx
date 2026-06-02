import { useEffect, useRef, useState } from "react";
import { FolderOpen, Save, Download, Upload, ShieldCheck } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api, API_BASE_URL } from "@/lib/api";
import type { Setting } from "@/lib/types";

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function Settings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});

  async function load() {
    const res = await api.get<Setting[]>("/settings");
    setSettings(res.data);
    const initial: Record<string, string> = {};
    for (const s of res.data) initial[s.key] = s.value;
    setValues(initial);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    setSaving(key);
    try {
      await api.put(`/settings/${key}`, { value: values[key] });
      setSavedAt((prev) => ({ ...prev, [key]: Date.now() }));
      setTimeout(() => {
        setSavedAt((prev) => {
          const { [key]: _, ...rest } = prev;
          return rest;
        });
      }, 2000);
    } finally {
      setSaving(null);
    }
  }

  function isLongValue(value: string) {
    return value.length > 50;
  }

  async function pickDirectory(key: string) {
    if (!inTauri()) {
      alert("La sélection de dossier n'est disponible que dans l'application desktop.");
      return;
    }
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setValues((p) => ({ ...p, [key]: selected }));
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Paramètres de l'application</h2>
      <p className="text-sm text-gray-500 mb-6">
        Ces valeurs sont utilisées par défaut lors de la génération des contrats. Modifiez-les
        quand un Directeur Général change, un nouvel arrêté est publié, etc.
      </p>

      <div className="space-y-4">
        {settings.map((s) => (
          <div key={s.key} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-900">
                  {s.label || s.key}
                </label>
                {s.description && (
                  <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {savedAt[s.key] && (
                  <span className="text-xs text-green-600 font-medium">✓ Enregistré</span>
                )}
                <button
                  onClick={() => save(s.key)}
                  disabled={saving === s.key || values[s.key] === s.value}
                  className="flex items-center gap-1 bg-enastic-500 hover:bg-enastic-600 disabled:bg-gray-300 text-white text-sm px-3 py-1.5 rounded"
                >
                  <Save size={14} />
                  {saving === s.key ? "..." : "Enregistrer"}
                </button>
              </div>
            </div>
            {s.key === "dossier_telechargement_defaut" ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={values[s.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [s.key]: e.target.value }))}
                  placeholder="Laisser vide pour utiliser Téléchargements"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-enastic-500"
                />
                <button
                  type="button"
                  onClick={() => pickDirectory(s.key)}
                  className="flex items-center gap-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded text-sm"
                >
                  <FolderOpen size={14} /> Parcourir
                </button>
              </div>
            ) : isLongValue(s.value) ? (
              <textarea
                value={values[s.key] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [s.key]: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-enastic-500"
              />
            ) : (
              <input
                type="text"
                value={values[s.key] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [s.key]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-enastic-500"
              />
            )}
            <div className="text-xs text-gray-400 mt-1 font-mono">clé: {s.key}</div>
          </div>
        ))}
      </div>

      <BackupSection />
    </div>
  );
}

// ─── Sauvegarde & restauration ──────────────────────────────────────────────

function BackupSection() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function backupFilename(): string {
    // Date locale AAAA-MM-JJ pour nommer la sauvegarde.
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `enastic-sauvegarde-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.db`;
  }

  async function fetchBackupBytes(): Promise<Uint8Array> {
    const token = localStorage.getItem("enastic_token");
    const res = await fetch(`${API_BASE_URL}/backup/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Export échoué (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    try {
      const bytes = await fetchBackupBytes();
      const filename = backupFilename();

      if (inTauri()) {
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        const path = await save({
          defaultPath: filename,
          filters: [{ name: "Sauvegarde ENASTIC", extensions: ["db"] }],
        });
        if (!path) {
          setExporting(false);
          return; // annulé
        }
        await writeFile(path, bytes);
        setMessage({ kind: "ok", text: `Sauvegarde enregistrée : ${path}` });
      } else {
        // Mode navigateur (dev)
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const blob = new Blob([buffer as ArrayBuffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setMessage({ kind: "ok", text: "Sauvegarde téléchargée." });
      }
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Erreur lors de l'export.";
      setMessage({ kind: "err", text });
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // réautoriser le même fichier ensuite
    if (!file) return;

    const confirmed = window.confirm(
      "⚠️ Restaurer une sauvegarde va REMPLACER toutes les données actuelles " +
        "(contrats, académique, enseignants, paramètres) par celles du fichier.\n\n" +
        "Cette action est irréversible. Pensez à exporter une sauvegarde de l'état " +
        "actuel avant de continuer.\n\nVoulez-vous restaurer cette sauvegarde ?",
    );
    if (!confirmed) return;

    setImporting(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<{ message?: string }>("/backup/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage({
        kind: "ok",
        text:
          res.data?.message ??
          "Sauvegarde restaurée. Veuillez redémarrer l'application pour finaliser.",
      });
      // Redémarrage recommandé pour repartir sur une base saine.
      if (inTauri()) {
        setTimeout(async () => {
          try {
            const { relaunch } = await import("@tauri-apps/plugin-process");
            await relaunch();
          } catch {
            /* l'utilisateur redémarrera manuellement */
          }
        }, 1800);
      }
    } catch (err: unknown) {
      let text = "Erreur lors de la restauration.";
      if (err && typeof err === "object" && "response" in err) {
        const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail;
        if (typeof detail === "string") text = detail;
      }
      setMessage({ kind: "err", text });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={18} className="text-enastic-600" />
        <h3 className="text-lg font-semibold text-gray-900">Sauvegarde & restauration</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Enregistrez régulièrement une sauvegarde complète de toutes vos données (contrats,
        académique, enseignants, paramètres) dans un fichier. En cas de problème ou de
        changement d'ordinateur, restaurez ce fichier pour tout récupérer.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-enastic-500 hover:bg-enastic-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Download size={16} />
          {exporting ? "Export en cours…" : "Exporter une sauvegarde"}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-4 py-2 rounded-lg text-sm"
        >
          <Upload size={16} />
          {importing ? "Restauration…" : "Restaurer une sauvegarde"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".db"
          hidden
          onChange={handleImportFile}
        />
      </div>

      {message && (
        <div
          className={
            "mt-4 text-sm rounded-lg px-3 py-2 " +
            (message.kind === "ok"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-700")
          }
        >
          {message.text}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Conseil : conservez la sauvegarde sur une clé USB ou un autre disque que l'ordinateur de
        travail.
      </p>
    </div>
  );
}
