import { isolateHistory, redo, selectAll, undo } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import { useMemo, useRef, useState } from "react";
import { parseAnnotations, stripAnnotations } from "../../core/annotations";
import type { Settings } from "../../core/settings";
import { formatDuration, readingSeconds, scriptStats } from "../../core/stats";
import { copyText, pasteText } from "../../services/clipboard";
import { inTauri } from "../../services/env";
import { fileName } from "../../services/files";
import { Prompter } from "../teleprompter/Prompter";
import { useScriptModel } from "../teleprompter/model";
import { ScriptEditor, type EditorHandle } from "./ScriptEditor";
import type { ScriptDocument } from "./useScriptDocument";

export function ScriptView({ doc, settings }: { doc: ScriptDocument; settings: Settings }) {
  const editor = useRef<EditorHandle>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const model = useScriptModel(doc.text, settings.annotations);
  const stats = useMemo(() => scriptStats(doc.text, model.segments), [doc.text, model.segments]);

  const view = () => editor.current?.getView() ?? null;
  const run = (fn: (v: NonNullable<ReturnType<typeof view>>) => unknown) => {
    const v = view();
    if (!v) return;
    fn(v);
    v.focus();
  };
  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2500);
  };
  const forCopy = (text: string) =>
    settings.annotations.includeInCopy
      ? text
      : stripAnnotations(text, parseAnnotations(text, settings.annotations));

  const selection = () => {
    const v = view();
    if (!v) return "";
    const { from, to } = v.state.selection.main;
    return v.state.sliceDoc(from, to);
  };

  const clipboardError = (e: unknown) => flash(`Clipboard unavailable: ${String(e)}`);

  const copyAll = () =>
    copyText(forCopy(doc.text))
      .then(() => flash("Script copied to the clipboard."))
      .catch(clipboardError);
  const copySelection = () => {
    const text = selection();
    if (!text) return flash("Select some text first.");
    copyText(forCopy(text))
      .then(() => flash("Selection copied."))
      .catch(clipboardError);
  };
  /** Toolbar edits are their own undo step, like the equivalent keyboard shortcuts. */
  const replaceSelection = (v: EditorView, text: string, userEvent: string) =>
    v.dispatch({
      ...v.state.replaceSelection(text),
      userEvent,
      annotations: isolateHistory.of("full"),
    });
  const cut = () => {
    const text = selection();
    if (!text) return flash("Select some text first.");
    copyText(text)
      .then(() => run((v) => replaceSelection(v, "", "delete.cut")))
      .catch(clipboardError);
  };
  const paste = () =>
    pasteText()
      .then((text) => run((v) => replaceSelection(v, text, "input.paste")))
      .catch(clipboardError);

  const seconds = readingSeconds(stats.spokenWords, settings.editor.wpm);

  return (
    <div className="script-view">
      <div className="toolbar" role="toolbar" aria-label="Script">
        <button onClick={() => void doc.newScript()}>New</button>
        <button onClick={() => void doc.open()}>Open…</button>
        <button onClick={() => void doc.save()}>Save</button>
        <button onClick={() => void doc.saveAs()}>Save as…</button>
        <button
          onClick={() => void doc.exportWithoutAnnotations()}
          title="Save a copy without stage directions"
        >
          Export clean copy…
        </button>
        {inTauri && settings.recent.length > 0 && (
          <select
            aria-label="Open a recent script"
            value=""
            onChange={(e) => e.target.value && void doc.openRecent(e.target.value)}
          >
            <option value="">Recent…</option>
            {settings.recent.map((p) => (
              <option key={p} value={p} title={p}>
                {fileName(p)}
              </option>
            ))}
          </select>
        )}
        <span className="sep" />
        <button onClick={() => run(undo)}>Undo</button>
        <button onClick={() => run(redo)}>Redo</button>
        <button onClick={cut}>Cut</button>
        <button onClick={copySelection}>Copy</button>
        <button onClick={() => void paste()}>Paste</button>
        <button onClick={() => run(selectAll)}>Select all</button>
        <button onClick={() => run(openSearchPanel)}>Find &amp; replace</button>
        <span className="sep" />
        <button className="primary" onClick={() => void copyAll()}>
          Copy script
        </button>
        <button aria-pressed={showPreview} onClick={() => setShowPreview((v) => !v)}>
          Preview
        </button>
      </div>

      <div className={`editor-split ${showPreview ? "with-preview" : ""}`}>
        <ScriptEditor
          ref={editor}
          value={doc.text}
          onChange={doc.setText}
          annotations={settings.annotations}
        />
        {showPreview && (
          <section className="preview" aria-label="Teleprompter preview">
            <Prompter model={model} settings={settings} scale={0.5} />
          </section>
        )}
      </div>

      <div className="status-bar" aria-live="polite">
        <span>{doc.path ? fileName(doc.path) : "Untitled"}</span>
        <span>{doc.dirty ? "Unsaved changes" : "Saved"}</span>
        {doc.dirty && doc.autosavedAt && (
          <span>Draft autosaved {new Date(doc.autosavedAt).toLocaleTimeString()}</span>
        )}
        <span>
          {stats.spokenWords} spoken words
          {stats.words !== stats.spokenWords && ` (${stats.words} incl. stage directions)`}
        </span>
        <span>
          ≈ {formatDuration(seconds)} at {settings.editor.wpm} wpm
        </span>
        {notice && <span role="status">{notice}</span>}
      </div>
    </div>
  );
}
