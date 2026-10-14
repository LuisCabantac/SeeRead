# 0006: CodeMirror 6 for the script editor

- **Status:** accepted
- **Date:** 2026-10-14

## Context

The editor needs paste, cut/copy, undo/redo, select all, find & replace, good performance on long
scripts, accessibility, and live highlighting of stage directions.

## Options considered

1. **`<textarea>`** — zero dependencies and native behaviour, but programmatic edits (toolbar paste,
   replace all) wipe the browser's undo stack, and highlighting stage directions is not possible.
2. **CodeMirror 6** — modular, MIT, accessible contenteditable with a real transaction history, search
   panel with replace, decorations, and virtualized rendering for long documents.
3. **ProseMirror/Tiptap** — rich text we don't need; heavier.

## Decision

CodeMirror 6 with only `state`, `view`, `commands`, `search` and `language` packages. The document is
plain text; stage directions are highlighted with a view plugin that reuses `core/annotations.ts`.
Toolbar edits are dispatched as isolated history events so each is one undo step.

## Consequences

- About 250 KB (80 KB gzipped) of editor code shared by both windows' bundles.
- Replacing the whole document from outside (open, new, restore) intentionally starts a fresh undo
  history.
