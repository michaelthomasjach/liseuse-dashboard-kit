/** The five types a `new Variable(type, default)` declaration may name — the exact set the settings
 *  UI knows how to render an input for, which is why it's a closed union rather than open-ended. */
export const SCRIPT_PARAM_TYPES = ["string", "number", "Array[string]", "Array[number]", "color"] as const;

export type ScriptParamType = (typeof SCRIPT_PARAM_TYPES)[number];

/** A parameter's own value, in whichever shape its type implies. `color` is a `string` at runtime
 *  (a `#rrggbb` literal) — it's a distinct *type* only so the settings UI can offer a color picker
 *  instead of a free-text field. */
export type ScriptParamValue = string | number | string[] | number[];

/** One `const NAME = new Variable(type, default)` declaration found in a script's source — the
 *  bridge between the script text and the settings UI. Discovered by parsing rather than by running
 *  anything: the declaration's own *name* is what the settings panel labels its field with, and a
 *  `new Variable(...)` call has no way to know the identifier it was assigned to. See
 *  `analyzeScriptVariables`. */
export interface ScriptParam {
  name: string;
  type: ScriptParamType;
  defaultValue: ScriptParamValue;
  /** Free text from the declaration's own `{ description }` option, shown under the field in the
   *  settings form. Absent when the declaration omitted it — the field then stands on its own name,
   *  which for something like `ATR_MULT` is often enough. */
  description?: string;
  /** Source span of the whole `new Variable(...)` initializer — what `applyScriptParams` swaps out
   *  for the effective value before the code is compiled. */
  from: number;
  to: number;
}

/** A problem with a `Variable` declaration, positioned in the script source so the editor can show
 *  it inline. Deliberately not reusing `ScriptError` (line/column, produced by a *run*): these are
 *  found by parsing, exist before anything runs, and are reported as character offsets because
 *  that's what CodeMirror's own lint API takes. */
export interface ScriptParamDiagnostic {
  from: number;
  to: number;
  message: string;
}
