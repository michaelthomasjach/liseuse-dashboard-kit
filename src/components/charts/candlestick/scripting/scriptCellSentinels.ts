/** Two invisible, unmistakably-non-user-text markers `ScriptEditorCodeMirror.tsx` splices into the
 *  code sent to the worker for a cell run (see `codeThroughCellInstrumented`'s own doc there) —
 *  kept in this tiny, CodeMirror-free module rather than in that file itself so the panels that
 *  need `isCellInstrumentationLog` below (`ScriptEditorPanel.tsx`, `ScriptInteractiveTutorial.tsx`)
 *  can import it as a plain static import without defeating `ScriptEditorCodeMirror.tsx`'s own
 *  `lazy()`/dynamic-`import()` loading (a static import of *any* export from that file would pull
 *  in the whole CodeMirror bundle eagerly, exactly what that lazy-loading exists to avoid — see
 *  that file's own doc). */
export const CELL_OUTPUT_SENTINEL = "  lq-cell-output  ";
export const CELL_VALUE_SENTINEL = "  lq-cell-value  ";

/** Whether a `ScriptRunResult.logs` entry is one of the cell-run instrumentation markers above
 *  rather than something the user's own script logged — every consumer that renders `logs` as a
 *  visible "console" panel filters these out with this, so a cell run (Shift+Enter, the per-cell
 *  "▶" button) never leaks sentinel-looking garbage into that shared panel. */
export function isCellInstrumentationLog(line: string): boolean {
  return line.startsWith(CELL_OUTPUT_SENTINEL) || line.startsWith(CELL_VALUE_SENTINEL);
}
