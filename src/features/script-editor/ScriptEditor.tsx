/**
 * Script editor (CodeMirror 6): native-feeling editing with undo history that survives
 * find/replace and toolbar actions, plus live highlighting of stage directions.
 */
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  placeholder,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useLatest } from "../../app/useLatest";
import { parseAnnotations, type AnnotationConfig } from "../../core/annotations";

const annotationMark = Decoration.mark({ class: "cm-annotation" });

function annotationHighlighter(config: AnnotationConfig) {
  const build = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    for (const s of parseAnnotations(view.state.doc.toString(), config)) {
      if (s.kind === "annotation") builder.add(s.start, s.end, annotationMark);
    }
    return builder.finish();
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

export interface EditorHandle {
  getView(): EditorView | null;
}

interface Props {
  value: string;
  onChange(value: string): void;
  annotations: AnnotationConfig;
}

export const ScriptEditor = forwardRef<EditorHandle, Props>(function ScriptEditor(
  { value, onChange, annotations },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const highlighting = useRef(new Compartment());
  const onChangeRef = useLatest(onChange);

  useImperativeHandle(ref, () => ({ getView: () => view.current }), []);

  const createState = (doc: string, config: AnnotationConfig) =>
    EditorState.create({
      doc,
      extensions: [
        history(),
        search({ top: true }),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.lineWrapping,
        placeholder("Type or paste your script here…"),
        EditorView.contentAttributes.of({ "aria-label": "Script text", spellcheck: "true" }),
        highlighting.current.of(annotationHighlighter(config)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });

  useEffect(() => {
    view.current = new EditorView({
      state: createState(value, annotations),
      parent: host.current!,
    });
    return () => view.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once
  }, []);

  // Replacing the document from outside (open, new, restore) starts a fresh undo history.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.setState(createState(value, annotations));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- annotations handled below
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: highlighting.current.reconfigure(annotationHighlighter(annotations)),
    });
  }, [annotations]);

  return <div className="editor-host" ref={host} />;
});
