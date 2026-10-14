/** True inside the Tauri webview; false in a plain browser (dev preview and E2E tests). */
export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export type WindowLabel = "main" | "overlay";
