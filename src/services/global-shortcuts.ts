/**
 * System-wide shortcuts, so the teleprompter can be driven while another app (a video
 * call, a recorder) has focus. Registered from the main window only.
 */
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { isSafeGlobalShortcut } from "../core/shortcuts";
import type { Settings } from "../core/settings";
import { inTauri } from "./env";

export type ShortcutAction = keyof Settings["shortcuts"];

// Registration runs are serialized: overlapping unregisterAll/register sequences make the
// plugin reject shortcuts as "already registered".
let queue: Promise<unknown> = Promise.resolve();

/** Re-registers every shortcut; returns the actions that could not be registered. */
export function registerGlobalShortcuts(
  bindings: Settings["shortcuts"],
  handler: (action: ShortcutAction) => void,
): Promise<ShortcutAction[]> {
  const run = queue.then(() => registerAll(bindings, handler));
  queue = run.catch(() => undefined);
  return run;
}

async function registerAll(
  bindings: Settings["shortcuts"],
  handler: (action: ShortcutAction) => void,
): Promise<ShortcutAction[]> {
  if (!inTauri) return [];
  await unregisterAll();
  const failed: ShortcutAction[] = [];
  for (const [action, accelerator] of Object.entries(bindings) as [ShortcutAction, string][]) {
    if (!accelerator) continue;
    if (!isSafeGlobalShortcut(accelerator)) {
      failed.push(action);
      continue;
    }
    try {
      await register(accelerator, (event) => {
        if (event.state === "Pressed") handler(action);
      });
    } catch {
      // Usually another application already owns this combination.
      failed.push(action);
    }
  }
  return failed;
}
