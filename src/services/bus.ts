/**
 * Messages between the main window and the teleprompter overlay. Uses Tauri events in
 * the app and a BroadcastChannel in a plain browser, so both windows can be developed and
 * tested without the native shell.
 */
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { inTauri, type WindowLabel } from "./env";

interface Envelope {
  target: WindowLabel;
  event: string;
  payload: unknown;
}

const channel = inTauri ? null : new BroadcastChannel("seeread");
let self: WindowLabel = "main";

/** Called once by each entry point. */
export function setWindowLabel(label: WindowLabel) {
  self = label;
}

export async function send<T>(target: WindowLabel, event: string, payload: T): Promise<void> {
  if (inTauri) return emitTo(target, event, payload);
  channel!.postMessage({ target, event, payload } satisfies Envelope);
}

export async function on<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  if (inTauri) return getCurrentWebviewWindow().listen<T>(event, (e) => handler(e.payload));
  const listener = (m: MessageEvent<Envelope>) => {
    if (m.data.target === self && m.data.event === event) handler(m.data.payload as T);
  };
  channel!.addEventListener("message", listener);
  return () => channel!.removeEventListener("message", listener);
}
