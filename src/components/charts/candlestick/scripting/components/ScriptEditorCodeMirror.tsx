import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState, StateField, type Text } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  Decoration,
  type DecorationSet,
  type KeyBinding,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentSelection, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { tags } from "@lezer/highlight";
import type { ScriptError } from "../interfaces/ScriptRunResult.interface";
import { SCRIPT_API_COMPLETIONS } from "../scriptApiCompletions";
import "./ScriptEditorCodeMirror.css";

export interface ScriptEditorCodeMirrorProps {
  value: string;
  onChange: (value: string) => void;
  /** The most recent run's own error (if any) — shown as a red underline on its own line/column
   *  when both are known (a runtime error), or not underlined at all when only a message is known
   *  (a `SyntaxError` from compilation itself, which V8 gives no usable position for — see
   *  `runScript.ts`'s own doc). `ScriptErrorPanel` is what shows the message text either way; this
   *  is purely the in-editor gutter/underline affordance for exigence #24. */
  error: ScriptError | null;
  /** Bumped by the toolbar's own "Format" button — a light re-indent of the whole document via
   *  CodeMirror's own `indentSelection` command, not Prettier (too heavy a dependency for this).
   *  `undefined`/`0` (the toolbar's own starting value) never triggers a reformat on mount. */
  formatRequestId?: number;
  /** Fires on Shift+Enter (and via the imperative `runCurrentCell()` handle, for the toolbar's own
   *  "Exécuter la cellule" button) with the code from the start of the document through the end of
   *  the `// %%`-delimited cell containing the cursor — see `codeThroughCellAtCursor`'s own doc for
   *  why that's "from the top", not the cell in isolation. Omit to leave Shift+Enter as CodeMirror's
   *  own default (insert a newline) — a consumer with no notion of "run" (none exist yet, but kept
   *  optional for one) simply doesn't get the shortcut. */
  onRunCell?: (code: string) => void;
}

/** Imperative handle for `ScriptEditorPanel.tsx`'s own "Exécuter la cellule" toolbar button — the
 *  keyboard shortcut (Shift+Enter) reaches the same code path directly through a keymap binding,
 *  this is only needed for triggering it from outside the CodeMirror instance itself. */
export interface ScriptEditorCodeMirrorHandle {
  runCurrentCell: () => void;
}

function apiCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[\w.]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: SCRIPT_API_COMPLETIONS.map((c) => ({ label: c.label, type: c.type, detail: c.detail, apply: c.apply ?? c.label })),
  };
}

const theme = EditorView.theme({
  "&": { color: "var(--lq-color-text)", backgroundColor: "var(--lq-color-panel)", height: "100%", fontSize: "var(--lq-text-sm)" },
  ".cm-content": { fontFamily: "var(--lq-font-mono)", caretColor: "var(--lq-color-accent)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--lq-color-accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "var(--lq-color-hover)" },
  ".cm-gutters": { backgroundColor: "var(--lq-color-panel)", color: "var(--lq-color-text-muted)", border: "none", borderRight: "1px solid var(--lq-color-border-subtle)" },
  ".cm-activeLine": { backgroundColor: "var(--lq-color-hover)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--lq-color-hover)" },
  ".cm-tooltip": { backgroundColor: "var(--lq-color-panel)", border: "1px solid var(--lq-color-border)", color: "var(--lq-color-text)" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "var(--lq-color-accent)", color: "var(--lq-color-accent-contrast)" },
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--lq-color-accent)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--lq-color-up)" },
  { tag: tags.number, color: "var(--lq-color-down)" },
  { tag: tags.comment, color: "var(--lq-color-text-muted)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--lq-color-accent)" },
  { tag: tags.propertyName, color: "var(--lq-color-text)" },
  { tag: tags.operator, color: "var(--lq-color-text-muted)" },
  { tag: tags.bool, color: "var(--lq-color-down)" },
  { tag: tags.null, color: "var(--lq-color-text-muted)" },
]);

// A "cell" (exigence : mode Jupyter — voir ScriptEditorPanel.tsx's own "Exécuter la cellule"
// button) is delimited by a `// %%` comment at the start of a line, the same marker convention
// several existing Python tools (VS Code, Spyder) already use for the same purpose in plain
// source files — reused here rather than inventing a new one. 1-based line numbers throughout,
// matching CodeMirror's own `Text.line()` convention.
const CELL_MARKER_RE = /^\s*\/\/\s*%%/;

function findCellMarkerLines(doc: Text): number[] {
  const lines: number[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    if (CELL_MARKER_RE.test(doc.line(i).text)) lines.push(i);
  }
  return lines;
}

// The last line of the cell containing `lineNumber` — everything from the previous marker
// (exclusive) up to the next marker (exclusive), or the whole document's own start/end when
// there's no marker on one side.
function cellEndLine(doc: Text, lineNumber: number, markerLines: number[]): number {
  const next = markerLines.find((m) => m > lineNumber);
  return next ? next - 1 : doc.lines;
}

/** The code to run for "Exécuter la cellule" (Shift+Enter or the toolbar button) — from the very
 *  start of the document through the end of whichever cell contains the cursor, *not* that cell
 *  in isolation. This engine has no persistent variable scope between separate runs (`state.*`
 *  itself resets to zero every full execution — see its own doc), so a truly isolated cell would
 *  throw a ReferenceError the moment it read a `const` defined in an earlier cell — "from the top
 *  through here" is what actually matches how Jupyter is used in practice (sequential, top to
 *  bottom) despite the different mechanics underneath. */
function codeThroughCellAtCursor(state: EditorState): string {
  const doc = state.doc;
  const markerLines = findCellMarkerLines(doc);
  const cursorLine = doc.lineAt(state.selection.main.head).number;
  const endLine = cellEndLine(doc, cursorLine, markerLines);
  return doc.sliceString(0, doc.line(endLine).to);
}

const cellMarkerLineDeco = Decoration.line({ attributes: { class: "cm-cell-marker" } });
const cellActiveLineDeco = Decoration.line({ attributes: { class: "cm-cell-active" } });

// One decoration pass per doc/selection change: a border on every `// %%` line (always visible,
// not just on the active cell — "here's where the cells are" at a glance), and a background tint
// on every line of whichever cell currently contains the cursor (mutually exclusive with the
// marker's own border — a marker line never also gets the tint).
function buildCellDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  const markerLines = findCellMarkerLines(doc);
  if (markerLines.length === 0) return Decoration.none;
  const markerLineSet = new Set(markerLines);
  const cursorLine = doc.lineAt(state.selection.main.head).number;
  const activeEnd = cellEndLine(doc, cursorLine, markerLines);
  const activeStart = [...markerLines].reverse().find((m) => m <= cursorLine) ?? 1;
  const decorations = [];
  for (let i = 1; i <= doc.lines; i++) {
    if (markerLineSet.has(i)) decorations.push(cellMarkerLineDeco.range(doc.line(i).from));
    else if (i >= activeStart && i <= activeEnd) decorations.push(cellActiveLineDeco.range(doc.line(i).from));
  }
  return Decoration.set(decorations);
}

const cellDecorationsField = StateField.define<DecorationSet>({
  create: (state) => buildCellDecorations(state),
  update: (deco, tr) => (tr.docChanged || tr.selection ? buildCellDecorations(tr.state) : deco),
  provide: (field) => EditorView.decorations.from(field),
});

/** Hand-assembled CodeMirror 6 extensions — line numbers, active-line highlight, undo history,
 *  auto-indent/bracket-matching, JS syntax highlighting, the static API completion list (see
 *  scriptApiCompletions.ts), and a lint gutter fed by the *last run's own* error rather than a
 *  live static analyzer. Deliberately not the `codemirror`/`basicSetup` meta-package (search/
 *  fold/full history-panel UI this editor has no use for) — same "avoid heavy tooling
 *  dependencies" spirit `CodeBlock.tsx` already documents for its own simpler syntax highlighting
 *  choice. Loaded only via a dynamic `import()` from `ScriptEditorPanel.tsx`, never a static
 *  import reachable from this library's own top-level exports — a consumer that never opens the
 *  script editor never pays for CodeMirror's own bundle weight (verified in M5's own dist/ build
 *  check — see that commit). */
export const ScriptEditorCodeMirror = forwardRef<ScriptEditorCodeMirrorHandle, ScriptEditorCodeMirrorProps>(function ScriptEditorCodeMirror(
  { value, onChange, error, formatRequestId, onRunCell },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Same ref-indirection as onChangeRef above — the keymap binding below is registered once (see
  // this effect's own doc on why), so it has to read the *current* onRunCell through a ref rather
  // than closing over whichever one happened to be passed in on the render that built it.
  const onRunCellRef = useRef(onRunCell);
  onRunCellRef.current = onRunCell;
  const lastFormatRequestIdRef = useRef(formatRequestId);

  useImperativeHandle(
    ref,
    () => ({
      runCurrentCell: () => {
        const view = viewRef.current;
        if (!view || !onRunCellRef.current) return;
        onRunCellRef.current(codeThroughCellAtCursor(view.state));
      },
    }),
    []
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const runCellBinding: KeyBinding = {
      key: "Shift-Enter",
      run: (view) => {
        if (!onRunCellRef.current) return false;
        onRunCellRef.current(codeThroughCellAtCursor(view.state));
        return true;
      },
    };
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        javascript(),
        syntaxHighlighting(highlightStyle),
        autocompletion({ override: [apiCompletionSource] }),
        lintGutter(),
        cellDecorationsField,
        keymap.of([runCellBinding, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Constructed once — an external `value` change (Reset, switching which script's tab is
    // active) is applied via the separate effect below instead of tearing down and rebuilding the
    // whole view, which would lose cursor position/undo history on every keystroke (this effect's
    // own updateListener reports every keystroke back up through onChange, which would otherwise
    // re-run this effect right back at the value it just produced).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes only — skipped whenever the incoming `value` already matches the
  // editor's own current doc, which is true for every user-typed change (already reported
  // upward by the updateListener above; dispatching it back in here would be a redundant no-op
  // transaction at best, and at worst reset the cursor to the start on every keystroke).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const diagnostics: Diagnostic[] = [];
    if (error && error.line !== undefined) {
      const lineNumber = Math.min(Math.max(1, error.line), view.state.doc.lines);
      const line = view.state.doc.line(lineNumber);
      const column = error.column !== undefined ? Math.min(Math.max(0, error.column - 1), line.length) : 0;
      diagnostics.push({ from: line.from + column, to: line.to, severity: "error", message: error.message });
    }
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [error]);

  useEffect(() => {
    if (formatRequestId === undefined || formatRequestId === lastFormatRequestIdRef.current) return;
    lastFormatRequestIdRef.current = formatRequestId;
    const view = viewRef.current;
    if (!view) return;
    const wholeDoc = { anchor: 0, head: view.state.doc.length };
    view.dispatch({ selection: wholeDoc });
    indentSelection(view);
    view.dispatch({ selection: { anchor: 0 } });
  }, [formatRequestId]);

  return <div ref={containerRef} className="lq-script-editor-codemirror" />;
});
