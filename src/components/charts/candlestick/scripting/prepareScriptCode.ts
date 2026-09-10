import { analyzeScriptVariables, applyScriptParams } from "./scriptVariables";
import { stripScriptDescription } from "./scriptDescription";
import { stripScriptBlocks } from "./scriptBlocks";
import { stripScriptKind } from "./scriptKind";
import type { ScriptDef, ScriptFile } from "../interfaces/ScriptDef.interface";

/** The code actually handed to the engine.
 *
 *  Two things happen here, and both have to happen or nothing runs. The decorators — `@indicator`,
 *  `@strategy`, `@quant`, `@report`, `@description`, `@block` — are not JavaScript, so they are
 *  blanked in place (line numbers preserved, so a runtime error still points where the author is
 *  looking). And every `const NAME = new Variable(type, default)` is swapped for the value the
 *  settings currently hold — `Variable` itself is never injected into the sandbox, so a source that
 *  reaches the compiler with one left in it fails with `Variable is not defined`.
 *
 *  Shared rather than reimplemented per caller for exactly that reason: the examples runner did its
 *  own thing and skipped the substitution, so the five documented examples that declare parameters
 *  — the Pine Script port among them — all failed with that error, in the documentation, where the
 *  reader is most likely to conclude the language is broken.
 *
 *  Resolved at each run rather than once at save time, so a parameter change picks up the new
 *  value, and so does an edit that moves a default. */
export function withScriptParams(source: string, paramValues: ScriptDef["paramValues"]): string {
  const code = stripScriptKind(stripScriptBlocks(stripScriptDescription(source)));
  const { params } = analyzeScriptVariables(code);
  return applyScriptParams(code, params, paramValues);
}

/** The same substitution across every extra file of a multi-file script. A file declares its own
 *  parameters exactly like the entry does and reads the same `paramValues`, so a value set once in
 *  the settings reaches whichever file actually declares it. */
export function withScriptParamsForFiles(files: ScriptFile[] | undefined, paramValues: ScriptDef["paramValues"]): ScriptFile[] | undefined {
  if (!files || files.length === 0) return undefined;
  return files.map((file) => ({ name: file.name, code: withScriptParams(file.code, paramValues) }));
}
