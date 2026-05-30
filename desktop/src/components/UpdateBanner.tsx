import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from "@/lib/updater";

const SNOOZE_KEY = "enastic_update_snooze";

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Vérifie 3s après le démarrage (laisse l'API démarrer d'abord)
    const t = setTimeout(async () => {
      const snoozed = localStorage.getItem(SNOOZE_KEY);
      const info = await checkForUpdate();
      if (info && snoozed !== info.version) {
        setUpdate(info);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  async function install() {
    if (!update) return;
    setInstalling(true);
    try {
      await downloadAndInstall(update.update, (d, t) => {
        if (t) setProgress(Math.round((d / t) * 100));
      });
    } catch (err) {
      console.error("Update failed:", err);
      setInstalling(false);
    }
  }

  function snooze() {
    if (update) localStorage.setItem(SNOOZE_KEY, update.version);
    setDismissed(true);
  }

  if (!update || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 bg-white border border-enastic-200 rounded-xl shadow-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">Mise à jour disponible</h3>
          <p className="text-xs text-gray-500">Version {update.version}</p>
        </div>
        {!installing && (
          <button onClick={snooze} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        )}
      </div>

      {update.notes && (
        <p className="text-xs text-gray-600 mb-3 max-h-24 overflow-y-auto whitespace-pre-wrap">
          {update.notes}
        </p>
      )}

      {installing ? (
        <div>
          <div className="text-xs text-gray-700 mb-1">
            Téléchargement et installation… {progress > 0 && `${progress}%`}
          </div>
          <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-enastic-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            L'application redémarrera automatiquement à la fin.
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={install}
            className="flex-1 flex items-center justify-center gap-1 bg-enastic-500 hover:bg-enastic-600 text-white px-3 py-1.5 rounded text-sm"
          >
            <Download size={14} /> Installer maintenant
          </button>
          <button
            onClick={snooze}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Plus tard
          </button>
        </div>
      )}
    </div>
  );
}
