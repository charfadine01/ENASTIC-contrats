import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/api";
import type { Setting } from "@/lib/types";

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
            {isLongValue(s.value) ? (
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
    </div>
  );
}
