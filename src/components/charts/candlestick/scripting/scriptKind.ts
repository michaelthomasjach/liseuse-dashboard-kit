import type { ScriptParamDiagnostic } from "../interfaces/ScriptParam.interface";

/** What a script *is*, declared by a decorator on its own line — `@indicator` for something that
 *  draws on the chart, `@strategy` for something that also takes positions and is backtested (see
 *  `buildStrategyApi.ts`). Same family as `@description` and `@block`: read from the source text
 *  before anything runs, then removed, because none of the three is valid JavaScript.
 *
 *  The distinction is not cosmetic. A strategy gets an execution model an indicator has no use for
 *  — an account, orders, fills, an equity curve — and a whole pane of its own to configure and read
 *  it in. Declaring it up front is what lets the editor, the indicator picker and the pane layout
 *  know which of the two they are dealing with without executing anything first. */
export type ScriptKind = "indicator" | "strategy";

const KIND_LINE_RE = /^[ \t]*@(indicator|strategy)\b.*$/gm;

export interface ScriptKindAnalysis {
  kind: ScriptKind;
  /** True only when the script actually declared one. A script with no decorator is treated as an
   *  indicator (see `analyzeScriptKind`) — this says whether that was its own choice or the
   *  fallback, which is what lets the editor hint at the missing declaration without treating a
   *  script written before decorators existed as broken. */
  declared: boolean;
  diagnostics: ScriptParamDiagnostic[];
}

/** Finds a script's own `@indicator`/`@strategy` declaration.
 *
 *  Absent, the script is an indicator. That is the honest default rather than an error: it is what
 *  every script written before this decorator existed already was, and what the overwhelming
 *  majority of scripts will keep being. Declaring both is a real contradiction, though — a script
 *  cannot be backtested *and* be a plain drawing — so that is a diagnostic, and the first
 *  declaration wins so the editor still has something coherent to show while the user fixes it. */
export function analyzeScriptKind(code: string): ScriptKindAnalysis {
  const diagnostics: ScriptParamDiagnostic[] = [];
  const matches = [...code.matchAll(KIND_LINE_RE)];
  if (matches.length === 0) return { kind: "indicator", declared: false, diagnostics };

  const kinds = new Set(matches.map((m) => m[1]));
  for (const extra of matches.slice(1)) {
    const at = extra.index ?? 0;
    diagnostics.push({
      from: at,
      to: at + extra[0].length,
      message:
        kinds.size > 1
          ? "Un script est soit @indicator, soit @strategy — pas les deux. Seule la première déclaration est prise en compte."
          : `Un script ne déclare qu'un seul @${extra[1]}.`,
    });
  }
  return { kind: matches[0][1] as ScriptKind, declared: true, diagnostics };
}

/** Removes the declaration so the remaining source is valid JavaScript again — blanking its line
 *  in place rather than deleting it, so every line after it keeps its number and a runtime error
 *  still points where the user is looking. Same contract as `stripScriptDescription`/
 *  `stripScriptBlocks`, which run alongside it (see `useScriptEngine.run`). */
export function stripScriptKind(code: string): string {
  return code.replace(KIND_LINE_RE, "");
}
