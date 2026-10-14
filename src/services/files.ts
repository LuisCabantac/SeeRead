/** Opening, saving and autosaving scripts. Files are plain UTF-8 text on the user's disk. */
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { inTauri } from "./env";

const FILTERS = [{ name: "Text script", extensions: ["txt", "md"] }];
const DRAFT_KEY = "seeread.draft";

export interface Draft {
  contents: string;
  path: string | null;
  savedAt: number;
}

export interface OpenedScript {
  /** Absolute path in the app; a bare file name in a browser. */
  path: string;
  text: string;
}

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

export function readScript(path: string): Promise<string> {
  return invoke<string>("read_script", { path });
}

export async function openScriptDialog(): Promise<OpenedScript | null> {
  if (!inTauri) return pickInBrowser();
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  if (typeof path !== "string") return null;
  return { path, text: await readScript(path) };
}

export async function writeScript(path: string, text: string): Promise<void> {
  if (!inTauri) return downloadInBrowser(fileName(path), text);
  await invoke("write_script", { path, contents: text });
}

/** Asks for a destination and writes; returns the chosen path, or null if cancelled. */
export async function saveScriptAs(text: string, suggested = "script.txt"): Promise<string | null> {
  if (!inTauri) {
    downloadInBrowser(suggested, text);
    return suggested;
  }
  const path = await save({ defaultPath: suggested, filters: FILTERS });
  if (!path) return null;
  await writeScript(path, text);
  return path;
}

export async function saveDraft(draft: Draft): Promise<void> {
  if (inTauri) await invoke("save_draft", { draft });
  else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<Draft | null> {
  if (inTauri) return invoke<Draft | null>("load_draft");
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  if (inTauri) await invoke("clear_draft");
  else localStorage.removeItem(DRAFT_KEY);
}

function pickInBrowser(): Promise<OpenedScript | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,text/plain";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { path: file.name, text: await file.text() } : null);
    };
    input.click();
  });
}

function downloadInBrowser(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
