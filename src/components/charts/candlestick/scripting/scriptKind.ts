import type { ScriptParamDiagnostic } from "../interfaces/ScriptParam.interface";

/** What a script *is*, declared by a decorator on its own line — `@indicator` for something that
 *  draws on the chart, `@strategy` for something that also takes positions and is backtested (see
 *  `buildStrategyApi.ts`), `@quant` for an analysis that draws nothing and simply returns its
 *  findings. Same family as `@description` and `@block`: read from the source text before anything
 *  runs, then removed, because none of them is valid JavaScript.
 *
 *  The distinction is not cosmetic. Each kind gets an execution model the others have no use for.
 *  A strategy gets an account, orders, fills and an equity curve, plus a pane to configure and read
 *  it in. A quant script gets none of that and no drawing surface either: it runs once per symbol
 *  rather than once per bar, over a list of symbols it names itself, and what it `return`s is the
 *  whole of its output. Declaring the kind up front is what lets the editor, the indicator picker
 *  and the pane layout know what they are dealing with without executing anything first. */
export type ScriptKind = "indicator" | "strategy" | "quant" | "report";

const KIND_LINE_RE = /^[ \t]*@(indicator|strategy|quant|report)\b.*$/gm;
/** The symbols a `@quant` names, if any: everything between its parentheses. Tolerant on purpose —
 *  `@quant(AAPL, MSFT)`, `@quant("AAPL", "MSFT")` and `@quant(["AAPL", "MSFT"])` all mean the same
 *  list, and a ticker is whatever a ticker looks like (letters, digits, and the `.`/`-`/`:`/`_`
 *  that real ones carry: BRK.B, BTC-USD, NASDAQ:AAPL). */
const QUANT_SYMBOLS_RE = /^[ \t]*@(?:quant|report)[ \t]*\(([^)]*)\)/m;
const TICKER_RE = /[A-Za-z0-9][A-Za-z0-9.:_-]*/g;

/** The symbols a `@quant` script declares, in source order and without duplicates.
 *
 *  Empty when it declared none, which is not an error: the analysis then runs on the chart's own
 *  symbol alone, the same thing every other kind of script already does. */
export function analyzeQuantSymbols(code: string): string[] {
  const match = QUANT_SYMBOLS_RE.exec(code);
  if (match === null) return [];
  const found = match[1].match(TICKER_RE) ?? [];
  return [...new Set(found.map((t) => t.toUpperCase()))];
}

export interface ScriptKindAnalysis {
  kind: ScriptKind;
  /** `@quant` only — the symbols it named. Empty for every other kind, and for a `@quant` that
   *  named none (see `analyzeQuantSymbols`). */
  symbols: string[];
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
  if (matches.length === 0) return { kind: "indicator", declared: false, symbols: [], diagnostics };

  const kinds = new Set(matches.map((m) => m[1]));
  for (const extra of matches.slice(1)) {
    const at = extra.index ?? 0;
    diagnostics.push({
      from: at,
      to: at + extra[0].length,
      message:
        kinds.size > 1
          ? "Un script est @indicator, @strategy, @quant ou @report — pas plusieurs à la fois. Seule la première déclaration est prise en compte."
          : `Un script ne déclare qu'un seul @${extra[1]}.`,
    });
  }
  const kind = matches[0][1] as ScriptKind;
  // `@report(AAPL)` names its subject the same way `@quant(...)` names its list — one symbol
  // rather than several, but read by the same parser rather than a second one that could disagree.
  return { kind, declared: true, symbols: kind === "quant" || kind === "report" ? analyzeQuantSymbols(code) : [], diagnostics };
}

/** Removes the declaration so the remaining source is valid JavaScript again — blanking its line
 *  in place rather than deleting it, so every line after it keeps its number and a runtime error
 *  still points where the user is looking. Same contract as `stripScriptDescription`/
 *  `stripScriptBlocks`, which run alongside it (see `useScriptEngine.run`). */
export function stripScriptKind(code: string): string {
  return code.replace(KIND_LINE_RE, "");
}

/** Every `plot.*` call in a script's own source, as diagnostics.
 *
 *  A `@quant` script has no drawing surface: it produces no pane and no overlay, so a `plot` call
 *  there is not a small mistake to be tolerated but a misunderstanding of what the script is. Said
 *  in the editor, where it can be read before running, *and* enforced in the worker, where `plot`
 *  is replaced by an API that throws — a diagnostic alone would be advice, and this is a rule. */
const PLOT_CALL_RE = /\bplot\s*\.\s*([A-Za-z_$][\w$]*)/g;

export function analyzeQuantPlotCalls(code: string, kind: "quant" | "report" = "quant"): ScriptParamDiagnostic[] {
  const instead = kind === "quant" ? "Renvoyez vos résultats avec « return » à la place." : "Écrivez le rapport avec « report.* » à la place.";
  const what = kind === "quant" ? "Une analyse @quant" : "Un rapport @report";
  return [...code.matchAll(PLOT_CALL_RE)].map((m) => ({
    from: m.index ?? 0,
    to: (m.index ?? 0) + m[0].length,
    message: `${what} n'affiche rien sur le graphique : « plot.${m[1]} » n'y est pas disponible. ${instead}`,
  }));
}
