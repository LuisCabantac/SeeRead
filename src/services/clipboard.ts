/** Clipboard access, only ever called from an explicit user action (button or shortcut). */
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { inTauri } from "./env";

export async function copyText(text: string): Promise<void> {
  if (inTauri) await writeText(text);
  else await navigator.clipboard.writeText(text);
}

export async function pasteText(): Promise<string> {
  return inTauri ? readText() : navigator.clipboard.readText();
}
