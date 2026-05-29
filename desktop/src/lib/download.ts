import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, mkdir, exists } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { downloadDir, tempDir } from "@tauri-apps/api/path";
import { API_BASE_URL } from "@/lib/api";

const FALLBACK_DOWNLOAD_KEY = "enastic_default_download_dir";

/**
 * Détecte si on tourne dans Tauri (vs un navigateur classique en dev).
 */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Récupère les bytes d'un fichier généré côté API. */
async function fetchBytes(downloadUrl: string): Promise<Uint8Array> {
  const token = localStorage.getItem("enastic_token");
  const res = await fetch(`${API_BASE_URL}${downloadUrl}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Téléchargement échoué (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/** Téléchargement "navigateur" (mode dev hors Tauri). */
function browserDownload(bytes: Uint8Array, filename: string, mime: string) {
  // Copier dans un ArrayBuffer pur (TS6/Node 24 distinguent SharedArrayBuffer)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const blob = new Blob([buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface DownloadOptions {
  downloadUrl: string;
  filename: string;
  format: "docx" | "pdf";
  defaultDir?: string;
  saveAs?: boolean;
}

const MIMES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/**
 * Télécharge un contrat. Si `saveAs=true` ou pas de dossier défini, ouvre un dialog.
 * Sinon écrit directement dans le dossier configuré.
 * Renvoie le chemin du fichier écrit (ou null si annulé).
 */
export async function downloadContract(options: DownloadOptions): Promise<string | null> {
  const { downloadUrl, filename, format, defaultDir, saveAs } = options;
  const mime = MIMES[format];

  // Hors Tauri : fallback navigateur
  if (!inTauri()) {
    const bytes = await fetchBytes(downloadUrl);
    browserDownload(bytes, filename, mime);
    return filename;
  }

  // Déterminer le dossier cible
  let targetPath: string | null = null;
  if (saveAs || !defaultDir) {
    // Dialog "Enregistrer sous..."
    const defaultPath = defaultDir
      ? `${defaultDir}/${filename}`
      : `${await downloadDir()}/${filename}`;
    targetPath = await save({
      defaultPath,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!targetPath) return null; // annulé
  } else {
    targetPath = `${defaultDir}/${filename}`;
  }

  const bytes = await fetchBytes(downloadUrl);
  await writeFile(targetPath, bytes);
  return targetPath;
}

/**
 * Imprime un contrat : télécharge le PDF dans un dossier temporaire dédié,
 * puis l'ouvre avec l'app PDF du système (Aperçu sur macOS, Adobe/Edge sur
 * Windows) — l'utilisateur clique ⌘P / Ctrl+P pour imprimer.
 *
 * Stratégie de chemin (par ordre de préférence) :
 *  1. dossier configuré dans Paramètres
 *  2. dossier Téléchargements de l'utilisateur
 *  3. dossier temporaire système
 */
export async function printContract(
  downloadUrl: string,
  filename: string,
  preferredDir?: string,
): Promise<void> {
  if (!inTauri()) {
    const token = localStorage.getItem("enastic_token");
    const res = await fetch(`${API_BASE_URL}${downloadUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }

  // Construire une liste de candidats à essayer dans l'ordre
  const candidates: string[] = [];
  if (preferredDir) candidates.push(preferredDir);
  try {
    candidates.push(await downloadDir());
  } catch {
    /* ignore */
  }
  try {
    candidates.push(`${await tempDir()}ENASTIC`);
  } catch {
    /* ignore */
  }

  if (candidates.length === 0) {
    throw new Error(
      "Aucun dossier accessible pour écrire le PDF. Configurez un dossier dans Paramètres.",
    );
  }

  const bytes = await fetchBytes(downloadUrl);
  let lastError: Error | null = null;
  let writtenPath: string | null = null;

  for (const dir of candidates) {
    const path = `${dir}/${filename}`.replace(/\/\//g, "/");
    try {
      // S'assurer que le dossier existe (en particulier pour tempDir/ENASTIC)
      try {
        if (!(await exists(dir))) {
          await mkdir(dir, { recursive: true });
        }
      } catch {
        /* certains dossiers comme Downloads existent déjà — on continue */
      }
      await writeFile(path, bytes);
      writtenPath = path;
      break;
    } catch (e: any) {
      lastError = new Error(`Écriture impossible dans ${dir}: ${e?.message ?? e}`);
      continue;
    }
  }

  if (!writtenPath) {
    throw (
      lastError ||
      new Error("Aucun dossier accessible. Configurez un dossier dans Paramètres.")
    );
  }

  try {
    await openPath(writtenPath);
  } catch (e: any) {
    throw new Error(
      `PDF enregistré dans ${writtenPath} mais impossible de l'ouvrir : ${e?.message ?? e}`,
    );
  }
}

export function rememberDefaultDir(dir: string): void {
  localStorage.setItem(FALLBACK_DOWNLOAD_KEY, dir);
}

export function getRememberedDefaultDir(): string | null {
  return localStorage.getItem(FALLBACK_DOWNLOAD_KEY);
}
