import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import { analyzeScriptKind } from "../scripting/scriptKind";

/** One entry of the `/` menu.
 *
 *  Two kinds, and the difference matters. A *command* is a whole request with a hole in it —
 *  "/strategie" becomes "Sur la stratégie … : " and leaves the cursor where the question goes. A
 *  *reference* is a noun — a symbol, a script — that gets inserted into whatever sentence is being
 *  written. Both are plain text substitution: nothing here is a hidden instruction the model reads
 *  differently from what the user can see in the box, which is what keeps the feature honest. */
export interface SlashCommand {
  /** What is typed after the slash. */
  key: string;
  label: string;
  hint: string;
  /** The text the box is filled with. `…` marks where the caret lands. */
  template: string;
  group: string;
}

const FIXED: SlashCommand[] = [
  {
    key: "indicateurs",
    label: "/indicateurs",
    hint: "Afficher des indicateurs sur le graphique",
    template: "Sur le graphique affiché, ajoute …",
    group: "Graphique",
  },
  {
    key: "canaux",
    label: "/canaux",
    hint: "Tracer les canaux d'évolution des prix entre deux dates",
    template: "Sur le graphique, dessine les canaux d'évolution des prix entre le … et le …",
    group: "Graphique",
  },
  {
    key: "explique",
    label: "/explique",
    hint: "Lire ce qui est affiché et le commenter",
    template: "Regarde le graphique tel qu'il est affiché et explique-moi …",
    group: "Graphique",
  },
  {
    key: "strategie",
    label: "/strategie",
    hint: "Écrire une nouvelle stratégie",
    template:
      "Écris une nouvelle stratégie qui prend une position LONG quand … et sort de la position quand … Écris-la avec l'outil d'écriture de script, puis exécute-la et donne-moi ses résultats.",
    group: "Scripts",
  },
  {
    key: "quant",
    label: "/quant",
    hint: "Écrire une analyse @quant sur plusieurs symboles",
    template: "Écris une analyse @quant sur les symboles … qui calcule … et renvoie le résultat par symbole.",
    group: "Scripts",
  },
  {
    key: "rapport",
    label: "/rapport",
    hint: "Générer un rapport d'entreprise",
    template: "Génère un rapport complet sur l'entreprise …",
    group: "Analyse",
  },
];

/** The `/` menu for this chart: the fixed commands, plus one reference per script and one per
 *  symbol the chart knows about — so "sur la stratégie …" can be completed by picking it rather
 *  than by remembering how it was spelled. */
export function slashCommandsFor(chart: AiChartContext, extraSymbols: string[] = []): SlashCommand[] {
  const scripts = chart.scripts.map((script) => {
    const kind = analyzeScriptKind(script.code).kind;
    const group = kind === "strategy" ? "Mes stratégies" : kind === "quant" ? "Mes analyses" : "Mes indicateurs";
    return {
      key: `script-${script.id}`,
      label: `/${script.name}`,
      hint: `${kind === "strategy" ? "Stratégie" : kind === "quant" ? "Analyse @quant" : "Indicateur"} — id ${script.id}`,
      // The id travels with the name: two scripts can share a name, and the id is what every tool
      // actually takes.
      template: `Sur le script « ${script.name} » (id ${script.id}), …`,
      group,
    };
  });

  const symbols = [...new Set([chart.symbol, ...extraSymbols].filter((s): s is string => !!s))].map((symbol) => ({
    key: `symbole-${symbol}`,
    label: `/${symbol}`,
    hint: "Symbole",
    template: `Sur ${symbol}, …`,
    group: "Symboles",
  }));

  return [...FIXED, ...scripts, ...symbols];
}

/** The `/word` being typed at the caret, if any — `null` as soon as the text stops looking like a
 *  command being written (a space, or a slash that is not at the start of the line). */
export function slashQueryAt(text: string, caret: number): { query: string; from: number } | null {
  const before = text.slice(0, caret);
  const slash = before.lastIndexOf("/");
  if (slash === -1) return null;
  // Only at the very start of the box or of a line: a slash inside a sentence is a slash.
  if (slash > 0 && before[slash - 1] !== "\n") return null;
  const query = before.slice(slash + 1);
  if (/\s/.test(query)) return null;
  return { query, from: slash };
}

/** Case- and accent-insensitive, because `/strategie` should find "/stratégie" and a user typing a
 *  script's name should not have to reproduce its capitals. */
const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function filterSlashCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  if (query === "") return commands;
  const needle = fold(query);
  return commands.filter((command) => fold(command.label).includes(needle) || fold(command.hint).includes(needle));
}
