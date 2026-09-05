import type { ScriptFile } from "../interfaces/ScriptDef.interface";
import { analyzeScriptDescription } from "./scriptDescription";

/** A script name turned into something an import can resolve against (see `ScriptDef.files`, whose
 *  names are matched with an optional `./` and `.js`). Accents and spaces are the common case in
 *  French script names and neither survives an import specifier. */
function moduleName(scriptName: string): string {
  const slug = scriptName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "indicateur";
}

/** Top-level `export function X` / `export const X` bindings an indicator already exposes. A
 *  deliberately plain scan rather than a parse: this only has to find what a human wrote on a line
 *  of its own to generate a *starting point*, and a missed binding costs a comment, not
 *  correctness — the generated script is opened in the editor for the author to finish either way. */
export function exportedBindings(code: string): string[] {
  return [...code.matchAll(/^[ \t]*export\s+(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
}

export interface GeneratedStrategy {
  name: string;
  code: string;
  files: ScriptFile[];
}

/** Builds a `@strategy` script from an existing indicator, as two files: the indicator kept whole
 *  as a module, and an entry that imports it and holds the trading rules.
 *
 *  Two files rather than one copied blob, which is the whole point: the indicator stays a single
 *  source of truth, so fixing it fixes every strategy built on it. A copy would drift, and the
 *  drift is invisible until a trade fires on a rule the author already believed they had fixed.
 *
 *  What the entry can do depends on what the indicator exposes. If it exports bindings, they are
 *  imported and one of them is wired into a worked example. If it exports nothing — the common case
 *  for an indicator that only ever calls `plot.*` — the import is kept for its drawing side effect
 *  and the entry says, in the one place the author is already looking, exactly what to add to the
 *  indicator to make its value reusable. Generating a broken import instead would be worse than
 *  generating none. */
export function strategyFromIndicator(indicatorName: string, indicatorCode: string): GeneratedStrategy {
  const module = moduleName(indicatorName);
  const bindings = exportedBindings(indicatorCode);
  const first = bindings[0];
  const { description } = analyzeScriptDescription(indicatorCode);

  const header = `@strategy
@description "///${indicatorName} — stratégie///
${description ? "Bâtie sur l'indicateur du même nom, importé tel quel." : "Bâtie sur l'indicateur du même nom."}

//À compléter//
Les règles d'entrée et de sortie sont un point de départ : ajustez-les, puis lisez le facteur de
profit et le drawdown dans le panneau sous les bougies.
"
`;

  const body = first
    ? `@block Ce que l'indicateur expose

// Importé, pas copié : corriger « ${indicatorName} » corrige aussi cette stratégie.
import { ${bindings.join(", ")} } from "./${module}";

const valeur = ${first}();

@block Les règles

// Point de départ à ajuster. Un seuil nu suffit rarement — c'est en général un CHANGEMENT d'état
// qu'on veut détecter (voir l'exemple « Croisement de moyennes », qui mémorise l'état précédent
// avec state.* pour n'entrer qu'au moment du croisement, pas à chaque bougie de la tendance).
if (valeur !== null && strategy.position() === "flat") {
  // strategy.long("Entrée");
}

if (valeur !== null && strategy.position() === "long") {
  // strategy.close("Sortie");
}`
    : `@block L'indicateur

// Importé pour ce qu'il dessine : « ${indicatorName} » n'exporte aucune valeur, donc il trace ses
// courbes mais cette stratégie ne peut encore rien en lire.
import "./${module}";

// Pour rendre sa valeur réutilisable, extrayez le calcul dans une fonction exportée, côté
// indicateur — et l'indicateur continue de fonctionner exactement comme avant :
//
//     export function signal() {
//       return ta.rsi(market.series("close", 70), 14);
//     }
//     plot.pane("RSI").line("RSI", signal());
//
// puis, ici :
//
//     import { signal } from "./${module}";
//     const valeur = signal();

@block Les règles

// En attendant, les règles peuvent lire le marché directement.
const cours = market.close(0);

if (cours !== null && strategy.position() === "flat") {
  // strategy.long("Entrée");
}`;

  return {
    name: `${indicatorName} — stratégie`,
    code: `${header}\n${body}\n`,
    files: [{ name: module, code: indicatorCode }],
  };
}
