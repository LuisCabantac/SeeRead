/**
 * The script being edited: text, file path, unsaved state, autosave and crash recovery.
 * Drafts are written atomically to the app data directory while there are unsaved
 * changes, and offered back on the next launch.
 */
import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { useLatest } from "../../app/useLatest";
import { parseAnnotations, stripAnnotations } from "../../core/annotations";
import { addRecent, type Settings } from "../../core/settings";
import { inTauri } from "../../services/env";
import {
  clearDraft,
  fileName,
  loadDraft,
  openScriptDialog,
  readScript,
  saveDraft,
  saveScriptAs,
  writeScript,
  type Draft,
} from "../../services/files";
import { updateSettings } from "../../services/settings-store";
import { SAMPLE_SCRIPT } from "./sample";

const AUTOSAVE_MS = 1000;

async function confirmDiscard(): Promise<boolean> {
  const message = "You have unsaved changes. Discard them?";
  if (inTauri) return ask(message, { title: "SeeRead", kind: "warning" });
  return window.confirm(message);
}

const rememberRecent = (path: string) =>
  updateSettings((s) => ({ ...s, recent: addRecent(s.recent, path, s.editor.recentLimit) }));

export function useScriptDocument(settings: Settings, firstRun: boolean) {
  const [text, setText] = useState(firstRun ? SAMPLE_SCRIPT : "");
  const [path, setPath] = useState<string | null>(null);
  const [savedText, setSavedText] = useState(firstRun ? SAMPLE_SCRIPT : "");
  const [recovery, setRecovery] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const dirty = text !== savedText;

  useEffect(() => {
    loadDraft()
      .then((draft) => {
        if (draft && draft.contents.trim()) setRecovery(draft);
      })
      .catch(() => undefined);
  }, []);

  // Autosave a draft while there are unsaved changes (never while a recovery is pending).
  const autosave = settings.editor.autosave;
  const pathRef = useLatest(path);
  useEffect(() => {
    if (!autosave || !dirty || recovery) return;
    const timer = setTimeout(() => {
      const savedAt = Date.now();
      saveDraft({ contents: text, path: pathRef.current, savedAt })
        .then(() => setAutosavedAt(savedAt))
        .catch((e) =>
          setMessage({ kind: "error", text: `Autosave failed: ${String(e?.message ?? e)}` }),
        );
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [text, dirty, autosave, recovery, pathRef]);

  const fail = (action: string) => (e: unknown) =>
    setMessage({
      kind: "error",
      text: `${action} failed: ${typeof e === "object" && e && "message" in e ? String(e.message) : String(e)}`,
    });

  const load = (nextText: string, nextPath: string | null) => {
    setText(nextText);
    setSavedText(nextText);
    setPath(nextPath);
    setMessage(null);
  };

  const newScript = useCallback(async () => {
    if (dirty && !(await confirmDiscard())) return;
    load("", null);
    await clearDraft().catch(() => undefined);
  }, [dirty]);

  const open = useCallback(async () => {
    if (dirty && !(await confirmDiscard())) return;
    try {
      const opened = await openScriptDialog();
      if (!opened) return;
      load(opened.text, inTauri ? opened.path : null);
      if (inTauri) await rememberRecent(opened.path);
    } catch (e) {
      fail("Opening the file")(e);
    }
  }, [dirty]);

  const openRecent = useCallback(
    async (recentPath: string) => {
      if (dirty && !(await confirmDiscard())) return;
      try {
        load(await readScript(recentPath), recentPath);
        await rememberRecent(recentPath);
      } catch (e) {
        await updateSettings((s) => ({ ...s, recent: s.recent.filter((p) => p !== recentPath) }));
        fail(`Opening ${fileName(recentPath)}`)(e);
      }
    },
    [dirty],
  );

  const afterSave = async (savedPath: string) => {
    setSavedText(text);
    setPath(inTauri ? savedPath : null);
    setMessage({ kind: "info", text: `Saved ${fileName(savedPath)}` });
    await clearDraft().catch(() => undefined);
    if (inTauri) await rememberRecent(savedPath);
  };

  const saveAs = useCallback(async () => {
    try {
      const saved = await saveScriptAs(text, path ? fileName(path) : "script.txt");
      if (saved) await afterSave(saved);
    } catch (e) {
      fail("Saving")(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, path]);

  const save = useCallback(async () => {
    if (!path) return saveAs();
    try {
      await writeScript(path, text);
      await afterSave(path);
    } catch (e) {
      fail("Saving")(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, path, saveAs]);

  /** Exports a copy without stage directions; the open document is unchanged. */
  const exportWithoutAnnotations = useCallback(async () => {
    const clean = stripAnnotations(text, parseAnnotations(text, settings.annotations));
    const base = path ? fileName(path).replace(/\.[^.]+$/, "") : "script";
    try {
      const saved = await saveScriptAs(clean, `${base}-clean.txt`);
      if (saved) setMessage({ kind: "info", text: `Exported ${fileName(saved)}` });
    } catch (e) {
      fail("Exporting")(e);
    }
  }, [text, path, settings.annotations]);

  const restoreDraft = useCallback(() => {
    if (!recovery) return;
    setText(recovery.contents);
    setSavedText(""); // a recovered draft is unsaved until the user saves it
    setPath(recovery.path);
    setRecovery(null);
  }, [recovery]);

  const discardDraft = useCallback(async () => {
    setRecovery(null);
    await clearDraft().catch(() => undefined);
  }, []);

  return {
    text,
    setText,
    path,
    dirty,
    autosavedAt,
    message,
    dismissMessage: () => setMessage(null),
    recovery,
    restoreDraft,
    discardDraft,
    newScript,
    open,
    openRecent,
    save,
    saveAs,
    exportWithoutAnnotations,
  };
}

export type ScriptDocument = ReturnType<typeof useScriptDocument>;
