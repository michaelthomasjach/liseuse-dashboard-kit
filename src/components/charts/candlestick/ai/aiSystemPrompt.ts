import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import { analyzeScriptKind } from "../scripting/scriptKind";

/** Who the assistant is, and what it is looking at.
 *
 *  Two halves, deliberately. The first is fixed for the life of the build; the second is a snapshot
 *  of the chart at the moment of the request. Both go in the system prompt, which is what makes the
 *  whole thing cacheable — and the snapshot is short precisely so that changing it between turns
 *  costs little, while the manual (added separately, see `useAiAssistant`) stays identical and
 *  keeps its cache hit. */
const ROLE = `Tu es l'assistant intégré à un graphique boursier. Tu réponds en français, brièvement, et tu agis.

Ce que tu es capable de faire, par les outils qui te sont fournis : lire l'état du graphique, y ajouter ou retirer des indicateurs, afficher le volume, changer d'unité de temps ou de symbole, tracer des lignes et des canaux, lire les prix et les données fondamentales, lire et écrire des scripts (indicateurs, stratégies, analyses @quant) et lire ce qu'ils ont produit.

Trois règles de conduite :

1. Regarde avant d'agir. Appelle lire_le_graphique quand ta réponse dépend de ce qui est affiché — n'invente jamais le symbole courant, les indicateurs actifs ou la période couverte.
2. Agis plutôt que de décrire. Si on te demande d'afficher, de tracer ou d'écrire quelque chose, fais-le avec les outils, puis dis en une phrase ce que tu as fait. Ne rends pas du code que l'utilisateur devrait recopier lui-même : écris-le avec ecrire_un_script.
3. Dis ce que tu ne peux pas faire. Cette bibliothèque ne possède aucune source de données : les prix, les fondamentaux et la liste des symboles viennent de l'application qui l'utilise. Si une donnée manque, dis-le au lieu de la fabriquer.

Sur l'analyse de stratégies : quand on te demande d'améliorer un résultat, commence par lire le backtest (lire_le_resultat_d_un_script). Méfie-toi du surajustement et dis-le explicitement — un ratio de Sharpe amélioré en ajoutant des paramètres réglés sur l'historique n'est pas une amélioration. Privilégie ce qui se teste hors échantillon : moins de paramètres, des seuils moins précis, une gestion du risque plutôt qu'un signal d'entrée plus fin, et une vérification de la robustesse.`;

/** The chart, as a paragraph the model reads before doing anything. Short: the tools can fetch the
 *  detail, and repeating the whole history here would push the cacheable part of the prompt out of
 *  shape on every turn. */
export function describeChart(chart: AiChartContext): string {
  const first = chart.data[0];
  const last = chart.data[chart.data.length - 1];
  const lines = [
    `Symbole affiché : ${chart.symbol ?? "non renseigné"}`,
    `Unité de temps : ${chart.timeframe ?? "non renseignée"}${chart.availableTimeframes.length > 0 ? ` (disponibles : ${chart.availableTimeframes.join(", ")})` : ""}`,
    first && last
      ? `Historique : ${chart.data.length} bougies, du ${first.date.toISOString().slice(0, 10)} au ${last.date.toISOString().slice(0, 10)}, dernière clôture ${last.close}`
      : "Historique : aucune bougie",
    `Indicateurs affichés : ${chart.indicators.map((i) => `${chart.indicatorLabel(i)} (id ${i.id})`).join(", ") || "aucun"}`,
    `Dessins : ${chart.drawings().length}`,
  ];
  if (chart.scripts.length > 0) {
    lines.push(
      `Scripts : ${chart.scripts
        .map((s) => `« ${s.name} » [${analyzeScriptKind(s.code).kind}] id ${s.id}${s.enabled === false ? " (désactivé)" : ""}`)
        .join(" ; ")}`,
    );
  }
  if ((chart.fundamentals?.length ?? 0) > 0) lines.push(`Données fondamentales : ${chart.fundamentals?.length} points disponibles`);
  return lines.join("\n");
}

export function buildAiSystemPrompt(chart: AiChartContext, scriptingManual: string | null): string {
  const parts = [ROLE, `--- État du graphique ---\n${describeChart(chart)}`];
  if (scriptingManual) {
    parts.push(
      `--- Manuel du langage de scripting ---\nCe qui suit est la documentation complète du langage dans lequel tu dois écrire tout script. Respecte-la : une API que tu inventes n'existe pas.\n\n${scriptingManual}`,
    );
  }
  return parts.join("\n\n");
}
