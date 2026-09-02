import { analyzeScriptVariables } from "../scriptVariables";
import { analyzeScriptDescription } from "../scriptDescription";
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
import type { Candle } from "../../interfaces/Candle.interface";
import type { CustomIndicatorDef } from "../../interfaces/CustomIndicatorDef.interface";
import type { ScriptError, ScriptRunResult } from "../interfaces/ScriptRunResult.interface";
import { SCRIPT_API_COMPLETIONS } from "../scriptApiCompletions";
import { CELL_OUTPUT_SENTINEL, CELL_VALUE_SENTINEL, isCellInstrumentationLog } from "../scriptCellSentinels";
import { scriptPaneToCustomIndicatorDef } from "../scriptOutputToCustomIndicatorDef";
import { scriptIndicatorToChartIndicator } from "../scriptIndicatorToChartIndicator";
import { CandlestickChart } from "../../../CandlestickChart";
import { LqThemeProvider, useLqTheme, type LqThemeContextValue } from "../../../../../theme";
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
   *  serves both the caller's normal run bookkeeping and this component's own inline output. Purely
   *  fire-and-forget from this component's own point of view — the caller reports the *result* back
   *  separately, via the imperative handle's own `applyRunResult` (see its own doc for why a
   *  callback return value isn't enough here). */
  onRunCell?: (code: string) => void;
  /** The candles a cell's own `plot.pane`/`plot.overlay` preview (see the notebook cell-output doc
   *  block below) draws its own mini `CandlestickChart` against — the same data the caller's own
   *  "real" chart(s) already use, so the preview and the real chart never disagree about what price
   *  history looks like. `undefined`/empty simply means no pane/overlay preview ever renders (the
   *  rest of a cell's own output — logs, the auto-displayed value, an xyChart — still does), rather
   *  than an error: not every host necessarily has a natural single "the" dataset to offer here
   *  (`ScriptEditorPanel.tsx`'s own script can target any one of several open chart panels). */
  previewData?: Candle[];
}

/** Imperative handle — `runCurrentCell()` for `ScriptEditorPanel.tsx`'s own "Exécuter la cellule"
 *  toolbar button (the keyboard shortcut, Shift+Enter, reaches the same code path directly through
 *  a keymap binding; this is only needed for triggering it from outside the CodeMirror instance
 *  itself), `applyRunResult(result)` for the notebook cell-output feature's *other* half.
 *
 *  Why a push, not a return value: `onRunCell`'s own result doesn't reach the caller the same way
 *  in every host. `ScriptInteractiveTutorial.tsx` calls `engine.run(code)` directly, whose own
 *  promise resolves with exactly this run's own result — trivial to await. `ScriptEditorPanel.tsx`
 *  is a different shape entirely: its own `onRunCell` (`handleRunClick`) may need a target-panel
 *  choice from the user first (a modal, see `needsTargetChoice`), and even once chosen, `runScript`
 *  itself only ever *writes a trigger* (`ScriptDef.runRequestId`/`runDraftCode`) that some other,
 *  entirely separate component (`ScriptRunner.tsx`) picks up and eventually reports back through
 *  yet another channel (`runOutputs`) — there is no return value anywhere in that chain to await.
 *  Pushing the result in from whichever reactive state the host *already* surfaces (`engine.result`,
 *  `output?.result`) works identically in both shapes, synchronous or not: the host doesn't need to
 *  know or care that a cell run happened, it just forwards its own "latest result" state through a
 *  `useEffect` every time that changes, and this component decides for itself (via its own pending-
 *  cell bookkeeping) whether that specific result belongs to a cell run it's still waiting on. */
export interface ScriptEditorCodeMirrorHandle {
  runCurrentCell: () => void;
  /** Call whenever the host's own "most recent run result" state changes — a no-op if this
   *  component isn't currently waiting on one (e.g. the host's own full-script "Exécuter" produced
   *  it, not a cell run), so it's always safe to forward every result unconditionally. */
  applyRunResult: (result: ScriptRunResult) => void;
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

// Reads the dedicated `--lq-code-*` palette rather than the chart's own semantic colours. Those
// (accent/up/down/text-muted) all collapse to the same near-black under the e-ink palette, which is
// correct for chart data and disastrous for code: every token rendered identically. See the
// syntax-highlighting block in tokens.css.
const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--lq-code-keyword)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--lq-code-string)" },
  { tag: tags.number, color: "var(--lq-code-number)" },
  { tag: tags.comment, color: "var(--lq-code-comment)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--lq-code-function)" },
  { tag: tags.propertyName, color: "var(--lq-code-property)" },
  { tag: tags.operator, color: "var(--lq-code-operator)" },
  { tag: tags.bool, color: "var(--lq-code-number)" },
  { tag: tags.null, color: "var(--lq-code-comment)" },
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
// Matches both `plot.pane("Name")` and `plot.overlay("Name")` — same literal-string-name
// assumption as XY_CALL_RE above. Global/all-matches: unlike plot.xy (one chart, one name), a cell
// can create several panes/overlays at once, each worth its own place on the preview chart below.
const PANE_CALL_RE = /plot\.(?:pane|overlay)\(\s*["'`]([^"'`]+)["'`]/g;

export interface CellOutput {
  logs: string[];
  /** The trailing bare expression's own auto-displayed value (already `JSON.stringify`-formatted
   *  text), if the cell had one and it didn't evaluate to `undefined` (suppressed the same way a
   *  Python REPL never echoes `None`). */
  value?: string;
  xyChart?: ScriptRunResult["xyCharts"][number];
  /** Every `plot.pane`/`plot.overlay` this cell's own code named, already converted to the exact
   *  shape `CandlestickChart.defaultIndicators` accepts — see `buildCellOutput`'s own doc. Rendered
   *  as a small preview `CandlestickChart` (real price candles, not the free-standing shape
   *  `xyChart` gets) when present. */
  panePreview?: CustomIndicatorDef[];
}

/** Splits a cell run's own `result.logs`/`result.xyCharts`/`result.panes` into what belongs to
 *  *this* cell specifically — see `codeThroughCellInstrumented`'s own doc for why a single trailing
 *  segment of the flat `logs` array is enough (the target cell is always the last thing that ran).
 *  The xy-chart/pane-preview association is purely static/textual (does `cellSourceText` contain a
 *  `plot.xy("Name", …)`/`plot.pane("Name")`/`plot.overlay("Name")` call with a literal string name?)
 *  rather than anything the worker has to report back — matches how every existing tutorial example
 *  already writes a name as a literal, and avoids needing any new worker-side "which cell produced
 *  this" bookkeeping at all. The scriptId fed to `scriptPaneToCustomIndicatorDef` is a fixed
 *  placeholder, not this script's own real id — the resulting `CustomIndicatorDef` only ever feeds
 *  a throwaway preview chart, never `usePaneLayout`'s own real indicator list, so it has no need to
 *  be globally unique/stable across runs the way a real script-produced indicator's id does. */
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
  const paneNames = [...cellSourceText.matchAll(PANE_CALL_RE)].map((m) => m[1]);
  const panePreview =
    paneNames.length > 0
      ? paneNames
          .map((name) => result.panes.find((p) => p.name === name))
          .filter((p): p is ScriptRunResult["panes"][number] => p !== undefined)
          .map((pane) => scriptPaneToCustomIndicatorDef("preview", pane))
      : undefined;
  return { logs, value, xyChart, panePreview };
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
  private resizeObserver: ResizeObserver | null = null;
  constructor(
    private readonly output: CellOutput,
    private readonly previewData: Candle[] | undefined,
    private readonly theme: LqThemeContextValue
  ) {
    super();
  }
  eq(other: CellOutputWidget) {
    return (
      this.previewData === other.previewData &&
      this.theme === other.theme &&
      JSON.stringify(this.output) === JSON.stringify(other.output)
    );
  }
  toDOM(view: EditorView) {
    const container = document.createElement("div");
    container.className = "cm-cell-output";
    // This widget is a child of `.cm-content`, which — unlike `.cm-scroller`, its own non-
    // overflowing viewport — grows to fit the *longest line in the document* when line-wrapping
    // is off (as it is here): a single long line elsewhere in the script makes `.cm-content`, and
    // this widget along with it, wider than what's actually visible, forcing a chart/table inside
    // to render past the editor's own right edge rather than fitting the space genuinely on
    // screen. Constraining this widget's own max-width to `.cm-scroller`'s own real client width
    // (minus the line-number gutter, which sits beside `.cm-content` inside that same scroller) is
    // what actually fixes that, kept in sync via ResizeObserver since the editor's own window is
    // itself resizable (see ScriptEditorWindow.tsx).
    const updateMaxWidth = () => {
      const guttersWidth = view.dom.querySelector(".cm-gutters")?.getBoundingClientRect().width ?? 0;
      container.style.maxWidth = `${Math.max(0, view.scrollDOM.clientWidth - guttersWidth)}px`;
    };
    updateMaxWidth();
    this.resizeObserver = new ResizeObserver(updateMaxWidth);
    this.resizeObserver.observe(view.scrollDOM);
    this.root = createRoot(container);
    this.root.render(<CellOutputContent output={this.output} previewData={this.previewData} theme={this.theme} />);
    return container;
  }
  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    // Unmounting synchronously from inside CodeMirror's own update cycle (which this destroy()
    // call happens during) is exactly the kind of "unmount while another render is in flight"
    // React warns about — deferred a tick to be safe.
    const root = this.root;
    this.root = null;
    if (root) queueMicrotask(() => root.unmount());
  }
}

function CellOutputContent({
  output,
  previewData,
  theme,
}: {
  output: CellOutput;
  previewData: Candle[] | undefined;
  theme: LqThemeContextValue;
}) {
  if (output.logs.length === 0 && output.value === undefined && !output.xyChart && !output.panePreview?.length) return null;
  return (
    <div className="lq-script-editor-codemirror__cell-output">
      {output.logs.map((line, i) => (
        <div key={i} className="lq-script-editor-codemirror__cell-output-line">
          {line}
        </div>
      ))}
      {output.value !== undefined && <div className="lq-script-editor-codemirror__cell-output-value">{output.value}</div>}
      {output.xyChart && <ScriptXYChart chart={output.xyChart} />}
      {output.panePreview && output.panePreview.length > 0 && previewData && previewData.length > 0 && (
        <div className="lq-script-editor-codemirror__cell-chart-preview">
          <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
            <CandlestickChart
              data={previewData}
              defaultIndicators={output.panePreview.map(scriptIndicatorToChartIndicator)}
              height={220}
              symbol="Aperçu"
              showVolume={false}
              fullscreenToggle={false}
            />
          </LqThemeProvider>
        </div>
      )}
    </div>
  );
}

// One decoration pass per doc/selection/cell-output change: a border on every `// %%` line (always
// visible, not just on the active cell — "here's where the cells are" at a glance), a background
// tint on every line of whichever cell currently contains the cursor, a "▶" run button right after
// the active cell's own marker text (or after line 1 when it has none preceding it — content
// before the very first `// %%` is its own implicit leading cell), and, for every cell that has an
// entry in `cellOutputsField`, its own output block right after its last line.
function buildCellDecorations(
  state: EditorState,
  runCellAt: (startLine: number, endLine: number) => void,
  previewData: Candle[] | undefined,
  theme: LqThemeContextValue
): DecorationSet {
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
    decorations.push(
      Decoration.widget({ widget: new CellOutputWidget(output, previewData, theme), side: 1, block: true }).range(doc.line(endLine).to)
    );
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
  { value, onChange, error, formatRequestId, onRunCell, previewData },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Read by buildCellDecorations (via the two call sites below) so a `previewData` change (new
  // candles arriving, the active script's own target panel changing) reaches an already-rendered
  // pane/overlay preview without needing to tear down and rebuild the whole EditorView the way
  // changing `value` externally does — same ref-indirection reasoning as onChangeRef/onRunCellRef.
  const previewDataRef = useRef(previewData);
  previewDataRef.current = previewData;
  // A pane/overlay preview's own `<CandlestickChart>` (see CellOutputContent) mounts into a fully
  // separate React root (createRoot on the CodeMirror widget's own detached DOM node — necessary
  // since a CodeMirror widget is vanilla DOM, not something this component's own JSX can render
  // into directly), which has no ancestor `<LqThemeProvider>` of its own to read from — every
  // `useLqTheme()` call inside that chart's own sub-components would throw. This component itself
  // *is* part of the normal tree, so it reads the real, current theme here and threads it down
  // through the same ref mechanism as previewData, for a fresh `<LqThemeProvider>` wrapping just
  // that preview to use — same "read here, re-provide down there" shape `Popover.tsx` already uses
  // for its own portaled content.
  // Named appTheme, not theme, to avoid shadowing this file's own module-level `theme` (the
  // CodeMirror EditorView.theme(...) extension defined near the top) — both are in scope inside
  // this component, and JS's own lexical scoping would otherwise silently make the extensions
  // array below resolve to this one instead of that one.
  const appTheme = useLqTheme();
  const appThemeRef = useRef(appTheme);
  appThemeRef.current = appTheme;
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
  // The cell awaiting the *next* result the host pushes in via applyRunResult (see
  // ScriptEditorCodeMirrorHandle's own doc on why this is a push rather than a return value) — set
  // right when a cell run is kicked off, cleared the moment a result is actually applied to it.
  // `null` means "nothing pending," so an unrelated result (the host's own full-script run, or one
  // that arrives after this component's own doc has since changed) is safely ignored.
  const pendingCellRef = useRef<{ endLine: number; cellSourceText: string } | null>(null);
  runCellAtRef.current = (startLine, endLine) => {
    const view = viewRef.current;
    if (!view || !onRunCellRef.current) return;
    const cellSourceText = view.state.doc.sliceString(view.state.doc.line(startLine).from, view.state.doc.line(endLine).to);
    const code = codeThroughCellInstrumented(view.state, startLine, endLine);
    pendingCellRef.current = { endLine, cellSourceText };
    onRunCellRef.current(code);
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
      applyRunResult: (result) => {
        const pending = pendingCellRef.current;
        if (!pending) return;
        pendingCellRef.current = null;
        const output = buildCellOutput(result, pending.cellSourceText);
        viewRef.current?.dispatch({ effects: setCellOutputEffect.of({ endLine: pending.endLine, output }) });
      },
    }),
    []
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const cellDecorationsField = StateField.define<DecorationSet>({
      create: (state) => buildCellDecorations(state, (s, e) => runCellAtRef.current(s, e), previewDataRef.current, appThemeRef.current),
      update: (deco, tr) => {
        const cellOutputsChanged = tr.effects.some((e) => e.is(setCellOutputEffect));
        return tr.docChanged || tr.selection || cellOutputsChanged
          ? buildCellDecorations(tr.state, (s, e) => runCellAtRef.current(s, e), previewDataRef.current, appThemeRef.current)
          : deco;
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

  // Both diagnostic sources go through this one dispatch rather than a `linter()` extension
  // alongside it: `setDiagnostics` replaces the whole lint state, so a second source writing to it
  // independently would erase whichever set was dispatched first. Keyed on `value` as well as
  // `error` so the static `Variable` checks re-run as the user types — the parse is a whole-document
  // Lezer parse of a script-sized document, cheap enough to redo per keystroke — while the run
  // error, which only changes when something actually runs, rides along unchanged.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const diagnostics: Diagnostic[] = [];

    // Parameter declaration rules (const-only, known type, matching default, never reassigned) —
    // reported against the live document, so they show up before anything is ever run.
    const docLength = view.state.doc.length;
    const source = view.state.doc.toString();
    for (const issue of [...analyzeScriptDescription(source).diagnostics, ...analyzeScriptVariables(source).diagnostics]) {
      diagnostics.push({
        from: Math.min(issue.from, docLength),
        to: Math.min(issue.to, docLength),
        severity: "error",
        message: issue.message,
      });
    }

    if (error && error.line !== undefined) {
      const lineNumber = Math.min(Math.max(1, error.line), view.state.doc.lines);
      const line = view.state.doc.line(lineNumber);
      const column = error.column !== undefined ? Math.min(Math.max(0, error.column - 1), line.length) : 0;
      diagnostics.push({ from: line.from + column, to: line.to, severity: "error", message: error.message });
    }

    // setDiagnostics requires them in document order, and the run error's own line can easily sit
    // before a later `Variable` declaration.
    diagnostics.sort((a, b) => a.from - b.from);
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [error, value]);

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
