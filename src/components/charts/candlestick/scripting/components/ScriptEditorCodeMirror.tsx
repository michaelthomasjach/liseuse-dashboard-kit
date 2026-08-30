import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EditorState, StateEffect, StateField, type Text } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  Decoration,
  WidgetType,
  type DecorationSet,
  type KeyBinding,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentSelection, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, indentOnInput, syntaxHighlighting, syntaxTree, HighlightStyle } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { tags } from "@lezer/highlight";
import type { ScriptError, ScriptRunResult } from "../interfaces/ScriptRunResult.interface";
import { SCRIPT_API_COMPLETIONS } from "../scriptApiCompletions";
import { CELL_OUTPUT_SENTINEL, CELL_VALUE_SENTINEL, isCellInstrumentationLog } from "../scriptCellSentinels";
import { ScriptXYChart } from "./ScriptXYChart";
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
  /** Runs the `// %%`-delimited cell containing the cursor — fires on Shift+Enter, the imperative
   *  `runCurrentCell()` handle, and the per-cell "▶" button this component now draws on the active
   *  cell (see the notebook cell-output doc block below). Always called with *instrumented* code
   *  (a couple of invisible sentinel `console.log` calls spliced in — see
   *  `codeThroughCellInstrumented`'s own doc), never the cell's own plain text, so the same prop
   *  serves both the caller's normal run bookkeeping and this component's own inline output.
   *  Returning the run's own `ScriptRunResult` (or a promise of one) is optional — a caller with no
   *  notion of "run" simply gets nothing back and this component's own inline cell output stays
   *  empty, same graceful degradation as when the prop is omitted entirely. */
  onRunCell?: (code: string) => void | ScriptRunResult | Promise<ScriptRunResult>;
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

// The first line of the cell containing `lineNumber` — the closest marker line at or before it, or
// the very first line of the document when nothing precedes it (content before the first `// %%`
// is its own implicit leading cell).
function cellStartLine(lineNumber: number, markerLines: number[]): number {
  return [...markerLines].reverse().find((m) => m <= lineNumber) ?? 1;
}

const cellMarkerLineDeco = Decoration.line({ attributes: { class: "cm-cell-marker" } });
const cellActiveLineDeco = Decoration.line({ attributes: { class: "cm-cell-active" } });

// The last top-level statement inside [from, to) that's a "bare" expression — one whose value a
// REPL/Jupyter would auto-display because nothing else captures it (not assigned to a variable,
// not a declaration, not a control-flow construct) — via the Lezer parse tree CodeMirror already
// maintains for syntax highlighting (`syntaxTree`, `@codemirror/language`), not a hand-rolled regex
// heuristic: `ExpressionStatement` nodes whose own single child isn't itself an
// `AssignmentExpression` (`a = 5` is technically an expression statement too, but Jupyter/a REPL
// never auto-displays a bare assignment either). Returns the expression's own exact text range
// (trailing `;` excluded, so it can be spliced into a wrapping call) or `null` when the cell's own
// last statement doesn't qualify — a script that ends in `state.set(...)` or an `if` block simply
// gets no auto-displayed value, same as Python/Jupyter itself.
function trailingBareExpression(state: EditorState, from: number, to: number): { from: number; to: number } | null {
  const tree = syntaxTree(state);
  let node = tree.topNode.firstChild;
  let last: typeof node = null;
  while (node) {
    if (node.from >= from && node.to <= to) last = node;
    if (node.from >= to) break;
    node = node.nextSibling;
  }
  if (!last || last.name !== "ExpressionStatement") return null;
  if (last.firstChild?.name === "AssignmentExpression") return null;
  let end = last.to;
  if (state.doc.sliceString(end - 1, end) === ";") end -= 1;
  return { from: last.from, to: end };
}

/** The code to actually send to the worker for a cell run (the per-cell "▶" button, Shift+Enter, or
 *  the imperative `runCurrentCell()` handle) — from the very start of the document through the end
 *  of the target cell, *not* that cell in isolation (this engine has no persistent variable scope
 *  between separate runs, so an isolated cell would throw the moment it read a `const` defined in
 *  an earlier one — see this same reasoning on the original, uninstrumented version of this
 *  function this replaced). On top of that slice, two invisible `console.log` calls are spliced in,
 *  purely so this component's own inline cell-output widget can tell "what did *this* run produce"
 *  apart from `result.logs`' own bar-by-bar-accumulated history, entirely on the main thread with
 *  zero worker changes:
 *   - Right where the target cell's own code starts: `console.log(CELL_OUTPUT_SENTINEL)`. Since the
 *     target cell is always the *last* thing in the code sent (nothing after it exists in this
 *     slice), everything logged after this sentinel's own *last* occurrence in the returned
 *     `logs` — the final bar's own pass through it — is this cell's own output, however many bars
 *     actually ran underneath.
 *   - If the cell's own last statement is a bare expression (see `trailingBareExpression`): wraps
 *     it as `console.log(CELL_VALUE_SENTINEL + JSON.stringify(<expr>))`, so a cell ending in e.g.
 *     `maFonction(a, 10)` with no `console.log` of its own still surfaces its value inline, the same
 *     "last expression auto-displays" convention a real Jupyter cell already has. */
function codeThroughCellInstrumented(state: EditorState, startLine: number, endLine: number): string {
  const doc = state.doc;
  const cellStart = doc.line(startLine).from;
  const cellEnd = doc.line(endLine).to;
  const trailing = trailingBareExpression(state, cellStart, cellEnd);
  const prefix = doc.sliceString(0, cellStart);
  const boundarySentinel = `console.log(${JSON.stringify(CELL_OUTPUT_SENTINEL)});\n`;
  let body: string;
  if (trailing) {
    const before = doc.sliceString(cellStart, trailing.from);
    const exprText = doc.sliceString(trailing.from, trailing.to);
    const after = doc.sliceString(trailing.to, cellEnd);
    body = `${before}console.log(${JSON.stringify(CELL_VALUE_SENTINEL)} + JSON.stringify(${exprText}));${after}`;
  } else {
    body = doc.sliceString(cellStart, cellEnd);
  }
  return `${prefix}${boundarySentinel}${body}`;
}

const XY_CALL_RE = /plot\.xy\(\s*["'`]([^"'`]+)["'`]/;

export interface CellOutput {
  logs: string[];
  /** The trailing bare expression's own auto-displayed value (already `JSON.stringify`-formatted
   *  text), if the cell had one and it didn't evaluate to `undefined` (suppressed the same way a
   *  Python REPL never echoes `None`). */
  value?: string;
  xyChart?: ScriptRunResult["xyCharts"][number];
}

/** Splits a cell run's own `result.logs`/`result.xyCharts` into what belongs to *this* cell
 *  specifically — see `codeThroughCellInstrumented`'s own doc for why a single trailing segment of
 *  the flat `logs` array is enough (the target cell is always the last thing that ran). The xy-
 *  chart association is purely static/textual (does `cellSourceText` contain a `plot.xy("Name", …)`
 *  call with a literal string name?) rather than anything the worker has to report back — matches
 *  how every existing tutorial example already writes a chart's own name as a literal, and avoids
 *  needing any new worker-side "which cell produced this" bookkeeping at all. */
function buildCellOutput(result: ScriptRunResult, cellSourceText: string): CellOutput {
  const boundaryIndex = result.logs.lastIndexOf(CELL_OUTPUT_SENTINEL);
  const tail = boundaryIndex === -1 ? result.logs : result.logs.slice(boundaryIndex + 1);
  const logs: string[] = [];
  let value: string | undefined;
  for (const line of tail) {
    if (line.startsWith(CELL_VALUE_SENTINEL)) {
      const text = line.slice(CELL_VALUE_SENTINEL.length);
      if (text !== "undefined") value = text;
    } else if (!isCellInstrumentationLog(line)) {
      logs.push(line);
    }
  }
  const xyMatch = XY_CALL_RE.exec(cellSourceText);
  const xyChart = xyMatch ? result.xyCharts.find((c) => c.name === xyMatch[1]) : undefined;
  return { logs, value, xyChart };
}

const setCellOutputEffect = StateEffect.define<{ endLine: number; output: CellOutput }>();

// Keyed by a cell's own *end line number* — a plain, workable-enough identity for "which cell is
// this" given cells are re-derived from the document on every change anyway (see the docChanged
// branch below: any edit at all clears every stored output rather than risk silently attributing a
// stale one to the wrong, since-shifted cell — simple and always correct, at the cost of a cell's
// own inline output disappearing the moment *any* part of the document is touched, not just that
// cell, until it's re-run).
const cellOutputsField = StateField.define<Map<number, CellOutput>>({
  create: () => new Map(),
  update: (value, tr) => {
    if (tr.docChanged) return new Map();
    let next = value;
    for (const effect of tr.effects) {
      if (!effect.is(setCellOutputEffect)) continue;
      if (next === value) next = new Map(value);
      next.set(effect.value.endLine, effect.value.output);
    }
    return next;
  },
});

class CellRunButtonWidget extends WidgetType {
  constructor(private readonly onClick: () => void) {
    super();
  }
  eq() {
    return false;
  }
  toDOM() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-cell-run-button";
    button.title = "Exécuter cette cellule (Maj+Entrée)";
    button.innerHTML =
      '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M7 4.8v14.4a1 1 0 0 0 1.53.85l11.4-7.2a1 1 0 0 0 0-1.7L8.53 3.95A1 1 0 0 0 7 4.8Z"/></svg>';
    // Both listeners needed: mousedown alone would still let the click reach CodeMirror's own
    // selection handling first and move the cursor away from this cell before onClick runs.
    button.addEventListener("mousedown", (e) => e.preventDefault());
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClick();
    });
    return button;
  }
  ignoreEvent() {
    return true;
  }
}

class CellOutputWidget extends WidgetType {
  private root: Root | null = null;
  constructor(private readonly output: CellOutput) {
    super();
  }
  eq(other: CellOutputWidget) {
    return JSON.stringify(this.output) === JSON.stringify(other.output);
  }
  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-cell-output";
    this.root = createRoot(container);
    this.root.render(<CellOutputContent output={this.output} />);
    return container;
  }
  destroy() {
    // Unmounting synchronously from inside CodeMirror's own update cycle (which this destroy()
    // call happens during) is exactly the kind of "unmount while another render is in flight"
    // React warns about — deferred a tick to be safe.
    const root = this.root;
    this.root = null;
    if (root) queueMicrotask(() => root.unmount());
  }
}

function CellOutputContent({ output }: { output: CellOutput }) {
  if (output.logs.length === 0 && output.value === undefined && !output.xyChart) return null;
  return (
    <div className="lq-script-editor-codemirror__cell-output">
      {output.logs.map((line, i) => (
        <div key={i} className="lq-script-editor-codemirror__cell-output-line">
          {line}
        </div>
      ))}
      {output.value !== undefined && <div className="lq-script-editor-codemirror__cell-output-value">{output.value}</div>}
      {output.xyChart && <ScriptXYChart chart={output.xyChart} />}
    </div>
  );
}

// One decoration pass per doc/selection/cell-output change: a border on every `// %%` line (always
// visible, not just on the active cell — "here's where the cells are" at a glance), a background
// tint on every line of whichever cell currently contains the cursor, a "▶" run button right after
// the active cell's own marker text (or after line 1 when it has none preceding it — content
// before the very first `// %%` is its own implicit leading cell), and, for every cell that has an
// entry in `cellOutputsField`, its own output block right after its last line.
function buildCellDecorations(state: EditorState, runCellAt: (startLine: number, endLine: number) => void): DecorationSet {
  const doc = state.doc;
  const markerLines = findCellMarkerLines(doc);
  if (markerLines.length === 0 && state.field(cellOutputsField).size === 0) return Decoration.none;
  const markerLineSet = new Set(markerLines);
  const cursorLine = doc.lineAt(state.selection.main.head).number;
  const activeStart = cellStartLine(cursorLine, markerLines);
  const activeEnd = cellEndLine(doc, cursorLine, markerLines);
  const decorations = [];
  for (let i = 1; i <= doc.lines; i++) {
    if (markerLineSet.has(i)) decorations.push(cellMarkerLineDeco.range(doc.line(i).from));
    else if (i >= activeStart && i <= activeEnd) decorations.push(cellActiveLineDeco.range(doc.line(i).from));
  }
  const buttonLine = activeStart === 1 && !markerLineSet.has(1) ? 1 : activeStart;
  decorations.push(
    Decoration.widget({ widget: new CellRunButtonWidget(() => runCellAt(activeStart, activeEnd)), side: 1 }).range(doc.line(buttonLine).to)
  );
  for (const [endLine, output] of state.field(cellOutputsField)) {
    if (endLine < 1 || endLine > doc.lines) continue;
    decorations.push(Decoration.widget({ widget: new CellOutputWidget(output), side: 1, block: true }).range(doc.line(endLine).to));
  }
  return Decoration.set(decorations, true);
}

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
  // Read by the run-button widget's own click handler and by the keymap/imperative-handle paths
  // below — a stable function identity (the ref itself never changes) closing over whichever
  // onRunCell is current, so `buildCellDecorations`' own widget closures (rebuilt only when the
  // document/cursor/cell-output actually change) never go stale.
  const runCellAtRef = useRef<(startLine: number, endLine: number) => void>(() => {});
  runCellAtRef.current = (startLine, endLine) => {
    const view = viewRef.current;
    if (!view || !onRunCellRef.current) return;
    const cellSourceText = view.state.doc.sliceString(view.state.doc.line(startLine).from, view.state.doc.line(endLine).to);
    const code = codeThroughCellInstrumented(view.state, startLine, endLine);
    const outcome = onRunCellRef.current(code);
    const resultPromise: Promise<ScriptRunResult> | null =
      outcome && typeof (outcome as Promise<ScriptRunResult>).then === "function"
        ? (outcome as Promise<ScriptRunResult>)
        : outcome
          ? Promise.resolve(outcome as ScriptRunResult)
          : null;
    resultPromise?.then((result) => {
      const output = buildCellOutput(result, cellSourceText);
      viewRef.current?.dispatch({ effects: setCellOutputEffect.of({ endLine, output }) });
    });
  };

  useImperativeHandle(
    ref,
    () => ({
      runCurrentCell: () => {
        const view = viewRef.current;
        if (!view) return;
        const markerLines = findCellMarkerLines(view.state.doc);
        const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
        runCellAtRef.current(cellStartLine(cursorLine, markerLines), cellEndLine(view.state.doc, cursorLine, markerLines));
      },
    }),
    []
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const cellDecorationsField = StateField.define<DecorationSet>({
      create: (state) => buildCellDecorations(state, (s, e) => runCellAtRef.current(s, e)),
      update: (deco, tr) => {
        const cellOutputsChanged = tr.effects.some((e) => e.is(setCellOutputEffect));
        return tr.docChanged || tr.selection || cellOutputsChanged ? buildCellDecorations(tr.state, (s, e) => runCellAtRef.current(s, e)) : deco;
      },
      provide: (field) => EditorView.decorations.from(field),
    });
    const runCellBinding: KeyBinding = {
      key: "Shift-Enter",
      run: (view) => {
        const markerLines = findCellMarkerLines(view.state.doc);
        const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
        runCellAtRef.current(cellStartLine(cursorLine, markerLines), cellEndLine(view.state.doc, cursorLine, markerLines));
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
        cellOutputsField,
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
