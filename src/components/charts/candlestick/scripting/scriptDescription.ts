import type { ScriptParamDiagnostic } from "../interfaces/ScriptParam.interface";

/** The keyword itself. Not valid JavaScript — which is the point: it can never collide with real
 *  code, and `stripScriptDescription` removes it before anything compiles. */
const KEYWORD = "@description";

/** Matches the keyword only at the start of its own line (leading whitespace allowed), so the same
 *  word inside a comment (`// @description …`) or in the middle of an expression is never mistaken
 *  for the declaration. */
const KEYWORD_LINE_RE = /^[ \t]*@description\b/gm;

export interface ScriptDescriptionAnalysis {
  /** The declared text, or `null` when the script declares none. */
  description: string | null;
  /** Source span of the whole `@description "…"` declaration, for stripping. Both -1 when absent. */
  from: number;
  to: number;
  diagnostics: ScriptParamDiagnostic[];
}

/** Reads the string literal that follows the keyword, starting at `index` (just past it). Returns
 *  the raw text with escapes resolved, plus where the literal ended. */
function readStringLiteral(code: string, index: number): { text: string; end: number } | null {
  let i = index;
  // The opening quote may sit on a later line than the keyword — the example in the docs puts the
  // text itself on the following lines.
  while (i < code.length && /\s/.test(code[i])) i++;
  const quote = code[i];
  if (quote !== '"' && quote !== "'") return null;
  i++;

  let text = "";
  while (i < code.length) {
    const char = code[i];
    if (char === "\\" && i + 1 < code.length) {
      const next = code[i + 1];
      text += next === "n" ? "\n" : next === "t" ? "\t" : next;
      i += 2;
      continue;
    }
    if (char === quote) return { text, end: i + 1 };
    text += char;
    i++;
  }
  return null;
}

/** Finds a script's own `@description "…"` declaration. Deliberately a scan rather than a parse:
 *  the declaration isn't JavaScript, so the JS grammar has nothing to say about it — and it has to
 *  be readable from a script that doesn't compile at all, since the description is documentation
 *  and shouldn't vanish the moment there's a typo elsewhere.
 *
 *  Position isn't policed. The convention is to put it at the very top, but a declaration further
 *  down still works and still strips cleanly, so there's nothing here worth failing a script over. */
export function analyzeScriptDescription(code: string): ScriptDescriptionAnalysis {
  const diagnostics: ScriptParamDiagnostic[] = [];
  const matches = [...code.matchAll(KEYWORD_LINE_RE)];
  if (matches.length === 0) return { description: null, from: -1, to: -1, diagnostics };

  const [first, ...rest] = matches;
  for (const extra of rest) {
    const at = extra.index ?? 0;
    diagnostics.push({ from: at, to: at + KEYWORD.length, message: "Un script ne peut déclarer qu'une seule @description." });
  }

  const keywordAt = (first.index ?? 0) + first[0].indexOf(KEYWORD);
  const literal = readStringLiteral(code, keywordAt + KEYWORD.length);
  if (!literal) {
    diagnostics.push({
      from: keywordAt,
      to: keywordAt + KEYWORD.length,
      message: '@description doit être suivi d\'un texte entre guillemets : @description "…".',
    });
    return { description: null, from: -1, to: -1, diagnostics };
  }

  return { description: literal.text, from: keywordAt, to: literal.end, diagnostics };
}

/** Removes the declaration so the remaining source is valid JavaScript again. Replaced by exactly
 *  the newlines it spanned rather than deleted outright — the declaration is routinely several
 *  lines long, and collapsing it would shift every line after it, throwing off the line numbers a
 *  runtime error reports (see runScript's own offset doc). */
export function stripScriptDescription(code: string): string {
  const { from, to } = analyzeScriptDescription(code);
  if (from < 0) return code;
  const spannedLines = code.slice(from, to).split("\n").length - 1;
  return code.slice(0, from) + "\n".repeat(spannedLines) + code.slice(to);
}
