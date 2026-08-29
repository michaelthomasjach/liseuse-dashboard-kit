import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
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
export function ScriptEditorCodeMirror({ value, onChange, error, formatRequestId }: ScriptEditorCodeMirrorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastFormatRequestIdRef = useRef(formatRequestId);

  useEffect(() => {
    if (!containerRef.current) return;
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
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
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
}
