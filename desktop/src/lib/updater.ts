/**
 * Wrapper autour de @tauri-apps/plugin-updater.
 * - Vérifie GitHub Releases pour une nouvelle version
 * - Télécharge + installe + relance automatiquement
 */
import type { Update } from "@tauri-apps/plugin-updater";

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface UpdateInfo {
  version: string;
  notes: string | null;
  update: Update;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!inTauri()) return null;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      notes: update.body ?? null,
      update,
    };
  } catch (e) {
    console.warn("Update check failed:", e);
    return null;
  }
}

export async function downloadAndInstall(
  update: Update,
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<void> {
  let downloaded = 0;
  let total: number | null = null;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? null;
        onProgress?.(0, total);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.(downloaded, total);
        break;
      case "Finished":
        onProgress?.(total ?? downloaded, total);
        break;
    }
  });

  // Redémarre l'app après installation
  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch {
    // Plugin process pas installé → l'utilisateur devra relancer manuellement
  }
}
