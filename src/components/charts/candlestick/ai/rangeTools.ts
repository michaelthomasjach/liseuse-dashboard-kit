import type { AiTool } from "./aiTools";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { Candle } from "../interfaces/Candle.interface";
import type { ChartRangeAsk } from "../interfaces/ChartRangeAsk.interface";
import { DATE_DOC, fail, fmtNum, ok, parseDate, str } from "./toolHelpers";
import { candlesInRange, orderedRange, rangeStats, rangeStructure } from "../rangeAsk";

/**
 * Outils de l'assistant liés aux zones du graphique (l'outil « Interroger l'IA sur une zone » de la barre de gauche) :
 * poser, lire ou retirer la zone affichée, et chiffrer n'importe quelle période. Les chiffres viennent des bougies du
 * graphique, jamais de la mémoire du modèle.
 */

const iso = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

/** La première et la dernière bougie entre deux dates (bornes comprises), null s'il n'y en a aucune. */
function snap(data: Candle[], a: Date, b: Date): ChartRangeAsk | null {
  const { from, to } = orderedRange(a, b);
  const inside = candlesInRange(data, { from, to });
  if (inside.length === 0) return null;
  return { from: inside[0].date, to: inside[inside.length - 1].date };
}

/** Les chiffres d'une zone en quelques lignes : ouverture, clôture, variation, plus haut / plus bas datés, amplitude,
 *  volume, plus forte hausse et plus forte baisse d'une bougie. */
export function describeRange(data: Candle[], range: ChartRangeAsk): string {
  const candles = candlesInRange(data, range);
  const s = rangeStats(candles);
  if (!s) return "Aucune bougie dans cette zone.";
  let up = candles[0];
  let down = candles[0];
  for (const c of candles) {
    if (c.close - c.open > up.close - up.open) up = c;
    if (c.close - c.open < down.close - down.open) down = c;
  }
  const pct = (v: number | null) => (v === null ? "" : ` (${v >= 0 ? "+" : ""}${v.toFixed(2)} %)`);
  return [
    `Zone du ${iso(range.from)} au ${iso(range.to)} : ${s.count} bougie(s).`,
    `Ouverture ${fmtNum(s.open)}, clôture ${fmtNum(s.close)}, variation ${s.change >= 0 ? "+" : ""}${fmtNum(s.change)}${pct(s.changePct)}.`,
    `Plus haut ${fmtNum(s.high)} le ${iso(s.highAt)}, plus bas ${fmtNum(s.low)} le ${iso(s.lowAt)}, amplitude${pct(s.amplitudePct)}.`,
    `Plus forte hausse d'une bougie : ${fmtNum(up.close - up.open)} le ${iso(up.date)} ; plus forte baisse : ${fmtNum(down.close - down.open)} le ${iso(down.date)}.`,
    ...(s.volume !== null ? [`Volume total ${Math.round(s.volume)}.`] : []),
    "Structure technique :",
    ...rangeStructure(data, range, iso),
    "Pour expliquer ces chiffres : rattache chaque phase et chaque niveau à une cause datée (publication économique, banque centrale, inflation, géopolitique, résultats, échéance d'options), cherchée avec les outils d'actualité et le dossier de la période ; ne te contente pas de les répéter.",
  ].join("\n");
}

const SELECT_RANGE_TOOL: AiTool = {
  definition: {
    name: "selectionner_une_zone",
    description:
      "Pose sur le graphique une zone entre deux dates (bandeau entre deux lignes verticales, avec ses poignées et l'infobulle des questions), la lit ou la retire — comme l'outil « Interroger l'IA sur une zone » de la barre de gauche. « poser » et « lire » rendent le détail chiffré de la zone : variation, plus haut et plus bas datés, supports et résistances, plus fortes bougies, écarts, volatilité et volume comparés à avant la zone, échéances d'options proches ; la vue se déplace si la zone est hors de l'écran. Sers-t'en pour une réponse précise et expliquée, jamais pour recopier des chiffres.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["poser", "lire", "retirer"], description: "« poser » (debut et fin requis), « lire » la zone affichée, ou la « retirer »." },
        debut: { type: "string", description: DATE_DOC },
        fin: { type: "string", description: DATE_DOC },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: (input, chart) => {
    const controls = chart.controls;
    if (!controls?.setRangeAsk) return fail("Ce graphique n'affiche pas l'outil de zone.");
    const action = str(input, "action");
    if (action === "retirer") {
      controls.setRangeAsk(null);
      return ok("Zone retirée.");
    }
    if (action === "lire") {
      const current = controls.rangeAsk?.() ?? null;
      return current ? ok(describeRange(chart.data, current)) : ok("Aucune zone n'est affichée.");
    }
    const a = parseDate(str(input, "debut"));
    const b = parseDate(str(input, "fin"));
    if (!a || !b) return fail(`Il faut deux dates, debut et fin. ${DATE_DOC}`);
    const range = snap(chart.data, a, b);
    if (!range) return fail("Aucune bougie entre ces deux dates sur ce graphique (changez d'unité de temps ou de période).");
    controls.setRangeAsk(range);
    // La zone à l'écran : si l'un de ses bords sort de la vue, la vue l'encadre avec un peu de marge.
    const i0 = chart.data.findIndex((c) => c.date.getTime() === range.from.getTime());
    const i1 = chart.data.findIndex((c) => c.date.getTime() === range.to.getTime());
    const view = controls.view();
    if (i0 < view.start || i1 + 1 > view.end) {
      const pad = Math.max(3, Math.round((i1 - i0 + 1) * 0.25));
      controls.setView(Math.max(0, i0 - pad), Math.min(chart.data.length + pad, i1 + 1 + pad));
    }
    return ok(`Zone posée.\n${describeRange(chart.data, range)}`);
  },
};

const READ_RANGE_TOOL: AiTool = {
  definition: {
    name: "lire_une_zone",
    description:
      "Analyse chiffrée et détaillée d'une période du graphique : ouverture, clôture, variation, plus haut et plus bas datés, amplitude, plus fortes bougies, supports et résistances (plus hauts et plus bas locaux regroupés, nombre de contacts), écarts d'ouverture, volatilité et volume comparés à la période précédente, tendance d'avant, échéances d'options (mensuelle, quatre sorcières, VIX) autour de la période. Sans dates : la zone affichée (voir selectionner_une_zone). À combiner avec les actualités et le contexte macro pour expliquer précisément le mouvement.",
    inputSchema: {
      type: "object",
      properties: {
        debut: { type: "string", description: DATE_DOC },
        fin: { type: "string", description: DATE_DOC },
      },
      additionalProperties: false,
    },
  },
  run: (input, chart: AiChartContext) => {
    const a = parseDate(str(input, "debut"));
    const b = parseDate(str(input, "fin"));
    let range: ChartRangeAsk | null;
    if (a && b) range = snap(chart.data, a, b);
    else range = chart.controls?.rangeAsk?.() ?? null;
    if (!range) return fail(a && b ? "Aucune bougie entre ces deux dates." : "Donnez debut et fin, ou posez d'abord une zone (selectionner_une_zone).");
    return ok(describeRange(chart.data, range));
  },
};

export const RANGE_TOOLS: AiTool[] = [SELECT_RANGE_TOOL, READ_RANGE_TOOL];

/** `selectionner_une_zone` n'existe que là où l'outil de zone est affiché ; `lire_une_zone` partout. */
export function rangeToolAvailable(name: string, chart: AiChartContext): boolean | undefined {
  if (name === "selectionner_une_zone") return chart.controls?.setRangeAsk !== undefined && chart.controls.rangeAskEnabled?.() === true;
  if (name === "lire_une_zone") return true;
  return undefined;
}
